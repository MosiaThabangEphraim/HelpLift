"use client"

import { useEffect, useState } from "react"

const BAR_COUNT = 5

export function MicrophoneLevelIndicator({ active }: { active: boolean }) {
  const [levels, setLevels] = useState<number[] | null>(null)

  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) {
      setLevels(null)
      return
    }

    let cancelled = false
    let frame = 0
    let lastUpdate = 0
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null
    let samples: Uint8Array<ArrayBuffer> | null = null
    const smoothed = Array(BAR_COUNT).fill(0)

    const stop = () => {
      window.cancelAnimationFrame(frame)
      source?.disconnect()
      analyser?.disconnect()
      stream?.getTracks().forEach(track => track.stop())
      if (context && context.state !== "closed") void context.close()
    }

    const measure = (now: number) => {
      if (!analyser || !samples || cancelled) return
      analyser.getByteTimeDomainData(samples)

      const next = smoothed.map((previous, bar) => {
        const start = Math.floor(bar * samples!.length / BAR_COUNT)
        const end = Math.floor((bar + 1) * samples!.length / BAR_COUNT)
        let energy = 0
        for (let index = start; index < end; index++) {
          const amplitude = (samples![index] - 128) / 128
          energy += amplitude * amplitude
        }
        const rms = Math.sqrt(energy / Math.max(1, end - start))
        const target = Math.min(1, rms * 12)
        const value = previous + (target - previous) * (target > previous ? 0.45 : 0.16)
        smoothed[bar] = value
        return value
      })

      if (now - lastUpdate >= 50) {
        lastUpdate = now
        setLevels(next)
      }
      frame = window.requestAnimationFrame(measure)
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        context = new AudioContext()
        source = context.createMediaStreamSource(stream)
        analyser = context.createAnalyser()
        analyser.fftSize = 512
        samples = new Uint8Array(new ArrayBuffer(analyser.fftSize))
        source.connect(analyser)
        if (context.state === "suspended") await context.resume()
        if (!cancelled) frame = window.requestAnimationFrame(measure)
      } catch {
        if (!cancelled) setLevels(null)
        stop()
      }
    }

    setLevels(null)
    void start()

    return () => {
      cancelled = true
      stop()
    }
  }, [active])

  if (!active) return null

  if (!levels) {
    return (
      <span
        aria-label="Listening"
        className="relative flex h-4 w-4 shrink-0 items-center justify-center"
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
    )
  }

  return (
    <span className="flex h-4 items-center gap-0.5" role="img" aria-label="Microphone input level">
      {levels.map((level, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="w-0.5 rounded-full bg-red-500 transition-transform duration-75"
          style={{ height: "100%", transformOrigin: "bottom", transform: `scaleY(${Math.max(0.12, level)})` }}
        />
      ))}
    </span>
  )
}
