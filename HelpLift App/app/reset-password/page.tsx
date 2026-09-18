"use client"

import { FormEvent, Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Lock, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Step = "checking" | "code" | "password" | "success"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </main>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // "checking" first: if the user arrived via a clicked link, Supabase may
  // have already established a session (the older ConfirmationURL flow) —
  // in that case skip straight to the password step. Otherwise fall back to
  // the code-entry step, for the {{ .Token }} email template.
  const [step, setStep] = useState<Step>("checking")

  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [code, setCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStep(data.session ? "password" : "code")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMsg("")
    if (!email.trim()) return setErrorMsg("Enter the email address you requested the code for.")
    if (!code.trim()) return setErrorMsg("Enter the verification code from your email.")

    setIsVerifying(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "recovery",
      })
      if (error) throw error
      setStep("password")
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Invalid or expired code. Request a new one.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSubmitPassword = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMsg("")
    if (password.length < 8) return setErrorMsg("Password must be at least 8 characters.")
    if (password !== confirmPassword) return setErrorMsg("Passwords do not match.")

    setIsLoading(true)
    try {
      const response = await fetch("/api/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || "Unable to update password.")
      setStep("success")
      setTimeout(() => router.push("/login"), 1800)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Unable to update password.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center px-4 py-24">
      <section className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex rounded-2xl bg-slate-900 p-3 text-white">
            {step === "code" ? <ShieldCheck className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {step === "code" ? "Enter verification code" : "Choose a new password"}
          </h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {step === "code"
              ? "Enter the code we emailed you to confirm it's really you."
              : "Use at least 8 characters to secure your HelpLift account."}
          </p>
        </div>

        {step === "checking" ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          </div>
        ) : step === "success" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-800">
            <CheckCircle2 className="mx-auto mb-2 h-7 w-7" />Password updated. Redirecting to sign in...
          </div>
        ) : step === "code" ? (
          <form onSubmit={handleVerifyCode} className="space-y-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />{errorMsg}
              </div>
            )}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your account email"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
              required
            />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Verification code"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
              required
            />
            <Button type="submit" disabled={isVerifying} className="w-full rounded-full bg-slate-900 py-6 font-bold hover:bg-slate-800">
              {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify code
            </Button>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Didn't get a code?{" "}
              <Link href="/forgot-password" className="font-bold text-blue-600 hover:underline">Request a new one</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmitPassword} className="space-y-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />{errorMsg}
              </div>
            )}
            <input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500" required />
            <input type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500" required />
            <Button type="submit" disabled={isLoading} className="w-full rounded-full bg-slate-900 py-6 font-bold hover:bg-slate-800">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update password</Button>
          </form>
        )}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400"><Link href="/login" className="font-bold text-blue-600 hover:underline">Back to sign in</Link></p>
      </section>
    </main>
  )
}
