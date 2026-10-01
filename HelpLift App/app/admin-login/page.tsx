"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2, Mail, Lock, ShieldCheck, AlertCircle, LogIn } from "lucide-react"
import { GoogleSignInButton } from "@/components/google-sign-in-button"
import { LinkedInSignInButton } from "@/components/linkedin-sign-in-button"
import { MicrosoftSignInButton } from "@/components/microsoft-sign-in-button"
import { AccountUnlockDialog } from "@/components/account-unlock-dialog"

// Messages for the ?error= values /auth/callback redirects back with.
const CALLBACK_ERRORS: Record<string, string> = {
  not_admin: "That account isn't an administrator account.",
  profile: "Your account profile is incomplete. Please contact support.",
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)
  const [showUnlockedBanner, setShowUnlockedBanner] = useState(false)

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get("error")
    if (callbackError) {
      setErrorMsg(CALLBACK_ERRORS[callbackError] || "Sign-in didn't complete. Please try again.")
      window.history.replaceState({}, "", "/admin-login")
    }
  }, [])

  const completeLogin = (user: { id: string; email: string; fullName: string; role: string }) => {
    if (user.role !== "admin") {
      setErrorMsg("This portal is for administrators only.")
      return
    }
    localStorage.setItem("userId", user.id)
    localStorage.setItem("userRole", user.role)
    localStorage.setItem("userName", user.fullName)
    router.push("/admin-dashboard")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg("")

    try {
      let deviceId = localStorage.getItem("deviceId")
      if (!deviceId) {
        deviceId =
          "dev_" +
          Math.random().toString(36).substr(2, 9) +
          Date.now().toString(36)

        localStorage.setItem("deviceId", deviceId)
      }

      const location = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown"

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, adminPortal: true, deviceId, location }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.locked) {
          setShowUnlockDialog(true)
          setIsLoading(false)
          return
        }
        throw new Error(data.message || "Admin login failed")
      }

      completeLogin(data.user)
    } catch (err: any) {
      setErrorMsg(err instanceof Error ? err.message : "Admin login failed")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] flex flex-col items-center justify-center py-20 px-4 transition-colors">
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-[#0B1220]/80 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
      )}

      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-3 rounded shadow-lg shadow-blue-500/20 inline-flex mb-6">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300 mb-3">
            Admin Portal
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            System Access
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-300 mt-3">
            Sign in to manage users, approvals, needs, and platform activity.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 rounded-[28px] border border-slate-200 dark:border-[#233350] bg-white/90 dark:bg-[#121B2E]/90 p-6 shadow-2xl shadow-slate-200/50 dark:shadow-blue-950/30 backdrop-blur-xl">
          {errorMsg && <div className="flex items-center gap-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 p-4 text-sm font-semibold text-red-700 dark:text-red-200"><AlertCircle className="h-5 w-5" />{errorMsg}</div>}
          {showUnlockedBanner && (
            <div className="flex items-center gap-2 rounded border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
              Account unlocked. Enter your password to sign in.
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white"
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
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-lg shadow-blue-600/20 transition-all"
            disabled={isLoading}
          >
            Sign In to Admin Panel <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </form>

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-[#233350]" />
            or
            <span className="h-px flex-1 bg-slate-200 dark:bg-[#233350]" />
          </div>
          <GoogleSignInButton label="Sign in with Google" intent="admin" onError={setErrorMsg} />
          <LinkedInSignInButton label="Sign in with LinkedIn" intent="admin" onError={setErrorMsg} />
          <MicrosoftSignInButton label="Sign in with Microsoft" intent="admin" onError={setErrorMsg} />
          <p className="text-center text-xs text-slate-400">Only for existing administrator accounts.</p>
        </div>

        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-2 rounded border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 px-6 py-3 text-sm font-bold text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-950/50"
        >
          <LogIn className="h-4 w-4" />
          Not an admin? User login
        </Link>
      </div>

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
    </div>
  )
}
