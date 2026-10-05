"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// The Web Speech API's SpeechSynthesis half - the mirror image of
// speech-to-text.ts's SpeechRecognition. Support is broader than
// SpeechRecognition (every major browser, including Firefox, has shipped
// this for years), but still worth feature-detecting since it's absent in
// non-browser environments (SSR) and vendor-inconsistent in some older
// versions.
export function isTextToSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

// SpeechSynthesisVoice has no standard "gender" or "quality" field - the
// browser/OS just gives each voice a name, so both of these are heuristics
// scored and ranked, not a real lookup. There's a hard ceiling here: the
// actual sound of a voice comes entirely from what's installed on the
// visitor's own device - a webpage can only pick among those, never make
// one sound more human than the device's engine actually renders it. A
// genuinely studio-quality voice would mean a paid cloud TTS API (Google
// Cloud TTS, Azure Speech, ElevenLabs...), the same billed-per-use trade-off
// that got the AI-polish feature removed earlier - this stays free and
// on-device on purpose, so it does the best it can with whatever's already
// on the visitor's machine.
//
// Quality hints: modern browsers/OSes increasingly ship noticeably better
// "neural"/"natural" voices alongside their older, more robotic default
// engine (classic Windows SAPI voices, eSpeak on Linux) - Edge in particular
// exposes far more natural "...Online (Natural)"/"...Neural" voices than
// its plain desktop ones. `localService: false` also tends to correlate
// with the nicer network-backed voices over the bundled offline engine.
const FEMALE_VOICE_HINTS = [
  "female", "zira", "hazel", "samantha", "victoria", "karen", "moira", "tessa",
  "fiona", "susan", "allison", "ava", "nicky", "serena", "salli", "joanna",
  "kendra", "kimberly", "ivy", "aria", "jenny", "emma", "michelle",
]
const QUALITY_HINTS = ["natural", "neural", "enhanced", "premium", "plus", "online"]
const ROBOTIC_HINTS = ["espeak", "compact", "pico", "festival"]

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  let score = 0
  if (QUALITY_HINTS.some((hint) => name.includes(hint))) score += 20
  if (FEMALE_VOICE_HINTS.some((hint) => name.includes(hint))) score += 10
  if (!voice.localService) score += 5
  if (ROBOTIC_HINTS.some((hint) => name.includes(hint))) score -= 20
  return score
}

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined
  const langPrefix = lang.slice(0, 2).toLowerCase()
  const sameLanguage = voices.filter((v) => v.lang?.toLowerCase().startsWith(langPrefix))
  const pool = sameLanguage.length > 0 ? sameLanguage : voices
  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
}

// getVoices() is notoriously asynchronous in Chrome/Edge - it returns an
// empty list on the very first call, populating only after the
// "voiceschanged" event fires. Safari/Firefox are usually synchronous. This
// covers both: return immediately if already populated, otherwise wait for
// the event (with a timeout fallback in case a browser never fires it).
function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices()
    if (existing.length > 0) {
      resolve(existing)
      return
    }
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler)
      resolve(window.speechSynthesis.getVoices())
    }
    window.speechSynthesis.addEventListener("voiceschanged", handler)
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler)
      resolve(window.speechSynthesis.getVoices())
    }, 300)
  })
}

// Speaks a longer text (e.g. a Lifty reply) sentence by sentence - Chrome cuts
// single utterances off after ~15 seconds, and shorter pieces start playing
// sooner - with the same best-voice choice as the "read aloud" buttons.
// Cancels anything already speaking. `onDone` runs once the last sentence
// finishes (not when cancelled). Returns a function that stops it.
export function speakInSentences(text: string, onDone?: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onDone?.()
    return () => {}
  }
  let cancelled = false
  const chunks = (text.match(/[^.!?\n]+[.!?]*/g) || []).map(chunk => chunk.trim()).filter(Boolean)
  window.speechSynthesis.cancel()
  if (chunks.length === 0) {
    onDone?.()
    return () => {}
  }

  getVoicesAsync().then((voices) => {
    if (cancelled) return
    const lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US"
    const voice = pickBestVoice(voices, lang)
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = lang
      if (voice) utterance.voice = voice
      if (index === chunks.length - 1) {
        utterance.onend = () => { if (!cancelled) onDone?.() }
        utterance.onerror = (event) => { if (!cancelled && event.error !== "interrupted" && event.error !== "canceled") onDone?.() }
      }
      window.speechSynthesis.speak(utterance) // queued - plays after the previous chunk
    })
  })

  return () => {
    cancelled = true
    window.speechSynthesis.cancel()
  }
}

// Mobile Safari only allows speech that starts from a tap. Calling this inside
// a click handler "unlocks" it, so later replies can be spoken automatically.
export function primeSpeechSynthesis() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const silent = new SpeechSynthesisUtterance("")
  silent.volume = 0
  window.speechSynthesis.speak(silent)
}

// Drives one "read aloud" button: speaks the given text via the browser's
// (or OS's) built-in voice, entirely on-device - HelpLift never sends this
// text anywhere or pays for it, same "free, local, no external call" shape
// as Harper. Only one utterance plays at a time; starting a new one cancels
// whatever was already speaking. Picks the best-scoring available voice
// (see pickBestVoice - favors natural/neural-sounding and female-leaning
// voices) in whatever language the browser is set to.
export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState("")
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback(async (text: string) => {
    setError("")
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("Reading aloud isn't supported in this browser.")
      return
    }
    const trimmed = text.trim()
    if (!trimmed) return

    // Starting a new utterance always replaces whatever was playing -
    // simpler than a queue, and matches the button always showing exactly
    // one "Listen"/"Stop" toggle for its own piece of text.
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(trimmed)
    utterance.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US"

    const voices = await getVoicesAsync()
    const bestVoice = pickBestVoice(voices, utterance.lang)
    if (bestVoice) utterance.voice = bestVoice

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = (event) => {
      // "interrupted"/"canceled" fire when stop() or a newer speak() call
      // cuts this utterance off deliberately - not a real error.
      if (event.error !== "interrupted" && event.error !== "canceled") {
        setError("Couldn't read this aloud. Please try again.")
      }
      setSpeaking(false)
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [])

  // Stop speaking if the component unmounts (dialog closed, navigated away) mid-utterance.
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel() }, [])

  return { speaking, error, speak, stop }
}
