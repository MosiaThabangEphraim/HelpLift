import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Records one site visit (see components/site-visit-tracker.tsx and
// 20260928000600_site_visits.sql). Deliberately public/unauthenticated -
// most visitors browsing the public site aren't signed in - and never lets
// a tracking failure surface as an error to the page that called it.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { visitorId, sessionId, path } = body || {}
    if (typeof visitorId !== "string" || typeof sessionId !== "string" || !visitorId || !sessionId) {
      return NextResponse.json({ success: false }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from("site_visits").insert({
      visitor_id: visitorId.slice(0, 100),
      session_id: sessionId.slice(0, 100),
      path: typeof path === "string" ? path.slice(0, 300) : null,
    })
    // A duplicate session_id (a retried beacon for the same tab) is expected
    // and fine to ignore - the unique index is what prevents double counting.
    // Anything else is a real failure - surfaced with a proper error status
    // (never thrown - a non-2xx response can't break the page that called
    // this) so it shows up in the browser console instead of vanishing.
    if (error && !error.message.toLowerCase().includes("duplicate key")) {
      console.warn("track-visit warning (has its migration been applied?):", error.message)
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("track-visit error:", error)
    return NextResponse.json({ success: false, message: error?.message || "Tracking failed." }, { status: 500 })
  }
}
