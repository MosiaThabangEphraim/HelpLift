"use client"

import { useState, useEffect, useMemo } from "react"
import { stageFormFiles } from "@/lib/stage-uploads"
import { describeUploadLimit, UPLOAD_LIMITS } from "@/lib/upload-limits"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search,
  MapPin,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Flame,
  HeartHandshake,
  Send,
  Loader2,
  Filter,
  X,
  LogIn,
  ArrowRight,
  PackageCheck,
  Banknote,
  Image as ImageIcon
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useNeedCategories } from "@/lib/use-need-categories"
import { DonateDialog } from "@/components/donate-dialog"
import { BackButton } from "@/components/back-button"
import { formatCurrency } from "@/lib/banking"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { ReadAloudButton } from "@/components/read-aloud-button"
import { appendSpeech } from "@/lib/speech-to-text"
import { getCurrentPosition, haversineKm, NEAR_ME_RADIUS_KM, reverseGeocodePlaceNames } from "@/lib/geolocation"
import { LocateFixed } from "lucide-react"
import { ViewToggle, type ListView } from "@/components/view-toggle"
import { OrgLogo } from "@/components/org-logo"
import { RefreshButton } from "@/components/refresh-button"
import { MaximizeToggle } from "@/components/maximize-toggle"

type OrganizationInfo = {
  id: string
  name: string
  type: string
  verification_status: string
  city?: string | null
  province?: string | null
  logo_url?: string | null
}

type PublicNeed = {
  id: string
  title: string
  description: string
  category: string
  location: string | null
  latitude?: number | null
  longitude?: number | null
  quantity: string | null
  target_amount: number | null
  due_date: string | null
  urgency: "low" | "medium" | "high" | string
  status?: string
  created_at: string
  organizations: OrganizationInfo | OrganizationInfo[] | null
  need_attachments?: { id: string; file_name: string | null; url: string }[]
}

export default function PublicNeedsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [needs, setNeeds] = useState<PublicNeed[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedUrgency, setSelectedUrgency] = useState<"all" | "high" | "medium" | "low">("all")
  const [locationFilter, setLocationFilter] = useState("")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "urgency" | "title">("newest")
  const needCategories = useNeedCategories()

  // Category pills: the canonical (admin-managed) list, plus any category text
  // already present in real needs (older needs may predate the constrained
  // category select in the organization dashboard, when it was still free
  // text - or use a category an admin has since retired).
  const categoryOptions = useMemo(() => {
    const extra = needs.map(need => need.category).filter(Boolean) as string[]
    return ["All", ...Array.from(new Set([...needCategories, ...extra]))]
  }, [needs, needCategories])

  // Auth & Interest Submission States
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [giverId, setGiverId] = useState<string | null>(null)
  const [preferredCategories, setPreferredCategories] = useState<string[]>([])
  const [preferredLocations, setPreferredLocations] = useState<string[]>([])
  const [matchesOnly, setMatchesOnly] = useState(false)
  // "Needs near me" - see lib/geolocation.ts. Independent of matchesOnly
  // (works for anyone, no account or saved preferences needed); if both are
  // on at once, a need matching either counts, same as the giver dashboard's
  // own "preference, near me, or both" selector.
  const [nearMeEnabled, setNearMeEnabled] = useState(false)
  const [nearMePlaces, setNearMePlaces] = useState<string[]>([])
  const [nearMeCoords, setNearMeCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [nearMeError, setNearMeError] = useState("")
  const [view, setView] = useState<ListView>("grid")
  const [selectedNeed, setSelectedNeed] = useState<PublicNeed | null>(null)
  const [interestMessage, setInterestMessage] = useState("")
  const [interestPhotos, setInterestPhotos] = useState<File[]>([])
  const [isSubmittingInterest, setIsSubmittingInterest] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [donatingNeed, setDonatingNeed] = useState<PublicNeed | null>(null)

  useEffect(() => {
    fetchNeeds()
    checkUserSession()
    const params = new URLSearchParams(window.location.search)
    const search = params.get("search")
    if (search) setSearchQuery(search)
  }, [])

  // Deep-linking for a single need (e.g. from a QR code an organization
  // printed for it, see need-qr-code-dialog.tsx) - opens its detail dialog
  // once the full list has loaded, same "read the query param once data
  // arrives" pattern as impact story deep-links elsewhere on the site.
  useEffect(() => {
    if (needs.length === 0) return
    const needId = new URLSearchParams(window.location.search).get("need")
    if (!needId) return
    const match = needs.find(n => n.id === needId)
    if (match) setSelectedNeed(match)
  }, [needs])

  const checkUserSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
        if (profile) {
          setUserRole(profile.role)
          if (profile.role === "giver") {
            const { data: giver } = await supabase.from("givers").select("id, preferred_categories, preferred_locations").eq("profile_id", user.id).single()
            if (giver) {
              setGiverId(giver.id)
              setPreferredCategories(giver.preferred_categories || [])
              setPreferredLocations(giver.preferred_locations || [])
            }
          }
        }
      }
    } catch (e) {
      console.warn("Session check fallback:", e)
    }
  }

  // quiet: refresh in place without swapping the list for the loading state.
  const fetchNeeds = async (quiet = false) => {
    if (!quiet) setIsLoading(true)
    try {
      const res = await fetch("/api/public/needs")
      const data = await res.json()
      if (data.success && Array.isArray(data.needs)) {
        setNeeds(data.needs)
      } else {
        setNeeds([])
      }
    } catch (err) {
      console.error("Failed to load needs:", err)
      setNeeds([])
    } finally {
      setIsLoading(false)
    }
  }

  const toggleNearMe = async (checked: boolean) => {
    if (!checked) {
      setNearMeEnabled(false)
      return
    }
    setIsLocating(true)
    setNearMeError("")
    try {
      const position = await getCurrentPosition()
      setNearMeCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
      const places = await reverseGeocodePlaceNames(position.coords.latitude, position.coords.longitude)
      if (places.length === 0) throw new Error("Could not determine your area from your location.")
      setNearMePlaces(places)
      setNearMeEnabled(true)
    } catch (err: any) {
      setNearMeError(err.message || "Could not use your location.")
      setNearMeEnabled(false)
    } finally {
      setIsLocating(false)
    }
  }

  const urgencyRank: Record<string, number> = { high: 0, medium: 1, low: 2 }

  const filteredNeeds = useMemo(() => {
    const filtered = needs.filter((need) => {
      // Exact (case-insensitive) match now that category pills are drawn from
      // real data (see categoryOptions) - a substring match previously let
      // "Food" match "Food & Nutrition" but also caused mismatches once the
      // organization's create-need field stopped being free text.
      const matchesCategory =
        selectedCategory === "All" ||
        need.category?.toLowerCase() === selectedCategory.toLowerCase()

      const needUrgency = (need.urgency || "medium").toLowerCase()
      const matchesUrgency =
        selectedUrgency === "all" || needUrgency === selectedUrgency

      const matchesLocation =
        !locationFilter ||
        need.location?.toLowerCase().includes(locationFilter.toLowerCase())

      const matchesSearch =
        !searchQuery ||
        need.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        need.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        need.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        need.location?.toLowerCase().includes(searchQuery.toLowerCase())

      // Same rules as notify_matching_givers() in the database: each preference
      // list that is set must match; an empty list places no restriction.
      // "Near me" reuses the identical location-matching rule against place
      // names derived from a live GPS position instead of a saved
      // preference (see lib/geolocation.ts) - checking both at once shows a
      // need matching either, not requiring both simultaneously.
      let matchesPersonalized = true
      if (matchesOnly || nearMeEnabled) {
        const org = Array.isArray(need.organizations) ? need.organizations[0] : need.organizations
        const needPlace = [need.location, org?.city, org?.province].filter(Boolean).join(" ").toLowerCase()

        let matchesPreferences = true
        if (matchesOnly) {
          const categoryOk =
            preferredCategories.length === 0 ||
            preferredCategories.some(c => c.trim().toLowerCase() === need.category?.trim().toLowerCase())
          const locationOk =
            preferredLocations.length === 0 ||
            preferredLocations.some(l => l.trim() && needPlace.includes(l.trim().toLowerCase()))
          matchesPreferences = categoryOk && locationOk
        }

        // Real distance, not place-name text matching (see lib/geolocation.ts) -
        // a need with no coordinates yet (geocoding failed, or it predates
        // this feature and hasn't been edited since) simply can't match
        // "near me".
        let matchesNearMe = true
        if (nearMeEnabled) {
          matchesNearMe =
            !!nearMeCoords && need.latitude != null && need.longitude != null &&
            haversineKm(nearMeCoords.lat, nearMeCoords.lng, need.latitude, need.longitude) <= NEAR_ME_RADIUS_KM
        }

        matchesPersonalized = matchesOnly && nearMeEnabled ? (matchesPreferences || matchesNearMe) : matchesOnly ? matchesPreferences : matchesNearMe
      }

      return matchesCategory && matchesUrgency && matchesLocation && matchesSearch && matchesPersonalized
    })

    const sorted = [...filtered]
    if (sortBy === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sortBy === "urgency") sorted.sort((a, b) => (urgencyRank[(a.urgency || "medium").toLowerCase()] ?? 1) - (urgencyRank[(b.urgency || "medium").toLowerCase()] ?? 1))
    else if (sortBy === "title") sorted.sort((a, b) => a.title.localeCompare(b.title))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [needs, selectedCategory, selectedUrgency, locationFilter, searchQuery, sortBy, matchesOnly, preferredCategories, preferredLocations, nearMeEnabled, nearMeCoords])

  const hasPreferences = preferredCategories.length > 0 || preferredLocations.length > 0

  const handleSupportClick = (need: PublicNeed) => {
    if (!currentUser) {
      setShowAuthPrompt(true)
      return
    }
    if (userRole !== "giver") {
      setFeedback({
        type: "error",
        text: "Please sign in with a Giver account to express support for needs."
      })
      return
    }
    setSelectedNeed(need)
  }

  const handleDonateClick = (need: PublicNeed) => {
    if (!currentUser) {
      setShowAuthPrompt(true)
      return
    }
    if (userRole !== "giver") {
      setFeedback({
        type: "error",
        text: "Please sign in with a Giver account to donate."
      })
      return
    }
    setDonatingNeed(need)
  }

  const submitInterest = async () => {
    if (!selectedNeed) return
    setIsSubmittingInterest(true)
    setFeedback(null)

    try {
      const formData = new FormData()
      formData.set("need_id", selectedNeed.id)
      formData.set("message", interestMessage)
      interestPhotos.forEach(file => formData.append("photos", file))
      const res = await fetch("/api/giver/interests", {
        method: "POST",
        body: await stageFormFiles(formData, UPLOAD_LIMITS.interestPhotos),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit support interest.")
      }
      setFeedback({
        type: "success",
        text: "Thank you! Your expression of interest has been sent to the organization."
      })
      setSelectedNeed(null)
      setInterestMessage("")
      setInterestPhotos([])
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Unable to submit interest at this time."
      })
    } finally {
      setIsSubmittingInterest(false)
    }
  }

  const renderUrgencyBadge = (urgency?: string) => {
    const level = (urgency || "medium").toLowerCase()
    if (level === "high") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
          <Flame className="w-3.5 h-3.5 fill-red-500" />
          High Urgency
        </span>
      )
    }
    if (level === "medium") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Medium
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
        <PackageCheck className="w-3.5 h-3.5" />
        Standard
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 pt-28 pb-20 px-4 md:px-8 transition-colors">
      <div className="max-w-[2400px] mx-auto space-y-10">
        <div>
          <BackButton fallbackHref="/" />
        </div>

        {/* --- HEADER --- */}
        <header className="space-y-4 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <HeartHandshake className="w-4 h-4" />
            <span>Community Support Needs</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
            Discover & Fulfill Needs
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">
            Explore verified requests from vetted non-profits, schools, and community groups.
            Contribute supplies, professional services, or direct assistance where it matters most.
          </p>
          <div className="flex justify-center">
            <RefreshButton variant="pill" onRefresh={() => fetchNeeds(true)} />
          </div>
        </header>

        {/* --- FEEDBACK ALERTS --- */}
        {feedback && (
          <div className={`max-w-3xl mx-auto p-4 rounded border flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
          }`}>
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
            <button aria-label="Dismiss message" onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* --- SEARCH & FILTERS BAR --- */}
        <div className="rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E]/80 p-6 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search needs by title, keyword, or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Urgency Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm font-semibold outline-none focus:border-blue-500 transition-colors text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Urgency</option>
                <option value="high">High Urgency</option>
                <option value="medium">Medium Urgency</option>
                <option value="low">Standard / Low</option>
              </select>
            </div>

            {/* Location Filter */}
            <div className="md:col-span-3 relative">
              <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Location (e.g. Durban, Soweto)"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Sort */}
            <div className="md:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm font-semibold outline-none focus:border-blue-500 transition-colors text-slate-700 dark:text-slate-300"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="urgency">Highest urgency</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Category:
            </span>
            {categoryOptions.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded font-bold transition-all shrink-0 ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Preference matching (givers only) + "near me" (anyone) */}
            <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
              <div className="flex items-center gap-3 flex-wrap">
              {userRole === "giver" && (
                <label
                  data-tip="Uses the preferred categories and locations saved in your giver profile"
                  className={`inline-flex items-center gap-2 font-semibold ${hasPreferences ? "cursor-pointer" : "opacity-60"}`}
                >
                  <input
                    type="checkbox"
                    checked={matchesOnly}
                    disabled={!hasPreferences}
                    onChange={(e) => setMatchesOnly(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  Only show needs matching my preferences
                </label>
              )}
              {!hasPreferences && userRole === "giver" && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Set preferred categories and locations in your dashboard profile settings to use this.
                </span>
              )}
              <label
                data-tip="Uses your device's live location, just once, to find needs near you - it isn't saved"
                className="inline-flex items-center gap-2 font-semibold cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={nearMeEnabled}
                  onChange={(e) => toggleNearMe(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                Needs near me
              </label>
              {nearMeError && <span className="text-xs font-semibold text-red-600 dark:text-red-400">{nearMeError}</span>}
              </div>
              <ViewToggle view={view} onChange={setView} />
            </div>
            {nearMeEnabled && nearMePlaces.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <LocateFixed className="w-3.5 h-3.5" /> Showing needs near {nearMePlaces.slice(0, 2).join(", ")}
              </p>
            )}
        </div>

        {/* --- NEEDS GRID --- */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Loading verified community needs...</p>
          </div>
        ) : filteredNeeds.length === 0 ? (
          <div className="text-center py-20 rounded border border-dashed border-slate-300 dark:border-[#233350] p-8 space-y-4 bg-white dark:bg-[#121B2E]/40">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-xl font-bold">No needs match your search criteria</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
              Try adjusting your category, urgency level, or search keyword to view open needs.
            </p>
            <button
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
                setSelectedUrgency("all")
                setLocationFilter("")
                setSortBy("newest")
                setMatchesOnly(false)
              }}
              className="px-5 py-2.5 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className={`grid gap-6 ${view === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
            {filteredNeeds.map((need) => {
              const org = Array.isArray(need.organizations) ? need.organizations[0] : need.organizations

              const coverImage = need.need_attachments?.find(a => /\.(png|jpe?g|gif|webp)$/i.test(a.file_name || a.url))

              return (
                <article
                  key={need.id}
                  className="rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-[#233350] transition-all"
                >
                  {coverImage && (
                    <div className="h-40 w-full overflow-hidden bg-slate-100 dark:bg-[#1A2740]">
                      <img src={coverImage.url} alt={need.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="space-y-4 p-6">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300 text-xs font-bold">
                        {need.category}
                      </span>
                      {need.status === "in_progress" && (
                        <span className="px-3 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold">
                          In Progress
                        </span>
                      )}
                      {renderUrgencyBadge(need.urgency)}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white line-clamp-2">
                        {need.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                        {need.description}
                      </p>
                      <div className="mt-2">
                        <ReadAloudButton text={`${need.title}. ${need.description}`} label="Listen to this need" />
                      </div>
                    </div>

                    {/* Organization Tag with link to Public Profile */}
                    {org ? (
                      <Link
                        href={`/organizations/${org.id}`}
                        className="group inline-flex items-center gap-2 p-2.5 rounded bg-slate-50 dark:bg-[#0B1220]/60 border border-slate-100 dark:border-[#233350] hover:border-blue-300 dark:hover:border-blue-800 transition-colors w-full"
                      >
                        <OrgLogo src={org.logo_url} name={org.name} className="h-6 w-6 text-[10px]" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors truncate">
                          {org.name}
                        </span>
                        {org.verification_status === "approved" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-auto" />
                        )}
                      </Link>
                    ) : (
                      <div className="inline-flex items-center gap-2 p-2 text-xs text-slate-400">
                        <Building2 className="w-4 h-4" />
                        <span>Verified Organization</span>
                      </div>
                    )}

                    {/* Metadata tags */}
                    <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 pt-1">
                      {need.location && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-[#1A2740]/80 px-2.5 py-1 rounded">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {need.location}
                        </span>
                      )}
                      {need.quantity && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-[#1A2740]/80 px-2.5 py-1 rounded">
                          Qty: {need.quantity}
                        </span>
                      )}
                      {need.due_date && (
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-[#1A2740]/80 px-2.5 py-1 rounded">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Due {need.due_date}
                        </span>
                      )}
                      {need.target_amount != null && (
                        <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded font-bold">
                          <Banknote className="w-3 h-3" />
                          Target: {formatCurrency(Number(need.target_amount))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div className="mt-6 pt-4 px-6 pb-6 border-t border-slate-100 dark:border-[#233350] space-y-2">
                    {need.target_amount != null && (
                      <button
                        onClick={() => handleDonateClick(need)}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/10 active:scale-[0.98]"
                      >
                        <Banknote className="w-4 h-4" />
                        <span>Donate Money</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleSupportClick(need)}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-600/10 active:scale-[0.98]"
                    >
                      <Send className="w-4 h-4" />
                      <span>Support this Need</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* --- EXPRESS INTEREST MODAL FOR LOGGED-IN GIVERS --- */}
        {selectedNeed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="relative w-full max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto pt-12 md:pt-12 bg-white dark:bg-[#121B2E] border border-slate-200 dark:border-[#233350] rounded p-6 md:p-8 shadow-2xl space-y-6">
              <MaximizeToggle />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mb-2">
                    <HeartHandshake className="w-3.5 h-3.5" />
                    Express Support
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {selectedNeed.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Let the organization know how you can help fulfill this need.
                  </p>
                </div>
                <button aria-label="Close"
                  onClick={() => setSelectedNeed(null)}
                  className="p-2 rounded hover:bg-slate-100 dark:hover:bg-[#1A2740] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Message / Details of Offer (Optional)
                  </label>
                  <GrammarCheckButton text={interestMessage} onTextChange={setInterestMessage} />
                </div>
                <div className="relative">
                  <textarea
                    value={interestMessage}
                    onChange={(e) => setInterestMessage(e.target.value)}
                    placeholder="E.g., We have 50 backpacks ready for drop-off this Wednesday, or we can assist with delivery..."
                    className="w-full min-h-32 p-4 pr-11 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm outline-none focus:border-blue-500 transition-colors"
                  />
                  <MicButton className="top-2 right-2" onText={text => setInterestMessage(m => appendSpeech(m, text))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Photos (Optional)
                </label>
                {interestPhotos.length > 0 && (
                  <ul className="space-y-1.5">
                    {interestPhotos.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setInterestPhotos(photos => photos.filter((_, i) => i !== index))}
                          aria-label={`Remove ${file.name}`}
                          data-tip="Remove this photo"
                          className="text-slate-400 hover:text-red-600 shrink-0 font-bold px-1"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label
                  data-tip="You can attach multiple photos - select several at once, or add them one at a time"
                  className="flex flex-col items-center justify-center gap-1.5 rounded border-2 border-dashed border-slate-300 dark:border-[#233350] p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {interestPhotos.length === 0 ? "Click to attach photo(s), e.g. of the goods offered" : "Click to attach more photos"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      setInterestPhotos(photos => [...photos, ...Array.from(e.target.files || [])])
                      e.target.value = ""
                    }}
                  />
                    <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">{describeUploadLimit(UPLOAD_LIMITS.interestPhotos)}</span>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedNeed(null)}
                  className="px-5 py-2.5 rounded border border-slate-200 dark:border-[#233350] text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-[#1A2740] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitInterest}
                  disabled={isSubmittingInterest}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {isSubmittingInterest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Expression of Interest</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- AUTH PROMPT MODAL FOR UNAUTHENTICATED USERS --- */}
        {showAuthPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="relative w-full max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto pt-12 md:pt-12 bg-white dark:bg-[#121B2E] border border-slate-200 dark:border-[#233350] rounded p-6 md:p-8 shadow-2xl text-center space-y-6">
              <MaximizeToggle />
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 rounded flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                <HeartHandshake className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Join HelpLift to Support
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  To protect community authenticity and coordinate donations, givers must sign in before expressing interest.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => router.push("/login")}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Your Account</span>
                </button>
                <button
                  onClick={() => router.push("/register")}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded border border-slate-200 dark:border-[#233350] hover:bg-slate-50 dark:hover:bg-[#1A2740]/60 text-slate-800 dark:text-slate-200 font-bold text-sm transition-all"
                >
                  <span>Create a Free Giver Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setShowAuthPrompt(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Close and continue browsing
              </button>
            </div>
          </div>
        )}

      </div>

      <DonateDialog
        open={!!donatingNeed}
        onOpenChange={(open) => !open && setDonatingNeed(null)}
        need={donatingNeed ? { id: donatingNeed.id, title: donatingNeed.title } : null}
        onDone={() => setFeedback({ type: "success", text: "Thank you! Your proof of payment has been submitted for verification." })}
      />
    </div>
  )
}
