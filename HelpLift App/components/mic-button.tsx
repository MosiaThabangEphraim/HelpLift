"use client"

import { useEffect, useState } from "react"
import { Mic } from "lucide-react"
import { isSpeechToTextSupported, useSpeechToText } from "@/lib/speech-to-text"

// A small microphone button meant to sit inside a `relative` wrapper around a
// textarea/input, e.g.:
//   <div className="relative">
//     <textarea className="... pr-10" ... />
//     <MicButton className="top-2 right-2" onText={text => setValue(v => appendSpeech(v, text))} />
//   </div>
// Renders nothing when the browser has no speech recognition support (e.g.
// Firefox), so it never shows a control that can't work.
export function MicButton({
  onText,
  className = "",
  disabled = false,
}: {
  onText: (text: string) => void
  /** Positioning classes for the absolutely-positioned wrapper, e.g. "top-2 right-2". */
  className?: string
  disabled?: boolean
}) {
  const [supported, setSupported] = useState(false)
  useEffect(() => setSupported(isSpeechToTextSupported()), [])
  const { listening, error, start, stop } = useSpeechToText(onText)

  if (!supported) return null

  return (
    <div className={`absolute z-10 ${className}`}>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop voice typing" : "Start voice typing"}
        data-tip={listening ? "Stop voice typing" : "Speak instead of typing"}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
          listening
            ? "bg-red-500 text-white animate-pulse"
            : "bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
        }`}
      >
        <Mic className="h-3.5 w-3.5" />
      </button>
      {error && (
        <p role="alert" className="absolute right-0 top-8 w-44 rounded-lg bg-red-600 px-2 py-1.5 text-[10px] font-semibold leading-tight text-white shadow-lg">
          {error}
        </p>
      )}
    </div>
  )
}
