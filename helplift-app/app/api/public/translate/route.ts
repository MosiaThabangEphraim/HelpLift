import { NextResponse } from "next/server"
import { generateStructured } from "@/lib/gemini"
import { clientIp, isRateLimited } from "@/lib/rate-limit"
import { TRANSLATE_LANGUAGES, languageLabel } from "@/lib/languages"

// Translates a piece of content (a need description, an impact story, a
// timeline post, a message) into one of HelpLift's languages, on request - the
// "Translate" control in components/translatable-text.tsx. Nothing is stored.
// Public, because needs and stories are read by visitors too, so it's rate
// limited per IP, capped in length, and recent results are cached in memory.

const MAX_LENGTH = 6000
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 10 * 60 * 1000
const CACHE_LIMIT = 300
const cache = new Map<string, string>()

export async function POST(request: Request) {
  try {
    const { text, language } = await request.json()
    const value = typeof text === "string" ? text.trim() : ""
    if (!value) return NextResponse.json({ message: "Nothing to translate." }, { status: 400 })
    if (value.length > MAX_LENGTH) return NextResponse.json({ message: "This text is too long to translate." }, { status: 400 })
    if (!TRANSLATE_LANGUAGES.some(option => option.code === language)) {
      return NextResponse.json({ message: "Choose a language to translate into." }, { status: 400 })
    }

    const key = `${language}:${value}`
    const cached = cache.get(key)
    if (cached) return NextResponse.json({ translation: cached })

    if (isRateLimited(`translate:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return NextResponse.json({ message: "That's a lot of translations in a row - please wait a few minutes." }, { status: 429 })
    }

    const target = languageLabel(language)
    const { translation } = await generateStructured<{ translation: string }>({
      systemPrompt: `You translate content from a South African community giving platform (HelpLift) into ${target}. Translate the user's text faithfully and naturally for everyday readers - keep its meaning, tone, line breaks, numbers, amounts (e.g. R2 000), dates, names of people, organizations and places unchanged. Do not add, explain or summarise anything. If the text is already in ${target}, return it as it is.`,
      parts: [{ text: value }],
      schema: {
        type: "object",
        properties: { translation: { type: "string" } },
        required: ["translation"],
      },
    })
    const result = (translation || "").trim()
    if (!result) throw new Error("empty translation")

    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
    cache.set(key, result)
    return NextResponse.json({ translation: result })
  } catch (error) {
    console.error("Translate error:", error)
    return NextResponse.json({ message: "Couldn't translate this right now. Please try again in a moment." }, { status: 503 })
  }
}
