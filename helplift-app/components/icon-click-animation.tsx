"use client"

import { useEffect } from "react"

// Dashboard header buttons (.mobile-toolbar) don't animate on their own; their
// icon plays a short wiggle each time the button is pressed. This restarts the
// animation on every press by re-adding the "icon-clicked" class (globals.css).
// Mounted once in the root layout, like ClickSoundProvider.
export function IconClickAnimation() {
  useEffect(() => {
    const onPress = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.("button, a, [role=button]")
      if (!target || !target.closest(".mobile-toolbar")) return
      const icon = target.querySelector<SVGElement>("svg.lucide")
      if (!icon) return
      icon.classList.remove("icon-clicked")
      void icon.getBoundingClientRect() // restart the animation
      icon.classList.add("icon-clicked")
      icon.addEventListener("animationend", () => icon.classList.remove("icon-clicked"), { once: true })
    }
    document.addEventListener("pointerdown", onPress, true)
    return () => document.removeEventListener("pointerdown", onPress, true)
  }, [])

  return null
}
