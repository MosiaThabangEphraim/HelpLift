"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Loader2, AlertCircle, CheckCircle2, Mail, Lock, Fingerprint, Quote as QuoteIcon } from "lucide-react"
import { getRandomQuote } from "@/lib/quotes"
import { GoogleSignInButton } from "@/components/google-sign-in-button"
import { createClient } from "@/lib/supabase/client"
import { isPasskeySupported, passkeyErrorMessage } from "@/lib/passkeys"

// Messages for the ?error= values /auth/callback redirects back with.
const CALLBACK_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't complete. Please try again.",
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
  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  // Picked once per page load, so every visit to this screen (i.e. every
  // time someone logs in) shows a fresh random one.
  const [quote] = useState(() => getRandomQuote())

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
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-3 rounded-2xl shadow-lg inline-block mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>

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
            className="text-sm italic text-slate-500 dark:text-slate-400"
          >
            "{quote.text}"
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
            className="text-sm not-italic font-semibold text-slate-400 dark:text-slate-500 mt-1.5"
          >
            - {quote.author}
          </motion.p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="w-full max-w-xl space-y-6">
        {showVerifiedBanner && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> Your email has been verified. You can now sign in.
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700 text-sm font-bold">
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
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-slate-100"
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
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-slate-100"
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
          className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full shadow-lg transition-all"
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
            className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 shadow-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
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
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          New to HelpLift? Google only verifies your email. You'll then choose whether you're a giver or an organization and finish registering.
        </p>
      </div>

      <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
        New to the platform?{" "}
        <Link
          href="/register"
          className="text-blue-600 font-bold hover:underline"
        >
          Create an account
        </Link>
      </p>

      <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Admin access?{" "}
        <Link
          href="/admin-login"
          className="text-indigo-600 font-bold hover:underline"
        >
          Sign in as admin
        </Link>
      </div>
    </div>
  )
}