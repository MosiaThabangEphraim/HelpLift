import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, insufficientRoleMessage, roleAtLeast } from "@/lib/organization-access"
import { getActiveCategoryNames } from "@/lib/need-categories"
import { generateStructured } from "@/lib/gemini"
import { isRateLimited } from "@/lib/rate-limit"

// AI need writer: turns an organization's rough sentence ("we need about 30
// pairs of school shoes for grade 1s before January") into a filled-in need
// form - title, description, category, urgency, quantity, due date, location.
// It only drafts: nothing is saved here. The organization reviews and edits
// the form, then submits it through the normal flow (admin approval included),
// and the existing duplicate check runs on the drafted title as usual.

const MAX_INPUT_LENGTH = 1000
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000
const URGENCIES = ["low", "medium", "high"] as const

type Draft = {
  title: string
  description: string
  category: string
  urgency: string
  quantity: string
  due_date: string
  location: string
  target_amount: number | null
}

function todayInSouthAfrica() {
  // en-CA formats as YYYY-MM-DD.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })
    const ctx = await getOrgContext<{ id: string; name: string; city: string | null; province: string | null }>(supabase, user.id, "id, name, city, province")
    if (!ctx?.organization) return NextResponse.json({ message: "Organization not found." }, { status: 404 })
    // Same bar as creating a need: managers and owners only.
    if (!roleAtLeast(ctx.role, "manager")) return NextResponse.json({ message: insufficientRoleMessage(ctx.role, "manager") }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (text.length < 5) return NextResponse.json({ message: "Describe the need in a sentence or two first." }, { status: 400 })
    if (text.length > MAX_INPUT_LENGTH) return NextResponse.json({ message: `Please keep it under ${MAX_INPUT_LENGTH} characters.` }, { status: 400 })

    if (isRateLimited(`need-draft:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ message: "That's a lot of drafts in a row - please wait a minute and try again." }, { status: 429 })
    }

    const categories = await getActiveCategoryNames(supabase)
    const org = ctx.organization
    const orgLocation = [org.city, org.province].filter(Boolean).join(", ")
    const today = todayInSouthAfrica()

    const systemPrompt = `You help South African non-profit organizations post needs on HelpLift, a giving platform.
Turn the organization's rough description into a clear, honest need listing for givers.
Today's date is ${today}. The organization is "${org.name}"${orgLocation ? `, based in ${orgLocation}` : ""}.

Rules:
- title: short and specific, max 80 characters, ideally with the quantity (e.g. "30 Pairs of School Shoes for Grade 1 Learners").
- description: 2-4 warm, factual sentences: what is needed, who benefits and why. Use ONLY facts stated in the input. Never add details that weren't given - no colours, sizes, brands, ages, names, reasons, requirements or stories. If the input is short, keep the description short.
- category: exactly one of the allowed categories, whichever fits best.
- urgency: "high" if they say urgent/critical/as soon as possible or the deadline is within about 2 weeks; "low" if there's no time pressure; otherwise "medium".
- quantity: the amount with its unit (e.g. "30 pairs"), or "" if none is given.
- due_date: YYYY-MM-DD, or "" if no deadline is stated. "By/before <month>" means the LAST day of the month before it (e.g. "before January" = 31 December); "by <month>" or "in <month>" means the last day of that month; always the next such date after today. Never a date before today.
- location: only a place explicitly named in the input, otherwise "". Do not guess or use a country.
- target_amount: a Rand amount only if they explicitly mention money needed, otherwise null.
Write in English even if the input is in another language.`

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string", enum: categories },
        urgency: { type: "string", enum: [...URGENCIES] },
        quantity: { type: "string" },
        due_date: { type: "string" },
        location: { type: "string" },
        target_amount: { type: "number", nullable: true },
      },
      required: ["title", "description", "category", "urgency", "quantity", "due_date", "location", "target_amount"],
    }

    let draft: Draft
    try {
      draft = await generateStructured<Draft>({ systemPrompt, parts: [{ text }], schema })
    } catch (err) {
      console.error("Need draft generation failed:", err)
      return NextResponse.json({ message: "Lifty couldn't draft this right now. Please try again in a moment, or fill in the form yourself." }, { status: 503 })
    }

    // The model's output is a suggestion - tidy and validate it before it reaches the form.
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.due_date || "") && !Number.isNaN(Date.parse(draft.due_date)) && draft.due_date >= today ? draft.due_date : ""
    // Keep a location only if the organization actually named it; otherwise use their own.
    const namedLocation = String(draft.location || "").trim().slice(0, 120)
    const location = namedLocation && text.toLowerCase().includes(namedLocation.toLowerCase()) ? namedLocation : orgLocation
    const amount = typeof draft.target_amount === "number" && Number.isFinite(draft.target_amount) && draft.target_amount > 0 ? Math.round(draft.target_amount) : null

    return NextResponse.json({
      draft: {
        title: String(draft.title || "").trim().slice(0, 120),
        description: String(draft.description || "").trim().slice(0, 2000),
        category: categories.includes(draft.category) ? draft.category : "",
        urgency: (URGENCIES as readonly string[]).includes(draft.urgency) ? draft.urgency : "medium",
        quantity: String(draft.quantity || "").trim().slice(0, 80),
        due_date: dueDate,
        location,
        target_amount: amount === null ? "" : String(amount),
      },
    })
  } catch (error) {
    console.error("Need draft route error:", error)
    return NextResponse.json({ message: "Lifty couldn't draft this right now. Please try again in a moment." }, { status: 500 })
  }
}
