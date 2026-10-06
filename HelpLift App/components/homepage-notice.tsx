"use client"

import { useEffect, useState } from "react"
import { Megaphone, Paperclip, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ReadAloudButton } from "@/components/read-aloud-button"

// The admin's public notice at the top of the homepage (Send Announcement ->
// "Homepage public notice"; turned off in Platform Settings). Everyone who
// opens the site sees it, signed in or not. Read straight from
// platform_settings ("homepage_notice") with the public client - platform
// settings are readable by anyone.
//
// Dismissal is remembered on this device against the notice's updated_at, so
// a new or edited notice shows again even to people who closed the old one -
// the same approach as the login page banner.

const DISMISSED_KEY = "homepageNoticeDismissedAt"

type Notice = { title: string; message: string; updatedAt: string; attachments: { name: string; url: string }[] }

export function HomepageNotice({ className = "" }: { className?: string }) {
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.from("platform_settings").select("value, updated_at").eq("key", "homepage_notice").maybeSingle()
        const value = data?.value as { enabled?: boolean; title?: string; message?: string; attachments?: { path: string; name: string }[] } | undefined
        if (!value?.enabled || !value.message?.trim() || !data?.updated_at) return
        try {
          if (localStorage.getItem(DISMISSED_KEY) === data.updated_at) return
        } catch {}
        // Same public bucket as the login banner's attachments - plain public URLs.
        const attachments = (value.attachments || []).map(file => ({
          name: file.name,
          url: supabase.storage.from("login-banner-attachments").getPublicUrl(file.path).data.publicUrl,
        }))
        setNotice({ title: value.title?.trim() || "", message: value.message, updatedAt: data.updated_at, attachments })
      } catch {
        // No notice is better than a broken homepage.
      }
    }
    load()
  }, [])

  if (!notice) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, notice.updatedAt)
    } catch {
      // Storage blocked - it just won't stay dismissed after a reload.
    }
    setNotice(null)
  }

  return (
    <section
      role="region"
      aria-label="Announcement from HelpLift"
      className={`max-w-5xl mx-auto animate-in fade-in slide-in-from-top-2 duration-500 ${className}`}
    >
      <div className="flex items-start gap-3 rounded border border-blue-200 dark:border-blue-900 border-l-4 border-l-blue-600 bg-blue-50 dark:bg-blue-950/40 p-4">
        <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0 flex-1 space-y-1">
          {notice.title && <p className="font-bold text-slate-900 dark:text-slate-100">{notice.title}</p>}
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{notice.message}</p>
          <ReadAloudButton text={notice.title ? `${notice.title}. ${notice.message}` : notice.message} label="Listen" />
          {notice.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {notice.attachments.map(file => (
                <a
                  key={file.url}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded border border-blue-200 dark:border-blue-900 bg-white dark:bg-[#121B2E] px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                >
                  <Paperclip className="h-3 w-3" /> {file.name}
                </a>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          data-tip="Dismiss"
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-blue-100 hover:text-slate-700 dark:hover:bg-blue-900/50 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
