"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowRight, HeartHandshake, Loader2, AlertCircle, CheckCircle2, Mail, Lock, Fingerprint, Megaphone, Paperclip, Quote as QuoteIcon, X, UserPlus, ShieldCheck } from "lucide-react"
import { getRandomQuote, GIVING_QUOTES, type Quote } from "@/lib/quotes"
import { GoogleSignInButton } from "@/components/google-sign-in-button"
import { LinkedInSignInButton } from "@/components/linkedin-sign-in-button"
import { MicrosoftSignInButton } from "@/components/microsoft-sign-in-button"
import { createClient } from "@/lib/supabase/client"
import { isPasskeySupported, passkeyErrorMessage } from "@/lib/passkeys"
import { AccountUnlockDialog } from "@/components/account-unlock-dialog"

// Messages for the ?error= values /auth/callback redirects back with.
const CALLBACK_ERRORS: Record<string, string> = {
  admin: "Administrators sign in through the administrator portal.",
  profile: "Your account profile is incomplete. Please contact support.",
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [showUnlockedBanner, setShowUnlockedBanner] = useState(false)
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false)
  const [adminBanner, setAdminBanner] = useState<{ message: string; updatedAt: string; attachments: { name: string; url: string }[] } | null>(null)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  // Picked once per page load, so every visit to this screen (i.e. every
  // time someone logs in) shows a fresh random one. The pick has to happen
  // in an effect, not in useState's initializer - that initializer runs
  // during the server render too, and Math.random() there almost never
  // matches what the client then picks on its own first render, which is
  // exactly the "server rendered text didn't match the client" hydration
  // error. Rendering GIVING_QUOTES[0] on both the server and the client's
  // first pass keeps them in sync; the effect only swaps in a random one
  // after hydration is already done, when React no longer compares.
  const [quote, setQuote] = useState<Quote>(() => GIVING_QUOTES[0])

  useEffect(() => {
    setQuote(getRandomQuote())
  }, [])

  useEffect(() => {
    const callbackError = searchParams.get("error")
    if (callbackError) {
      setErrorMsg(CALLBACK_ERRORS[callbackError] || "Sign-in didn't complete. Please try again.")
      window.history.replaceState({}, "", "/login")
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      setShowVerifiedBanner(true)
      // Clean the query param out of the address bar without a navigation/reload.
      window.history.replaceState({}, "", "/login")
    }
  }, [searchParams])

  useEffect(() => {
    setPasskeySupported(isPasskeySupported())
  }, [])

  // A dismissible note an admin can set for the login page (Platform Settings
  // > Login page banner). Dismissal is tracked in localStorage against this
  // row's own updated_at, not per-account - there's no session yet here - so
  // editing the message later makes it reappear even for people who already
  // dismissed the old one.
  useEffect(() => {
    const loadBanner = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.from("platform_settings").select("value, updated_at").eq("key", "login_banner").maybeSingle()
        const value = data?.value as { enabled?: boolean; message?: string; attachments?: { path: string; name: string }[] } | undefined
        if (!value?.enabled || !value.message?.trim() || !data?.updated_at) return
        const dismissedAt = localStorage.getItem("loginBannerDismissedAt")
        if (dismissedAt === data.updated_at) return
        // login-banner-attachments is a PUBLIC bucket (see
        // 20260928000400_login_banner_attachments.sql) - a plain public URL,
        // no signing needed, since this page has no session to sign with anyway.
        const attachments = (value.attachments || []).map((a) => ({
          name: a.name,
          url: supabase.storage.from("login-banner-attachments").getPublicUrl(a.path).data.publicUrl,
        }))
        setAdminBanner({ message: value.message, updatedAt: data.updated_at, attachments })
      } catch {}
    }
    loadBanner()
  }, [])

  const dismissAdminBanner = () => {
    // Closing it on screen must happen regardless of whether the storage
    // write below succeeds - a blocked localStorage (private browsing, some
    // iframe/tunnel contexts) was throwing here before this try/catch, which
    // stopped setAdminBanner(null) from ever running: dismiss appeared to do
    // nothing, and the popup/banner stayed stuck until the admin disabled
    // the announcement entirely.
    try {
      if (adminBanner) localStorage.setItem("loginBannerDismissedAt", adminBanner.updatedAt)
    } catch {
      // Dismissal just won't persist across reloads; it must still close now.
    }
    setAdminBanner(null)
  }

  // Sign in with a passkey (fingerprint, face or device PIN). No email or password
  // is typed: the device offers the passkeys it has for this site. Afterwards the
  // same rules as the password login apply: administrators use their own portal.
  const handlePasskeyLogin = async () => {
    setErrorMsg("")
    setIsPasskeyLoading(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase.auth.signInWithPasskey()
      if (error || !data?.user) throw error ?? new Error("Passkey sign-in didn't complete.")

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single()
      if (!profile) {
        await supabase.auth.signOut()
        throw new Error("Your account profile is incomplete. Please contact support.")
      }
      if (profile.role === "admin") {
        await supabase.auth.signOut()
        throw new Error("Administrators sign in through the administrator portal.")
      }
      setIsLoading(true)
      router.push(profile.role === "organization" ? "/organisation-dashboard" : "/givers-dashboard")
    } catch (err) {
      setErrorMsg(passkeyErrorMessage(err, "signin"))
      setIsPasskeyLoading(false)
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg("")

    try {
      // 1. Prepare device/location data for the API
      let deviceId = localStorage.getItem("deviceId")
      if (!deviceId) {
        deviceId =
          "dev_" +
          Math.random().toString(36).substr(2, 9) +
          Date.now().toString(36)

        localStorage.setItem("deviceId", deviceId)
      }

      const location =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"

      // 2. Call the API
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, deviceId, location }),
      })

      const data = await response.json()

      // 3. Handle Login Response
      if (!response.ok) {
        if (data.locked) {
          setShowUnlockDialog(true)
          setIsLoading(false)
          return
        }
        throw new Error(data.message || "Login failed")
      }

      // 4. Set Session Data
      localStorage.setItem("userId", data.user.id)
      localStorage.setItem("userRole", data.user.role)
      localStorage.setItem("userName", data.user.fullName)

      // 5. Redirect based on role
      if (data.user.role === "giver") {
        router.push("/givers-dashboard")
      } else if (data.user.role === "organization") {
        router.push("/organisation-dashboard")
      } else if (data.user.role === "admin") {
        router.push("/admin-dashboard")
      } else {
        router.push("/dashboard")
      }
    } catch (err: any) {
      setErrorMsg(err.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex flex-col items-center justify-center py-20 px-4">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-3 rounded shadow-lg inline-block mb-3">
          <HeartHandshake className="w-8 h-8 text-white" />
        </div>

        <p className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
          Giving made transparent. Impact made real.
        </p>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          Welcome Back
        </h1>

        <p className="text-lg text-slate-500 dark:text-slate-400 mt-3">
          Sign in to continue to HelpLift.
        </p>

        <div className="max-w-md mx-auto mt-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.4, rotate: -15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex justify-center mb-2"
          >
            <QuoteIcon className="w-5 h-5 text-blue-500/50 dark:text-blue-400/50" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-sm italic font-bold text-slate-500 dark:text-slate-400"
          >
            "{quote.text}"
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
            className="text-sm italic font-semibold text-slate-400 dark:text-slate-500 mt-1.5"
          >
            - {quote.author}
          </motion.p>
        </div>
      </div>

      {/* Shown two ways at once, both tied to the same adminBanner/dismiss
          state: a popup on load, so it can't be skipped past by someone
          logging in quickly (autofill, muscle memory) - and a banner that
          stays above the form as a lasting reminder while they type, in case
          they want to re-read it after closing the popup. Dismissing either
          one dismisses both, since they're the same announcement. */}
      <Dialog open={!!adminBanner} onOpenChange={(open) => !open && dismissAdminBanner()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Megaphone className="h-5 w-5 shrink-0" /> Announcement
            </DialogTitle>
          </DialogHeader>
          {adminBanner && (
            <div className="space-y-4 pt-1">
              <p className="whitespace-pre-line text-sm font-semibold text-slate-700 dark:text-slate-200">{adminBanner.message}</p>
              {adminBanner.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {adminBanner.attachments.map((a, i) =>
                    /\.(png|jpe?g|gif|webp|svg)$/i.test(a.name) ? (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                        <img src={a.url} alt={a.name} className="h-16 w-16 rounded-lg object-cover border border-blue-200 dark:border-blue-900" />
                      </a>
                    ) : (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="max-w-[140px] truncate">{a.name}</span>
                      </a>
                    )
                  )}
                </div>
              )}
              <Button type="button" onClick={dismissAdminBanner} className="w-full">
                Got it
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AccountUnlockDialog
        open={showUnlockDialog}
        email={email}
        onOpenChange={setShowUnlockDialog}
        onUnlocked={() => {
          setShowUnlockDialog(false)
          setShowUnlockedBanner(true)
          setPassword("")
        }}
      />

      {adminBanner && (
        <div className="w-full max-w-xl mb-6 p-4 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-sm space-y-3">
          <div className="flex items-start gap-3">
            <Megaphone className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="flex-1 font-semibold whitespace-pre-line">{adminBanner.message}</p>
            <button
              type="button"
              onClick={dismissAdminBanner}
              aria-label="Dismiss"
              className="shrink-0 rounded p-1 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {adminBanner.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-8">
              {adminBanner.attachments.map((a, i) =>
                /\.(png|jpe?g|gif|webp|svg)$/i.test(a.name) ? (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                    <img src={a.url} alt={a.name} className="h-16 w-16 rounded-lg object-cover border border-blue-200 dark:border-blue-900" />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-white dark:bg-blue-950/60 px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span className="max-w-[140px] truncate">{a.name}</span>
                  </a>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleLogin} className="w-full max-w-xl space-y-6">
        {showVerifiedBanner && (
          <div className="p-4 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> Your email has been verified. You can now sign in.
          </div>
        )}
        {showUnlockedBanner && (
          <div className="p-4 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> Account unlocked. Enter your password to sign in.
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded bg-red-50 border border-red-100 flex items-center gap-3 text-red-700 text-sm font-bold">
            <AlertCircle className="h-5 w-5" /> {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-400" />

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-4 w-5 h-5 text-slate-400" />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-slate-100"
              required
            />
          </div>
        </div>

<div className="flex items-center justify-end">
  <Link 
    href="/forgot-password" 
    className="text-sm font-semibold text-primary hover:underline transition-colors"
  >
    Forgot password?
  </Link>
</div>
        <Button
          type="submit"
          className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded shadow-lg transition-all"
          disabled={isLoading}
        >
          Sign In <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </form>

      <div className="w-full max-w-xl mt-6 space-y-4">
        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          or
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>
        {passkeySupported && (
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={isPasskeyLoading}
            className="flex w-full items-center justify-center gap-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {isPasskeyLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
            <span>Sign in with a passkey</span>
          </button>
        )}
        {passkeySupported && (
          <p className="-mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
            Passkeys are set up after your first sign-in, in Settings.
          </p>
        )}
        <GoogleSignInButton label="Sign in with Google" onError={setErrorMsg} />
        <LinkedInSignInButton label="Sign in with LinkedIn" onError={setErrorMsg} />
        <MicrosoftSignInButton label="Sign in with Microsoft" onError={setErrorMsg} />
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          New to HelpLift? Google/LinkedIn/Microsoft only verify your email. You'll then choose whether you're a giver or an organization and finish registering.
        </p>
      </div>

      <div className="mt-8 grid w-full max-w-xl grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/register"
          className="flex items-center justify-center gap-2 rounded border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 px-6 py-3 text-sm font-bold text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-950/50"
        >
          <UserPlus className="h-4 w-4" />
          Create an account
        </Link>
        <Link
          href="/admin-login"
          className="flex items-center justify-center gap-2 rounded border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 px-6 py-3 text-sm font-bold text-indigo-700 dark:text-indigo-300 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-950/50"
        >
          <ShieldCheck className="h-4 w-4" />
          Sign in as admin
        </Link>
      </div>
    </div>
  )
}