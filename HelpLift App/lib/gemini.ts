// Shared Gemini helpers for HelpLift's AI features (Lifty in app/api/assistant,
// the need writer and snap-to-pledge). Server-only: reads GEMINI_API_KEY.

// Gemini models in fallback order: the fast "lite" model first, the larger
// one as backup. The 2.5 models were removed - Google no longer offers them to
// new API keys ("no longer available to new users"), so they only wasted time.
export const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
]

export class GeminiError extends Error {}

// --- Speed ------------------------------------------------------------------
// One slow or stuck model must not hold up an answer, so every call has a
// time limit, after which the next model is tried.
export const GEMINI_TIMEOUT_MS = 25_000

// Models that recently failed go to the back of the line for a while, so a
// model that's down (or not available to this API key) only costs time once,
// not on every question. Otherwise the order in GEMINI_MODELS always holds -
// the fast model first - even if the slower backup answered last time.
// Per server instance.
const FAILED_FOR_MS = 10 * 60 * 1000
const failedAt = new Map<string, number>()

/** GEMINI_MODELS in order, with recently failed ones moved to the end. */
export function modelsInOrder() {
  const now = Date.now()
  const recentlyFailed = (model: string) => (failedAt.get(model) ?? 0) > now - FAILED_FOR_MS
  return [...GEMINI_MODELS].sort((a, b) => Number(recentlyFailed(a)) - Number(recentlyFailed(b)))
}

export function markModelWorked(model: string) {
  failedAt.delete(model)
}

export function markModelFailed(model: string) {
  failedAt.set(model, Date.now())
}

// Gemini "thinks" before answering by default, which adds seconds and isn't
// needed for help questions or form filling. Settings are tried from fastest
// to safest: Gemini 3 "minimal", then "low", then the model's default. The
// first one a model accepts is remembered, so a rejected setting only costs
// one extra request per server instance.
const THINKING_OPTIONS: (Record<string, unknown> | null)[] = [
  { thinkingConfig: { thinkingLevel: "minimal" } },
  { thinkingConfig: { thinkingLevel: "low" } },
  null, // the model's own default
]
const acceptedThinking = new Map<string, number>()

/**
 * fetch() for a Gemini call, with the time limit and the fastest thinking
 * setting the model accepts.
 */
export async function geminiFetch(model: string, apiKey: string, body: Record<string, any>) {
  const send = (payload: Record<string, any>) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    })
  try {
    for (let option = acceptedThinking.get(model) ?? 0; option < THINKING_OPTIONS.length; option++) {
      const thinking = THINKING_OPTIONS[option]
      const payload = thinking ? { ...body, generationConfig: { ...(body.generationConfig || {}), ...thinking } } : body
      const response = await send(payload)
      if (response.status === 400 && thinking) {
        const errData = await response.clone().json().catch(() => ({}))
        if (/thinking/i.test(errData.error?.message || "")) continue // try the next setting
      }
      acceptedThinking.set(model, option)
      return response
    }
    return await send(body)
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new GeminiError(`${model} took longer than ${GEMINI_TIMEOUT_MS / 1000}s`)
    }
    throw err
  }
}

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
  for (const model of modelsInOrder()) {
    try {
      const response = await geminiFetch(model, apiKey, {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
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
      const result = JSON.parse(text) as T
      markModelWorked(model)
      return result
    } catch (err: any) {
      markModelFailed(model)
      lastError = err?.message || String(err)
      console.warn(`Gemini model ${model} failed, trying next candidate. Reason:`, lastError)
    }
  }
  throw new GeminiError(lastError)
}
