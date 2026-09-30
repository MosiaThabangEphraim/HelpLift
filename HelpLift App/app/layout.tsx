import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import PublicShell from "@/components/public-shell"
import { Toaster } from "@/components/ui/sonner"
import { SiteTooltips } from "@/components/site-tooltips"
import { InlineFeedback } from "@/components/inline-feedback"
import { GrayscaleDarkSync } from "@/components/grayscale-dark-sync"
import { RouteHistoryTracker } from "@/components/route-history-tracker"
import { OfflineProvider } from "@/components/offline-provider"
import { FontSizeProvider } from "@/components/font-size-provider"
import { SiteVisitTracker } from "@/components/site-visit-tracker"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

// layout.tsx

export const metadata: Metadata = {
  title: "HelpLift - Connecting Communities in Need with Givers",
  description: "HelpLift connects organizations posting community needs with individuals and businesses ready to help.",
  manifest: "/manifest.json", // <-- ADD THIS
  appleWebApp: {              // <-- ADD THIS FOR IPHONE
    capable: true,
    statusBarStyle: "default",
    title: "HelpLift",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport = {
  themeColor: "#ffffff", // Change this to match your app's header color
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zooming which makes it feel more like an app
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          disableTransitionOnChange
          themes={["light", "dark", "high-contrast", "grayscale"]}
        >
          {/* First tab-stop on every page: lets someone navigating by keyboard
              jump straight past the repeated header/nav, instead of tabbing
              through it fresh on every single page. Invisible until it
              receives focus. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-full focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg dark:focus:bg-white dark:focus:text-slate-900"
          >
            Skip to main content
          </a>
          <div id="main-content" tabIndex={-1} className="outline-none">
            <PublicShell>
              {children}
            </PublicShell>
          </div>
          <Toaster />
          <SiteTooltips />
          <InlineFeedback />
          <GrayscaleDarkSync />
          <RouteHistoryTracker />
          <OfflineProvider />
          <FontSizeProvider />
          <SiteVisitTracker />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}