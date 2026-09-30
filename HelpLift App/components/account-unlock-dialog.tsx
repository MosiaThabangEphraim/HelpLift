"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Shown by both /login and /admin-login when api/login responds with
// locked:true (5 incorrect password attempts in a row). Verifies the code
// api/login already emailed via lockAccountAndSendCode(); on success the
// person is told to sign in again - this only clears the lockout, it
// doesn't itself sign anyone in, since no password has been confirmed yet.
export function AccountUnlockDialog({
  open,
  email,
  onOpenChange,
  onUnlocked,
}: {
  open: boolean
  email: string
  onOpenChange: (open: boolean) => void
  onUnlocked: () => void
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
      const res = await fetch("/api/login/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || "That code is incorrect or has expired.")
      onUnlocked()
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
      const res = await fetch("/api/login/unlock/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
            <MailCheck className="h-5 w-5 text-blue-600 shrink-0" /> Account locked
          </DialogTitle>
          <DialogDescription>
            Too many incorrect password attempts. Enter the verification code we emailed to <span className="font-semibold">{email}</span> to unlock your account.
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
            Unlock account
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
