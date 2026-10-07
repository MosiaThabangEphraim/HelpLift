import { NextResponse } from "next/server"
import { readUploadedFile, readUploadedFiles, isStagedReference } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { createClient } from "@/lib/supabase/server"
import { getActiveCategoryNames } from "@/lib/need-categories"
import { needSimilarity } from "@/lib/need-similarity"
import { generateStructured } from "@/lib/gemini"
import { isRateLimited } from "@/lib/rate-limit"

// Snap to pledge: a giver photographs items they want to give, Gemini's vision
// identifies them and drafts the Gift Library pledge (title, description,
// type, quantity), and we suggest open needs the items could help with.
//
// Nothing is saved here and the photo isn't stored - it's only sent to Gemini
// for analysis. The giver reviews the drafted form and submits it through the
// normal pledge flow (admin review included); the photo is attached there.
// Matching uses the giver's own session, so only needs they could see on the
// public board are suggested.

const MAX_BYTES = 5 * 1024 * 1024 // the client compresses first; this is a safety cap
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000
const MATCH_THRESHOLD = 0.3
const MAX_MATCHES = 3

type PhotoAnalysis = {
  is_donatable: boolean
  reason: string
  title: string
  description: string
  offering_type: "goods" | "services"
  quantity: string
  category: string
  keywords: string[]
}

// Checks the file really is the image type it claims (magic bytes).
async function hasImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  return isJpeg || isPng || isWebp
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "giver") return NextResponse.json({ message: "Only givers can pledge offerings." }, { status: 403 })

    const formData = await request.formData()
    const photo = await readUploadedFile(formData, "photo")
    if (!(photo instanceof File) || photo.size === 0) return NextResponse.json({ message: "Take or choose a photo first." }, { status: 400 })
    if (!ALLOWED_TYPES.includes(photo.type) || !(await hasImageSignature(photo))) {
      return NextResponse.json({ message: "Use a JPG, PNG or WebP photo." }, { status: 400 })
    }
    if (photo.size > MAX_BYTES) return NextResponse.json({ message: "That photo is too large - try a smaller one." }, { status: 400 })

    if (isRateLimited(`photo-pledge:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ message: "That's a lot of photos in a row - please wait a minute and try again." }, { status: 429 })
    }

    const categories = await getActiveCategoryNames(supabase)
    const systemPrompt = `You help givers on HelpLift, a South African giving platform, pledge items to the Gift Library for verified non-profits.
Look at the photo and describe what is being offered.

Rules:
- is_donatable: false if the photo shows nothing that could reasonably be donated (e.g. a selfie, a screenshot, a blank wall, or anything unsafe or inappropriate to donate); then explain briefly in "reason" and leave the other text fields empty.
- title: short and specific, max 80 characters, with the count if visible (e.g. "12 Exercise Books").
- description: 1-3 factual sentences on what the items are and their visible condition. Only describe what you can see; never invent brands, ages or history.
- offering_type: "goods" for physical items; "services" only if the photo clearly shows a service offer (e.g. a flyer for tutoring).
- quantity: your best count with a unit (e.g. "about 12 books"); say "about" when you can't count exactly.
- category: the best-fitting need category from the allowed list.
- keywords: 3-8 simple English words for the items (e.g. ["school", "bag", "backpack"]) used to match open needs.`

    const schema = {
      type: "object",
      properties: {
        is_donatable: { type: "boolean" },
        reason: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        offering_type: { type: "string", enum: ["goods", "services"] },
        quantity: { type: "string" },
        category: { type: "string", enum: categories },
        keywords: { type: "array", items: { type: "string" } },
      },
      required: ["is_donatable", "reason", "title", "description", "offering_type", "quantity", "category", "keywords"],
    }

    let analysis: PhotoAnalysis
    try {
      const data = Buffer.from(await photo.arrayBuffer()).toString("base64")
      analysis = await generateStructured<PhotoAnalysis>({
        systemPrompt,
        parts: [{ inline_data: { mime_type: photo.type, data } }, { text: "What is being offered in this photo?" }],
        schema,
      })
    } catch (err) {
      console.error("Photo pledge analysis failed:", err)
      return NextResponse.json({ message: "Lifty couldn't look at this photo right now. Please try again, or fill in the form yourself." }, { status: 503 })
    }

    if (!analysis.is_donatable) {
      return NextResponse.json({
        donatable: false,
        message: analysis.reason?.trim() || "Lifty couldn't spot anything to pledge in this photo. Try a clearer photo of the items.",
      })
    }

    const draft = {
      title: String(analysis.title || "").trim().slice(0, 120),
      description: String(analysis.description || "").trim().slice(0, 2000),
      offering_type: analysis.offering_type === "services" ? "services" : "goods",
      quantity_or_value: String(analysis.quantity || "").trim().slice(0, 80),
    }
    const category = categories.includes(analysis.category) ? analysis.category : ""
    const keywords = (Array.isArray(analysis.keywords) ? analysis.keywords : []).map(String).slice(0, 8)

    // Suggest open needs these items could help with - same similarity scoring
    // as the organizations' duplicate-need check, with the keywords added in.
    const { data: openNeeds } = await supabase
      .from("needs")
      .select("id, title, description, category, location, urgency, organizations(name, logo_url, verification_status)")
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(300)

    const probe = { title: `${draft.title} ${keywords.join(" ")}`, description: draft.description, category }
    const matches = (openNeeds || [])
      .filter((need: any) => firstOf<any>(need.organizations)?.verification_status === "approved")
      .map((need: any) => ({ need, score: needSimilarity(probe, need) }))
      .filter(entry => entry.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MATCHES)
      .map(({ need }) => {
        const org = firstOf<any>(need.organizations)
        return {
          id: need.id,
          title: need.title,
          location: need.location,
          urgency: need.urgency,
          organization: { name: org?.name || "Verified organization", logo_url: org?.logo_url || null },
          link: `/needs?need=${need.id}`,
        }
      })

    return NextResponse.json({ donatable: true, draft, category, matches })
  } catch (error) {
    console.error("Photo pledge route error:", error)
    return NextResponse.json({ message: "Lifty couldn't look at this photo right now. Please try again in a moment." }, { status: 500 })
  }
}
