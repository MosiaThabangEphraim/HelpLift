// Shared password strength rules — used by the registration form's live
// checklist (components/password-requirements.tsx) and mirrored server-side
// in api/register/route.ts so the two can never drift out of sync.
export const PASSWORD_REQUIREMENTS = [
  { key: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { key: "uppercase", label: "One uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lowercase", label: "One lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "One number (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { key: "special", label: "One special character (e.g. ! @ # $ %)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every(req => req.test(password))
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
