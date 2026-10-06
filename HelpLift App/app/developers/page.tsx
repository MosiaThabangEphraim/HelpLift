"use client"

import { useState } from "react"
import Link from "next/link"
import { Bug, CheckCircle2, Code2, Heart, Home, Lightbulb, Loader2, Paperclip, Send, ShieldAlert, Wrench, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { DEV_REPORT_BUCKET, DEV_REPORT_FILE_TYPES, DEV_REPORT_MAX_FILE_BYTES, DEV_REPORT_MAX_FILES } from "@/lib/developer-report-files"

// Public "Developers" page: anyone can anonymously report a bug, suggest an
// improvement or report a security issue, optionally with proof files. Sent
// to app/api/developer-reports; admins review them in the Dev reports tab.
//
// The tech stack below is deliberately general - enough for useful
// suggestions, nothing security-sensitive (no versions, keys, environment
// names, access rules or internal routes).

const TYPES = [
  { value: "bug", label: "Bug", description: "Something is broken or behaves wrongly", icon: Bug },
  { value: "improvement", label: "Improvement", description: "An idea to make HelpLift better", icon: Lightbulb },
  { value: "security", label: "Security issue", description: "A vulnerability or privacy risk", icon: ShieldAlert },
  { value: "other", label: "Other", description: "Anything else", icon: Wrench },
] as const

const STACK = [
  { name: "Next.js, React & TypeScript", note: "Web app and server routes" },
  { name: "Tailwind CSS & shadcn/ui", note: "Styling and UI components" },
  { name: "Supabase", note: "PostgreSQL database, authentication and file storage" },
  { name: "Vercel", note: "Hosting" },
  { name: "Recharts", note: "Analytics charts" },
  { name: "Browser Web Speech API", note: "Voice typing and read-aloud" },
  { name: "Generative AI", note: "Lifty, the assistant, and form auto-fill" },
  { name: "Progressive Web App", note: "Installable, offline-aware" },
]

const inputClass = "w-full rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"

export default function DevelopersPage() {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("bug")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [steps, setSteps] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  const [severity, setSeverity] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [website, setWebsite] = useState("") // honeypot - hidden from people
  const [files, setFiles] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const showBugFields = type === "bug" || type === "security"

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
    setIsSending(true)
    setError("")
    try {
      // 1. Files go straight to secure storage (they're too big to pass
      //    through our server), using one-time upload links.
      let reportId: string | undefined
      const attachments: { path: string; name: string }[] = []
      if (files.length > 0) {
        setProgress("Preparing upload...")
        const linkRes = await fetch("/api/developer-reports/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: files.map(file => ({ name: file.name, size: file.size, type: file.type })) }),
        })
        const links = await linkRes.json().catch(() => ({}))
        if (!linkRes.ok) throw new Error(links.message || "Couldn't upload your files.")
        reportId = links.reportId
        const storage = createClient().storage.from(DEV_REPORT_BUCKET)
        for (const [index, file] of files.entries()) {
          setProgress(`Uploading file ${index + 1} of ${files.length}...`)
          const { path, token } = links.uploads[index]
          const { error: uploadError } = await storage.uploadToSignedUrl(path, token, file, { contentType: file.type })
          if (uploadError) throw new Error(`Couldn't upload "${file.name}". Please try again.`)
          attachments.push({ path, name: file.name })
        }
      }

      // 2. The report itself.
      setProgress("Sending report...")
      const res = await fetch("/api/developer-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          report_type: type,
          title,
          description,
          steps_to_reproduce: showBugFields ? steps : "",
          severity: showBugFields ? severity : "",
          page_url: pageUrl,
          contact_email: contactEmail,
          website,
          attachments,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Couldn't send your report. Please try again.")
      setSent(true)
    } catch (err: any) {
      setError(err.message || "Couldn't send your report. Please try again.")
    } finally {
      setIsSending(false)
      setProgress("")
    }
  }

  const reset = () => {
    setTitle(""); setDescription(""); setSteps(""); setPageUrl(""); setSeverity(""); setContactEmail(""); setFiles([]); setSent(false)
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 pt-28 pb-24 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="space-y-4">
          <Link
            href="/"
            aria-label="Go to the HelpLift homepage"
            className="inline-flex items-center gap-2 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740] transition-colors"
          >
            <Home className="h-4 w-4" /> Home
          </Link>
          <div className="inline-flex items-center gap-2 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Code2 className="h-3.5 w-3.5" /> For developers
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Help us build a better HelpLift</h1>
          <p className="max-w-2xl text-slate-600 dark:text-slate-400">
            Found a bug, spotted a security issue, or have an idea to improve the platform? Tell us below. Reports are
            anonymous - we don&apos;t link them to any account - and go straight to the HelpLift team.
          </p>
          <p className="flex max-w-2xl gap-3 border-l-2 border-pink-500 pl-4 text-sm text-slate-600 dark:text-slate-300">
            <Heart className="mt-0.5 h-4 w-4 shrink-0 text-pink-600" />
            <span>
              We truly value your feedback. HelpLift is completely free - we build and run it without charging givers or
              organizations a cent - so every bug you report, idea you share and bit of support you give genuinely helps us
              keep it going and make it better. Thank you!
            </span>
          </p>
        </div>

        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* --- The form --- */}
          <section className="border-t border-slate-200 dark:border-[#233350] pt-6">
            {sent ? (
              <div className="space-y-4 py-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Thank you - your report was sent!</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  The team will review it. {contactEmail ? "We may contact you at the email you gave if we need more detail." : "Since it's anonymous, we won't be able to reply - but every report is read."}
                </p>
                <button type="button" onClick={reset} className="rounded border border-slate-200 dark:border-[#233350] px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#1A2740]">
                  Send another report
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <fieldset>
                  <legend className={labelClass}>What would you like to report?</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TYPES.map(option => {
                      const Icon = option.icon
                      const active = type === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setType(option.value)}
                          aria-pressed={active}
                          className={`flex items-start gap-3 rounded border p-3 text-left transition-colors ${active ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40" : "border-slate-200 dark:border-[#233350] hover:border-blue-300"}`}
                        >
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} />
                          <span>
                            <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">{option.label}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                {type === "security" && (
                  <p className="rounded border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                    Thank you for reporting responsibly. Please don&apos;t access other people&apos;s data, make real payments, or share the
                    issue publicly until we&apos;ve fixed it. Describe what you found and how to reproduce it safely.
                  </p>
                )}

                <div>
                  <label htmlFor="title" className={labelClass}>Title</label>
                  <input id="title" required minLength={5} maxLength={150} value={title} onChange={e => setTitle(e.target.value)} placeholder={type === "improvement" ? "e.g. Let givers filter needs by distance" : "e.g. Donate button does nothing on mobile"} className={inputClass} />
                </div>

                <div>
                  <label htmlFor="description" className={labelClass}>{type === "improvement" ? "Your idea" : "What happened?"}</label>
                  <textarea id="description" required minLength={20} maxLength={5000} value={description} onChange={e => setDescription(e.target.value)} rows={5} placeholder={type === "improvement" ? "Describe the idea and why it would help." : "What did you do, what happened, and what did you expect to happen?"} className={inputClass} />
                </div>

                {showBugFields && (
                  <>
                    <div>
                      <label htmlFor="steps" className={labelClass}>Steps to reproduce (optional)</label>
                      <textarea id="steps" maxLength={3000} value={steps} onChange={e => setSteps(e.target.value)} rows={3} placeholder={"1. Go to ...\n2. Click ...\n3. See ..."} className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="severity" className={labelClass}>How serious is it? (optional)</label>
                      <select id="severity" value={severity} onChange={e => setSeverity(e.target.value)} className={inputClass}>
                        <option value="">Not sure</option>
                        <option value="low">Low - minor or cosmetic</option>
                        <option value="medium">Medium - annoying, has a workaround</option>
                        <option value="high">High - blocks something important</option>
                        <option value="critical">Critical - data, money or security at risk</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="page" className={labelClass}>Which page? (optional)</label>
                  <input id="page" maxLength={300} value={pageUrl} onChange={e => setPageUrl(e.target.value)} placeholder="e.g. /needs or the full link" className={inputClass} />
                </div>

                <div>
                  <span className={labelClass}>Proof (optional)</span>
                  {files.length > 0 && (
                    <ul className="mb-2 space-y-1">
                      {files.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs">
                          <span className="truncate">{file.name}</span>
                          <button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`} className="text-slate-400 hover:text-red-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {files.length < DEV_REPORT_MAX_FILES && (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded border-2 border-dashed border-slate-300 dark:border-[#233350] p-3 text-xs font-semibold text-slate-500 hover:border-blue-400">
                      <Paperclip className="h-4 w-4" /> Attach screenshots, PDFs or screen recordings (up to {DEV_REPORT_MAX_FILES} files, 25 MB each)
                      <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4,video/webm" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = "" }} />
                    </label>
                  )}
                </div>

                <div>
                  <label htmlFor="contact" className={labelClass}>Contact email (optional)</label>
                  <input id="contact" type="email" maxLength={200} value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Only if you'd like us to be able to reply" className={inputClass} />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave empty to stay completely anonymous.</p>
                </div>

                {/* Honeypot: invisible to people, tempting to spam bots. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
                </div>

                {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

                <button type="submit" disabled={isSending} className="inline-flex items-center gap-2 rounded bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSending ? progress || "Sending..." : "Send report"}
                </button>
              </form>
            )}
          </section>

          {/* --- Tech stack and guidelines --- */}
          <aside className="space-y-8">
            <section className="border-t border-slate-200 dark:border-[#233350] pt-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">What HelpLift is built with</h2>
              <ul className="space-y-2.5">
                {STACK.map(item => (
                  <li key={item.name}>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{item.note}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="border-t border-slate-200 dark:border-[#233350] pt-6 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Good reports</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>One issue or idea per report.</li>
                <li>Say what you expected and what actually happened.</li>
                <li>Screenshots or a short recording help a lot.</li>
                <li>Never include passwords, codes or anyone&apos;s personal details.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
