"use client"

import { useState, useEffect, useMemo } from "react"
import { stageFormFiles } from "@/lib/stage-uploads"
import { describeUploadLimit, UPLOAD_LIMITS } from "@/lib/upload-limits"
import Link from "next/link"
import { RefreshButton } from "@/components/refresh-button"
import { useRouter } from "next/navigation"
import {
  Gift,
  Search,
  MapPin,
  Calendar,
  Sparkles,
  Package,
  Wrench,
  DollarSign,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Filter,
  X,
  Building2,
  ArrowRight,
  ShieldCheck
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { BackButton } from "@/components/back-button"
import { GiftDetailDialog, type GiftDetailSummary } from "@/components/gift-detail-dialog"
import { ReadAloudButton } from "@/components/read-aloud-button"
import { ViewToggle, type ListView } from "@/components/view-toggle"

type GiftOffering = {
  id: string
  title: string
  offering_type: "goods" | "services" | "financial" | string
  description: string
  quantity_or_value: string | null
  conditions: string | null
  location: string | null
  expiry_date: string | null
  status: string
  created_at: string
  my_claim_pending?: boolean
  givers?: {
    name: string
    account_type: string
  } | null
  photos?: { id: string; file_name: string | null; url: string | null }[]
}

export default function PublicGiftLibraryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [gifts, setGifts] = useState<GiftOffering[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<"all" | "goods" | "services" | "financial">("all")
  const [view, setView] = useState<ListView>("grid")
  const [locationFilter, setLocationFilter] = useState("")

  // Auth / Organization state
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [orgVerification, setOrgVerification] = useState<string | null>(null)
  const [orgMemberRole, setOrgMemberRole] = useState<string | null>(null)
  const [selectedGift, setSelectedGift] = useState<GiftOffering | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showOrgPrompt, setShowOrgPrompt] = useState(false)

  useEffect(() => {
    fetchGifts()
    checkUserSession()
  }, [])

  const checkUserSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
        if (profile) {
          setUserRole(profile.role)
          if (profile.role === "organization") {
            const { data: membership } = await supabase.from("organization_members").select("role, organizations(verification_status)").eq("profile_id", user.id).maybeSingle()
            const orgField = (membership as any)?.organizations
            const org = Array.isArray(orgField) ? orgField[0] : orgField
            if (org) setOrgVerification(org.verification_status)
            if (membership) setOrgMemberRole((membership as any).role)
          }
        }
      }
    } catch (err) {
      console.warn("Session check fallback:", err)
    }
  }

  // quiet: refresh in place without swapping the list for the loading state.
  const fetchGifts = async (quiet = false) => {
    if (!quiet) setIsLoading(true)
    try {
      const res = await fetch("/api/public/gifts")
      const data = await res.json()
      if (data.success && Array.isArray(data.gifts)) {
        setGifts(data.gifts)
      } else {
        setGifts([])
      }
    } catch (err) {
      console.error("Failed to load gifts:", err)
      setGifts([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredGifts = useMemo(() => {
    return gifts.filter((gift) => {
      const matchesType =
        selectedType === "all" || gift.offering_type?.toLowerCase() === selectedType

      const matchesLocation =
        !locationFilter ||
        gift.location?.toLowerCase().includes(locationFilter.toLowerCase())

      const matchesSearch =
        !searchQuery ||
        gift.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gift.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gift.conditions?.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesType && matchesLocation && matchesSearch
    })
  }, [gifts, selectedType, locationFilter, searchQuery])

  const handleClaimClick = (gift: GiftOffering) => {
    if (!currentUser) {
      setShowOrgPrompt(true)
      return
    }
    if (userRole !== "organization") {
      setFeedback({
        type: "error",
        text: "Only verified organizations can claim items from the Gift Library."
      })
      return
    }
    setSelectedGift(gift)
  }

  const handleClaimGift = async (motivation: string, documents: File[]) => {
    if (!selectedGift) return
    setFeedback(null)
    try {
      const formData = new FormData()
      formData.set("motivation", motivation)
      documents.forEach(file => formData.append("documents", file))
      const res = await fetch(`/api/organization/gifts/${selectedGift.id}/claim`, {
        method: "POST",
        body: await stageFormFiles(formData, UPLOAD_LIMITS.giftClaimDocuments),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to claim offering.")

      setFeedback({
        type: "success",
        text: `Claim request sent for "${selectedGift.title}". A HelpLift administrator will review and confirm it shortly.`
      })
      fetchGifts()
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Unable to claim offering."
      })
      throw err
    }
  }

  const selectedGiftSummary: GiftDetailSummary | null = selectedGift ? {
    id: selectedGift.id,
    title: selectedGift.title,
    offering_type: selectedGift.offering_type,
    description: selectedGift.description,
    quantity_or_value: selectedGift.quantity_or_value,
    conditions: selectedGift.conditions,
    location: selectedGift.location,
    expiry_date: selectedGift.expiry_date,
    status: selectedGift.status,
    created_at: selectedGift.created_at,
    giverName: selectedGift.givers?.name,
    myClaimPending: selectedGift.my_claim_pending,
    photos: selectedGift.photos,
  } : null

  const renderTypeBadge = (type: string) => {
    const t = type.toLowerCase()
    if (t === "goods") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
          <Package className="w-3.5 h-3.5" />
          Goods & Supplies
        </span>
      )
    }
    if (t === "services") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
          <Wrench className="w-3.5 h-3.5" />
          Pro-Bono Service
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
        <DollarSign className="w-3.5 h-3.5" />
        Financial Grant
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pt-28 pb-20 px-4 md:px-8">
      <div className="max-w-[2400px] mx-auto space-y-10">
        <div>
          <BackButton fallbackHref="/" />
        </div>

        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-10">
          <div className="space-y-3 max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
              <Gift className="w-4 h-4" />
              <span>Proactive Community Offerings</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              Community Gift Library
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-base">
              A repository of proactive donations, free professional services, and surplus supplies
              pledged by generous individuals and businesses ready for verified organizations.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3">
            <RefreshButton variant="pill" onRefresh={() => fetchGifts(true)} />
            <Link
              href="/givers-dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity shadow-md"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Pledge an Offering</span>
            </Link>
          </div>
        </header>

        {/* --- FEEDBACK ALERTS --- */}
        {feedback && (
          <div className={`p-4 rounded border flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
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

        {/* --- FILTER BAR --- */}
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8 relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search offerings by description, equipment, skill, or condition..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="md:col-span-4 relative">
              <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by city / area..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] mr-1 shrink-0 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Offering Type:
              </span>
              {[
                { id: "all", label: "All Offerings" },
                { id: "goods", label: "Goods & Equipment" },
                { id: "services", label: "Professional Services" },
                { id: "financial", label: "Financial Grants" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedType(tab.id as any)}
                  className={`px-4 py-1.5 rounded font-bold transition-all shrink-0 ${
                    selectedType === tab.id
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        {/* --- GIFTS GRID --- */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Loading Gift Library offerings...</p>
          </div>
        ) : filteredGifts.length === 0 ? (
          <div className="text-center py-20 rounded border border-dashed border-slate-300 dark:border-slate-700 p-8 space-y-4 bg-white dark:bg-slate-900/40">
            <Gift className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-xl font-bold">No offerings available in this category</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
              Check back soon as new offerings are approved daily, or pledge an offering if you have resources to share.
            </p>
          </div>
        ) : (
          <div className={`grid gap-6 ${view === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
            {filteredGifts.map((gift) => (
              <article
                key={gift.id}
                className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all space-y-5"
              >
                <div className="space-y-3">
                  {gift.photos && gift.photos.length > 0 && gift.photos[0].url && (
                    <img
                      src={gift.photos[0].url}
                      alt={gift.title}
                      className="w-full h-36 object-cover rounded border border-slate-100 dark:border-slate-800"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    {renderTypeBadge(gift.offering_type)}
                    {gift.location && (
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {gift.location}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white line-clamp-2">
                    {gift.title}
                  </h3>

                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {gift.description}
                  </p>
                  <ReadAloudButton text={`${gift.title}. ${gift.description}`} label="Listen" />

                  <div className="space-y-1.5 pt-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    {gift.quantity_or_value && (
                      <p><strong className="text-slate-800 dark:text-slate-200">Quantity / Value:</strong> {gift.quantity_or_value}</p>
                    )}
                    {gift.conditions && (
                      <p><strong className="text-slate-800 dark:text-slate-200">Conditions:</strong> {gift.conditions}</p>
                    )}
                    {gift.expiry_date && (
                      <p className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Valid until {gift.expiry_date}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Pledged by {gift.givers?.name || "Verified Supporter"}
                  </span>

                  {gift.my_claim_pending ? (
                    <span
                      data-tip="Your organization already has a claim on this offering awaiting a decision"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-bold text-xs"
                    >
                      Awaiting decision
                    </span>
                  ) : (
                    <button
                      onClick={() => handleClaimClick(gift)}
                      data-tip="Ask an administrator to claim this offering for your organization"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm shadow-purple-600/20"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Claim Offering</span>
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* --- CLAIM MODAL (motivation required, supporting documents optional) --- */}
        <GiftDetailDialog
          open={!!selectedGift}
          onOpenChange={(open) => !open && setSelectedGift(null)}
          gift={selectedGiftSummary}
          role="organization"
          canClaim={orgMemberRole !== "viewer" && orgVerification === "approved"}
          onClaim={handleClaimGift}
        />

        {/* --- ORG SIGN-IN PROMPT MODAL --- */}
        {showOrgPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-6 md:p-8 shadow-2xl text-center space-y-6">
              <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900 rounded flex items-center justify-center mx-auto text-purple-600 dark:text-purple-400">
                <Building2 className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Organization Access Required
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Only verified non-profit and community organizations can claim offerings from the Gift Library.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => router.push("/login")}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-600/20 transition-all"
                >
                  <span>Sign In as Organization</span>
                </button>
                <button
                  onClick={() => router.push("/register")}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-bold text-sm transition-all"
                >
                  <span>Register an Organization</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setShowOrgPrompt(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Close and continue browsing
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
