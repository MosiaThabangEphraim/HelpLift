"use client"

import { useEffect, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { isTextToSpeechSupported, useTextToSpeech } from "@/lib/text-to-speech"

// "Read aloud" - the mirror image of MicButton/speech-to-text: turns text
// INTO speech instead of speech into text. Runs entirely via the browser's
// (or OS's) built-in voice - free, on-device, no server involved, same
// trust/cost profile as Harper. Meant for READ-ONLY long-form content
// (a need's description, an impact story, an organization's mission
// statement...), not form fields - renders as a small standalone pill,
// never overlaid on top of the text itself (the grammar-check button used
// to do that and it covered part of the text - see its own fix).
//
//   <ReadAloudButton text={need.description} label="Listen to this need" />
//
// Renders nothing if the browser has no speech-synthesis support at all
// (very rare today, but SSR/older browsers), so it never shows a control
// that can't work.
export function ReadAloudButton({
  text,
  label = "Listen",
  className = "",
  iconOnly = false,
}: {
  text: string
  label?: string
  className?: string
  /** Just the speaker icon, no text and a much smaller hit area - for tight spots (e.g. one per message in a long conversation) where the full pill takes up too much room. The label still drives its aria-label/tooltip. */
  iconOnly?: boolean
}) {
  const [supported, setSupported] = useState(false)
  const { speaking, error, speak, stop } = useTextToSpeech()

  useEffect(() => setSupported(isTextToSpeechSupported()), [])

  if (!supported || !text.trim()) return null

  if (iconOnly) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <button
          type="button"
          onClick={() => (speaking ? stop() : speak(text))}
          aria-label={speaking ? "Stop reading aloud" : `${label} - read aloud`}
          data-tip={speaking ? "Stop reading" : "Read this aloud"}
          className={`inline-flex shrink-0 items-center justify-center rounded-full p-1 transition-colors ${
            speaking
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
          }`}
        >
          {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        </button>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => (speaking ? stop() : speak(text))}
        aria-label={speaking ? "Stop reading aloud" : `${label} - read aloud`}
        data-tip={speaking ? "Stop reading" : "Read this aloud"}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold transition-colors ${
          speaking
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
        }`}
      >
        {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        <span>{speaking ? "Stop" : label}</span>
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </span>
  )
}
