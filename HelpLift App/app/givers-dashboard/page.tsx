"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  CheckCircle2,
  HeartHandshake,
  Loader2,
  LogOut,
  Send,
  XCircle,
  Gift,
  Plus,
  Flame,
  AlertTriangle,
  PackageCheck,
  ExternalLink,
  Sparkles,
  Pencil,
  Settings,
  Search,
  MessageSquare,
  Bell,
  Mail,
  ClipboardList,
  Users,
  X,
  Banknote,
  Paperclip,
  BarChart3
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { firstOf } from "@/lib/utils"
import { DonateDialog } from "@/components/donate-dialog"
import { ChangeEmailFlow, ChangePasswordFlow, DeleteAccountFlow } from "@/components/account-security"
import { PledgeFinancialDialog } from "@/components/pledge-financial-dialog"
import { DonationDetailDialog, statusBadgeClasses, type DonationSummary } from "@/components/donation-detail-dialog"
import { formatCurrency } from "@/lib/banking"
import { NEED_CATEGORIES } from "@/lib/categories"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MessageComposeDialog } from "@/components/message-compose-dialog"
import { MessageDetailDialog } from "@/components/message-detail-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { FeedbackButton } from "@/components/feedback-button"
import { SettingsDialog } from "@/components/settings-dialog"
import { useNotificationAlerts } from "@/hooks/use-notification-alerts"
import { GiverAnalytics } from "@/components/analytics/giver-analytics"
import { UserAvatar } from "@/components/user-avatar"
import { MessageViewToggle, SentMessages } from "@/components/sent-messages"

type Giver = { id: string; name: string; email: string; phone: string | null; account_type: string; preferred_categories: string[] | null; preferred_locations: string[] | null; avatar_url?: string | null }
type Need = {
  id: string
  title: string
  description: string
  category: string
  location: string | null
  quantity: string | null
  target_amount: number | null
  due_date: string | null
  urgency?: "low" | "medium" | "high" | string
  status?: string
  organizations: { id?: string; name: string; verification_status: string; profile_id?: string }[] | { id?: string; name: string; verification_status: string; profile_id?: string } | null
}
type Interest = { id: string; status: string; message: string | null; needs: { title: string }[] | { title: string } | null }
type FulfillmentNeed = { title: string; description: string; category: string; location: string | null; quantity: string | null; due_date: string | null; organizations: { name: string }[] | { name: string } | null }
type FulfillmentInterest = { message: string | null; needs: FulfillmentNeed[] | FulfillmentNeed | null }
type Fulfillment = {
  id: string
  status: string
  notes: string | null
  proof_storage_path?: string | null
  proof_notes?: string | null
  completed_at?: string | null
  created_at: string
  support_interests: FulfillmentInterest[] | FulfillmentInterest | null
}
type Notification = { id: string; type: string; title: string; message: string; sender_name?: string | null; sender_role?: string | null; read_at: string | null; created_at: string; attachment_file_name?: string | null; attachmentUrl?: string | null; attachments?: { id: string; file_name: string | null; url: string | null }[] }
type Donation = {
  id: string
  amount: number
  payment_method: string
  status: "pending" | "successful" | "unsuccessful"
  reference_code: string
  bank_name: string | null
  proof_storage_path: string | null
  payer_notes: string | null
  admin_notes: string | null
  created_at: string
  needs: ({ title: string; organizations: { name: string }[] | { name: string } | null }[] | { title: string; organizations: { name: string }[] | { name: string } | null }) | null
  gift_offerings: { title: string }[] | { title: string } | null
}
type MyGift = {
  id: string
  title: string
  offering_type: string
  description: string
  quantity_or_value?: string | null
  status: string
  created_at: string
}

export default function GiverDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [giver, setGiver] = useState<Giver | null>(null)
  const [needs, setNeeds] = useState<Need[]>([])
  const [interests, setInterests] = useState<Interest[]>([])
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  // Keeps the bell fresh while the page is open and chimes on new notifications.
  useNotificationAlerts<Notification>(setNotifications)
  const [myGifts, setMyGifts] = useState<MyGift[]>([])
  const [donations, setDonations] = useState<Donation[]>([])

  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null)
  const [donatingNeed, setDonatingNeed] = useState<Need | null>(null)
  const [selectedDonation, setSelectedDonation] = useState<DonationSummary | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState("needs")
  const [payfastBanner, setPayfastBanner] = useState<"success" | "cancelled" | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Notification | null>(null)
  const [messageView, setMessageView] = useState<"inbox" | "sent">("inbox")

  // Gift Pledge Modal state
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showFinancialPledge, setShowFinancialPledge] = useState(false)
  const [giftForm, setGiftForm] = useState({
    title: "",
    offering_type: "goods",
    description: "",
    quantity_or_value: "",
    conditions: "",
    location: "",
    expiry_date: ""
  })
  const [isSubmittingGift, setIsSubmittingGift] = useState(false)

  // Settings window: opens the edit-profile / delete-account screens below
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Edit Profile Dialog state
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileDialogMode, setProfileDialogMode] = useState<"fields" | "email" | "password" | "delete">("fields")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)
  const [avatarNote, setAvatarNote] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Message Admin dialog
  const [isMessagingAdmin, setIsMessagingAdmin] = useState(false)
  const [messagingOrg, setMessagingOrg] = useState<{ id: string; label: string } | null>(null)

  // Fulfillment detail modal
  const [selectedFulfillment, setSelectedFulfillment] = useState<Fulfillment | null>(null)
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null)
  const [proofGallery, setProofGallery] = useState<{ id: string; fileName: string | null; signedUrl: string | null }[]>([])
  const [isLoadingProof, setIsLoadingProof] = useState(false)

  // Open needs search (client-side, over the already-fetched open needs)
  const [needsQuery, setNeedsQuery] = useState("")

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // Offline, the sign-in check can fail even though the person is signed in. Don't send them
      // to the login page for that; tell them, and let them retry once they're back online.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You're offline and your saved sign-in couldn't be confirmed. Reconnect to continue.")
        setIsLoading(false)
        return
      }
      return router.replace("/login")
    }

    const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (currentProfile && currentProfile.role !== "giver") {
      if (currentProfile.role === "admin") return router.replace("/admin-dashboard")
      if (currentProfile.role === "organization") return router.replace("/organisation-dashboard")
      return router.replace("/login")
    }

    let { data: giverProfile } = await supabase
      .from("givers")
      .select("id, name, email, phone, account_type, preferred_categories, preferred_locations, avatar_url")
      .eq("profile_id", user.id)
      .single()
    // avatar_url only exists once the profile-picture migration has been applied;
    // without it the query above fails as a whole, so retry without that column
    // rather than reporting the giver as missing.
    if (!giverProfile) {
      const retry = await supabase
        .from("givers")
        .select("id, name, email, phone, account_type, preferred_categories, preferred_locations")
        .eq("profile_id", user.id)
        .single()
      giverProfile = retry.data ? { ...retry.data, avatar_url: null } : null
    }

    if (!giverProfile) {
      setError("Your giver profile could not be found. Please contact support if this persists.")
      setIsLoading(false)
      return
    }

    setGiver(giverProfile)

    const [{ data: openNeeds }, { data: submittedInterests }, { data: giverFulfillments }] = await Promise.all([
      supabase
        .from("needs")
        .select("id, title, description, category, location, quantity, target_amount, due_date, urgency, status, organizations(id, name, verification_status, profile_id)")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false }),
      supabase
        .from("support_interests")
        .select("id, status, message, created_at, needs(title)")
        .eq("giver_id", giverProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("fulfillments")
        .select("id, status, notes, proof_storage_path, proof_notes, completed_at, created_at, support_interests(message, needs(title, description, category, location, quantity, due_date, organizations(name)))")
        .eq("giver_id", giverProfile.id)
        .order("created_at", { ascending: false }),
    ])

    setNeeds((openNeeds || []) as unknown as Need[])
    setInterests((submittedInterests || []) as unknown as Interest[])
    setFulfillments((giverFulfillments || []) as unknown as Fulfillment[])

    // Load notifications
    const notificationsResponse = await fetch("/api/notifications")
    if (notificationsResponse.ok) setNotifications((await notificationsResponse.json()).notifications || [])

    // Load my gifts from Gift Library
    const giftsRes = await fetch("/api/giver/gifts")
    if (giftsRes.ok) {
      const gData = await giftsRes.json()
      setMyGifts(gData.gifts || [])
    }

    // Load my monetary donations
    const donationsRes = await fetch("/api/giver/donations")
    if (donationsRes.ok) setDonations((await donationsRes.json()).donations || [])

    setIsLoading(false)
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab")
    const payfast = params.get("payfast")
    if (tab) setActiveTab(tab)
    if (payfast === "success" || payfast === "cancelled") setPayfastBanner(payfast)
    if (tab || payfast) window.history.replaceState({}, "", "/givers-dashboard")
  }, [])

  useEffect(() => {
    if (!selectedFulfillment) {
      setProofSignedUrl(null)
      setProofGallery([])
      return
    }
    setIsLoadingProof(true)
    ;(async () => {
      const { data: rows } = await supabase
        .from("fulfillment_proofs")
        .select("id, storage_path, file_name")
        .eq("fulfillment_id", selectedFulfillment.id)
        .order("created_at", { ascending: true })

      if (rows && rows.length > 0) {
        const withUrls = await Promise.all(rows.map(async (row) => {
          const { data } = await supabase.storage.from("fulfillment-proofs").createSignedUrl(row.storage_path, 3600)
          return { id: row.id, fileName: row.file_name, signedUrl: data?.signedUrl || null }
        }))
        setProofGallery(withUrls)
        setProofSignedUrl(null)
      } else if (selectedFulfillment.proof_storage_path) {
        const { data } = await supabase.storage.from("fulfillment-proofs").createSignedUrl(selectedFulfillment.proof_storage_path, 3600)
        setProofSignedUrl(data?.signedUrl || null)
        setProofGallery([])
      } else {
        setProofSignedUrl(null)
        setProofGallery([])
      }
      setIsLoadingProof(false)
    })()
  }, [selectedFulfillment])

  const submitInterest = async () => {
    if (!giver || !selectedNeed) return
    setIsSending(true)
    setError("")

    const response = await fetch("/api/giver/interests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ need_id: selectedNeed.id, message }),
    })

    if (!response.ok) {
      setError((await response.json()).message || "Interest submission failed.")
    } else {
      setSelectedNeed(null)
      setMessage("Thank you! Your interest has been submitted.")
      await loadData()
    }
    setIsSending(false)
  }

  const handlePledgeGift = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingGift(true)
    setError("")

    try {
      const res = await fetch("/api/giver/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(giftForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to pledge gift.")

      setShowGiftModal(false)
      setGiftForm({
        title: "",
        offering_type: "goods",
        description: "",
        quantity_or_value: "",
        conditions: "",
        location: "",
        expiry_date: ""
      })
      setMessage("Gift offering pledged! It will be listed in the Gift Library once approved by an admin.")
      await loadData()
    } catch (err: any) {
      setError(err.message || "Failed to submit gift.")
    } finally {
      setIsSubmittingGift(false)
    }
  }

  const updateFulfillment = async (id: string, status: string) => {
    const response = await fetch(`/api/fulfillments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    })
    if (!response.ok) setError((await response.json()).message || "Fulfillment update failed.")
    else await loadData()
  }

  const markNotificationRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" })
    setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  const openMessage = (item: Notification) => {
    if (!item.read_at) markNotificationRead(item.id)
    setSelectedMessage(item)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  // The picture is saved as soon as it's chosen, separately from the Save changes button.
  const changeAvatar = async (file: File | undefined) => {
    if (!file) return
    setIsUpdatingAvatar(true)
    setAvatarNote(null)
    try {
      const formData = new FormData()
      formData.append("avatar", file)
      const res = await fetch("/api/giver/avatar", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not upload the picture.")
      setGiver(current => (current ? { ...current, avatar_url: data.avatar_url } : current))
      setAvatarNote({ type: "success", text: "Profile picture updated." })
    } catch (err: any) {
      setAvatarNote({ type: "error", text: err.message || "Could not upload the picture." })
    } finally {
      setIsUpdatingAvatar(false)
    }
  }

  const removeAvatar = async () => {
    setIsUpdatingAvatar(true)
    setAvatarNote(null)
    try {
      const res = await fetch("/api/giver/avatar", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not remove the picture.")
      setGiver(current => (current ? { ...current, avatar_url: null } : current))
      setAvatarNote({ type: "success", text: "Profile picture removed." })
    } catch (err: any) {
      setAvatarNote({ type: "error", text: err.message || "Could not remove the picture." })
    } finally {
      setIsUpdatingAvatar(false)
    }
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingProfile(true)
    setError("")
    const formData = new FormData(event.currentTarget)
    const payload = {
      full_name: (formData.get("full_name") as string)?.trim(),
      phone: (formData.get("phone") as string)?.trim() || null,
      account_type: formData.get("account_type") as string,
      preferred_categories: formData.getAll("preferred_categories").join(","),
      preferred_locations: (formData.get("preferred_locations") as string) || "",
    }
    const res = await fetch("/api/giver/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.message || "Profile update failed.")
    } else {
      setIsEditingProfile(false)
      await loadData()
    }
    setIsSavingProfile(false)
  }

  const closeProfileDialog = () => {
    setIsEditingProfile(false)
    setProfileDialogMode("fields")
  }

  const filteredNeeds = useMemo(() => {
    const q = needsQuery.trim().toLowerCase()
    if (!q) return needs
    return needs.filter(need =>
      (need.title || "").toLowerCase().includes(q) ||
      (need.description || "").toLowerCase().includes(q) ||
      (need.category || "").toLowerCase().includes(q) ||
      (need.location || "").toLowerCase().includes(q) ||
      (firstOf(need.organizations)?.name || "").toLowerCase().includes(q)
    )
  }, [needs, needsQuery])

  const stats = useMemo(() => ({
    openNeeds: needs.length,
    myInterests: interests.length,
    myGifts: myGifts.length,
    activeFulfillments: fulfillments.filter(f => f.status === "pending" || f.status === "in_progress").length,
  }), [needs, interests, myGifts, fulfillments])

  const unreadCount = notifications.filter(n => !n.read_at).length
  const messages = notifications.filter(n => ["admin_message", "org_message", "admin_announcement"].includes(n.type))
  const unreadMessages = messages.filter(m => !m.read_at).length
  const pendingDonations = donations.filter(d => d.status === "pending").length

  const renderUrgencyBadge = (urgency?: string) => {
    const level = (urgency || "medium").toLowerCase()
    if (level === "high") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
          <Flame className="w-3 h-3 fill-red-600" /> High Urgency
        </span>
      )
    }
    if (level === "medium") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
          <AlertTriangle className="w-3 h-3" /> Medium
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
        <PackageCheck className="w-3 h-3" /> Standard
      </span>
    )
  }

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0B1220]"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></main>

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-14 space-y-6">

        {/* --- HEADER --- */}
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <UserAvatar src={giver?.avatar_url} name={giver?.name} className="size-14 text-xl shadow-lg shadow-blue-600/20" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Giver dashboard</p>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">Welcome, {giver?.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-slate-500 dark:text-slate-400">{giver?.email}</span>
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-[#1A2740] px-2 py-0.5 text-[11px] font-bold capitalize">
                  {giver?.account_type} Supporter
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ThemeToggle className="h-9 w-9" />
            <FeedbackButton />

            <Link
              href="/organizations"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              Organizations
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Notifications"
                  data-tip={unreadCount > 0 ? `Notifications: ${unreadCount} unread. Click to see them.` : "Notifications. You're all caught up."}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740] transition-colors">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">No notifications yet.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map(item => (
                      <DropdownMenuItem
                        key={item.id}
                        onSelect={(e) => { e.preventDefault(); if (!item.read_at) markNotificationRead(item.id) }}
                        className={`flex flex-col items-start gap-0.5 whitespace-normal ${!item.read_at ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                      >
                        <span className="font-semibold text-xs">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.message}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => setShowGiftModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 shadow-sm shadow-purple-600/20"
            >
              <Gift className="h-4 w-4" /> Pledge a Gift
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </button>

            <button
              onClick={() => setIsMessagingAdmin(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Message Admin
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>

        {(error || message) && (
          <div className={`flex items-center gap-2 rounded-2xl border p-4 text-sm font-semibold ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}>
            {error ? <XCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
            {error || message}
          </div>
        )}

        {/* --- STATS ROW --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={ClipboardList} label="Open Needs" value={stats.openNeeds} accent="blue" />
          <StatCard icon={Users} label="My Interests" value={stats.myInterests} accent="emerald" />
          <StatCard icon={Gift} label="My Gift Pledges" value={stats.myGifts} accent="purple" />
          <StatCard icon={PackageCheck} label="Active Fulfillments" value={stats.activeFulfillments} accent="amber" />
        </div>

        {/* --- TABS --- */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
          <TabsList className="w-full flex-wrap h-auto justify-start bg-white dark:bg-[#121B2E] border border-slate-200 dark:border-[#233350] p-1.5 rounded-2xl">
            <TabsTrigger value="needs" className="gap-1.5 rounded-xl"><ClipboardList className="w-4 h-4" />Browse Needs</TabsTrigger>
            <TabsTrigger value="interests" className="gap-1.5 rounded-xl"><Users className="w-4 h-4" />My Interests</TabsTrigger>
            <TabsTrigger value="gifts" className="gap-1.5 rounded-xl"><Gift className="w-4 h-4" />Gift Library</TabsTrigger>
            <TabsTrigger value="fulfillments" className="gap-1.5 rounded-xl"><PackageCheck className="w-4 h-4" />Fulfillments<CountBadge value={stats.activeFulfillments} /></TabsTrigger>
            <TabsTrigger value="donations" className="gap-1.5 rounded-xl"><Banknote className="w-4 h-4" />My Donations<CountBadge value={pendingDonations} /></TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5 rounded-xl"><Mail className="w-4 h-4" />Messages<CountBadge value={unreadMessages} /></TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 rounded-xl"><BarChart3 className="w-4 h-4" />Analytics</TabsTrigger>
          </TabsList>

          {/* --- BROWSE NEEDS TAB --- */}
          <TabsContent value="needs">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Open community needs</CardTitle>
                  <CardDescription>Browse current needs from verified HelpLift organizations.</CardDescription>
                </div>
                <Link href="/needs" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                  <span>View Public Board</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {needs.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={needsQuery}
                      onChange={e => setNeedsQuery(e.target.value)}
                      placeholder="Search open needs by title, category, or organization..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[640px] overflow-y-auto pr-1">
                  {needs.length === 0 ? (
                    <div className="md:col-span-2"><EmptyState text="No open needs are available yet." /></div>
                  ) : filteredNeeds.length === 0 ? (
                    <div className="md:col-span-2"><EmptyState text="No open needs match your search." /></div>
                  ) : (
                    filteredNeeds.map(need => {
                      const organization = firstOf(need.organizations)
                      return (
                        <article key={need.id} className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-bold text-base">{need.title}</h3>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {organization?.id ? (
                                  <Link href={`/organizations/${organization.id}`} target="_blank" className="font-semibold text-blue-600 hover:underline">
                                    {organization.name}
                                  </Link>
                                ) : (
                                  organization?.name || "Verified Organization"
                                )}
                                {" "}· {need.category}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {need.status === "in_progress" && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                                  In Progress
                                </span>
                              )}
                              {renderUrgencyBadge(need.urgency)}
                              {organization?.verification_status === "approved" && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2">{need.description}</p>

                          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
                            {need.location && <span>📍 {need.location}</span>}
                            {need.quantity && <span>· Qty: {need.quantity}</span>}
                            {need.due_date && <span>· Due {need.due_date}</span>}
                            {need.target_amount != null && (
                              <span className="text-blue-600 dark:text-blue-400">· Target: {formatCurrency(Number(need.target_amount))}</span>
                            )}
                          </div>

                          <div className="pt-2 flex flex-wrap gap-2">
                            {need.target_amount != null && (
                              <button
                                onClick={() => setDonatingNeed(need)}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                              >
                                <Banknote className="h-3.5 w-3.5" /> Donate Money
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedNeed(need)}
                              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                            >
                              <Send className="h-3.5 w-3.5" /> Express interest
                            </button>
                            {organization?.profile_id && (
                              <button
                                onClick={() => setMessagingOrg({ id: organization.profile_id!, label: organization.name })}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-[#233350] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                              >
                                <MessageSquare className="h-3.5 w-3.5" /> Message Organization
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- MY INTERESTS TAB --- */}
          <TabsContent value="interests">
            <Card>
              <CardHeader>
                <CardTitle>My interests</CardTitle>
                <CardDescription>Track support offers you have submitted.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {interests.length === 0 ? (
                  <EmptyState text="You have not expressed interest in a need yet." />
                ) : (
                  interests.map(interest => (
                    <div key={interest.id} className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-sm">{firstOf(interest.needs)?.title || "Need"}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                          interest.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300"
                        }`}>
                          {interest.status}
                        </span>
                      </div>
                      {interest.message && <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{interest.message}"</p>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- GIFT LIBRARY TAB --- */}
          <TabsContent value="gifts">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-purple-600" />
                    My Gift Library Offerings ({myGifts.length})
                  </CardTitle>
                  <CardDescription>Pledges you have listed for community organizations.</CardDescription>
                </div>
                <button
                  onClick={() => setShowGiftModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:underline shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Offering</span>
                </button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {myGifts.length === 0 ? (
                    <div className="col-span-full">
                      <EmptyState text="You haven't posted any offerings to the Gift Library yet." />
                    </div>
                  ) : (
                    myGifts.map(g => (
                      <div key={g.id} className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 capitalize">
                              {g.offering_type}
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              g.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                              g.status === "claimed" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {g.status}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm mt-2">{g.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{g.description}</p>
                        </div>
                        <span className="text-[10px] text-slate-400">Pledged on {new Date(g.created_at).toLocaleDateString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- FULFILLMENTS TAB --- */}
          <TabsContent value="fulfillments">
            <Card>
              <CardHeader>
                <CardTitle>Fulfillment tracking</CardTitle>
                <CardDescription>Click a row for full details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {fulfillments.length === 0 ? (
                  <EmptyState text="No accepted support to track yet." />
                ) : (
                  fulfillments.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedFulfillment(item)}
                      className="flex w-full flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-[#233350] p-4 text-left hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all"
                    >
                      <div>
                        <p className="font-semibold text-sm">{firstOf(firstOf(item.support_interests)?.needs)?.title || "Need"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.notes || "No notes yet."}</p>
                        {item.proof_storage_path && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-1">
                            <CheckCircle2 className="w-3 h-3" /> Delivery proof attached
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">
                          {item.status.replace("_", " ")}
                        </span>
                        {item.status === "pending" && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); updateFulfillment(item.id, "in_progress") }}
                            className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            Start
                          </span>
                        )}
                        {item.status === "in_progress" && (
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); updateFulfillment(item.id, "completed") }}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Mark Delivered
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- MY DONATIONS TAB --- */}
          <TabsContent value="donations">
            <Card>
              <CardHeader>
                <CardTitle>My monetary donations</CardTitle>
                <CardDescription>Click a donation for banking details, status, or to upload proof of payment.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {payfastBanner === "success" && (
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Thanks! We're confirming your PayFast payment now — this can take a few seconds. Refresh if the status below doesn't update right away.
                  </div>
                )}
                {payfastBanner === "cancelled" && (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Your PayFast payment was cancelled. You can try again anytime from the need you'd like to support.
                  </div>
                )}
                {donations.length === 0 ? (
                  <EmptyState text="You haven't made any monetary donations yet." />
                ) : (
                  donations.map(item => {
                    const needInfo = firstOf(item.needs)
                    const orgName = firstOf(needInfo?.organizations)?.name
                    const giftTitle = firstOf(item.gift_offerings)?.title
                    const displayTitle = needInfo?.title || giftTitle || "Gift Library Pledge"
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedDonation({
                          id: item.id,
                          amount: item.amount,
                          payment_method: item.payment_method,
                          status: item.status,
                          reference_code: item.reference_code,
                          bank_name: item.bank_name,
                          proof_storage_path: item.proof_storage_path,
                          payer_notes: item.payer_notes,
                          admin_notes: item.admin_notes,
                          created_at: item.created_at,
                          needTitle: displayTitle,
                          orgName,
                        })}
                        className="flex w-full flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-[#233350] p-4 text-left hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all"
                      >
                        <div>
                          <p className="font-semibold text-sm">{displayTitle}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{orgName || "General Fund"} · Ref: {item.reference_code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{formatCurrency(Number(item.amount))}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusBadgeClasses(item.status)}`}>
                            {item.status === "pending" ? (item.proof_storage_path ? "Pending Verification" : "Awaiting Payment") : item.status}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- MESSAGES TAB --- */}
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
                <CardDescription>Direct messages from HelpLift admins and organizations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <MessageViewToggle value={messageView} onChange={setMessageView} />
                {messageView === "inbox" && (messages.length === 0 ? (
                  <EmptyState text="No messages yet." />
                ) : (
                  messages.map(item => (
                    <div
                      key={item.id}
                      onClick={() => openMessage(item)}
                      className={`w-full rounded-2xl border p-4 text-left cursor-pointer ${item.read_at ? "border-slate-200 dark:border-[#233350]" : "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-sm">{item.sender_name || "Unknown sender"}</p>
                        <span className="text-[11px] text-slate-400 shrink-0">{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate">{item.message}</p>
                      {item.attachmentUrl && (
                        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600">
                          <Paperclip className="w-3 h-3" /> Attachment
                        </span>
                      )}
                    </div>
                  ))
                ))}
                {messageView === "sent" && <SentMessages canReply={true} />}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="analytics">
            <GiverAnalytics donations={donations as any} interests={interests as any} fulfillments={fulfillments as any} gifts={myGifts} />
          </TabsContent>
        </Tabs>

        {/* --- EXPRESS INTEREST MODAL --- */}
        {selectedNeed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md space-y-5 rounded-3xl bg-white dark:bg-[#121B2E] p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold">Express interest</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedNeed.title}</p>
              </div>
              <textarea
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Add a message for the organization (optional)..."
                className="min-h-28 w-full rounded-2xl border border-slate-200 dark:border-[#233350] p-3 text-sm outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setSelectedNeed(null)} className="rounded-full border border-slate-200 dark:border-[#233350] px-4 py-2 text-xs font-bold">
                  Cancel
                </button>
                <button onClick={submitInterest} disabled={isSending} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {isSending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit interest
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- PLEDGE GIFT MODAL (Item 8) --- */}
        {showGiftModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-[#121B2E] rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 mb-2">
                    <Gift className="w-3.5 h-3.5" />
                    Gift Library Pledge
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Pledge an Offering
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Offer goods, professional services, or direct financial support to verified organizations.
                  </p>
                </div>
                <button aria-label="Close" onClick={() => setShowGiftModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePledgeGift} className="space-y-4">
                <input
                  required
                  placeholder="Offering Title (e.g. 20 Desktops for Computer Lab)"
                  value={giftForm.title}
                  onChange={e => setGiftForm({ ...giftForm, title: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded-2xl text-xs outline-none focus:border-purple-500"
                />

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={giftForm.offering_type}
                    onChange={e => {
                      if (e.target.value === "financial") {
                        setShowGiftModal(false)
                        setShowFinancialPledge(true)
                        return
                      }
                      setGiftForm({ ...giftForm, offering_type: e.target.value })
                    }}
                    className="p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded-2xl text-xs font-semibold outline-none focus:border-purple-500"
                  >
                    <option value="goods">Goods / Supplies</option>
                    <option value="services">Professional Service</option>
                    <option value="financial">Financial Assistance</option>
                  </select>
                  <input
                    placeholder="Quantity or Value"
                    value={giftForm.quantity_or_value}
                    onChange={e => setGiftForm({ ...giftForm, quantity_or_value: e.target.value })}
                    className="p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded-2xl text-xs outline-none focus:border-purple-500"
                  />
                </div>

                <textarea
                  required
                  placeholder="Detailed description of the offering and condition..."
                  value={giftForm.description}
                  onChange={e => setGiftForm({ ...giftForm, description: e.target.value })}
                  className="w-full min-h-24 p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded-2xl text-xs outline-none focus:border-purple-500"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Location / Area"
                    value={giftForm.location}
                    onChange={e => setGiftForm({ ...giftForm, location: e.target.value })}
                    className="p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded-2xl text-xs outline-none focus:border-purple-500"
                  />
                  <input
                    type="date"
                    value={giftForm.expiry_date}
                    onChange={e => setGiftForm({ ...giftForm, expiry_date: e.target.value })}
                    className="p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded-2xl text-xs outline-none focus:border-purple-500 text-slate-600 dark:text-slate-300"
                  />
                </div>

                <input
                  placeholder="Conditions / Requirements (e.g. Must collect with truck)"
                  value={giftForm.conditions}
                  onChange={e => setGiftForm({ ...giftForm, conditions: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded-2xl text-xs outline-none focus:border-purple-500"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGiftModal(false)}
                    className="px-4 py-2 rounded-full border border-slate-200 dark:border-[#233350] text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingGift}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 disabled:opacity-50"
                  >
                    {isSubmittingGift ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                    <span>Submit Gift Pledge</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* --- EDIT PROFILE DIALOG --- */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        onEditProfile={() => { setIsSettingsOpen(false); setProfileDialogMode("fields"); setIsEditingProfile(true) }}
        onDeleteAccount={() => { setIsSettingsOpen(false); setProfileDialogMode("delete"); setIsEditingProfile(true) }}
      />

      <Dialog open={isEditingProfile} onOpenChange={open => !open && closeProfileDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>
              {profileDialogMode === "email" ? "Change Email" : profileDialogMode === "password" ? "Change Password" : profileDialogMode === "delete" ? "Delete Account" : "Edit Your Profile"}
            </DialogTitle>
            <button aria-label="Close"
              type="button"
              onClick={closeProfileDialog}
              className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>
          {giver && profileDialogMode === "email" && (
            <ChangeEmailFlow
              currentEmail={giver.email}
              onBack={() => setProfileDialogMode("fields")}
              onUpdated={async (newEmail) => {
                await fetch("/api/giver/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: newEmail }),
                }).catch(() => {})
                setMessage("Email updated.")
                closeProfileDialog()
                await loadData()
              }}
            />
          )}
          {giver && profileDialogMode === "password" && (
            <ChangePasswordFlow
              onBack={() => setProfileDialogMode("fields")}
              onUpdated={() => { setMessage("Password updated."); closeProfileDialog() }}
            />
          )}
          {giver && profileDialogMode === "delete" && (
            <DeleteAccountFlow onBack={() => setProfileDialogMode("fields")} />
          )}
          {giver && profileDialogMode === "fields" && (
            <form onSubmit={saveProfile} className="space-y-3 pt-2">
              <div className="flex items-center gap-4">
                <UserAvatar src={giver.avatar_url} name={giver.name} className="size-20 text-2xl" />
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">Profile picture</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className={`inline-flex cursor-pointer items-center rounded-full border border-slate-200 dark:border-[#233350] px-3.5 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740] ${isUpdatingAvatar ? "pointer-events-none opacity-60" : ""}`}>
                      {isUpdatingAvatar ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      {giver.avatar_url ? "Change photo" : "Upload photo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={isUpdatingAvatar}
                        onChange={event => { changeAvatar(event.target.files?.[0]); event.target.value = "" }}
                      />
                    </label>
                    {giver.avatar_url && (
                      <button type="button" onClick={removeAvatar} disabled={isUpdatingAvatar} className="text-xs font-bold text-red-600 hover:underline disabled:opacity-60">
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">PNG, JPG or WebP, up to 2 MB.</p>
                  {avatarNote && (
                    <p className={`text-xs font-semibold ${avatarNote.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{avatarNote.text}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-giver-name">Full name</Label>
                <Input id="edit-giver-name" name="full_name" defaultValue={giver.name} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-giver-email">Email</Label>
                <div className="flex gap-2">
                  <Input id="edit-giver-email" name="email" defaultValue={giver.email} readOnly className="bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400" />
                  <Button type="button" variant="outline" onClick={() => setProfileDialogMode("email")}>Change</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-giver-phone">Phone number</Label>
                <Input id="edit-giver-phone" name="phone" defaultValue={giver.phone ?? undefined} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-giver-account-type">Account type</Label>
                <select
                  id="edit-giver-account-type"
                  name="account_type"
                  defaultValue={giver.account_type}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                  <option value="group">Group</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Preferred support categories</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {NEED_CATEGORIES.map(category => (
                    <label key={category} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="preferred_categories"
                        value={category}
                        defaultChecked={(giver.preferred_categories || []).some(c => c.trim().toLowerCase() === category.toLowerCase())}
                        className="w-4 h-4 accent-blue-600"
                      />
                      {category}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-giver-locations">Preferred locations</Label>
                <Input id="edit-giver-locations" name="preferred_locations" defaultValue={(giver.preferred_locations || []).join(", ")} placeholder="e.g. Gauteng, Cape Town" />
              </div>
              <div className="pt-1">
                <Button type="button" variant="outline" onClick={() => setProfileDialogMode("password")} className="w-full">
                  Change password
                </Button>
              </div>
              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={closeProfileDialog}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isSavingProfile}>
                  {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isSavingProfile ? "Saving..." : "Save changes"}</span>
                </Button>
              </DialogFooter>
              <div className="pt-3 border-t border-slate-100 dark:border-[#233350]">
                <button
                  type="button"
                  onClick={() => setProfileDialogMode("delete")}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Delete my account
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* --- MESSAGE ADMIN DIALOG --- */}
      <MessageComposeDialog
        open={isMessagingAdmin}
        onOpenChange={setIsMessagingAdmin}
        recipientLabel="Admin"
        target="admin"
        onSent={() => setMessage("Message sent to admin.")}
      />

      {/* --- MESSAGE ORGANIZATION DIALOG --- */}
      {messagingOrg && (
        <MessageComposeDialog
          open={!!messagingOrg}
          onOpenChange={(open) => !open && setMessagingOrg(null)}
          recipientLabel={messagingOrg.label}
          recipientId={messagingOrg.id}
          onSent={() => setMessage(`Message sent to ${messagingOrg.label}.`)}
        />
      )}

      <MessageDetailDialog
        open={!!selectedMessage}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
        message={selectedMessage}
      />

      {/* --- FULFILLMENT DETAIL MODAL --- */}
      <Dialog open={!!selectedFulfillment} onOpenChange={(open) => !open && setSelectedFulfillment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fulfillment Details</DialogTitle>
          </DialogHeader>
          {selectedFulfillment && (() => {
            const need = firstOf(firstOf(selectedFulfillment.support_interests)?.needs)
            return (
              <div className="space-y-4 pt-2">
                <div>
                  <h3 className="font-bold text-lg">{need?.title || "Need"}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{firstOf(need?.organizations)?.name || "Organization"} · {need?.category}</p>
                </div>
                {need?.description && <p className="text-sm text-slate-600 dark:text-slate-300">{need.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {need?.location && <span className="bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1 rounded-lg">📍 {need.location}</span>}
                  {need?.quantity && <span className="bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1 rounded-lg">Qty: {need.quantity}</span>}
                  {need?.due_date && <span className="bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1 rounded-lg">Due {need.due_date}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</p>
                    <p className="font-semibold capitalize">{selectedFulfillment.status.replace("_", " ")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Requested</p>
                    <p className="font-semibold">{new Date(selectedFulfillment.created_at).toLocaleDateString()}</p>
                  </div>
                  {selectedFulfillment.completed_at && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed</p>
                      <p className="font-semibold">{new Date(selectedFulfillment.completed_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                {firstOf(selectedFulfillment.support_interests)?.message && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Your message</p>
                    <p className="text-sm italic text-slate-600 dark:text-slate-300">"{firstOf(selectedFulfillment.support_interests)?.message}"</p>
                  </div>
                )}
                {selectedFulfillment.notes && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Organization notes</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{selectedFulfillment.notes}</p>
                  </div>
                )}
                {selectedFulfillment.proof_notes && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery verification notes</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{selectedFulfillment.proof_notes}</p>
                  </div>
                )}
                {(proofGallery.length > 0 || selectedFulfillment.proof_storage_path) && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Delivery proof</p>
                    {isLoadingProof ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    ) : proofGallery.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {proofGallery.map((item) => (
                          <a key={item.id} href={item.signedUrl || undefined} target="_blank" rel="noreferrer" className="block">
                            {item.signedUrl && /\.pdf($|\?)/i.test(item.signedUrl) ? (
                              <span className="flex items-center justify-center h-24 rounded-xl border border-slate-200 dark:border-[#233350] text-xs font-bold text-blue-600 hover:underline">📄 {item.fileName || "View file"}</span>
                            ) : item.signedUrl ? (
                              <img src={item.signedUrl} alt={item.fileName || "Delivery proof"} className="rounded-xl h-24 w-full object-cover border border-slate-200 dark:border-[#233350]" />
                            ) : null}
                          </a>
                        ))}
                      </div>
                    ) : proofSignedUrl ? (
                      <a href={proofSignedUrl} target="_blank" rel="noreferrer" className="block">
                        <img src={proofSignedUrl} alt="Delivery proof" className="rounded-xl max-h-64 w-full object-cover border border-slate-200 dark:border-[#233350]" />
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400">Unable to load proof file.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* --- DONATE MODAL --- */}
      <DonateDialog
        open={!!donatingNeed}
        onOpenChange={(open) => !open && setDonatingNeed(null)}
        need={donatingNeed ? { id: donatingNeed.id, title: donatingNeed.title } : null}
        onDone={async () => { setMessage("Thank you! Your proof of payment has been submitted for verification."); await loadData() }}
      />

      {/* --- FINANCIAL GIFT PLEDGE MODAL --- */}
      <PledgeFinancialDialog
        open={showFinancialPledge}
        onOpenChange={setShowFinancialPledge}
        onDone={async () => { setMessage("Thank you! Your proof of payment has been submitted for verification."); await loadData() }}
      />

      {/* --- DONATION DETAIL MODAL --- */}
      <DonationDetailDialog
        open={!!selectedDonation}
        onOpenChange={(open) => !open && setSelectedDonation(null)}
        donation={selectedDonation}
        role="giver"
        onChanged={async () => { setSelectedDonation(null); await loadData() }}
      />
    </main>
  )
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent: "blue" | "emerald" | "amber" | "purple" }) {
  const accentClasses = {
    blue: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400",
    purple: "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400",
  }[accent]

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] p-4 flex items-center gap-3 shadow-sm">
      <div className={`rounded-xl p-2.5 ${accentClasses}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-extrabold leading-none">{value}</p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  )
}

function CountBadge({ value }: { value: number }) {
  if (value === 0) return null
  return <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">{value}</span>
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-8 text-center text-sm text-slate-500 dark:text-slate-400">{text}</div>
}
