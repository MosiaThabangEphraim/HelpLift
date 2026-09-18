"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
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
  givers?: {
    name: string
    account_type: string
  } | null
}

export default function PublicGiftLibraryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [gifts, setGifts] = useState<GiftOffering[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<"all" | "goods" | "services" | "financial">("all")
  const [locationFilter, setLocationFilter] = useState("")

  // Auth / Organization state
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [orgVerification, setOrgVerification] = useState<string | null>(null)
  const [claimingGift, setClaimingGift] = useState<GiftOffering | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
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
            const { data: org } = await supabase.from("organizations").select("verification_status").eq("profile_id", user.id).single()
            if (org) setOrgVerification(org.verification_status)
          }
        }
      }
    } catch (err) {
      console.warn("Session check fallback:", err)
    }
  }

  const fetchGifts = async () => {
    setIsLoading(true)
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
    if (orgVerification !== "approved") {
      setFeedback({
        type: "error",
        text: "Your organization account is still pending admin approval."
      })
      return
    }
    setClaimingGift(gift)
  }

  const confirmClaim = async () => {
    if (!claimingGift) return
    setIsClaiming(true)
    setFeedback(null)

    try {
      const res = await fetch(`/api/organization/gifts/${claimingGift.id}/claim`, {
        method: "POST"
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to claim offering.")

      setFeedback({
        type: "success",
        text: `Claim request sent for "${claimingGift.title}". A HelpLift administrator will review and confirm it shortly.`
      })
      setClaimingGift(null)
      fetchGifts()
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Unable to claim offering."
      })
    } finally {
      setIsClaiming(false)
    }
  }

  const renderTypeBadge = (type: string) => {
    const t = type.toLowerCase()
    if (t === "goods") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
          <Package className="w-3.5 h-3.5" />
          Goods & Supplies
        </span>
      )
    }
    if (t === "services") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
          <Wrench className="w-3.5 h-3.5" />
          Pro-Bono Service
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
        <DollarSign className="w-3.5 h-3.5" />
        Financial Grant
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pt-28 pb-20 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-10">
          <div className="space-y-3 max-w-2xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
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

          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <Link
              href="/givers-dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity shadow-md"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Pledge an Offering</span>
            </Link>
          </div>
        </header>

        {/* --- FEEDBACK ALERTS --- */}
        {feedback && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
          }`}>
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* --- FILTER BAR --- */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8 relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search offerings by description, equipment, skill, or condition..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="md:col-span-4 relative">
              <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by city / area..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

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
                className={`px-4 py-1.5 rounded-full font-bold transition-all shrink-0 ${
                  selectedType === tab.id
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* --- GIFTS GRID --- */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Loading Gift Library offerings...</p>
          </div>
        ) : filteredGifts.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 space-y-4 bg-white dark:bg-slate-900/40">
            <Gift className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-xl font-bold">No offerings available in this category</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
              Check back soon as new offerings are approved daily, or pledge an offering if you have resources to share.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGifts.map((gift) => (
              <article
                key={gift.id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all space-y-5"
              >
                <div className="space-y-3">
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

                  <button
                    onClick={() => handleClaimClick(gift)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm shadow-purple-600/20"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Claim Offering</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* --- CLAIM CONFIRMATION MODAL --- */}
        {claimingGift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Gift className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Confirm Gift Claim
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Are you ready to claim <strong className="text-slate-900 dark:text-white">"{claimingGift.title}"</strong> for your organization?
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p><strong>Quantity:</strong> {claimingGift.quantity_or_value || "As listed"}</p>
                {claimingGift.conditions && <p><strong>Terms:</strong> {claimingGift.conditions}</p>}
                <p>Once claimed, you will be connected with the giver to coordinate pickup or delivery.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setClaimingGift(null)}
                  className="px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClaim}
                  disabled={isClaiming}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Confirm & Claim</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- ORG SIGN-IN PROMPT MODAL --- */}
        {showOrgPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-center space-y-6">
              <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900 rounded-2xl flex items-center justify-center mx-auto text-purple-600 dark:text-purple-400">
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
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-600/20 transition-all"
                >
                  <span>Sign In as Organization</span>
                </button>
                <button
                  onClick={() => router.push("/register")}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-bold text-sm transition-all"
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
