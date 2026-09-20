"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, HeartHandshake, Loader2, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PasswordRequirements } from "@/components/password-requirements"
import { isPasswordValid } from "@/lib/password"
import { ROLE_LABELS, type OrgRole } from "@/lib/organization-access"

type Invite = {
  organization_name: string
  email: string
  role: OrgRole
  status: "valid" | "expired" | "revoked" | "accepted"
  account_exists: boolean
  account_role: string | null
}

const ROLE_BLURBS: Record<OrgRole, string> = {
  owner: "You’ll have full access, including managing the team and the organization’s profile and banking details.",
  manager: "You'll be able to create and edit needs, respond to interests, manage fulfillments, stories and documents.",
  viewer: "You'll have read-only access to the organization's needs, interests, donations and fulfillments.",
}

const inputClass =
  "w-full px-4 py-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-blue-500 transition-colors"

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [invite, setInvite] = useState<Invite | null>(null)
  const [loadError, setLoadError] = useState("")
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const [res, { data: { user } }] = await Promise.all([fetch(`/api/invitations/${token}`), supabase.auth.getUser()])
        const data = await res.json()
        if (!res.ok) setLoadError(data.message || "This invitation link isn't valid.")
        else setInvite(data)
        setSignedInEmail(user?.email?.toLowerCase() ?? null)
      } catch {
        setLoadError("Could not load this invitation.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const acceptAndGo = async () => {
    const res = await fetch(`/api/invitations/${token}/accept`, { method: "POST" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || "Could not accept the invitation.")
    router.push("/organisation-dashboard")
  }

  const handleJoinSignedIn = async () => {
    setIsWorking(true)
    setError("")
    try {
      await acceptAndGo()
    } catch (e: any) {
      setError(e.message)
      setIsWorking(false)
    }
  }

  const handleSignInAndJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invite) return
    setIsWorking(true)
    setError("")
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password })
      if (signInError) throw new Error(signInError.message)
      await acceptAndGo()
    } catch (err: any) {
      setError(err.message)
      setIsWorking(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invite) return
    if (!isPasswordValid(password)) {
      setError("Please choose a password that meets all the requirements below.")
      return
    }
    setIsWorking(true)
    setError("")
    try {
      const res = await fetch(`/api/invitations/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not create your account.")
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password })
      if (signInError) throw new Error(signInError.message)
      router.push("/organisation-dashboard")
    } catch (err: any) {
      setError(err.message)
      setIsWorking(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSignedInEmail(null)
  }

  const statusMessage = (status: Invite["status"]) =>
    status === "accepted"
      ? "This invitation has already been used."
      : status === "revoked"
        ? "This invitation was cancelled by the organization."
        : "This invitation has expired. Ask the organization owner to send you a new one."

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 pt-28 pb-20 px-4 flex justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <HeartHandshake className="w-4 h-4" />
            <span>Team invitation</span>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E]/80 p-8 shadow-sm space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
          ) : loadError || !invite ? (
            <div className="text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
              <h1 className="text-xl font-bold">Invitation not found</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{loadError || "This invitation link isn't valid."}</p>
            </div>
          ) : invite.status !== "valid" ? (
            <div className="text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <h1 className="text-xl font-bold">Invitation unavailable</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{statusMessage(invite.status)}</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <Users className="w-10 h-10 text-blue-600 mx-auto" />
                <h1 className="text-2xl font-black tracking-tight">Join {invite.organization_name}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You've been invited as a <strong>{ROLE_LABELS[invite.role].toLowerCase()}</strong>. {ROLE_BLURBS[invite.role]}
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {signedInEmail === invite.email.toLowerCase() ? (
                <button
                  onClick={handleJoinSignedIn}
                  disabled={isWorking}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
                >
                  {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Accept invitation
                </button>
              ) : signedInEmail ? (
                <div className="space-y-3 text-sm text-center">
                  <p className="text-slate-600 dark:text-slate-300">
                    You're signed in as <strong>{signedInEmail}</strong>, but this invitation is for <strong>{invite.email}</strong>.
                  </p>
                  <button onClick={signOut} className="px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold">
                    Sign out and continue
                  </button>
                </div>
              ) : invite.account_exists && invite.account_role !== "organization" ? (
                <p className="text-sm text-center text-slate-600 dark:text-slate-300">
                  <strong>{invite.email}</strong> is already registered as a {invite.account_role} account, which can't join an organization team.
                  Ask the owner to send the invitation to a different email address.
                </p>
              ) : invite.account_exists ? (
                <form onSubmit={handleSignInAndJoin} className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300">Sign in as <strong>{invite.email}</strong> to accept.</p>
                  <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
                  <button type="submit" disabled={isWorking} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60">
                    {isWorking && <Loader2 className="w-4 h-4 animate-spin" />}
                    Sign in and join
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300">Create your account for <strong>{invite.email}</strong>.</p>
                  <input type="text" required placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
                  <input type="tel" placeholder="Phone number (optional)" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
                  <div className="space-y-1">
                    <input type="password" required placeholder="Choose a password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
                    <PasswordRequirements password={password} />
                  </div>
                  <button type="submit" disabled={isWorking} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60">
                    {isWorking && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create account and join
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
