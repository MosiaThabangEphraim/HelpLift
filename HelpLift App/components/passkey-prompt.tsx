"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Fingerprint, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { deviceLabel, isPasskeySupported, passkeyErrorMessage } from "@/lib/passkeys"

const storageKey = (userId: string) => `helplift:passkey-prompt:${userId}`

// A small card shown once, a moment after someone signs in on the giver or
// organization dashboard, offering to add a passkey so they can sign in with
// their fingerprint, face or PIN next time. It only appears when the browser
// supports passkeys, the person has none yet, and they haven't already said
// "Not now" (or added one) on this device. They can always add one later in
// Settings.
export function PasskeyPrompt() {
  const supabase = useMemo(() => createClient(), [])
  const [visible, setVisible] = useState(false)
  const [key, setKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isPasskeySupported() || !navigator.onLine) return
    let cancelled = false
    // Wait a moment so the prompt doesn't compete with the dashboard loading.
    const timer = window.setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const storedKey = storageKey(user.id)
        if (window.localStorage.getItem(storedKey)) return
        const { data, error: listError } = await supabase.auth.passkey.list()
        if (cancelled || listError || (data && data.length > 0)) return
        setKey(storedKey)
        setVisible(true)
      } catch {
        // Passkeys unavailable (e.g. not enabled in Supabase) or storage blocked: stay quiet.
      }
    }, 2500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [supabase])

  const remember = () => {
    try {
      if (key) window.localStorage.setItem(key, "dismissed")
    } catch {
      // Storage blocked: it may ask again next time, which is harmless.
    }
  }

  const dismiss = () => {
    remember()
    setVisible(false)
  }

  const addNow = async () => {
    setBusy(true)
    setError("")
    try {
      const { data, error: registerError } = await supabase.auth.registerPasskey()
      if (registerError) throw registerError
      if (data?.id) await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: deviceLabel() }).catch(() => undefined)
      remember()
      setDone(true)
      window.setTimeout(() => setVisible(false), 3500)
    } catch (err) {
      setError(passkeyErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Add a passkey"
      className="fixed bottom-4 right-4 z-[9990] w-[min(92vw,22rem)] rounded-2xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] p-4 shadow-2xl"
    >
      {done ? (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
          <div>
            <p className="text-sm font-bold">Passkey added</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Next time, choose “Sign in with a passkey” on the login page.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Sign in faster next time</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add a passkey to sign in with your fingerprint, face or device PIN. No password to type.
              </p>
            </div>
          </div>
          {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={dismiss} disabled={busy}>Not now</Button>
            <Button type="button" size="sm" onClick={addNow} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add now
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
