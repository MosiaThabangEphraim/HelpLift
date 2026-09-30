"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// The Web Speech API (SpeechRecognition) has no shipped TypeScript lib types
// and is vendor-prefixed in Chrome/Edge/Safari; Firefox doesn't implement it
// at all, so every caller must feature-detect before offering the mic button.
export function isSpeechToTextSupported(): boolean {
  if (typeof window === "undefined") return false
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

// Appends a freshly-recognized chunk of speech to whatever the person already
// typed, without a leading space on an empty field or a doubled space after one.
export function appendSpeech(previous: string, chunk: string): string {
  const trimmedChunk = chunk.trim()
  if (!trimmedChunk) return previous
  if (!previous.trim()) return trimmedChunk
  return previous.replace(/\s+$/, "") + " " + trimmedChunk
}

// Drives one microphone button: starts/stops native speech recognition and
// reports each finished phrase via onFinalText. Recognition runs entirely in
// the browser (or the OS's on-device engine); HelpLift never receives audio.
export function useSpeechToText(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState("")
  const recognitionRef = useRef<any>(null)
  const onFinalTextRef = useRef(onFinalText)
  onFinalTextRef.current = onFinalText

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    setError("")
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Ctor) {
      setError("Voice typing isn't supported in this browser.")
      return
    }
    const recognition = new Ctor()
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US"
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event: any) => {
      let text = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript
      }
      if (text.trim()) onFinalTextRef.current(text)
    }
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was blocked. Allow it in your browser to use voice typing."
          : "Voice typing stopped unexpectedly. Please try again."
      )
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      // start() throws if a recognition session is already running (e.g. a fast double-click); ignore.
    }
  }, [])

  // Stop listening if the component unmounts (dialog closed, navigated away) mid-session.
  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  return { listening, error, start, stop }
}
