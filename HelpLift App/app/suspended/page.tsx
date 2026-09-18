"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert, LogOut, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { MessageComposeDialog } from "@/components/message-compose-dialog"

// The only page a suspended account can reach — proxy.ts redirects every
// other protected route here for a suspended profile. The one thing left
// available is messaging an admin (send_notification() doesn't check
// suspension, so this keeps working normally for them).
export default function SuspendedPage() {
  const router = useRouter()
  const supabase = createClient()
  const [reason, setReason] = useState<string | null>(null)
  const [isMessagingAdmin, setIsMessagingAdmin] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase.from("profiles").select("suspended_reason").eq("id", data.user.id).single()
      setReason(profile?.suspended_reason || null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center px-4 py-24">
      <section className="w-full max-w-md space-y-6 text-center">
        <div className="inline-flex rounded-2xl bg-red-600 p-4 text-white mx-auto">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Account Suspended</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Your HelpLift account has been suspended by an administrator. You can't access the platform while suspended.
          </p>
          {reason && (
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 rounded-xl p-3 mt-2 text-left">
              <span className="font-bold">Reason given: </span>{reason}
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            If you believe this is a mistake, please contact an administrator.
          </p>
        </div>

        {sent ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            Message sent — an administrator will get back to you.
          </p>
        ) : (
          <Button onClick={() => setIsMessagingAdmin(true)} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
            <Mail className="w-4 h-4 mr-1.5" /> Message Admin
          </Button>
        )}

        <button onClick={logout} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mx-auto">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </section>

      <MessageComposeDialog
        open={isMessagingAdmin}
        onOpenChange={setIsMessagingAdmin}
        recipientLabel="Admin"
        target="admin"
        onSent={() => setSent(true)}
      />
    </main>
  )
}
