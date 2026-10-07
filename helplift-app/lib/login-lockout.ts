// Shared by api/login (locks the account on the 5th failed attempt) and
// api/login/unlock/resend (sends a fresh code while already locked). See
// 20260930000400_login_lockout.sql for the schema this reads/writes.
import { createHash, randomInt } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, escapeHtml, isMailerConfigured } from "@/lib/mailer"

export const MAX_LOGIN_ATTEMPTS = 5
// The account stays locked for up to this long even if the emailed code is
// never entered - a safety cap, not the normal path out (the code is).
export const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000
export const UNLOCK_CODE_TTL_MS = 15 * 60 * 1000
export const RESEND_COOLDOWN_MS = 60 * 1000

export function hashUnlockCode(code: string) {
  return createHash("sha256").update(code).digest("hex")
}

function generateUnlockCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

// Sets/refreshes the lockout window, stores a freshly generated code's hash,
// and emails the plaintext code. Best-effort on the email - a mailer outage
// shouldn't be what throws here, since the lock itself still needs to apply.
export async function lockAccountAndSendCode(profileId: string, email: string, fullName?: string | null) {
  const admin = createAdminClient()
  const code = generateUnlockCode()
  const now = Date.now()

  await admin.from("profiles").update({ locked_until: new Date(now + LOCKOUT_DURATION_MS).toISOString() }).eq("id", profileId)
  await admin.from("login_lockout_codes").insert({
    profile_id: profileId,
    code_hash: hashUnlockCode(code),
    expires_at: new Date(now + UNLOCK_CODE_TTL_MS).toISOString(),
  })

  if (!isMailerConfigured()) {
    console.warn("Lockout code email skipped - mailer not configured. Code:", code)
    return
  }
  try {
    await sendEmail({
      to: email,
      subject: "Your HelpLift account has been locked",
      text: `Hi${fullName ? ` ${fullName}` : ""},\n\nToo many incorrect password attempts were made on your HelpLift account, so it's been temporarily locked.\n\nYour verification code is: ${code}\n\nEnter it on the sign-in page to unlock your account. This code expires in 15 minutes.\n\nIf this wasn't you, change your password once you're back in.`,
      html: `
        <p style="font-family:sans-serif;">Hi${fullName ? ` ${escapeHtml(fullName)}` : ""},</p>
        <p style="font-family:sans-serif;">Too many incorrect password attempts were made on your HelpLift account, so it's been temporarily locked.</p>
        <p style="font-family:sans-serif;">Your verification code is:</p>
        <p style="font-family:sans-serif;font-size:28px;font-weight:bold;letter-spacing:6px;">${code}</p>
        <p style="font-family:sans-serif;">Enter it on the sign-in page to unlock your account. This code expires in 15 minutes.</p>
        <p style="font-family:sans-serif;color:#475569;">If this wasn't you, change your password once you're back in.</p>
      `,
    })
  } catch (err) {
    console.error("Lockout code email error:", err)
  }
}
