import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Password reset email contains a clickable link — BUT only if Supabase's
 * email template is configured correctly. See:
 *   /supabase/email-templates/README.md
 * The template must wrap {{ .ConfirmationURL }} in <a href="..."> tags
 * to render a clickable Reset Password button (and a backup plain link).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    if (body.action === "request") {
      if (!body.email) return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 })
      const baseUrl = new URL(req.url)
      const redirectTo = `${baseUrl.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(body.email, { redirectTo })
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
      return NextResponse.json({ success: true, message: "If an account exists, a reset link has been sent." })
    }

    if (body.action === "verify") {
      if (!body.password || body.password.length < 8) return NextResponse.json({ success: false, message: "Password must be at least 8 characters." }, { status: 400 })
      const { error } = await supabase.auth.updateUser({ password: body.password })
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })
      return NextResponse.json({ success: true, message: "Password updated successfully." })
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 })
  } catch (error) {
    console.error("Supabase password error:", error)
    return NextResponse.json({ success: false, message: "Password recovery is unavailable right now." }, { status: 503 })
  }
}
