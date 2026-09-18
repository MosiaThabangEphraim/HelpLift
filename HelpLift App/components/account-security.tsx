"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

const fieldClass = "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"

/**
 * Two-step email change: request (calls updateUser({ email }), which makes
 * Supabase send a confirmation code to the new address using the "Change
 * Email Address" template) then verify (verifyOtp with type "email_change").
 * If "Secure email change" is enabled in Supabase, a code may also be sent to
 * the OLD address — Supabase's own error message will say so if this single
 * code isn't sufficient; this UI doesn't need to special-case that.
 */
export function ChangeEmailFlow({ currentEmail, onBack, onUpdated }: { currentEmail: string; onBack: () => void; onUpdated: (newEmail: string) => void }) {
  const supabase = createClient()
  const [step, setStep] = useState<"request" | "code">("request")
  const [newEmail, setNewEmail] = useState("")
  const [code, setCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleRequest = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    if (!newEmail.trim() || newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      return setError("Enter a different email address.")
    }
    setIsSubmitting(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (err) throw err
      setStep("code")
    } catch (err: any) {
      setError(err.message || "Unable to start email change.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    if (!code.trim()) return setError("Enter the verification code from your email.")
    setIsSubmitting(true)
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email: newEmail.trim(), token: code.trim(), type: "email_change" })
      if (err) throw err
      onUpdated(newEmail.trim())
    } catch (err: any) {
      setError(err.message || "Invalid or expired code.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to profile
      </button>
      {error && <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>}

      {step === "request" ? (
        <form onSubmit={handleRequest} className="space-y-3">
          <div className="space-y-1">
            <Label>Current email</Label>
            <Input value={currentEmail} readOnly className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-email">New email address</Label>
            <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@example.com" required />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Send verification code
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            We sent a code to <span className="font-bold text-slate-700 dark:text-slate-200">{newEmail}</span>. Enter it below to confirm the change.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Verification code"
            required
            className={`${fieldClass} text-center text-lg font-bold tracking-[0.3em]`}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}Confirm new email
          </Button>
        </form>
      )}
    </div>
  )
}

/**
 * Password change gated by an emailed one-time code, using Supabase's
 * reauthenticate() (sends a nonce via the "Reauthentication" template) plus
 * updateUser({ password, nonce }).
 */
export function ChangePasswordFlow({ onBack, onUpdated }: { onBack: () => void; onUpdated: () => void }) {
  const supabase = createClient()
  const [step, setStep] = useState<"request" | "confirm">("request")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [code, setCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleRequestCode = async () => {
    setError("")
    setIsSubmitting(true)
    try {
      const { error: err } = await supabase.auth.reauthenticate()
      if (err) throw err
      setStep("confirm")
    } catch (err: any) {
      setError(err.message || "Unable to send verification code.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirm = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    if (newPassword.length < 8) return setError("Password must be at least 8 characters.")
    if (newPassword !== confirmPassword) return setError("Passwords do not match.")
    if (!code.trim()) return setError("Enter the verification code from your email.")

    setIsSubmitting(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword, nonce: code.trim() })
      if (err) throw err
      onUpdated()
    } catch (err: any) {
      setError(err.message || "Unable to update password.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to profile
      </button>
      {error && <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>}

      {step === "request" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            For your security, changing your password requires a verification code sent to your email.
          </p>
          <Button type="button" onClick={handleRequestCode} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Send verification code
          </Button>
        </div>
      ) : (
        <form onSubmit={handleConfirm} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="account-new-password">New password</Label>
            <Input id="account-new-password" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="account-confirm-password">Confirm new password</Label>
            <Input id="account-confirm-password" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="account-password-code">Verification code</Label>
            <input
              id="account-password-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code from your email"
              required
              className={`${fieldClass} text-center text-lg font-bold tracking-[0.3em]`}
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}Update password
          </Button>
        </form>
      )}
    </div>
  )
}

/**
 * Permanent self-service account deletion. Requires the password twice
 * (typo protection, not a security check by itself) plus an explicit
 * acknowledgement checkbox before the button even enables. The actual
 * verification that this is really the account owner happens server-side
 * in DELETE /api/account, which re-authenticates with the password before
 * calling auth.admin.deleteUser() — this form can't be tricked into
 * deleting an account without the correct password.
 */
export function DeleteAccountFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    if (!password || !confirmPassword) return setError("Enter your password in both fields.")
    if (password !== confirmPassword) return setError("Passwords do not match.")
    if (!acknowledged) return setError("Confirm that you understand this cannot be undone.")

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to delete your account.")
      router.push("/login")
    } catch (err: any) {
      setError(err.message || "Unable to delete your account.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to profile
      </button>
      <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>This permanently deletes your account and all associated data — needs, donations, messages, everything. This cannot be undone.</span>
      </div>
      {error && <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="delete-account-password">Current password</Label>
          <Input id="delete-account-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="delete-account-password-confirm">Re-enter password</Label>
          <Input id="delete-account-password-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1" />
          <span>I understand this will permanently delete my account and all my data, and cannot be undone.</span>
        </label>
        <Button type="submit" disabled={isSubmitting || !acknowledged} className="w-full bg-red-600 hover:bg-red-700 text-white">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Permanently delete my account
        </Button>
      </form>
    </div>
  )
}
