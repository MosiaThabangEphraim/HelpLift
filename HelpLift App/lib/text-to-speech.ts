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

// Utterances still playing. Chrome can garbage-collect an utterance that
// nothing references, after which it goes silent and never fires "end".
const liveUtterances = new Set<SpeechSynthesisUtterance>()

// How long a sentence may take to start before we assume its voice failed.
// Online ("natural") voices sometimes fail silently - no sound, no error.
const START_TIMEOUT_MS = 2500

// Speaks a longer text (e.g. a Lifty reply) one sentence at a time - Chrome cuts
// single utterances off after ~15 seconds, and shorter pieces start playing
// sooner - with the same best-voice choice as the "read aloud" buttons.
// If the chosen voice doesn't start (common with online voices), it switches
// to a voice installed on the device and carries on. Cancels anything already
// speaking. `onDone` runs once it has finished - including when speech turned
// out to be impossible, so callers never stay stuck in "speaking" - but not
// when cancelled. If other speech on the page (a "Listen" button) cuts it off,
// `onInterrupted` runs instead. Returns a function that stops it - which only
// ever stops this reply's own speech, never someone else's.
export function speakInSentences(text: string, onDone?: () => void, onInterrupted?: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onDone?.()
    return () => {}
  }
  const synth = window.speechSynthesis
  let cancelled = false
  let finished = false
  // Set while WE cancel (to retry with another voice), so the resulting
  // "interrupted" error isn't mistaken for someone else taking over.
  let selfCancelling = false
  let watchdog: number | undefined
  const chunks = (text.match(/[^.!?\n]+[.!?]*/g) || []).map(chunk => chunk.trim()).filter(Boolean)

  const finish = () => {
    if (finished || cancelled) return
    finished = true
    window.clearTimeout(watchdog)
    onDone?.()
  }

  synth.cancel()
  if (chunks.length === 0) {
    onDone?.()
    return () => {}
  }

  getVoicesAsync().then((voices) => {
    if (cancelled) return
    const lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US"
    let voice = pickBestVoice(voices, lang)
    // Fallback: the best voice that runs on the device itself (no network).
    const localVoice = pickBestVoice(voices.filter(v => v.localService), lang)
    let usedFallback = !voice || voice === localVoice

    const speakChunk = (index: number) => {
      selfCancelling = false
      if (cancelled || finished) return
      if (index >= chunks.length) return finish()

      const utterance = new SpeechSynthesisUtterance(chunks[index])
      utterance.lang = lang
      if (voice) utterance.voice = voice
      liveUtterances.add(utterance)
      // Some voices play without ever firing "start", so word boundaries and
      // the time an utterance took also count as proof that it played.
      let started = false
      const spokenAt = Date.now()
      utterance.onboundary = () => { started = true }

      const retryWithLocalVoice = () => {
        liveUtterances.delete(utterance)
        if (!usedFallback) {
          usedFallback = true
          voice = localVoice
          selfCancelling = true
          synth.cancel()
          window.setTimeout(() => speakChunk(index), 60)
        } else {
          selfCancelling = true
          synth.cancel()
          finish() // no voice works - don't leave the caller waiting
        }
      }

      utterance.onstart = () => {
        started = true
        window.clearTimeout(watchdog)
      }
      utterance.onend = () => {
        liveUtterances.delete(utterance)
        window.clearTimeout(watchdog)
        // Ending almost instantly without any sign of playing means it failed.
        if (!started && Date.now() - spokenAt < 400) return retryWithLocalVoice()
        speakChunk(index + 1)
      }
      utterance.onerror = (event) => {
        liveUtterances.delete(utterance)
        window.clearTimeout(watchdog)
        if (cancelled || finished) return
        if (event.error === "interrupted" || event.error === "canceled") {
          if (selfCancelling) return
          // Something else on the page started speaking: this reply is over,
          // and from now on it must not cancel that other speech.
          finished = true
          onInterrupted?.()
          return
        }
        if (!started) return retryWithLocalVoice()
        speakChunk(index + 1)
      }

      // A stuck/paused engine plays nothing until resumed.
      if (synth.paused) synth.resume()
      synth.speak(utterance)
      // Silent-failure check: nothing has started and the engine isn't busy
      // speaking. If it is busy, give it until the sentence could reasonably
      // have finished before giving up on the voice.
      const sentenceDeadline = 4000 + chunks[index].length * 150
      const check = () => {
        if (started || cancelled || finished) return
        if (synth.speaking && Date.now() - spokenAt < sentenceDeadline) {
          watchdog = window.setTimeout(check, 500)
          return
        }
        retryWithLocalVoice()
      }
      window.clearTimeout(watchdog)
      watchdog = window.setTimeout(check, START_TIMEOUT_MS)
    }

    // Chrome can ignore speak() straight after cancel(); give it a moment.
    window.setTimeout(() => speakChunk(0), 60)
  })

  return () => {
    const stillOurs = !cancelled && !finished
    cancelled = true
    window.clearTimeout(watchdog)
    liveUtterances.clear()
    if (stillOurs) synth.cancel()
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
  // True only while THIS button's own speech is playing. There's one speech
  // engine for the whole page, so a button must never cancel speech it didn't
  // start - e.g. Lifty's reply when a homepage story (and its Listen button)
  // rotates away.
  const ownsSpeechRef = useRef(false)

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    if (ownsSpeechRef.current) window.speechSynthesis.cancel()
    ownsSpeechRef.current = false
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
    utterance.onend = () => { ownsSpeechRef.current = false; setSpeaking(false) }
    utterance.onerror = (event) => {
      ownsSpeechRef.current = false
      // "interrupted"/"canceled" fire when stop() or a newer speak() call
      // cuts this utterance off deliberately - not a real error.
      if (event.error !== "interrupted" && event.error !== "canceled") {
        setError("Couldn't read this aloud. Please try again.")
      }
      setSpeaking(false)
    }
    utteranceRef.current = utterance
    ownsSpeechRef.current = true
    window.speechSynthesis.speak(utterance)
  }, [])

  // Stop speaking if the component unmounts (dialog closed, navigated away)
  // mid-utterance - but only this button's own speech.
  useEffect(() => () => {
    if (ownsSpeechRef.current && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
  }, [])

  return { speaking, error, speak, stop }
}
