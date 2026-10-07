'use client'

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // next-themes prevents the flash itself, by injecting a script into the
  // server-rendered HTML that the browser runs before React hydrates - so
  // NextThemesProvider needs to render unconditionally, during SSR, for
  // that script to actually be part of the initial page. Gating it behind
  // a client-only "mounted" flag (the previous version of this file) held
  // it back until after the first client render, which defeated that
  // mechanism (a script inserted by a later React re-render never
  // executes) and is also what trips React 19's "Encountered a script tag
  // while rendering React component" dev warning - see
  // https://github.com/pacocoursey/next-themes/issues/397
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
