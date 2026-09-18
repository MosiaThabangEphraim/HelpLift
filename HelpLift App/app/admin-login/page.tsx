"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2, Mail, Lock, ShieldCheck, AlertCircle } from "lucide-react"

export default function AdminLoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

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
        throw new Error(data.message || "Admin login failed")
      }

      if (data.user.role !== "admin") {
        throw new Error("This portal is for administrators only.")
      }

      localStorage.setItem("userId", data.user.id)
      localStorage.setItem("userRole", data.user.role)
      localStorage.setItem("userName", data.user.fullName)

      router.push("/admin-dashboard")
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
          <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20 inline-flex mb-6">
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
          {errorMsg && <div className="flex items-center gap-2 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 p-4 text-sm font-semibold text-red-700 dark:text-red-200"><AlertCircle className="h-5 w-5" />{errorMsg}</div>}
          <div className="relative">
            <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white"
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
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-lg shadow-blue-600/20 transition-all"
            disabled={isLoading}
          >
            Sign In to Admin Panel <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Not an admin? <Link href="/login" className="text-blue-600 dark:text-blue-300 font-bold hover:underline">User login</Link>
        </p>
      </div>
    </div>
  )
}
