"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Filter,
  HeartHandshake,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
} from "lucide-react"
import { MessageComposeDialog } from "@/components/message-compose-dialog"
import { useCanMessage } from "@/hooks/use-can-message"
import { BackButton } from "@/components/back-button"

type DirectoryOrganization = {
  id: string
  name: string
  type: string
  city: string | null
  province: string | null
  mission: string | null
  logo_url: string | null
  verification_status: string
  created_at: string
  open_needs: number
  // Present only for signed-in visitors.
  message_recipient_id?: string
  is_own?: boolean
}

type SortKey = "name" | "needs" | "newest"

const selectClass =
  "w-full px-4 py-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm font-semibold outline-none focus:border-blue-500 transition-colors text-slate-700 dark:text-slate-300"

export default function OrganizationsDirectoryPage() {
  const [organizations, setOrganizations] = useState<DirectoryOrganization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [provinceFilter, setProvinceFilter] = useState("all")
  const [onlyWithNeeds, setOnlyWithNeeds] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>("name")

  // Who is looking. Messaging needs an account, and an organization viewer is
  // read-only, so they can't send messages.
  const { signedIn, isViewer } = useCanMessage()
  const [messaging, setMessaging] = useState<{ id: string; label: string } | null>(null)
  const [needSignIn, setNeedSignIn] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/public/organizations")
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || "Could not load organizations.")
        setOrganizations(data.organizations || [])
      } catch (err: any) {
        setLoadError(err.message || "Could not load organizations.")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const types = useMemo(() => Array.from(new Set(organizations.map(o => o.type).filter(Boolean))).sort(), [organizations])
  const provinces = useMemo(() => Array.from(new Set(organizations.map(o => o.province).filter(Boolean) as string[])).sort(), [organizations])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = organizations.filter(org => {
      if (typeFilter !== "all" && org.type !== typeFilter) return false
      if (provinceFilter !== "all" && org.province !== provinceFilter) return false
      if (onlyWithNeeds && org.open_needs === 0) return false
      if (!q) return true
      return [org.name, org.mission, org.city, org.province, org.type].some(field => field?.toLowerCase().includes(q))
    })
    const sorted = [...filtered]
    if (sortBy === "needs") sorted.sort((a, b) => b.open_needs - a.open_needs || a.name.localeCompare(b.name))
    else if (sortBy === "newest") sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else sorted.sort((a, b) => a.name.localeCompare(b.name))
    return sorted
  }, [organizations, query, typeFilter, provinceFilter, onlyWithNeeds, sortBy])

  const hasFilters = query !== "" || typeFilter !== "all" || provinceFilter !== "all" || onlyWithNeeds || sortBy !== "name"
  const resetFilters = () => {
    setQuery("")
    setTypeFilter("all")
    setProvinceFilter("all")
    setOnlyWithNeeds(false)
    setSortBy("name")
  }

  const handleMessage = (org: DirectoryOrganization) => {
    if (!signedIn || !org.message_recipient_id) {
      setNeedSignIn(org.name)
      return
    }
    setNeedSignIn(null)
    setMessaging({ id: org.message_recipient_id, label: org.name })
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 pt-28 pb-20 px-4 md:px-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="-mb-4">
          <BackButton fallbackHref="/" />
        </div>
        <header className="space-y-4 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Organizations</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">Find an organization</h1>
          <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">
            Browse the schools, charities and community groups on HelpLift. Every organization listed here has been verified by a HelpLift administrator.
          </p>
        </header>

        {/* --- SEARCH & FILTERS --- */}
        <div className="rounded-3xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E]/80 p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, mission or place..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Search organizations"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="md:col-span-2">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by organization type" className={selectClass}>
                <option value="all">All types</option>
                {types.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <select value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)} aria-label="Filter by province" className={selectClass}>
                <option value="all">All provinces</option>
                {provinces.map(province => <option key={province} value={province}>{province}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} aria-label="Sort organizations" className={selectClass}>
                <option value="name">Name (A-Z)</option>
                <option value="needs">Most open needs</option>
                <option value="newest">Recently joined</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input type="checkbox" checked={onlyWithNeeds} onChange={e => setOnlyWithNeeds(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <span className="inline-flex items-center gap-1.5"><Filter className="w-3.5 h-3.5 text-slate-400" /> Only organizations with open needs</span>
            </label>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {!isLoading && <span>{visible.length} of {organizations.length} organization{organizations.length === 1 ? "" : "s"}</span>}
              {hasFilters && (
                <button type="button" onClick={resetFilters} className="font-bold text-blue-600 hover:underline">Reset filters</button>
              )}
            </div>
          </div>
        </div>

        {needSignIn && (
          <div className="max-w-3xl mx-auto rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3 flex-wrap">
            <span>Sign in to send a message to {needSignIn}.</span>
            <Link href="/login" className="rounded-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 text-xs font-bold">Sign in</Link>
          </div>
        )}

        {/* --- RESULTS --- */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Loading organizations...</p>
          </div>
        ) : loadError ? (
          <div className="text-center py-16 space-y-2">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-red-600">{loadError}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-slate-300 dark:border-[#233350] p-8 space-y-3 bg-white dark:bg-[#121B2E]/40">
            <Building2 className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-xl font-bold">{organizations.length === 0 ? "No organizations yet" : "No organizations match your search"}</h3>
            {hasFilters && (
              <button onClick={resetFilters} className="px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90">
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map(org => {
              const place = [org.city, org.province].filter(Boolean).join(", ")
              return (
                <article key={org.id} className="rounded-3xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] p-6 flex flex-col justify-between gap-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt="" className="h-12 w-12 rounded-2xl object-cover border border-slate-200 dark:border-[#233350] shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shrink-0">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="font-bold text-lg leading-tight">{org.name}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{org.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300" data-tip="Checked and approved by a HelpLift administrator">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          org.open_needs > 0
                            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                            : "bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400"
                        }`}
                        data-tip="Needs this organization currently has open for support"
                      >
                        <HeartHandshake className="w-3 h-3" />
                        {org.open_needs > 0 ? `${org.open_needs} open need${org.open_needs === 1 ? "" : "s"}` : "No open needs right now"}
                      </span>
                    </div>

                    {place && (
                      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 shrink-0" /> {place}
                      </p>
                    )}
                    {org.mission && <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">{org.mission}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/organizations/${org.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                      View details <ArrowRight className="w-4 h-4" />
                    </Link>
                    {org.is_own ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-2 text-xs font-bold text-slate-500">Your organization</span>
                    ) : isViewer ? (
                      <span
                        aria-disabled="true"
                        data-tip="Viewers have read-only access and can't send messages. Ask an owner or manager."
                        className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-full border border-slate-200 dark:border-[#233350] px-4 py-2.5 text-sm font-bold text-slate-400 dark:text-slate-500 opacity-70"
                      >
                        <MessageSquare className="w-4 h-4" /> Message
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMessage(org)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 dark:border-[#233350] px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2740] transition-colors"
                        data-tip={signedIn ? `Send a message to ${org.name}` : "Sign in to message this organization"}
                      >
                        <MessageSquare className="w-4 h-4" /> Message
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <MessageComposeDialog
        open={!!messaging}
        onOpenChange={open => !open && setMessaging(null)}
        recipientLabel={messaging?.label || ""}
        recipientId={messaging?.id}
      />
    </div>
  )
}
