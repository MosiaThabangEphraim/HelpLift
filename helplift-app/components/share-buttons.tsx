"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

// lucide-react doesn't ship brand icons - these are small inline SVGs, drawn
// once here, sized and stroked to sit naturally next to the lucide icons
// around them.
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.022 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.508 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562v1.875h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.918 8.437-9.94z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.1c-.24.68-1.4 1.32-1.93 1.36-.5.05-.98.24-3.28-.68-2.78-1.11-4.56-3.94-4.7-4.12-.14-.19-1.13-1.5-1.13-2.87 0-1.36.72-2.03.97-2.31.25-.28.55-.34.73-.34.19 0 .37 0 .53.01.17.01.4-.06.62.48.24.58.81 2 .88 2.15.07.14.11.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.3.77 1.28 1.66 2.07 1.14 1.02 2.1 1.34 2.4 1.49.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.24.66-.15.27.1 1.7.8 1.99.95.29.14.48.21.55.33.07.12.07.68-.17 1.36z" />
    </svg>
  )
}

// Share buttons for public content (impact stories) - X, LinkedIn, Facebook,
// WhatsApp and a copy-link fallback. Every one of these is a plain share
// intent URL opened in a popup, so this works for signed-in users,
// organizations and anonymous guests alike, with no SDK, API key or cost
// involved - the same free/local-first approach this project has used
// throughout (Harper, the Web Speech APIs, qrcode).
export function ShareButtons({
  url,
  title,
  className = "",
  label = "Share",
}: {
  url: string
  title: string
  className?: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(title)

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=600,height=600")

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (permissions, older browsers) - nothing more to do.
    }
  }

  const iconButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-[#233350] text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {label && <span className="mr-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>}
      <button
        type="button"
        onClick={() => open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`)}
        aria-label="Share on X"
        data-tip="Share on X"
        className={iconButtonClass}
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`)}
        aria-label="Share on LinkedIn"
        data-tip="Share on LinkedIn"
        className={iconButtonClass}
      >
        <LinkedInIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)}
        aria-label="Share on Facebook"
        data-tip="Share on Facebook"
        className={iconButtonClass}
      >
        <FacebookIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`)}
        aria-label="Share on WhatsApp"
        data-tip="Share on WhatsApp"
        className={iconButtonClass}
      >
        <WhatsAppIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={copyLink}
        aria-label="Copy link"
        data-tip={copied ? "Copied!" : "Copy link"}
        className={iconButtonClass}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}
