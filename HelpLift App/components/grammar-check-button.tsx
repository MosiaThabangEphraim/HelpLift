"use client"

import { useState } from "react"
import { Check, Loader2, SpellCheck2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { GrammarIssue } from "@/lib/harper"

// Harper (lib/harper.ts) grammar/spell check - offline, no external API, no
// per-check cost (unlike the AI-polish idea considered earlier, which made
// real billed calls and was removed for exactly that reason). Backed by the
// PUBLIC /api/public/grammar/check route (no login required) - this button
// shows up on public, unauthenticated forms too (e.g. the homepage contact
// form), and Harper has nothing sensitive or billed to gate behind login.
//
// Deliberately NOT absolutely positioned over the textarea (unlike
// MicButton) - an earlier version sat in the top-right corner the same way
// MicButton does, but it could shadow/cover part of the typed text. Instead
// this renders as a normal small labeled button meant to sit in a row above
// the field, next to its Label:
//   <div className="flex items-center justify-between gap-2">
//     <Label>Description</Label>
//     <GrammarCheckButton text={form.description} onTextChange={(next) => setForm(f => ({ ...f, description: next }))} />
//   </div>
//   <div className="relative">
//     <textarea className="... pr-11" ... />
//     <MicButton className="top-2 right-2" ... />
//   </div>
// `import type` for GrammarIssue keeps this a type-only reference - lib/harper.ts
// itself (which pulls in the ~16MB WASM binary) is never bundled for the client;
// all the real work happens server-side, in /api/public/grammar/check.
export function GrammarCheckButton({
  text,
  onTextChange,
  className = "",
}: {
  text: string
  onTextChange: (next: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [issues, setIssues] = useState<GrammarIssue[] | null>(null)
  const [error, setError] = useState("")

  const runCheck = async (value: string) => {
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/public/grammar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not check this text.")
      setIssues(data.issues || [])
    } catch (err: any) {
      setError(err.message || "Could not check this text.")
      setIssues(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      if (!text.trim()) {
        setIssues([])
        setError("")
      } else {
        runCheck(text)
      }
    }
  }

  // Applying a suggestion is plain string splicing on the given character
  // span (same logic Harper's own applySuggestion does internally). Then
  // re-check the updated text - applying one fix shifts the offsets of
  // every other pending issue, so their old spans can't just be reused.
  const applySuggestion = (issue: GrammarIssue, suggestion: GrammarIssue["suggestions"][number]) => {
    const { span } = issue
    const next =
      suggestion.kind === "Remove"
        ? text.slice(0, span.start) + text.slice(span.end)
        : suggestion.kind === "InsertAfter"
        ? text.slice(0, span.end) + suggestion.text + text.slice(span.end)
        : text.slice(0, span.start) + suggestion.text + text.slice(span.end)
    onTextChange(next)
    runCheck(next)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!text.trim()}
          aria-label="Check grammar and spelling"
          data-tip="Check grammar and spelling"
          className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 dark:bg-[#1A2740] px-2 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-40 ${className}`}
        >
          <SpellCheck2 className="h-3.5 w-3.5" />
          <span>Check grammar</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-96 overflow-y-auto space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Grammar &amp; spelling</p>
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking...
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!isLoading && !error && issues && issues.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> No issues found.
          </p>
        )}
        {!isLoading && issues && issues.length > 0 && (
          <div className="space-y-2.5">
            {issues.map((issue, i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-[#233350] p-2.5 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{issue.kind}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{issue.message}</p>
                <p className="text-xs italic text-slate-400">"{issue.problemText}"</p>
                {issue.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {issue.suggestions.map((s, si) => (
                      <button
                        key={si}
                        type="button"
                        onClick={() => applySuggestion(issue, s)}
                        className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                      >
                        {s.kind === "Remove" ? "Remove" : `Use "${s.text}"`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
