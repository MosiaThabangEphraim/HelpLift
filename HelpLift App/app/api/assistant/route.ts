// HelpLift App/app/api/assistant/route.ts
import { NextResponse } from "next/server"

const SYSTEM_PROMPT = `
You are the HelpLift Assistant, a knowledgeable, concise, and friendly AI guide for the HelpLift platform.

About HelpLift:
- HelpLift is a transparent platform connecting verified non-profit organizations with passionate givers and donors.
- Core Roles:
  1. Givers: Individuals or companies who browse community needs, express interest in helping, donate funds (via EFT, PayFast, or PayPal), and pledge physical goods or professional services to the Gift Library.
  2. Organizations: Registered NPOs and community initiatives that upload verification compliance documents, publish community needs, claim items from the Gift Library, and manage wallet withdrawals.
  3. Admins: Platform moderators who review verification documents, approve needs and gift claims, audit donations, and review withdrawal requests.

Key Navigation & Pages:
- Sign Up / Register: /register (choose between Giver or Organization account)
- Login: /login (or /admin-login for administrators)
- Community Needs Board: /needs (browse open needs by category, urgency, or location)
- Gift Library: /gift-library (in-kind goods and services available for organizations to claim)
- Partner With Us / Contact: Contact form on the homepage

Instructions:
- Keep answers concise, actionable, empathetic, and friendly.
- Suggest exact page paths (e.g. "/register" or "/needs") when relevant.
- Do not invent non-existent features or speculative partners.
- If asked unrelated technical or general knowledge questions, politely guide the conversation back to HelpLift.
`

// Active modern Gemini models on v1beta.
// gemini-2.5-flash-lite is prioritized first to bypass high-demand spikes.
const CANDIDATE_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
]

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { message: "GEMINI_API_KEY is not configured in .env.local." },
        { status: 500 }
      )
    }

    // 1. Sanitize history: Filter out connection errors and welcome prompts
    const rawList = (messages || []).filter(
      (m: { role: string; text: string }) =>
        m &&
        m.text &&
        !m.text.includes("Could not fetch a response") &&
        !m.text.includes("trouble connecting right now") &&
        !m.text.includes("experiencing high demand") &&
        !m.text.includes("is not found for API version")
    )

    if (rawList.length > 0 && rawList[0].role === "assistant") {
      rawList.shift()
    }

    // 2. Format conversation history ensuring strict user <-> model turn alternation
    const conversationHistory: { role: "user" | "model"; parts: { text: string }[] }[] = []

    for (const msg of rawList) {
      const targetRole: "user" | "model" = msg.role === "assistant" ? "model" : "user"

      if (
        conversationHistory.length > 0 &&
        conversationHistory[conversationHistory.length - 1].role === targetRole
      ) {
        conversationHistory[conversationHistory.length - 1].parts[0].text += `\n${msg.text}`
      } else {
        conversationHistory.push({
          role: targetRole,
          parts: [{ text: msg.text }],
        })
      }
    }

    if (conversationHistory.length === 0) {
      return NextResponse.json({
        reply: "Hi there! I'm your HelpLift Assistant. How can I help you navigate our giving platform today?",
      })
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: conversationHistory,
    }

    let lastErrorMessage = "Service temporarily unavailable"

    // 3. Fallback loop across active models
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey.trim(),
            },
            body: JSON.stringify(payload),
          }
        )

        if (response.ok) {
          const data = await response.json()
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (reply) {
            return NextResponse.json({ reply })
          }
        }

        const errData = await response.json().catch(() => ({}))
        lastErrorMessage = errData.error?.message || `Model ${model} returned status ${response.status}`
        console.warn(`Model ${model} failed, trying next candidate... Reason:`, lastErrorMessage)
      } catch (networkErr: any) {
        lastErrorMessage = networkErr.message
        console.warn(`Network error on ${model}, trying next candidate...`)
      }
    }

    return NextResponse.json({ message: lastErrorMessage }, { status: 503 })
  } catch (err: any) {
    console.error("Assistant route error:", err)
    return NextResponse.json(
      { message: err.message || "Failed to process message." },
      { status: 500 }
    )
  }
}