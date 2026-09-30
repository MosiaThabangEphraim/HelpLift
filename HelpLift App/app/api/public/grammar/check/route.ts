import { NextResponse } from "next/server"
import { checkGrammar } from "@/lib/harper"

// Grammar/spelling check backed by Harper (lib/harper.ts) - runs entirely
// on this server via WebAssembly, no external API, no per-request cost.
// Deliberately public/unauthenticated: it's used on the homepage's "Partner
// with us" contact form too (reachable by anonymous visitors), and Harper
// has no sensitive data access or billed usage to justify gating it behind
// login - unlike the AI-polish feature considered earlier, there's no cost
// or abuse-surface reason to restrict this. Returns plain, JSON-serializable
// issue data - the client applies a chosen suggestion itself (simple string
// splicing on the given span) and re-checks, rather than round-tripping
// WASM objects.
export async function POST(request: Request) {
  try {
    const { text } = await request.json()
    const value = typeof text === "string" ? text : ""
    if (!value.trim()) return NextResponse.json({ issues: [] })
    if (value.length > 10000) return NextResponse.json({ message: "Text is too long to check (10,000 characters max)." }, { status: 400 })

    const issues = await checkGrammar(value)
    return NextResponse.json({ issues })
  } catch (error) {
    console.error("Grammar check error:", error)
    return NextResponse.json({ message: "Could not check this text right now." }, { status: 503 })
  }
}
