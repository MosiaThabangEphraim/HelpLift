"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { subscribeFeedback, type FeedbackEvent } from "@/lib/inline-feedback"

const AUTO_HIDE_MS = 3000

// Single global listener + bubble, mounted once in the root layout (same
// pattern as SiteTooltips) - renders whatever showFeedback() last sent,
// positioned next to the button that was clicked, and fades itself out.
export function InlineFeedback() {
  const [item, setItem] = useState<FeedbackEvent | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return subscribeFeedback((event) => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      setItem(event)
      timerRef.current = window.setTimeout(() => setItem(null), AUTO_HIDE_MS)
    })
  }, [])

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])

  useEffect(() => {
    if (!item || !bubbleRef.current) {
      setPosition(null)
      return
    }
    const bubble = bubbleRef.current.getBoundingClientRect()
    const margin = 12
    if (item.rect) {
      let top = item.rect.top - bubble.height - margin
      if (top < margin) top = item.rect.bottom + margin
      let left = item.rect.left + item.rect.width / 2 - bubble.width / 2
      left = Math.max(margin, Math.min(left, window.innerWidth - bubble.width - margin))
      setPosition({ left, top })
    } else {
      // No recent click to anchor to - still show it, bottom-center, rather
      // than drop the message entirely.
      setPosition({ left: window.innerWidth / 2 - bubble.width / 2, top: window.innerHeight - bubble.height - 24 })
    }
  }, [item])

  if (!item) return null
  const isError = item.variant === "error"
  return (
    <div
      ref={bubbleRef}
      role="status"
      aria-live="polite"
      style={{ position: "fixed", left: position?.left ?? -9999, top: position?.top ?? -9999, visibility: position ? "visible" : "hidden" }}
      className={`z-[9999] flex max-w-[280px] items-start gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-200 ${
        isError ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
      }`}
    >
      {isError ? <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
      <span>{item.text}</span>
    </div>
  )
}
