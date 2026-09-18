/**
 * Lightweight session cookie signing/verification.
 *
 * This exists as a scaffold while there is no real auth provider or
 * database wired up (login currently checks an in-memory MOCK_USERS
 * array). It gives middleware something real to check — an HMAC-signed,
 * httpOnly cookie — instead of the unauthenticated localStorage values
 * that were being set before.
 *
 * When Supabase (or another provider) auth is wired up, everything that
 * calls `verifySessionToken()` / reads the session can stay the same —
 * only `createSessionToken()` (called from the login route) needs to be
 * replaced with the real provider's session creation.
 *
 * Uses the Web Crypto API (`crypto.subtle`) rather than Node's `crypto`
 * module so this file works unmodified in both API routes (Node runtime)
 * and middleware (Edge runtime).
 */

export type UserRole = "giver" | "organization" | "admin"

export interface SessionPayload {
  userId: string
  role: UserRole
  email: string
  fullName: string
  iat: number // issued-at, unix seconds
  exp: number // expiry, unix seconds
}

export const SESSION_COOKIE_NAME = "helplift_session"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret) return secret

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable must be set in production. " +
        "Generate one with: openssl rand -base64 32"
    )
  }

  // Dev-only fallback so the app runs without extra setup locally.
  // Every dev server restart still invalidates old cookies since this
  // is a constant, not persisted anywhere — that's fine for a scaffold.
  return "dev-only-insecure-secret-change-me"
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(input: string): Uint8Array {
  const padLength = (4 - (input.length % 4)) % 4
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

async function sign(data: string): Promise<string> {
  const key = await getHmacKey()
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
  return base64UrlEncode(new Uint8Array(signature))
}

/** Constant-time string comparison to avoid timing side-channels on the signature check. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">
): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const fullPayload: SessionPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_MAX_AGE_SECONDS,
  }

  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)))
  const signature = await sign(body)
  return `${body}.${signature}`
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null

  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, signature] = parts

  const expectedSignature = await sign(body)
  if (!timingSafeEqual(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body))
    ) as SessionPayload

    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
