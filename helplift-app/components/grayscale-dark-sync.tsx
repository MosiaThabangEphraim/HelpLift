"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

// Grayscale is meant to render as "the dark theme, desaturated" - not its
// own separate light-based look - so every dark: Tailwind utility and every
// .dark CSS variable needs to be active whenever grayscale is selected, on
// top of .grayscale's own filter: grayscale(1).
//
// next-themes only ever applies one theme's own class to <html> (a single
// word - "grayscale" here), so without this, selecting grayscale left
// :root's light colors showing through the filter. The obvious fix -
// mapping the theme name to the string "dark grayscale" via next-themes'
// own `value` prop - doesn't work: this version of next-themes passes that
// whole value straight to classList.add()/remove() as ONE token, and a
// token can't contain a space (throws InvalidCharacterError - see
// https://github.com/pacocoursey/next-themes/issues/397 for the unrelated
// but similarly-flavored class-token assumption elsewhere in this library).
//
// So this does it as a small side effect instead: next-themes keeps
// managing "grayscale" as its own ordinary single-word class, and this
// just also toggles "dark" alongside it, purely by watching resolvedTheme.
export function GrayscaleDarkSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark" || resolvedTheme === "grayscale")
  }, [resolvedTheme])

  return null
}
