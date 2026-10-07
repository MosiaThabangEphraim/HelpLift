// Helpers for passkey (WebAuthn) sign-in: fingerprint, face or device PIN.
// The ceremony itself is handled by Supabase Auth (supabase.auth.signInWithPasskey /
// registerPasskey), which is switched on for the browser client in lib/supabase/client.ts.

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined" && !!navigator.credentials
}

// Turns a WebAuthn / browser error into a sentence a person can act on.
export function passkeyErrorMessage(error: unknown, context: "signin" | "register" = "register"): string {
  const e = error as { name?: string; code?: string; message?: string } | null
  const code = e?.code
  const name = e?.name
  const message = e?.message || ""

  if (code === "ERROR_CEREMONY_ABORTED" || name === "NotAllowedError" || name === "AbortError") {
    // When signing in, the browser reports "no passkey found" and "you closed the prompt" the same
    // way, so say what to do if it's the former.
    return context === "signin"
      ? "No passkey was used. If you haven't set one up on this device yet, sign in with your password or Google first, then add a passkey in Settings to use it next time."
      : "That was cancelled or timed out. Please try again."
  }
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || name === "InvalidStateError") {
    return "This device already has a passkey for your account."
  }
  if (code === "ERROR_INVALID_RP_ID" || code === "ERROR_INVALID_DOMAIN" || name === "SecurityError") {
    return "Passkeys only work on the exact website address they were set up for. Open HelpLift from that address and try again."
  }
  if (code === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT" || code === "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT") {
    return "This device can't verify you with a fingerprint, face or PIN, so it can't be used for a passkey."
  }
  return message || "Passkey sign-in didn't work. Please try again or use your password."
}

// A readable name for the passkey being created, e.g. "Chrome on Windows", so
// people can tell their devices apart in the list.
export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "This device"
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser"
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad|iPod/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "this device"
  return `${browser} on ${os}`
}
