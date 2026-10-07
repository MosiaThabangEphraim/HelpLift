"use client"

import { useRef, type ReactNode } from "react"

// For an existing card: add onPointerMove={spotlightMove} plus the classes
// "group relative overflow-hidden", and put <SpotlightGlow /> inside it.
export function spotlightMove(event: React.PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return
  const card = event.currentTarget
  const rect = card.getBoundingClientRect()
  card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`)
  card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`)
}

export function SpotlightGlow({ glow = "rgba(59, 130, 246, 0.12)" }: { glow?: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{ background: `radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${glow}, transparent 60%)` }}
    />
  )
}

// A card with a soft glow that follows the mouse, and a gentle lift on hover
// (homepage feature tiles). Touch screens just get the card - no glow.
export function SpotlightCard({
  children,
  className = "",
  glow = "rgba(59, 130, 246, 0.12)",
}: {
  children: ReactNode
  className?: string
  /** Colour of the glow under the pointer. */
  glow?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const card = ref.current
    if (!card || event.pointerType !== "mouse") return
    const rect = card.getBoundingClientRect()
    card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`)
    card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onPointerMove={move}
      className={`group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-20px_rgba(15,23,42,0.18)] ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${glow}, transparent 60%)` }}
      />
      {children}
    </div>
  )
}
