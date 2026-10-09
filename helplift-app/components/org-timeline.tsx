"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CalendarDays,
  FileText,
  Flag,
  Loader2,
  MapPin,
  Megaphone,
  Newspaper,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { stageFormFiles } from "@/lib/stage-uploads"
import { describeUploadLimit, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { appendSpeech } from "@/lib/speech-to-text"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { ReadAloudButton } from "@/components/read-aloud-button"
import { ShareButtons } from "@/components/share-buttons"
import { AdminDeleteButton } from "@/components/admin-delete-button"
import {
  TIMELINE_POST_TYPES,
  isImageAttachment,
  timelinePostTypeLabel,
  type TimelinePost,
  type TimelinePostType,
  type TimelineViewer,
} from "@/lib/org-timeline"

// An organization's timeline (lib/org-timeline.ts): its updates, events,
// milestones and news, newest first with pinned posts on top. Used on the
// organization's dashboard (where its team posts) and on its public profile.
// What the viewer can do comes from the API: coordinators and up post and
// edit their own posts, managers and owners edit, delete or pin any post,
// administrators can delete any post.

const TYPE_STYLE: Record<TimelinePostType, { icon: React.ComponentType<{ className?: string }>; gradient: string; chip: string }> = {
  update: { icon: Megaphone, gradient: "from-blue-500 to-indigo-600", chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  event: { icon: CalendarDays, gradient: "from-emerald-500 to-teal-600", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  milestone: { icon: Trophy, gradient: "from-amber-400 to-orange-500", chip: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  news: { icon: Newspaper, gradient: "from-violet-500 to-purple-600", chip: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
}

const fullDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// --- Composer: new posts and edits ---------------------------------------------

function Composer({ initial, onSaved, onCancel }: { initial?: TimelinePost; onSaved: (post: TimelinePost) => void; onCancel?: () => void }) {
  const [type, setType] = useState<TimelinePostType>(initial?.post_type || "update")
  const [title, setTitle] = useState(initial?.title || "")
  const [body, setBody] = useState(initial?.body || "")
  const [eventAt, setEventAt] = useState(toLocalInput(initial?.event_starts_at || null))
  const [eventLocation, setEventLocation] = useState(initial?.event_location || "")
  const [files, setFiles] = useState<File[]>([])
  const [removing, setRemoving] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const keptAttachments = (initial?.attachments || []).filter(file => !removing.includes(file.path))

  const save = async () => {
    setError("")
    if (body.trim().length < 2) return setError("Write something to share.")
    if (type === "event" && !eventAt) return setError("Add the event's date and time.")
    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.set("post_type", type)
      formData.set("title", title)
      formData.set("body", body)
      formData.set("event_starts_at", type === "event" && eventAt ? new Date(eventAt).toISOString() : "")
      formData.set("event_location", type === "event" ? eventLocation : "")
      removing.forEach(path => formData.append("remove_attachments", path))
      files.forEach(file => formData.append("attachments", file))
      const staged = await stageFormFiles(formData, UPLOAD_LIMITS.timelineAttachments)
      const res = await fetch(initial ? `/api/organization/timeline/${initial.id}` : "/api/organization/timeline", { method: initial ? "PATCH" : "POST", body: staged })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Couldn't save the post.")
      onSaved(data.post)
      if (!initial) { setTitle(""); setBody(""); setEventAt(""); setEventLocation(""); setFiles([]); setType("update") }
    } catch (err: any) {
      setError(err.message || "Couldn't save the post.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white dark:bg-[#121B2E] p-4 shadow-sm">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Post type">
        {TIMELINE_POST_TYPES.map(option => {
          const Icon = TYPE_STYLE[option.value].icon
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              aria-pressed={type === option.value}
              className={`btn-pill ${type === option.value ? "btn-pill--blue" : "btn-pill--neutral"}`}
            >
              <Icon /> {option.label}
            </button>
          )
        })}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder="Title (optional)" className="field" aria-label="Title" />
      <div>
        <div className="mb-1 flex justify-end"><GrammarCheckButton text={body} onTextChange={setBody} /></div>
        <div className="relative">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={5000}
            rows={4}
            placeholder={type === "event" ? "What's happening, and who should come?" : "Share an update, news or a milestone with your supporters..."}
            className="field min-h-24 pr-11"
            aria-label="Post text"
          />
          <MicButton className="top-2 right-2" onText={text => setBody(current => appendSpeech(current, text))} />
        </div>
      </div>
      {type === "event" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-bold text-slate-500 dark:text-slate-400">
            Date and time
            <input type="datetime-local" value={eventAt} onChange={e => setEventAt(e.target.value)} className="field" />
          </label>
          <label className="space-y-1 text-xs font-bold text-slate-500 dark:text-slate-400">
            Location (optional)
            <input value={eventLocation} onChange={e => setEventLocation(e.target.value)} maxLength={200} placeholder="e.g. School hall, Soweto" className="field" />
          </label>
        </div>
      )}

      {(keptAttachments.length > 0 || files.length > 0) && (
        <ul className="flex flex-wrap gap-1.5">
          {keptAttachments.map(file => (
            <li key={file.path} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-semibold">
              <Paperclip className="h-3 w-3 shrink-0" /> <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => setRemoving(list => [...list, file.path])} aria-label={`Remove ${file.name}`} className="text-slate-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
              <Paperclip className="h-3 w-3 shrink-0" /> <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => setFiles(list => list.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`} className="opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-pill btn-pill--neutral" data-tip={describeUploadLimit(UPLOAD_LIMITS.timelineAttachments)}>
          <Paperclip /> Attach photos or documents
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={e => { setFiles(list => [...list, ...Array.from(e.target.files || [])]); e.target.value = "" }}
        />
        <div className="ml-auto flex items-center gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="btn-pill btn-pill--neutral">Cancel</button>}
          <button type="button" onClick={save} disabled={isSaving} className="btn-pill btn-pill--blue">
            {isSaving ? <Loader2 className="animate-spin" /> : <Send />}
            {initial ? "Save changes" : "Post"}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- One post --------------------------------------------------------------------

function PostCard({ post, viewer, organizationName, onChanged, onRemoved }: {
  post: TimelinePost
  viewer: TimelineViewer
  organizationName: string
  onChanged: (post: TimelinePost) => void
  onRemoved: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const style = TYPE_STYLE[post.post_type] || TYPE_STYLE.update
  const Icon = style.icon
  const canEdit = viewer.canManageAll || (viewer.canPost && post.author_id === viewer.userId)
  const images = post.attachments.filter(isImageAttachment)
  const documents = post.attachments.filter(file => !isImageAttachment(file))
  const long = post.body.length > 420

  const patch = async (fields: Record<string, string>) => {
    setBusy(true); setError("")
    try {
      const formData = new FormData()
      Object.entries(fields).forEach(([key, value]) => formData.set(key, value))
      const res = await fetch(`/api/organization/timeline/${post.id}`, { method: "PATCH", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Couldn't update the post.")
      onChanged(data.post)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true); setError("")
    try {
      const res = await fetch(`/api/organization/timeline/${post.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Couldn't delete the post.")
      onRemoved(post.id)
    } catch (err: any) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (editing) {
    return <Composer initial={post} onSaved={saved => { onChanged(saved); setEditing(false) }} onCancel={() => setEditing(false)} />
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/organizations/${post.organization_id}#post-${post.id}` : ""

  return (
    <article id={`post-${post.id}`} className="relative scroll-mt-28 rounded-2xl bg-white dark:bg-[#121B2E] p-4 md:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.gradient} text-white shadow-md`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${style.chip}`}>{timelinePostTypeLabel(post.post_type)}</span>
            {post.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-[#1A2740] px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300"><Pin className="h-3 w-3" /> Pinned</span>}
          </div>
          {post.title && <h3 className="mt-1.5 text-base font-extrabold leading-snug text-slate-900 dark:text-slate-100 break-words">{post.title}</h3>}
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" title={fullDate(post.created_at)}>
            Posted {fullDate(post.created_at)} · {timeAgo(post.created_at)}
            {post.edited_at && <> · edited</>}
            {viewer.canPost && post.author_name && <> · by {post.author_name}</>}
          </p>
        </div>
      </div>

      {post.post_type === "event" && post.event_starts_at && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {fullDate(post.event_starts_at)}</span>
          {post.event_location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {post.event_location}</span>}
          {new Date(post.event_starts_at).getTime() < Date.now() && <span className="text-xs font-bold text-emerald-700/70 dark:text-emerald-400/70">Past event</span>}
        </div>
      )}

      <p className={`mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300 ${long && !expanded ? "line-clamp-6" : ""}`}>{post.body}</p>
      {long && (
        <button type="button" onClick={() => setExpanded(value => !value)} className="mt-1 text-xs font-bold text-blue-600 dark:text-blue-400">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      {images.length > 0 && (
        <div className={`mt-3 grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
          {images.map(file => (
            <a key={file.path} href={file.url} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-xl bg-slate-100 dark:bg-[#1A2740]">
              <img src={file.url} alt={file.name} loading="lazy" className={`w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${images.length === 1 ? "max-h-96" : "aspect-square"}`} />
            </a>
          ))}
        </div>
      )}
      {documents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {documents.map(file => (
            <a key={file.path} href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600">
              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{file.name}</span> <span className="shrink-0 text-slate-400">{fileSize(file.size)}</span>
            </a>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ReadAloudButton text={[post.title, post.body].filter(Boolean).join(". ")} iconOnly label="Listen to this post" />
        {shareUrl && <ShareButtons url={shareUrl} title={post.title || `${organizationName} on HelpLift`} />}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {viewer.canManageAll && (
            <button type="button" onClick={() => patch({ pinned: post.pinned ? "false" : "true" })} disabled={busy} className="btn-pill btn-pill--neutral" data-tip={post.pinned ? "Unpin this post" : "Pin to the top of your timeline"}>
              {post.pinned ? <PinOff /> : <Pin />} {post.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} disabled={busy} className="btn-pill btn-pill--neutral"><Pencil /> Edit</button>
          )}
          {canEdit && (confirmingDelete ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Delete this post?</span>
              <button type="button" onClick={remove} disabled={busy} className="btn-pill btn-pill--red-solid">{busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete</button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="btn-pill btn-pill--neutral">Keep</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} aria-label="Delete post" data-tip="Delete this post" className="btn-delete"><Trash2 className="h-4 w-4" /></button>
          ))}
          {!canEdit && viewer.isAdmin && <AdminDeleteButton kind="timeline-post" id={post.id} onDeleted={() => onRemoved(post.id)} />}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
    </article>
  )
}

// --- The timeline ------------------------------------------------------------------

export function OrgTimeline({
  organizationId,
  organizationName,
  refreshKey = 0,
  heading = true,
}: {
  organizationId: string
  organizationName: string
  refreshKey?: number
  /** Show the section heading (the dashboard tab has its own). */
  heading?: boolean
}) {
  const [posts, setPosts] = useState<TimelinePost[] | null>(null)
  const [viewer, setViewer] = useState<TimelineViewer>({ userId: null, canPost: false, canManageAll: false, isAdmin: false })
  const [composing, setComposing] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/organizations/${organizationId}/timeline`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      setPosts(Array.isArray(data.posts) ? data.posts : [])
      if (data.viewer) setViewer(data.viewer)
      setError(res.ok ? "" : data.message || "")
    } catch {
      setPosts(current => current ?? [])
      setError("The timeline couldn't load. Try again shortly.")
    }
  }, [organizationId])

  useEffect(() => { load() }, [load, refreshKey])

  // A shared link (#post-...) scrolls to that post once it's loaded.
  useEffect(() => {
    if (!posts?.length || typeof window === "undefined" || !window.location.hash.startsWith("#post-")) return
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [posts])

  // Pinned first, then newest.
  const sorted = (list: TimelinePost[]) => [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))

  return (
    <section id="timeline" className="scroll-mt-28 space-y-4">
      {heading && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-blue-600" /> Timeline
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Updates, events and news from {organizationName}.</p>
          </div>
        </div>
      )}

      {viewer.canPost && (composing ? (
        <Composer onSaved={post => { setPosts(list => sorted([post, ...(list || [])])); setComposing(false) }} onCancel={() => setComposing(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-white dark:bg-[#121B2E] p-4 text-left shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white"><Plus className="h-5 w-5" /></span>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Share an update, event, milestone or news...</span>
        </button>
      ))}

      {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

      {posts === null ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/70 dark:bg-[#121B2E]/60 p-8 text-center">
          <Flag className="h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {viewer.canPost ? "Nothing posted yet. Share your first update with your supporters." : `${organizationName} hasn't posted anything yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              viewer={viewer}
              organizationName={organizationName}
              onChanged={updated => setPosts(list => sorted((list || []).map(item => (item.id === updated.id ? updated : item))))}
              onRemoved={id => setPosts(list => (list || []).filter(item => item.id !== id))}
            />
          ))}
        </div>
      )}
    </section>
  )
}
