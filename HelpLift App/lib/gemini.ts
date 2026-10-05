// Shared Gemini helpers for HelpLift's AI features (Lifty in app/api/assistant,
// the need writer and snap-to-pledge). Server-only: reads GEMINI_API_KEY.

// Gemini models in fallback order. Google now steers new API keys to the 3.x
// models ("gemini-2.5-* is no longer available to new users"); the 2.5 models
// stay last for older keys that still have access.
export const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
]

export class GeminiError extends Error {}

export function geminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || null
}

export type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

// Asks Gemini for a JSON object matching `schema` (an OpenAPI-style response
// schema), trying each model in turn. Throws GeminiError when every model
// fails - callers log it and show their own friendly message.
export async function generateStructured<T>({
  systemPrompt,
  parts,
  schema,
}: {
  systemPrompt: string
  parts: GeminiPart[]
  schema: Record<string, unknown>
}): Promise<T> {
  const apiKey = geminiApiKey()
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not configured.")

  let lastError = "No model available"
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema },
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new GeminiError(errData.error?.message || `status ${response.status}`)
      }
      const data = await response.json()
      const text = (data.candidates?.[0]?.content?.parts || [])
        .filter((part: any) => typeof part.text === "string" && !part.thought)
        .map((part: any) => part.text)
        .join("")
      if (!text) throw new GeminiError("empty response")
      return JSON.parse(text) as T
    } catch (err: any) {
      lastError = err?.message || String(err)
      console.warn(`Gemini model ${model} failed, trying next candidate. Reason:`, lastError)
    }
  }
  throw new GeminiError(lastError)
}
