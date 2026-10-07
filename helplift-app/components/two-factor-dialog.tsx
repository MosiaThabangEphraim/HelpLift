"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type TwoFactorUser = { id: string; email: string; fullName: string; role: string }

// Shown by both /login and /admin-login when api/login responds with
// twoFactorRequired:true (the account has two-factor sign-in on). Verifies
// the code against the attempt token api/login handed back - submitting
// completes the sign-in itself (api/login/verify-2fa mints the real
// session), so onVerified gets the same user shape a normal login does and
// the page can finish exactly as if the password step alone had succeeded.
export function TwoFactorDialog({
  open,
  email,
  attemptToken,
  adminPortal,
  onOpenChange,
  onVerified,
}: {
  open: boolean
  email: string
  attemptToken: string
  adminPortal?: boolean
  onOpenChange: (open: boolean) => void
  onVerified: (user: TwoFactorUser) => void
}) {
  const [code, setCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [resendMessage, setResendMessage] = useState("")

  useEffect(() => {
    if (open) {
      setCode("")
      setError("")
      setResendMessage("")
    }
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptToken, code, adminPortal }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || "That code is incorrect or has expired.")
      onVerified(data.user)
    } catch (err: any) {
      setError(err.message || "That code is incorrect or has expired.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resend = async () => {
    setIsResending(true)
    setError("")
    setResendMessage("")
    try {
      const res = await fetch("/api/login/verify-2fa/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptToken }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || "Could not resend the code.")
      setResendMessage("A new code has been sent to your email.")
    } catch (err: any) {
      setError(err.message || "Could not resend the code.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" /> Verify it's you
          </DialogTitle>
          <DialogDescription>
            Enter the verification code we emailed to <span className="font-semibold">{email}</span> to finish signing in.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          {error && (
            <div className="flex items-center gap-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {resendMessage && (
            <div className="flex items-center gap-2 rounded border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {resendMessage}
            </div>
          )}

          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={e => setCode(e.target.value)}
            data-tip="The verification code from the email we just sent you"
            className="h-12 text-center font-mono text-lg tracking-[0.5em]"
            maxLength={6}
            required
            autoFocus
          />

          <Button type="submit" disabled={isSubmitting || code.trim().length === 0} className="w-full h-11 font-bold">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify and sign in
          </Button>

          <button
            type="button"
            onClick={resend}
            disabled={isResending}
            data-tip="Send a new code if the last one expired or didn't arrive"
            className="w-full text-center text-sm font-semibold text-blue-600 hover:underline disabled:opacity-60"
          >
            {isResending ? "Sending..." : "Didn't get a code? Resend"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
