"use client"

import { useEffect, useState } from "react"
import { Languages, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TRANSLATE_LANGUAGES, languageLabel } from "@/lib/languages"

// "Translate" for content people write (needs, impact stories, timeline posts,
// messages): pick a language and the text is translated by AI on request
// (app/api/public/translate). Nothing is stored; "Show original" switches back.
// The last language chosen is remembered on this device.

const LAST_LANGUAGE_KEY = "helplift:translate-language"

/** The Translate control on its own: reports the translated text (or null for the original). */
export function TranslateControl({ text, onResult, className = "" }: { text: string; onResult: (translation: string | null) => void; className?: string }) {
  const [language, setLanguage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [lastLanguage, setLastLanguage] = useState<string | null>(null)

  useEffect(() => {
    try { setLastLanguage(window.localStorage.getItem(LAST_LANGUAGE_KEY)) } catch {}
  }, [])

  // New text (e.g. another need opened in the same window): back to the original.
  useEffect(() => { setLanguage(null); setError(""); onResult(null) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const translate = async (code: string) => {
    if (busy || !text.trim()) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/public/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Couldn't translate this right now.")
      setLanguage(code)
      onResult(data.translation)
      try { window.localStorage.setItem(LAST_LANGUAGE_KEY, code) } catch {}
      setLastLanguage(code)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const showOriginal = () => { setLanguage(null); onResult(null) }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${className}`} onClick={e => e.stopPropagation()}>
      {language ? (
        <>
          <span className="text-slate-500 dark:text-slate-400">Translated to {languageLabel(language)} by AI</span>
          <button type="button" onClick={showOriginal} className="font-bold text-blue-600 dark:text-blue-400 hover:underline">Show original</button>
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              data-tip="Translate this text into another language"
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/5 px-2.5 py-1 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
              {busy ? "Translating..." : "Translate"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 w-48 overflow-y-auto rounded border-0 p-1 shadow-xl">
            {lastLanguage && (
              <>
                <DropdownMenuItem onSelect={() => translate(lastLanguage)} className="font-semibold">
                  {languageLabel(lastLanguage)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-500">Translate to</DropdownMenuLabel>
            {TRANSLATE_LANGUAGES.filter(option => option.code !== lastLanguage).map(option => (
              <DropdownMenuItem key={option.code} onSelect={() => translate(option.code)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
    </span>
  )
}

/** Text with a Translate control underneath; shows the translation in place of the original. */
export function TranslatableText({ text, className = "", controlClassName = "mt-1.5" }: { text: string; className?: string; controlClassName?: string }) {
  const [translation, setTranslation] = useState<string | null>(null)
  return (
    <div>
      <p className={className}>{translation ?? text}</p>
      <TranslateControl text={text} onResult={setTranslation} className={controlClassName} />
    </div>
  )
}
