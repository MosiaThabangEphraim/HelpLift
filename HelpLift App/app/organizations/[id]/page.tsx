"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Building2,
  CheckCircle2,
  MapPin,
  Mail,
  Phone,
  HeartHandshake,
  Calendar,
  Sparkles,
  Loader2,
  ArrowLeft,
  Quote,
  Send,
  Flame,
  AlertTriangle,
  PackageCheck,
  MessageSquare
} from "lucide-react"
import { StoryMediaGallery } from "@/components/story-media-gallery"
import { MessageComposeDialog } from "@/components/message-compose-dialog"
import { useCanMessage } from "@/hooks/use-can-message"
import { BackButton } from "@/components/back-button"

type OrganizationProfile = {
  id: string
  name: string
  type: string
  city: string | null
  province: string | null
  address: string | null
  contact_email: string
  phone: string | null
  mission: string | null
  verification_status: string
  logo_url?: string | null
  created_at: string
  // Present only for signed-in visitors.
  message_recipient_id?: string
  is_own?: boolean
}

type Need = {
  id: string
  title: string
  description: string
  category: string
  location: string | null
  quantity: string | null
  target_amount: number | null
  due_date: string | null
  urgency: string
  status: string
}

type StoryMedia = { id: string; media_type: "image" | "video"; url: string }

type Story = {
  id: string
  title: string
  content: string
  author_role: string | null
  image_url: string | null
  video_url?: string | null
  created_at: string
  media?: StoryMedia[]
}

export default function OrganizationPublicProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [org, setOrg] = useState<OrganizationProfile | null>(null)
  const [needs, setNeeds] = useState<Need[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const { signedIn, isViewer } = useCanMessage()
  const [isMessaging, setIsMessaging] = useState(false)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)

  const handleMessage = () => {
    if (!signedIn || !org?.message_recipient_id) {
      setShowSignInPrompt(true)
      return
    }
    setShowSignInPrompt(false)
    setIsMessaging(true)
  }

  useEffect(() => {
    if (!id) return
    loadProfile()
  }, [id])

  const loadProfile = async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/public/organizations/${id}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load organization profile.")
      }
      setOrg(data.organization)
      setNeeds(data.needs || [])
      setStories(data.stories || [])
    } catch (err: any) {
      setError(err.message || "Could not load organization.")
    } finally {
      setIsLoading(false)
    }
  }

  const renderUrgencyBadge = (urgency?: string) => {
    const level = (urgency || "medium").toLowerCase()
    if (level === "high") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
          <Flame className="w-3 h-3 fill-red-500" />
          High
        </span>
      )
    }
    if (level === "medium") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          Medium
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
        <PackageCheck className="w-3 h-3" />
        Standard
      </span>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-slate-950">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-slate-950 px-4 text-center">
        <div className="p-6 max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-xl font-bold">Organization Profile Unavailable</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error || "We could not find the organization profile you were looking for."}</p>
          <Link
            href="/needs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Browse Community Needs</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pt-28 pb-24 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-10">

        <BackButton fallbackHref="/organizations" />

        {/* Organization Header Card */}
        <header className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start md:items-center gap-5">
              {org.logo_url ? (
                <img src={org.logo_url} alt={`${org.name} logo`} className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-blue-600/20 shrink-0 border border-slate-200 dark:border-slate-800" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
                  <Building2 className="w-8 h-8" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    {org.name}
                  </h1>
                  {org.verification_status === "approved" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified Organization
                    </span>
                  )}
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold mt-1">
                  {org.type} · Registered Entity
                </p>
                {org.is_own ? (
                  <p className="mt-3 text-xs font-bold text-slate-400">This is your organization's public profile.</p>
                ) : isViewer ? (
                  <span
                    aria-disabled="true"
                    data-tip="Viewers have read-only access and can't send messages. Ask an owner or manager."
                    className="mt-3 inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-400 opacity-70"
                  >
                    <MessageSquare className="w-4 h-4" /> Message
                  </span>
                ) : (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleMessage}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-bold transition-colors"
                      data-tip={signedIn ? `Send a message to ${org.name}` : "Sign in to message this organization"}
                    >
                      <MessageSquare className="w-4 h-4" /> Message
                    </button>
                    {showSignInPrompt && (
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Sign in to message {org.name}.{" "}
                        <Link href="/login" className="underline font-bold">Sign in</Link>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {(org.city || org.province) && (
                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{[org.city, org.province].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {org.contact_email && (
                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{org.contact_email}</span>
                </div>
              )}
              {org.phone && (
                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{org.phone}</span>
                </div>
              )}
              {org.address && (
                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{org.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mission Statement */}
          {org.mission && (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Mission & Vision
              </span>
              <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed italic">
                "{org.mission}"
              </p>
            </div>
          )}
        </header>

        <MessageComposeDialog
          open={isMessaging}
          onOpenChange={setIsMessaging}
          recipientLabel={org.name}
          recipientId={org.message_recipient_id}
        />

        {/* --- ACTIVE OPEN NEEDS SECTION --- */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Active Needs ({needs.length})
              </h2>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Support requests published by {org.name}.
              </p>
            </div>
          </div>

          {needs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 text-sm">
              This organization has no open requests at this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {needs.map((need) => (
                <div
                  key={need.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-sm space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                        {need.category}
                      </span>
                      {renderUrgencyBadge(need.urgency)}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {need.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                      {need.description}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 pt-1">
                      {need.location && <span>📍 {need.location}</span>}
                      {need.quantity && <span>· Qty: {need.quantity}</span>}
                      {need.due_date && <span>· Due {need.due_date}</span>}
                    </div>
                  </div>

                  <Link
                    href={`/needs?search=${encodeURIComponent(need.title)}`}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Support this Need</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* --- IMPACT STORIES SECTION --- */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Impact Stories
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
              Verified community outcomes achieved with HelpLift supporters.
            </p>
          </div>

          {stories.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 text-sm">
              No impact stories posted yet by this organization.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stories.map((story) => {
                const media: StoryMedia[] = story.media && story.media.length > 0
                  ? story.media
                  : [
                      ...(story.video_url ? [{ id: "legacy-video", media_type: "video" as const, url: story.video_url }] : []),
                      ...(story.image_url ? [{ id: "legacy-image", media_type: "image" as const, url: story.image_url }] : []),
                    ]

                return (
                <article
                  key={story.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex flex-col"
                >
                  {media.length > 0 && (
                    <div className="p-2 pb-0">
                      <StoryMediaGallery media={media} title={story.title} heightClassName="h-48" />
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {story.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {story.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span>{story.author_role || "Operations Team"}</span>
                      <span>{new Date(story.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </article>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
