"use client"

import { useEffect, useRef, useState } from "react"
import { isSpeechToTextSupported } from "@/lib/speech-to-text"

// "Hey Lifty": say it and Lifty opens and starts a hands-free voice chat.
//
// Off by default - a personal preference on this device, switched on in
// Settings. While it's on, the browser listens through the microphone, but
// only while a HelpLift tab is open and visible and Lifty's chat is closed
// (it pauses during a voice chat so the two never fight over the microphone).
// In Chrome and Edge the audio is processed by the browser's own speech
// service. Browsers without background speech recognition (Firefox, iPhone
// Safari) can't use it, and the setting says so.

const STORAGE_KEY = "helplift:wake-word"
const CHANGE_EVENT = "helplift:wake-word-change"

export function isWakeWordSupported(): boolean {
  return isSpeechToTextSupported()
}

export function isWakeWordEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on"
  } catch {
    return false
  }
}

export function setWakeWordEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off")
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function onWakeWordPreferenceChange(listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener() }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener("storage", onStorage)
  }
}

// A greeting followed by "Lifty" - or how speech recognition tends to hear it.
// "Lifty" on its own isn't enough, so ordinary talk about Lifty won't wake it.
const WAKE_PHRASE = /\b(hey|hi|hello|ok|okay|yo)\s+(lifty|lefty|lifti|liftie|liftee|lift ?e|lofty|lifting|left e|lift he)\b/

export function matchesWakeWord(transcript: string) {
  const text = transcript.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")
  return WAKE_PHRASE.test(text)
}

/**
 * Listens for the wake phrase while `active`, and calls `onWake` when it's heard.
 * Pauses while the tab is hidden. Reports a blocked microphone through `error`.
 */
export function useWakeWord(active: boolean, onWake: () => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState("")
  const onWakeRef = useRef(onWake)
  onWakeRef.current = onWake

  useEffect(() => {
    if (!active || !isWakeWordSupported()) {
      setListening(false)
      return
    }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    let recognition: any = null
    let stopped = false
    let restartTimer: number | undefined
    let failures = 0
    let running = false // a recognition session is currently live

    const start = () => {
      if (stopped || document.visibilityState !== "visible") return
      recognition = new Ctor()
      recognition.lang = navigator.language || "en-US"
      recognition.continuous = true
      // Interim results catch the phrase as it's said, not after a pause.
      recognition.interimResults = true
      recognition.onstart = () => { running = true; failures = 0; setListening(true); setError("") }
      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (matchesWakeWord(event.results[i][0].transcript)) {
            stopped = true
            try { recognition.abort() } catch {}
            setListening(false)
            onWakeRef.current()
            return
          }
        }
      }
      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          stopped = true
          setError("Microphone access is blocked, so \"Hey Lifty\" can't listen. Allow the microphone for this site in your browser.")
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          failures += 1
        }
      }
      recognition.onend = () => {
        running = false
        setListening(false)
        // Hidden tab: wait for it to come back (onVisibility starts again).
        if (stopped || document.visibilityState !== "visible") return
        // The browser ends a session every so often; start a new one, backing off after repeated errors.
        restartTimer = window.setTimeout(start, Math.min(500 * 2 ** failures, 15000))
      }
      try { recognition.start() } catch { restartTimer = window.setTimeout(start, 1000) }
    }

    // Only listen while HelpLift is the visible tab.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!running) { window.clearTimeout(restartTimer); start() }
      } else {
        try { recognition?.abort() } catch {}
      }
    }

    document.addEventListener("visibilitychange", onVisibility)
    start()
    return () => {
      stopped = true
      window.clearTimeout(restartTimer)
      document.removeEventListener("visibilitychange", onVisibility)
      try { recognition?.abort() } catch {}
      setListening(false)
    }
  }, [active])

  return { listening, error }
}
