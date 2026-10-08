"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, EyeOff, Flag, Loader2, Paperclip, Send, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { DEV_REPORT_FILE_TYPES, DEV_REPORT_MAX_FILE_BYTES, DEV_REPORT_MAX_FILES } from "@/lib/developer-report-files"
import { TIP_OFF_BUCKET, TIP_OFF_CATEGORIES } from "@/lib/tip-offs"

// Anonymous tip-off (whistleblowing) form from the homepage: report a
// registered organization for illegal or suspicious activity. Nothing about
// the sender is saved (app/api/tip-offs); the HelpLift team investigates and
// the organization is never told who reported it. Evidence files go straight
// to private storage with one-time upload links (app/api/tip-offs/uploads).

type OrgOption = { id: string; name: string; city?: string | null; province?: string | null }

const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
const inputClass = "w-full rounded-xl bg-slate-100 dark:bg-slate-800/70 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-500/40"

export function TipOffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [organizations, setOrganizations] = useState<OrgOption[]>([])
  const [orgQuery, setOrgQuery] = useState("")
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [category, setCategory] = useState("")
  const [details, setDetails] = useState("")
  const [occurredAt, setOccurredAt] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [website, setWebsite] = useState("") // honeypot - hidden from people
  const [isSending, setIsSending] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [sentMessage, setSentMessage] = useState("")

  // Registered organizations, for picking the one the tip-off is about.
  useEffect(() => {
    if (!open || organizations.length > 0) return
    fetch("/api/public/organizations")
      .then(res => res.json())
      .then(data => setOrganizations(Array.isArray(data.organizations) ? data.organizations : []))
      .catch(() => {})
  }, [open, organizations.length])

  const suggestions = useMemo(() => {
    const query = orgQuery.trim().toLowerCase()
    if (!query || orgId) return []
    return organizations.filter(org => org.name.toLowerCase().includes(query)).slice(0, 6)
  }, [orgQuery, orgId, organizations])

  const reset = () => {
    setOrgQuery(""); setOrgId(null); setCategory(""); setDetails(""); setOccurredAt(""); setContactEmail("")
    setFiles([]); setWebsite(""); setError(""); setSentMessage(""); setProgress("")
  }

  const addFiles = (picked: FileList | null) => {
    setError("")
    const next = [...files, ...Array.from(picked || [])]
    const tooBig = next.find(file => file.size > DEV_REPORT_MAX_FILE_BYTES)
    if (tooBig) return setError(`"${tooBig.name}" is larger than 25 MB.`)
    const wrongType = next.find(file => !DEV_REPORT_FILE_TYPES.includes(file.type))
    if (wrongType) return setError(`"${wrongType.name}" isn't supported. Use an image, PDF, MP4 or WebM.`)
    if (next.length > DEV_REPORT_MAX_FILES) return setError(`You can attach up to ${DEV_REPORT_MAX_FILES} files.`)
    setFiles(next)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (orgQuery.trim().length < 2) return setError("Tell us which organization this is about.")
    if (!category) return setError("Choose what the concern is about.")
    if (details.trim().length < 30) return setError("Please describe what happened in a bit more detail (at least 30 characters).")
    setIsSending(true)
    setError("")
    try {
      // 1. Evidence goes straight to private storage with one-time upload links.
      let tipOffId: string | undefined
      const attachments: { path: string; name: string }[] = []
      if (files.length > 0) {
        setProgress("Preparing upload...")
        const linkRes = await fetch("/api/tip-offs/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: files.map(file => ({ name: file.name, size: file.size, type: file.type })) }),
        })
        const links = await linkRes.json().catch(() => ({}))
        if (!linkRes.ok) throw new Error(links.message || "Couldn't upload your files.")
        tipOffId = links.tipOffId
        const storage = createClient().storage.from(TIP_OFF_BUCKET)
        for (const [index, file] of files.entries()) {
          setProgress(`Uploading file ${index + 1} of ${files.length}...`)
          const { path, token } = links.uploads[index]
          const { error: uploadError } = await storage.uploadToSignedUrl(path, token, file, { contentType: file.type })
          if (uploadError) throw new Error(`Couldn't upload "${file.name}". Please try again.`)
          attachments.push({ path, name: file.name })
        }
      }

      // 2. The tip-off itself.
      setProgress("Sending tip-off...")
      const res = await fetch("/api/tip-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tip_off_id: tipOffId,
          organization_id: orgId,
          organization_name: orgQuery,
          category,
          details,
          occurred_at_text: occurredAt,
          contact_email: contactEmail,
          website,
          attachments,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Couldn't send your tip-off. Please try again.")
      setSentMessage(data.message || "Thank you. Your tip-off has been sent.")
    } catch (err: any) {
      setError(err.message || "Couldn't send your tip-off. Please try again.")
    } finally {
      setIsSending(false)
      setProgress("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next && sentMessage) reset() }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/30">
              <Flag className="h-5 w-5" />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>Anonymous tip-off</DialogTitle>
              <DialogDescription>Report a registered organization for illegal or suspicious activity.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {sentMessage ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">Tip-off received</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{sentMessage}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={reset} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200">Send another</button>
              <button type="button" onClick={() => { onOpenChange(false); reset() }} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/25">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="flex items-start gap-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 p-3 text-xs leading-relaxed text-orange-900 dark:text-orange-200 text-justify-smart">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This form is anonymous. We don&apos;t save your name, account, IP address or device, and the organization is never told
                that it was reported or by whom. The HelpLift team will investigate every tip-off.
              </span>
            </p>

            <div className="relative">
              <label htmlFor="tip-org" className={labelClass}>Organization</label>
              <input
                id="tip-org"
                value={orgQuery}
                onChange={e => { setOrgQuery(e.target.value); setOrgId(null); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                maxLength={200}
                autoComplete="off"
                placeholder="Start typing the organization's name"
                className={inputClass}
              />
              {orgId && <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Registered organization selected.</p>}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-xl">
                  {suggestions.map(org => (
                    <li key={org.id}>
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setOrgQuery(org.name); setOrgId(org.id); setShowSuggestions(false) }}
                        className="block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{org.name}</span>
                        {(org.city || org.province) && <span className="block text-xs text-slate-500">{[org.city, org.province].filter(Boolean).join(", ")}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label htmlFor="tip-category" className={labelClass}>What is the concern?</label>
              <select id="tip-category" value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
                <option value="">Choose one</option>
                {TIP_OFF_CATEGORIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="tip-details" className={labelClass}>What happened?</label>
              <textarea
                id="tip-details"
                value={details}
                onChange={e => setDetails(e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder="Describe what you saw or know: who was involved, what was done, and how you know. Include as much detail as you safely can."
                className={`${inputClass} resize-y`}
              />
            </div>

            <div>
              <label htmlFor="tip-when" className={labelClass}>When did it happen? (optional)</label>
              <input id="tip-when" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} maxLength={200} placeholder="For example: March 2026, or ongoing" className={inputClass} />
            </div>

            <div>
              <span className={labelClass}>Evidence (optional)</span>
              {files.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 dark:bg-slate-800/70 px-3 py-1.5 text-xs">
                      <span className="truncate">{file.name}</span>
                      <button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`} className="text-slate-400 hover:text-red-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {files.length < DEV_REPORT_MAX_FILES && (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 p-3 text-xs font-semibold text-slate-500 hover:text-orange-600">
                  <Paperclip className="h-4 w-4 shrink-0" /> Attach photos, documents or videos (up to {DEV_REPORT_MAX_FILES} files, 25 MB each)
                  <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4,video/webm" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = "" }} />
                </label>
              )}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Files can contain hidden details such as names or locations. Remove anything that could identify you.</p>
            </div>

            <div>
              <label htmlFor="tip-contact" className={labelClass}>Contact email (optional)</label>
              <input id="tip-contact" type="email" maxLength={200} value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Only if you are happy for us to follow up" className={inputClass} />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave empty to stay completely anonymous.</p>
            </div>

            {/* Honeypot: invisible to people, tempting to spam bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-justify-smart">
              If someone is in immediate danger, contact the police (10111) first.
            </p>

            {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={isSending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? progress || "Sending..." : "Send anonymous tip-off"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
