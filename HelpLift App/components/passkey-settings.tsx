"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Fingerprint, Loader2, Plus, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { deviceLabel, isPasskeySupported, passkeyErrorMessage } from "@/lib/passkeys"

type Passkey = { id: string; friendly_name?: string; created_at: string; last_used_at?: string }

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : "")

// "Passkeys" section of the Settings window: add a passkey on this device (so the
// person can later sign in with their fingerprint, face or device PIN), see the
// ones they have, and remove any.
export function PasskeySettings({ open }: { open: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [supported, setSupported] = useState(true)
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.passkey.list()
      if (error) throw error
      setPasskeys(data || [])
    } catch (err) {
      setPasskeys([])
      setNote({ type: "error", text: passkeyErrorMessage(err) })
    }
  }, [supabase])

  useEffect(() => {
    setSupported(isPasskeySupported())
  }, [])

  useEffect(() => {
    if (open) {
      setNote(null)
      load()
    }
  }, [open, load])

  const add = async () => {
    setBusy(true)
    setNote(null)
    try {
      const { data, error } = await supabase.auth.registerPasskey()
      if (error) throw error
      // Name it after the device so it's recognizable in the list.
      if (data?.id) await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: deviceLabel() }).catch(() => undefined)
      setNote({ type: "success", text: "Passkey added. Next time, choose “Sign in with a passkey” on the login page." })
      await load()
    } catch (err) {
      setNote({ type: "error", text: passkeyErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (passkey: Passkey) => {
    if (!window.confirm(`Remove the passkey “${passkey.friendly_name || "Passkey"}”? You won't be able to sign in with it any more.`)) return
    setBusy(true)
    setNote(null)
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: passkey.id })
      if (error) throw error
      setNote({ type: "success", text: "Passkey removed." })
      await load()
    } catch (err) {
      setNote({ type: "error", text: passkeyErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Passkeys</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in with your fingerprint, face or device PIN instead of typing a password.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={busy || !supported}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          Add a passkey
        </Button>
      </div>

      {!supported && (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">This browser or device doesn't support passkeys.</p>
      )}

      {note && (
        <p className={`text-xs font-semibold ${note.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{note.text}</p>
      )}

      {passkeys === null ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
      ) : passkeys.length > 0 ? (
        <ul className="divide-y divide-slate-100 dark:divide-[#233350] rounded-xl border border-slate-100 dark:border-[#233350]">
          {passkeys.map(passkey => (
            <li key={passkey.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{passkey.friendly_name || "Passkey"}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Added {formatDate(passkey.created_at)}
                  {passkey.last_used_at ? ` · last used ${formatDate(passkey.last_used_at)}` : " · never used yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(passkey)}
                disabled={busy}
                aria-label={`Remove passkey ${passkey.friendly_name || ""}`.trim()}
                data-tip="Remove this passkey. It can no longer be used to sign in."
                className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">No passkeys yet. Add one on this device to sign in with biometrics.</p>
      )}
    </div>
  )
}
