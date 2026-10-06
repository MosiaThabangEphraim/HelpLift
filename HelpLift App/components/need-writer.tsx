"use client"

import { useState } from "react"
import { ChevronDown, Loader2, Sparkles } from "lucide-react"
import { MicButton } from "@/components/mic-button"
import { appendSpeech } from "@/lib/speech-to-text"

// "Write it for me" box at the top of the organization's Create a need form.
// The organization types or speaks a rough sentence; Lifty (via
// /api/organization/needs/draft) fills in the form fields, which stay fully
// editable - nothing is posted until they submit the form as usual.
// Collapsed to a small pill until clicked, so it doesn't crowd the form.

export type NeedDraft = {
  title: string
  description: string
  category: string
  urgency: string
  quantity: string
  due_date: string
  location: string
  target_amount: string
}

const MAX_LENGTH = 1000

export function NeedWriter({ onDraft }: { onDraft: (draft: NeedDraft) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [isDrafting, setIsDrafting] = useState(false)
  const [note, setNote] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const writeDraft = async () => {
    if (text.trim().length < 5 || isDrafting) return
    setIsDrafting(true)
    setNote(null)
    try {
      const res = await fetch("/api/organization/needs/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.draft) throw new Error(data.message || "Lifty couldn't draft this right now. Please try again.")
      onDraft(data.draft)
      setNote({ type: "success", text: "Done! Lifty filled in the form below - check every field before you submit." })
    } catch (err: any) {
      setNote({ type: "error", text: err?.message || "Lifty couldn't draft this right now. Please try again." })
    } finally {
      setIsDrafting(false)
    }
  }

  // Collapsed: a small pill. Open: the full panel.
  if (!open) {
    return (
      <div data-tour="need-writer" className="flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          data-tip="Describe the need in a sentence - typed or spoken - and Lifty fills in the form"
          className="inline-flex items-center gap-1.5 rounded border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" /> Let Lifty write it
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div data-tour="need-writer" className="rounded border border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30">
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded={true}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-600" />
        <span className="flex-1 text-xs font-bold text-slate-900 dark:text-slate-100">Let Lifty write it for you</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 rotate-180 text-slate-400" />
      </button>

      <div className="space-y-3 px-3 pb-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Type it or tap the mic, then press Write it for me. You can edit everything before submitting.
          </p>
          <div className="relative">
            <textarea
              value={text}
              maxLength={MAX_LENGTH}
              onChange={e => setText(e.target.value)}
              placeholder='e.g. "We need about 30 pairs of school shoes for our grade 1 learners before January"'
              aria-label="Describe the need for Lifty"
              autoFocus
              className="field min-h-16 pr-11"
            />
            <MicButton className="top-2 right-2" onText={spoken => setText(current => appendSpeech(current, spoken).slice(0, MAX_LENGTH))} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={writeDraft}
              disabled={isDrafting || text.trim().length < 5}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDrafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isDrafting ? "Writing..." : "Write it for me"}
            </button>
            {note && (
              <p role="status" className={`text-xs font-semibold ${note.type === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {note.text}
              </p>
            )}
          </div>
      </div>
    </div>
  )
}
