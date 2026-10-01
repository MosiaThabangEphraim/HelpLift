// Email-based two-factor sign-in. Shared by api/login (sends the first
// code once the password checks out) and api/login/verify-2fa/resend. See
// 20260930000600_two_factor_login.sql for the schema this reads/writes.
import { createHash, randomBytes, randomInt } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, escapeHtml, isMailerConfigured } from "@/lib/mailer"

export const TWO_FACTOR_CODE_TTL_MS = 15 * 60 * 1000
export const TWO_FACTOR_RESEND_COOLDOWN_MS = 60 * 1000

export function hashTwoFactorCode(code: string) {
  return createHash("sha256").update(code).digest("hex")
}

function generateTwoFactorCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

// Invalidates any still-usable codes for this attempt, generates a fresh
// one, stores its hash, and emails the plaintext code. Returns the opaque
// attempt token the client must send back alongside the code - without it,
// knowing the account's email is never enough to reach a verified session.
export async function sendTwoFactorCode(profileId: string, email: string, fullName?: string | null, existingAttemptToken?: string) {
  const admin = createAdminClient()
  const attemptToken = existingAttemptToken || randomBytes(24).toString("hex")
  const code = generateTwoFactorCode()
  const now = Date.now()

  if (existingAttemptToken) {
    await admin.from("two_factor_codes").update({ consumed_at: new Date().toISOString() }).eq("attempt_token", existingAttemptToken).is("consumed_at", null)
  }
  await admin.from("two_factor_codes").insert({
    profile_id: profileId,
    attempt_token: attemptToken,
    code_hash: hashTwoFactorCode(code),
    expires_at: new Date(now + TWO_FACTOR_CODE_TTL_MS).toISOString(),
  })

  if (!isMailerConfigured()) {
    console.warn("Two-factor code email skipped - mailer not configured. Code:", code)
    return attemptToken
  }
  try {
    await sendEmail({
      to: email,
      subject: "Your HelpLift sign-in verification code",
      text: `Hi${fullName ? ` ${fullName}` : ""},\n\nEnter this code to finish signing in to HelpLift:\n\n${code}\n\nThis code expires in 15 minutes. If you didn't just try to sign in, someone else may have your password - change it once you're back in.`,
      html: `
        <p style="font-family:sans-serif;">Hi${fullName ? ` ${escapeHtml(fullName)}` : ""},</p>
        <p style="font-family:sans-serif;">Enter this code to finish signing in to HelpLift:</p>
        <p style="font-family:sans-serif;font-size:28px;font-weight:bold;letter-spacing:6px;">${code}</p>
        <p style="font-family:sans-serif;">This code expires in 15 minutes.</p>
        <p style="font-family:sans-serif;color:#475569;">If you didn't just try to sign in, someone else may have your password - change it once you're back in.</p>
      `,
    })
  } catch (err) {
    console.error("Two-factor code email error:", err)
  }
  return attemptToken
}
