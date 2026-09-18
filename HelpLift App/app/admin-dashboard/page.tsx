"use client"

import { useEffect, useMemo, useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  LogOut,
  ShieldCheck,
  Users,
  UserPlus,
  XCircle,
  Gift,
  Flame,
  AlertTriangle,
  PackageCheck,
  Pencil,
  Search,
  MessageSquare,
  Mail,
  X,
  Banknote,
  Phone,
  MapPin,
  FileText,
  BarChart3,
  Download,
  History,
  Paperclip,
  Megaphone
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { createClient } from "@/lib/supabase/client"
import { firstOf } from "@/lib/utils"
import { DonationDetailDialog, statusBadgeClasses, type DonationSummary } from "@/components/donation-detail-dialog"
import { GiftDetailDialog, type GiftDetailSummary } from "@/components/gift-detail-dialog"
import { formatCurrency } from "@/lib/banking"
import { toCsv, downloadCsv } from "@/lib/csv"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageComposeDialog } from "@/components/message-compose-dialog"
import { MessageDetailDialog } from "@/components/message-detail-dialog"
import { AnnouncementComposeDialog } from "@/components/announcement-compose-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Organization = {
  id: string
  profile_id: string
  name: string
  type: string
  registration_number?: string | null
  contact_name?: string | null
  contact_role?: string | null
  contact_email: string
  phone?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  mission?: string | null
  bank_name?: string | null
  bank_account_holder?: string | null
  bank_account_number?: string | null
  bank_branch_code?: string | null
  bank_account_type?: string | null
  logo_url?: string | null
  verification_status: "pending" | "approved" | "rejected" | "more_info_requested"
  verification_notes?: string | null
  created_at: string
}
type Profile = { id: string; full_name: string; email: string; role: "admin" | "organization" | "giver" | string; suspended?: boolean; suspended_reason?: string | null; created_at: string; phone?: string | null; account_type?: string | null }
type Need = { id: string; title: string; description: string; category: string; urgency?: string; status: "draft" | "open" | "in_progress" | "fulfilled" | "closed" | "rejected"; rejection_reason?: string | null; organizations: { name: string }[] | { name: string } | null; created_at: string }
type Interest = { id: string; status: "pending" | "accepted" | "declined"; message: string | null; needs: { title: string }[] | { title: string } | null; givers: { name: string; email: string }[] | { name: string; email: string } | null; created_at: string }
type AdminMessage = { id: string; title: string; message: string; sender_name?: string | null; sender_role?: string | null; read_at: string | null; created_at: string; attachment_file_name?: string | null; attachmentUrl?: string | null; attachments?: { id: string; file_name: string | null; url: string | null }[] }
type OrganizationDocument = { id: string; organization_id: string; file_name: string; document_type: string; signed_url?: string | null }
type OrgVerificationHistoryEntry = {
  id: string
  organization_id: string
  previous_status: string | null
  new_status: string
  notes: string | null
  created_at: string
  profiles: { full_name: string } | { full_name: string }[] | null
}
type AdminGift = {
  id: string
  title: string
  offering_type: string
  description: string
  quantity_or_value?: string | null
  conditions?: string | null
  location?: string | null
  expiry_date?: string | null
  status: "pending" | "approved" | "pending_claim" | "rejected" | "claimed"
  claim_notes?: string | null
  claim_motivation?: string | null
  created_at: string
  givers?: { name: string; email: string } | null
  organizations?: { name: string } | null
}
type AdminDonation = {
  id: string
  amount: number
  payment_method: string
  status: "pending" | "successful" | "unsuccessful"
  reference_code: string
  bank_name: string | null
  proof_storage_path: string | null
  payer_notes: string | null
  admin_notes: string | null
  receipt_sent_at?: string | null
  created_at: string
  needs: ({ title: string; organizations: { name: string }[] | { name: string } | null }[] | { title: string; organizations: { name: string }[] | { name: string } | null }) | null
  gift_offerings: { title: string }[] | { title: string } | null
  givers: { name: string; email: string }[] | { name: string; email: string } | null
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [needs, setNeeds] = useState<Need[]>([])
  const [interests, setInterests] = useState<Interest[]>([])
  const [documents, setDocuments] = useState<OrganizationDocument[]>([])
  const [verificationHistory, setVerificationHistory] = useState<OrgVerificationHistoryEntry[]>([])
  const [gifts, setGifts] = useState<AdminGift[]>([])
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [donations, setDonations] = useState<AdminDonation[]>([])
  const [selectedDonation, setSelectedDonation] = useState<DonationSummary | null>(null)
  const [selectedGift, setSelectedGift] = useState<GiftDetailSummary | null>(null)
  const [selectedOrgDetail, setSelectedOrgDetail] = useState<Organization | null>(null)
  const [selectedUserDetail, setSelectedUserDetail] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<"organizations" | "needs" | "interests" | "users" | "gifts" | "messages" | "donations" | "reports">("organizations")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [adminForm, setAdminForm] = useState({ full_name: "", email: "", password: "" })
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false)

  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [messagingRecipient, setMessagingRecipient] = useState<{ id: string; label: string } | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null)
  const [isAnnouncing, setIsAnnouncing] = useState(false)

  const loadData = async () => {
    let firstError = ""
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.replace("/admin-login")
    const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (currentProfile?.role !== "admin") {
      if (currentProfile?.role === "organization") return router.replace("/organisation-dashboard")
      if (currentProfile?.role === "giver") return router.replace("/givers-dashboard")
      setError("This dashboard is restricted to administrators.")
      setIsLoading(false)
      return
    }

    // --- Organizations (load full fields needed for edit dialog)
    try {
      const { data, error: err } = await supabase
        .from("organizations")
        .select("id, profile_id, name, type, registration_number, contact_name, contact_role, contact_email, verification_status, verification_notes, phone, address, city, province, mission, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type, logo_url, created_at")
        .order("created_at", { ascending: false })
      if (err) throw err
      setOrganizations((data || []) as Organization[])
    } catch (e: any) {
      const msg = e?.message || "Organizations load failed."
      firstError = firstError || msg
      console.error("Admin orgs load error:", e)
    }

    // --- Users / Profiles
    try {
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, suspended, suspended_reason, created_at")
        .order("created_at", { ascending: false })
      if (err) throw err

      const { data: giverRows } = await supabase.from("givers").select("profile_id, phone, account_type")
      const giverByProfileId: Record<string, { phone: string | null; account_type: string | null }> = {}
      for (const row of giverRows || []) {
        giverByProfileId[row.profile_id] = { phone: row.phone, account_type: row.account_type }
      }

      const withGiverDetails = (data || []).map((profile) => ({
        ...profile,
        phone: giverByProfileId[profile.id]?.phone ?? null,
        account_type: giverByProfileId[profile.id]?.account_type ?? null,
      }))
      setProfiles(withGiverDetails as Profile[])
    } catch (e: any) {
      const msg = e?.message || "Users load failed."
      firstError = firstError || msg
      console.error("Admin users load error:", e)
    }

    // --- Needs (with urgency fallback retry — exactly matching org dashboard fix)
    try {
      let needsQuery = supabase
        .from("needs")
        .select("id, title, description, category, urgency, status, rejection_reason, organizations(name), created_at")
        .order("created_at", { ascending: false })
      let { data: needsData, error: needsErr } = await needsQuery
      if (needsErr && needsErr.message?.toLowerCase().includes("urgency")) {
        const fallback: any = await supabase
          .from("needs")
          .select("id, title, description, category, status, rejection_reason, organizations(name), created_at")
          .order("created_at", { ascending: false })
        needsData = (fallback.data || []).map((item: any) => ({ ...item, urgency: "medium" }))
        needsErr = fallback.error
      }
      if (needsErr) throw needsErr
      setNeeds((needsData || []) as unknown as Need[])
    } catch (e: any) {
      const msg = e?.message || "Needs load failed."
      firstError = firstError || msg
      console.error("Admin needs load error:", e)
      setNeeds([])
    }

    // --- Support Interests
    try {
      const { data, error: err } = await supabase
        .from("support_interests")
        .select("id, status, message, needs(title), givers(name, email), created_at")
        .order("created_at", { ascending: false })
      if (err) throw err
      setInterests((data || []) as unknown as Interest[])
    } catch (e: any) {
      const msg = e?.message || "Interests load failed."
      firstError = firstError || msg
      console.error("Admin interests load error:", e)
    }

    // --- Org Documents (keep mixed source fallback)
    let docsFallback: OrganizationDocument[] = []
    try {
      const { data, error: err } = await supabase
        .from("organization_documents")
        .select("id, organization_id, file_name, document_type")
        .order("created_at", { ascending: false })
      if (!err) docsFallback = (data || []) as OrganizationDocument[]
    } catch (e: any) {
      console.error("Admin docs direct load error:", e)
    }
    const documentsResponse = await fetch("/api/admin/documents")
    setDocuments(documentsResponse.ok ? (await documentsResponse.json()).documents || [] : docsFallback)

    // --- Organization verification history (audit trail)
    try {
      const { data, error: err } = await supabase
        .from("organization_verification_history")
        .select("id, organization_id, previous_status, new_status, notes, created_at, profiles(full_name)")
        .order("created_at", { ascending: false })
      if (err) throw err
      setVerificationHistory((data || []) as unknown as OrgVerificationHistoryEntry[])
    } catch (e: any) {
      console.error("Admin verification history load error:", e)
    }

    // --- Gift Library
    try {
      const giftsRes = await fetch("/api/admin/gifts")
      if (giftsRes.ok) {
        const gData = await giftsRes.json()
        setGifts(gData.gifts || [])
      }
    } catch (e: any) {
      console.error("Admin gifts load error:", e)
    }

    // --- Messages sent to admin (direct messages from users/organizations,
    // plus public "Partner with us" contact-form inquiries)
    try {
      const { data, error: err } = await supabase
        .from("notifications")
        .select("id, title, message, sender_name, sender_role, read_at, created_at, attachment_storage_path, attachment_file_name")
        .in("type", ["message_to_admin", "contact_inquiry"])
        .order("created_at", { ascending: false })
      if (err) throw err
      const withAttachments = await Promise.all((data || []).map(async (item) => {
        let attachmentUrl: string | null = null
        if (item.attachment_storage_path) {
          const { data: signed } = await supabase.storage
            .from("message-attachments")
            .createSignedUrl(item.attachment_storage_path, 60 * 60)
          attachmentUrl = signed?.signedUrl || null
        }
        const { data: attachmentRows } = await supabase
          .from("notification_attachments")
          .select("id, storage_path, file_name")
          .eq("notification_id", item.id)
          .order("created_at", { ascending: true })
        const attachments = await Promise.all((attachmentRows || []).map(async (row) => {
          const { data: signed } = await supabase.storage.from("message-attachments").createSignedUrl(row.storage_path, 60 * 60)
          return { id: row.id, file_name: row.file_name, url: signed?.signedUrl || null }
        }))
        return { ...item, attachmentUrl, attachments }
      }))
      setMessages(withAttachments as AdminMessage[])
    } catch (e: any) {
      console.error("Admin messages load error:", e)
    }

    // --- Donations
    try {
      const donationsRes = await fetch("/api/admin/donations")
      if (donationsRes.ok) setDonations((await donationsRes.json()).donations || [])
    } catch (e: any) {
      console.error("Admin donations load error:", e)
    }

    if (firstError) setError(firstError)
    setIsLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const updateOrganization = async (id: string, verification_status: Organization["verification_status"], verification_notes?: string) => {
    const response = await fetch(`/api/admin/organizations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_status, verification_notes }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.message || "Organization update failed.")
    } else {
      await loadData()
    }
  }

  const updateNeed = async (id: string, status: Need["status"], rejection_reason?: string) => {
    const response = await fetch(`/api/admin/needs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejection_reason }),
    })
    if (!response.ok) setError((await response.json()).message || "Need update failed.")
    else await loadData()
  }

  const updateInterest = async (id: string, status: Interest["status"]) => {
    const response = await fetch(`/api/admin/interests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) setError((await response.json()).message || "Interest update failed.")
    else await loadData()
  }

  const updateGift = async (id: string, status: AdminGift["status"], claim_notes?: string) => {
    const response = await fetch(`/api/admin/gifts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, claim_notes }),
    })
    if (!response.ok) setError((await response.json()).message || "Gift update failed.")
    else await loadData()
  }

  const logout = async () => { await supabase.auth.signOut(); router.replace("/admin-login") }

  const markMessageRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {})
    setMessages(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  const openMessage = (item: AdminMessage) => {
    if (!item.read_at) markMessageRead(item.id)
    setSelectedMessage(item)
  }

  const createAdministrator = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsCreatingAdmin(true)
    setError("")
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adminForm) })
    if (!response.ok) setError((await response.json()).message || "Administrator creation failed.")
    else { setAdminForm({ full_name: "", email: "", password: "" }); await loadData() }
    setIsCreatingAdmin(false)
  }

  const saveOrganizationEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingOrganization) return
    setIsSavingEdit(true)
    setError("")
    const formData = new FormData(event.currentTarget)
    const payload = {
      name: (formData.get("name") as string)?.trim(),
      type: (formData.get("type") as string)?.trim(),
      contact_email: (formData.get("contact_email") as string)?.trim(),
      phone: (formData.get("phone") as string)?.trim() || null,
      address: (formData.get("address") as string)?.trim() || null,
      city: (formData.get("city") as string)?.trim() || null,
      province: (formData.get("province") as string)?.trim() || null,
      verification_status: formData.get("verification_status") as Organization["verification_status"],
    }
    const res = await fetch(`/api/admin/organizations/${editingOrganization.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.message || "Organization update failed.")
    } else {
      setEditingOrganization(null)
      await loadData()
    }
    setIsSavingEdit(false)
  }

  const saveProfileEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingProfile) return
    setIsSavingEdit(true)
    setError("")
    const formData = new FormData(event.currentTarget)
    const payload: Record<string, any> = {
      full_name: (formData.get("full_name") as string)?.trim(),
      role: formData.get("role") as string,
      suspended: formData.get("suspended") === "on",
      suspended_reason: (formData.get("suspended_reason") as string)?.trim() || "",
    }
    const password = formData.get("password") as string
    if (password && password.length >= 8) payload.password = password
    if (password && password.length < 8) {
      setError("Password must be at least 8 characters.")
      setIsSavingEdit(false)
      return
    }
    const res = await fetch(`/api/admin/users/${editingProfile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.message || "Profile update failed.")
    } else {
      setEditingProfile(null)
      await loadData()
    }
    setIsSavingEdit(false)
  }

  const deleteProfile = async (profile: Profile) => {
    setIsSavingEdit(true)
    setError("")
    const res = await fetch(`/api/admin/users/${profile.id}`, { method: "DELETE" })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.message || "Unable to delete this account.")
    } else {
      setDeletingProfile(null)
      setEditingProfile(null)
      await loadData()
    }
    setIsSavingEdit(false)
  }

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0B1220]"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></main>
  if (error && profiles.length === 0) return <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0B1220] p-6"><div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div></main>

  const unreadMessages = messages.filter(m => !m.read_at).length
  const pendingApprovals = organizations.filter(o => o.verification_status === "pending").length
  const pendingDonations = donations.filter(d => d.status === "pending").length
  const fulfilledNeeds = needs.filter(n => n.status === "fulfilled").length
  const unfulfilledNeeds = needs.filter(n => !["fulfilled", "closed"].includes(n.status)).length
  const pendingGifts = gifts.filter(g => g.status === "pending").length
  const pendingInterests = interests.filter(i => i.status === "pending").length
  const totalDonated = donations.filter(d => d.status === "successful").reduce((sum, d) => sum + Number(d.amount || 0), 0)

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-14 space-y-6">

        {/* --- HEADER --- */}
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 dark:from-blue-600 dark:to-indigo-600 p-3.5 text-white shadow-lg shadow-slate-900/20 dark:shadow-blue-600/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">HelpLift administration</p>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">Moderation dashboard</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Review platform verification, needs, gifts, and access.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsAnnouncing(true)}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70"
            >
              <Megaphone className="h-4 w-4" /> Announcement
            </button>
            <ThemeToggle className="h-9 w-9" />
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>

        {error && <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><XCircle className="h-5 w-5" />{error}</div>}

        {/* --- STATS ROW --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <StatCard icon={Building2} label="Organizations" value={organizations.length} accent="blue" />
          <StatCard icon={AlertTriangle} label="Pending Approvals" value={pendingApprovals} accent="amber" />
          <StatCard icon={ClipboardList} label="Total Needs" value={needs.length} accent="emerald" />
          <StatCard icon={PackageCheck} label="Fulfilled Needs" value={fulfilledNeeds} accent="emerald" />
          <StatCard icon={Users} label="Total Users" value={profiles.length} accent="purple" />
          <StatCard icon={Banknote} label="Pending Donations" value={pendingDonations} accent="amber" />
        </div>

        {/* --- TABS --- */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="gap-6">
          <TabsList className="w-full flex-wrap h-auto justify-start bg-white dark:bg-[#121B2E] border border-slate-200 dark:border-[#233350] p-1.5 rounded-2xl">
            <TabsTrigger value="organizations" className="gap-1.5 rounded-xl"><Building2 className="w-4 h-4" />Organizations<CountBadge value={pendingApprovals} /></TabsTrigger>
            <TabsTrigger value="needs" className="gap-1.5 rounded-xl"><ClipboardList className="w-4 h-4" />Needs<CountBadge value={unfulfilledNeeds} /></TabsTrigger>
            <TabsTrigger value="gifts" className="gap-1.5 rounded-xl"><Gift className="w-4 h-4" />Gift Library<CountBadge value={pendingGifts} /></TabsTrigger>
            <TabsTrigger value="interests" className="gap-1.5 rounded-xl"><CheckCircle2 className="w-4 h-4" />Interests<CountBadge value={pendingInterests} /></TabsTrigger>
            <TabsTrigger value="donations" className="gap-1.5 rounded-xl"><Banknote className="w-4 h-4" />Donations<CountBadge value={pendingDonations} /></TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 rounded-xl"><Users className="w-4 h-4" />Users<CountBadge value={profiles.length} /></TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5 rounded-xl"><Mail className="w-4 h-4" />Messages<CountBadge value={unreadMessages} /></TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5 rounded-xl"><BarChart3 className="w-4 h-4" />Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="organizations">
            <OrganizationsView organizations={organizations} documents={documents} onUpdate={updateOrganization} onEdit={setEditingOrganization} onMessage={(org) => setMessagingRecipient({ id: org.profile_id, label: org.name })} onSelect={setSelectedOrgDetail} />
          </TabsContent>
          <TabsContent value="needs">
            <NeedsView needs={needs} onUpdate={updateNeed} />
          </TabsContent>
          <TabsContent value="gifts">
            <GiftsView gifts={gifts} onUpdate={updateGift} onSelect={setSelectedGift} />
          </TabsContent>
          <TabsContent value="interests">
            <InterestsView interests={interests} onUpdate={updateInterest} />
          </TabsContent>
          <TabsContent value="donations">
            <DonationsView donations={donations} onSelect={setSelectedDonation} />
          </TabsContent>
          <TabsContent value="messages">
            <MessagesView messages={messages} onOpen={openMessage} />
          </TabsContent>
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Add administrator</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createAdministrator} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <input required placeholder="Admin name" value={adminForm.full_name} onChange={event => setAdminForm({ ...adminForm, full_name: event.target.value })} className="field" />
                  <input required type="email" placeholder="Admin email" value={adminForm.email} onChange={event => setAdminForm({ ...adminForm, email: event.target.value })} className="field" />
                  <input required minLength={8} type="password" placeholder="Password (8+ characters)" value={adminForm.password} onChange={event => setAdminForm({ ...adminForm, password: event.target.value })} className="field" />
                  <button disabled={isCreatingAdmin} className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                    {isCreatingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Add admin
                  </button>
                </form>
              </CardContent>
            </Card>
            <UsersView
              profiles={profiles}
              onEdit={setEditingProfile}
              onMessage={(profile) => setMessagingRecipient({ id: profile.id, label: profile.full_name })}
              onSelect={(profile) => {
                if (profile.role === "organization") {
                  const org = organizations.find(o => o.profile_id === profile.id)
                  if (org) { setSelectedOrgDetail(org); return }
                }
                setSelectedUserDetail(profile)
              }}
            />
          </TabsContent>
          <TabsContent value="reports">
            <ReportsView organizations={organizations} needs={needs} donations={donations} profiles={profiles} />
          </TabsContent>
        </Tabs>
      </div>

      {/* --- Edit Organization Dialog --- */}
      <Dialog open={!!editingOrganization} onOpenChange={open => !open && setEditingOrganization(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Edit Organization</DialogTitle>
            <button
              type="button"
              onClick={() => setEditingOrganization(null)}
              className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>
          {editingOrganization && (
            <form onSubmit={saveOrganizationEdit} className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-org-name">Organization name</Label>
                  <Input id="edit-org-name" name="name" defaultValue={editingOrganization.name} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-type">Organization type</Label>
                  <Input id="edit-org-type" name="type" defaultValue={editingOrganization.type} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-email">Contact email</Label>
                  <Input id="edit-org-email" name="contact_email" type="email" defaultValue={editingOrganization.contact_email} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-phone">Phone number</Label>
                  <Input id="edit-org-phone" name="phone" defaultValue={editingOrganization.phone ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-city">City</Label>
                  <Input id="edit-org-city" name="city" defaultValue={editingOrganization.city ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-province">Province</Label>
                  <Input id="edit-org-province" name="province" defaultValue={editingOrganization.province ?? undefined} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="edit-org-address">Street address</Label>
                  <Input id="edit-org-address" name="address" defaultValue={editingOrganization.address ?? undefined} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="edit-org-status">Verification status</Label>
                  <select
                    id="edit-org-status"
                    name="verification_status"
                    defaultValue={editingOrganization.verification_status}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="more_info_requested">More info requested</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingOrganization(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isSavingEdit}>
                  {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isSavingEdit ? "Saving..." : "Save changes"}</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Edit Profile Dialog --- */}
      <Dialog open={!!editingProfile} onOpenChange={open => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Edit User Profile</DialogTitle>
            <button
              type="button"
              onClick={() => setEditingProfile(null)}
              className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>
          {editingProfile && (
            <form onSubmit={saveProfileEdit} className="space-y-3 pt-2">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-profile-fullname">Full name</Label>
                  <Input id="edit-profile-fullname" name="full_name" defaultValue={editingProfile.full_name} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-profile-email">Email (read-only, used for login)</Label>
                  <Input id="edit-profile-email" name="email" defaultValue={editingProfile.email} readOnly className="bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-profile-role">Role</Label>
                  <select
                    id="edit-profile-role"
                    name="role"
                    defaultValue={editingProfile.role}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="giver">Giver</option>
                    <option value="organization">Organization</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-profile-password">Reset password (optional, 8+ chars)</Label>
                  <Input id="edit-profile-password" name="password" type="password" placeholder="Leave blank to keep current password" />
                </div>
                <SuspendFields key={editingProfile.id} profile={editingProfile} />
              </div>
              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingProfile(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isSavingEdit}>
                  {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isSavingEdit ? "Saving..." : "Save changes"}</span>
                </Button>
              </DialogFooter>
              <div className="pt-3 border-t border-slate-100 dark:border-[#233350]">
                <button
                  type="button"
                  onClick={() => setDeletingProfile(editingProfile)}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Delete this account
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Delete Account Confirmation --- */}
      <AlertDialog open={!!deletingProfile} onOpenChange={open => !open && setDeletingProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes {deletingProfile?.full_name}'s ({deletingProfile?.email}) account and all associated data — needs, donations, messages, everything linked to them. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingEdit}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSavingEdit}
              onClick={(e) => { e.preventDefault(); if (deletingProfile) deleteProfile(deletingProfile) }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {messagingRecipient && (
        <MessageComposeDialog
          open={!!messagingRecipient}
          onOpenChange={(open) => !open && setMessagingRecipient(null)}
          recipientLabel={messagingRecipient.label}
          recipientId={messagingRecipient.id}
        />
      )}

      <MessageDetailDialog
        open={!!selectedMessage}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
        message={selectedMessage}
      />

      <AnnouncementComposeDialog
        open={isAnnouncing}
        onOpenChange={setIsAnnouncing}
      />

      <DonationDetailDialog
        open={!!selectedDonation}
        onOpenChange={(open) => !open && setSelectedDonation(null)}
        donation={selectedDonation}
        role="admin"
        onChanged={async () => { setSelectedDonation(null); await loadData() }}
      />

      <GiftDetailDialog
        open={!!selectedGift}
        onOpenChange={(open) => !open && setSelectedGift(null)}
        gift={selectedGift}
        role="admin"
        onModerate={async (status) => { if (selectedGift) await updateGift(selectedGift.id, status); setSelectedGift(null) }}
        onClaimReview={async (status, claimNotes) => { if (selectedGift) await updateGift(selectedGift.id, status, claimNotes); setSelectedGift(null) }}
      />

      <OrganizationDetailDialog
        open={!!selectedOrgDetail}
        onOpenChange={(open) => !open && setSelectedOrgDetail(null)}
        organization={selectedOrgDetail}
        documents={documents}
        history={verificationHistory}
        onEdit={(org) => { setSelectedOrgDetail(null); setEditingOrganization(org) }}
        onMessage={(org) => { setSelectedOrgDetail(null); setMessagingRecipient({ id: org.profile_id, label: org.name }) }}
        onUpdate={async (id, status, notes) => { await updateOrganization(id, status, notes); setSelectedOrgDetail(null) }}
      />

      <UserDetailDialog
        open={!!selectedUserDetail}
        onOpenChange={(open) => !open && setSelectedUserDetail(null)}
        profile={selectedUserDetail}
        onEdit={(profile) => { setSelectedUserDetail(null); setEditingProfile(profile) }}
        onMessage={(profile) => { setSelectedUserDetail(null); setMessagingRecipient({ id: profile.id, label: profile.full_name }) }}
      />
    </main>
  )
}

function UserDetailDialog({
  open, onOpenChange, profile, onEdit, onMessage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile | null
  onEdit: (profile: Profile) => void
  onMessage: (profile: Profile) => void
}) {
  if (!profile) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">{profile.full_name.charAt(0).toUpperCase()}</span>
            </div>
            {profile.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#1A2740] capitalize">{profile.role}</span>
            {profile.account_type && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#1A2740] capitalize">{profile.account_type} account</span>
            )}
            {profile.suspended && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700">Suspended</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="break-all">{profile.email}</span>
            </div>
            {profile.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{profile.phone}</span>
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Joined</p>
              <p className="font-semibold">{new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {profile.suspended && profile.suspended_reason && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-xs font-semibold text-red-800 dark:text-red-300">
              Suspension reason: {profile.suspended_reason}
            </div>
          )}

          <DialogFooter className="pt-1 gap-2">
            <Button type="button" variant="outline" onClick={() => onMessage(profile)}>
              <MessageSquare className="w-4 h-4" /> Message
            </Button>
            <Button type="button" onClick={() => onEdit(profile)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function OrganizationsView({ organizations, documents, onUpdate, onEdit, onMessage, onSelect }: { organizations: Organization[]; documents: OrganizationDocument[]; onUpdate: (id: string, status: Organization["verification_status"], verification_notes?: string) => void; onEdit: (org: Organization) => void; onMessage: (org: Organization) => void; onSelect: (org: Organization) => void }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")
  const [requestingInfoId, setRequestingInfoId] = useState<string | null>(null)
  const [infoNotes, setInfoNotes] = useState("")
  const [viewingDocsOrg, setViewingDocsOrg] = useState<Organization | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? organizations.filter(org =>
          org.name.toLowerCase().includes(q) ||
          org.type.toLowerCase().includes(q) ||
          org.contact_email.toLowerCase().includes(q) ||
          (org.city || "").toLowerCase().includes(q) ||
          (org.province || "").toLowerCase().includes(q)
        )
      : organizations
    const sorted = [...filtered]
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === "status") sorted.sort((a, b) => a.verification_status.localeCompare(b.verification_status))
    else if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [organizations, query, sort])

  return (
    <>
    <Panel
      title="Organization verification & documents"
      toolbar={
        <SearchSortBar
          query={query}
          onQuery={setQuery}
          placeholder="Search by name, type, email, or location..."
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "name", label: "Name (A-Z)" },
            { value: "status", label: "Verification status" },
          ]}
        />
      }
    >
      {organizations.length === 0 ? (
        <Empty text="No organizations registered." />
      ) : visible.length === 0 ? (
        <Empty text="No organizations match your search." />
      ) : visible.map(org => {
        const orgDocuments = documents.filter(document => document.organization_id === org.id)
        return (
          <article key={org.id} role="button" tabIndex={0} onClick={() => onSelect(org)} className="row cursor-pointer">
            <div>
              <h3 className="font-bold text-base">{org.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 break-all">
                {org.type} · {org.contact_email} · {orgDocuments.length} document{orgDocuments.length === 1 ? "" : "s"} · Registered {new Date(org.created_at).toLocaleDateString()}
              </p>
              {(org.city || org.province || org.phone) && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {[org.city, org.province].filter(Boolean).join(", ")}
                  {org.phone ? ` · Tel: ${org.phone}` : ""}
                </p>
              )}
              {orgDocuments.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setViewingDocsOrg(org) }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg"
                >
                  <FileText className="w-3.5 h-3.5" /> View Documents ({orgDocuments.length})
                </button>
              )}
              {org.verification_notes && (
                <p className="mt-2 text-xs italic text-amber-700 dark:text-amber-400">Last note: {org.verification_notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onEdit(org)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button
                type="button"
                onClick={() => onMessage(org)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
              >
                <MessageSquare className="w-3 h-3" /> Message
              </button>
              <span className="rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">{org.verification_status.replace(/_/g, " ")}</span>
              {(org.verification_status === "pending" || org.verification_status === "more_info_requested") && (
                <>
                  <button onClick={() => onUpdate(org.id, "approved")} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Approve</button>
                  <button onClick={() => onUpdate(org.id, "rejected")} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">Reject</button>
                  {requestingInfoId === org.id ? (
                    <div className="flex items-center gap-2 w-full mt-2 basis-full">
                      <input
                        value={infoNotes}
                        onChange={e => setInfoNotes(e.target.value)}
                        placeholder="What additional information is needed?"
                        className="field flex-1 text-xs py-2"
                      />
                      <button
                        onClick={() => { if (infoNotes.trim()) { onUpdate(org.id, "more_info_requested", infoNotes.trim()); setRequestingInfoId(null); setInfoNotes("") } }}
                        className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shrink-0"
                      >
                        Send request
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setRequestingInfoId(org.id)} className="rounded-full border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-3 py-1.5 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/30">Request Info</button>
                  )}
                </>
              )}
            </div>
          </article>
        )
      })}
    </Panel>

    <Dialog open={!!viewingDocsOrg} onOpenChange={(open) => !open && setViewingDocsOrg(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {viewingDocsOrg?.name} — Documents
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-1 max-h-[60vh] overflow-y-auto pr-1">
          {viewingDocsOrg && documents.filter(d => d.organization_id === viewingDocsOrg.id).length === 0 ? (
            <p className="text-sm text-slate-400">No documents uploaded.</p>
          ) : (
            viewingDocsOrg && documents.filter(d => d.organization_id === viewingDocsOrg.id).map(document => (
              <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[#233350] p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{document.file_name}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{document.document_type.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {document.signed_url ? (
                  <a href={document.signed_url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-bold text-blue-600 hover:underline">
                    View
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-slate-400">Unavailable</span>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

function OrganizationDetailDialog({
  open, onOpenChange, organization, documents, history, onEdit, onMessage, onUpdate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: Organization | null
  documents: OrganizationDocument[]
  history: OrgVerificationHistoryEntry[]
  onEdit: (org: Organization) => void
  onMessage: (org: Organization) => void
  onUpdate: (id: string, status: Organization["verification_status"], verification_notes?: string) => Promise<void> | void
}) {
  const [showRequestInfo, setShowRequestInfo] = useState(false)
  const [infoNotes, setInfoNotes] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    setShowRequestInfo(false)
    setInfoNotes("")
    setShowHistory(false)
  }, [organization])

  if (!organization) return null
  const orgDocuments = documents.filter(d => d.organization_id === organization.id)
  const orgHistory = history.filter(h => h.organization_id === organization.id)
  const canModerate = organization.verification_status === "pending" || organization.verification_status === "more_info_requested"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {organization.logo_url ? (
              <img src={organization.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <Building2 className="w-5 h-5 text-blue-600" />
            )}
            {organization.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#1A2740] capitalize">{organization.type}</span>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${
              organization.verification_status === "approved" ? "bg-emerald-50 text-emerald-700" :
              organization.verification_status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
            }`}>
              {organization.verification_status.replace(/_/g, " ")}
            </span>
          </div>

          {organization.mission && (
            <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{organization.mission}"</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {organization.registration_number && (
              <div className="col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Registration number</p>
                <p className="font-semibold">{organization.registration_number}</p>
              </div>
            )}
            {(organization.contact_name || organization.contact_role) && (
              <div className="col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact person</p>
                <p className="font-semibold">{organization.contact_name || "—"}{organization.contact_role ? ` · ${organization.contact_role}` : ""}</p>
              </div>
            )}
            <div className="col-span-2 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="break-all">{organization.contact_email}</span>
            </div>
            {organization.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{organization.phone}</span>
              </div>
            )}
            {(organization.address || organization.city || organization.province) && (
              <div className="col-span-2 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{[organization.address, organization.city, organization.province].filter(Boolean).join(", ")}</span>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Registered</p>
              <p className="font-semibold">{new Date(organization.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {(organization.bank_name || organization.bank_account_number) && (
            <div className="rounded-xl border border-slate-200 dark:border-[#233350] p-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Banking details (for payout reference)</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{organization.bank_name || "—"}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{organization.bank_account_holder || "—"}</p>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                Acc: {organization.bank_account_number || "—"} · Branch: {organization.bank_branch_code || "—"}
              </p>
              {organization.bank_account_type && <p className="text-xs text-slate-600 dark:text-slate-300">{organization.bank_account_type}</p>}
            </div>
          )}

          {organization.verification_notes && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
              Last admin note: {organization.verification_notes}
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Documents ({orgDocuments.length})</p>
            {orgDocuments.length === 0 ? (
              <p className="text-xs text-slate-400">No documents uploaded.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {orgDocuments.map(document => document.signed_url ? (
                  <a key={document.id} href={document.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-lg">
                    <FileText className="w-3.5 h-3.5" /> {document.file_name} <span className="font-normal text-slate-400 capitalize">({document.document_type.replace(/_/g, " ")})</span>
                  </a>
                ) : (
                  <span key={document.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1.5 rounded-lg">
                    <FileText className="w-3.5 h-3.5" /> {document.file_name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <History className="w-3.5 h-3.5" /> Verification history ({orgHistory.length}) {showHistory ? "▲" : "▼"}
            </button>
            {showHistory && (
              orgHistory.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">No verification decisions recorded yet.</p>
              ) : (
                <ol className="mt-2 space-y-2 border-l-2 border-slate-100 dark:border-[#233350] pl-3">
                  {orgHistory.map(entry => {
                    const actor = Array.isArray(entry.profiles) ? entry.profiles[0]?.full_name : entry.profiles?.full_name
                    return (
                      <li key={entry.id} className="text-xs">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          {(entry.previous_status || "created").replace(/_/g, " ")} → <span className="capitalize">{entry.new_status.replace(/_/g, " ")}</span>
                          <span className="font-normal text-slate-400"> · {actor || "System"} · {new Date(entry.created_at).toLocaleString()}</span>
                        </p>
                        {entry.notes && <p className="text-slate-500 dark:text-slate-400 italic">"{entry.notes}"</p>}
                      </li>
                    )
                  })}
                </ol>
              )
            )}
          </div>

          <DialogFooter className="pt-2 gap-2 flex-wrap">
            <Button type="button" variant="outline" onClick={() => onMessage(organization)}>
              <MessageSquare className="w-4 h-4" /> Message
            </Button>
            <Button type="button" variant="outline" onClick={() => onEdit(organization)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          </DialogFooter>

          {canModerate && (
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-[#233350]">
              {showRequestInfo && (
                <textarea
                  value={infoNotes}
                  onChange={e => setInfoNotes(e.target.value)}
                  placeholder="What additional information is needed?"
                  className="w-full min-h-16 p-3 mt-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-amber-500"
                />
              )}
              <DialogFooter className="pt-2 gap-2 flex-wrap">
                {showRequestInfo ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => infoNotes.trim() && onUpdate(organization.id, "more_info_requested", infoNotes.trim())}
                    className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                  >
                    Send request
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setShowRequestInfo(true)} className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30">
                    Request Info
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => onUpdate(organization.id, "rejected")} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
                  Reject
                </Button>
                <Button type="button" onClick={() => onUpdate(organization.id, "approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NeedsView({ needs, onUpdate }: { needs: Need[]; onUpdate: (id: string, status: Need["status"], rejection_reason?: string) => void }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const urgencyRank: Record<string, number> = { high: 0, medium: 1, low: 2 }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? needs.filter(need =>
          need.title.toLowerCase().includes(q) ||
          need.category.toLowerCase().includes(q) ||
          (firstOf(need.organizations)?.name || "").toLowerCase().includes(q) ||
          need.status.replace(/_/g, " ").toLowerCase().includes(q)
        )
      : needs
    const sorted = [...filtered]
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sort === "urgency") sorted.sort((a, b) => (urgencyRank[(a.urgency || "medium").toLowerCase()] ?? 1) - (urgencyRank[(b.urgency || "medium").toLowerCase()] ?? 1))
    else if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [needs, query, sort])

  return (
    <Panel
      title="Needs moderation"
      toolbar={
        <SearchSortBar
          query={query}
          onQuery={setQuery}
          placeholder="Search by title, category, organization, or status..."
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "urgency", label: "Highest urgency" },
            { value: "title", label: "Title (A-Z)" },
          ]}
        />
      }
    >
      {needs.length === 0 ? (
        <Empty text="No needs have been created." />
      ) : visible.length === 0 ? (
        <Empty text="No needs match your search." />
      ) : visible.map(need => {
        const canModerate = need.status === "draft" || need.status === "rejected"
        return (
        <article key={need.id} className={`row ${need.status === "draft" ? "border-amber-200 bg-amber-50/40" : need.status === "rejected" ? "border-red-200 bg-red-50/40 dark:bg-red-950/10" : ""}`}>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">{need.title}</h3>
              {need.status === "draft" && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Awaiting approval</span>}
              {need.status === "rejected" && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">Rejected</span>}
              {need.urgency === "high" && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">High Urgency</span>}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{firstOf(need.organizations)?.name || "Organization"} · {need.category}</p>
            {need.status === "rejected" && need.rejection_reason && (
              <p className="mt-1 text-xs italic text-red-700 dark:text-red-400">Reason: {need.rejection_reason}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">{need.status.replace(/_/g, " ")}</span>
            {canModerate && <button onClick={() => onUpdate(need.id, "open")} className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">Approve &amp; Publish</button>}
            {canModerate && (
              rejectingId === need.id ? (
                <div className="flex items-center gap-2 w-full mt-2 basis-full">
                  <input
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional, shared with the organization)"
                    className="field flex-1 text-xs py-2"
                  />
                  <button
                    onClick={() => { onUpdate(need.id, "rejected", rejectReason.trim() || undefined); setRejectingId(null); setRejectReason("") }}
                    className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shrink-0"
                  >
                    Confirm reject
                  </button>
                </div>
              ) : (
                <button onClick={() => setRejectingId(need.id)} className="rounded-full border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30">Reject</button>
              )
            )}
            {(need.status === "open" || need.status === "in_progress") && <button onClick={() => onUpdate(need.id, "closed")} className="rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740]">Close</button>}
          </div>
        </article>
        )
      })}
    </Panel>
  )
}

function GiftsView({ gifts, onUpdate, onSelect }: { gifts: AdminGift[]; onUpdate: (id: string, status: AdminGift["status"], claim_notes?: string) => void; onSelect: (gift: GiftDetailSummary) => void }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")
  const [rejectingClaimId, setRejectingClaimId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState("")

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? gifts.filter(gift =>
          gift.title.toLowerCase().includes(q) ||
          gift.offering_type.toLowerCase().includes(q) ||
          gift.status.toLowerCase().includes(q) ||
          (gift.givers?.name || "").toLowerCase().includes(q) ||
          (gift.givers?.email || "").toLowerCase().includes(q)
        )
      : gifts
    const sorted = [...filtered]
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sort === "status") sorted.sort((a, b) => a.status.localeCompare(b.status))
    else if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [gifts, query, sort])

  return (
    <Panel
      title="Gift Library Moderation"
      toolbar={
        <SearchSortBar
          query={query}
          onQuery={setQuery}
          placeholder="Search by title, type, status, or giver..."
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "status", label: "Status" },
            { value: "title", label: "Title (A-Z)" },
          ]}
        />
      }
    >
      {gifts.length === 0 ? (
        <Empty text="No gift offerings submitted yet." />
      ) : visible.length === 0 ? (
        <Empty text="No gift offerings match your search." />
      ) : visible.map(gift => (
        <article
          key={gift.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect({
            id: gift.id,
            title: gift.title,
            offering_type: gift.offering_type,
            description: gift.description,
            quantity_or_value: gift.quantity_or_value,
            conditions: gift.conditions,
            location: gift.location,
            expiry_date: gift.expiry_date,
            status: gift.status,
            claim_notes: gift.claim_notes,
            claim_motivation: gift.claim_motivation,
            created_at: gift.created_at,
            giverName: gift.givers?.name,
            giverEmail: gift.givers?.email,
            claimedByOrgName: gift.organizations?.name,
          })}
          className="row flex-wrap cursor-pointer"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">{gift.title}</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 capitalize">
                {gift.offering_type}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{gift.description}</p>
            <p className="text-xs text-slate-400">Pledged by: {gift.givers?.name || "Giver"} ({gift.givers?.email || "No email"})</p>
            {(gift.status === "pending_claim" || gift.status === "claimed") && gift.organizations?.name && (
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Claimed by: {gift.organizations.name}</p>
            )}
            {gift.claim_notes && <p className="text-xs text-red-600 dark:text-red-400 italic">Last claim note: {gift.claim_notes}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
              gift.status === "approved" ? "bg-emerald-50 text-emerald-700" :
              gift.status === "claimed" ? "bg-blue-50 text-blue-700" :
              gift.status === "pending_claim" ? "bg-amber-50 text-amber-700" : "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300"
            }`}>
              {gift.status === "pending_claim" ? "Claim pending" : gift.status}
            </span>
            {gift.status === "pending" && (
              <>
                <button onClick={() => onUpdate(gift.id, "approved")} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Approve</button>
                <button onClick={() => onUpdate(gift.id, "rejected")} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">Reject</button>
              </>
            )}
            {gift.status === "pending_claim" && (
              <>
                <button onClick={() => onUpdate(gift.id, "claimed")} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Approve Claim</button>
                {rejectingClaimId === gift.id ? (
                  <div className="flex items-center gap-2 w-full mt-2 basis-full">
                    <input
                      value={rejectNotes}
                      onChange={e => setRejectNotes(e.target.value)}
                      placeholder="Reason for declining the claim (optional)"
                      className="field flex-1 text-xs py-2"
                    />
                    <button
                      onClick={() => { onUpdate(gift.id, "approved", rejectNotes); setRejectingClaimId(null); setRejectNotes("") }}
                      className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shrink-0"
                    >
                      Confirm decline
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setRejectingClaimId(gift.id)} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">Reject Claim</button>
                )}
              </>
            )}
          </div>
        </article>
      ))}
    </Panel>
  )
}

function InterestsView({ interests, onUpdate }: { interests: Interest[]; onUpdate: (id: string, status: Interest["status"]) => void }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? interests.filter(interest =>
          (firstOf(interest.needs)?.title || "").toLowerCase().includes(q) ||
          (firstOf(interest.givers)?.name || "").toLowerCase().includes(q) ||
          (firstOf(interest.givers)?.email || "").toLowerCase().includes(q) ||
          interest.status.toLowerCase().includes(q)
        )
      : interests
    const sorted = [...filtered]
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sort === "status") sorted.sort((a, b) => a.status.localeCompare(b.status))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [interests, query, sort])

  return (
    <Panel
      title="Support interests"
      toolbar={
        <SearchSortBar
          query={query}
          onQuery={setQuery}
          placeholder="Search by need, giver name, email, or status..."
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "status", label: "Status" },
          ]}
        />
      }
    >
      {interests.length === 0 ? (
        <Empty text="No support interests have been submitted." />
      ) : visible.length === 0 ? (
        <Empty text="No interests match your search." />
      ) : visible.map(interest => (
        <article key={interest.id} className="row">
          <div>
            <h3 className="font-bold">{firstOf(interest.needs)?.title || "Need"}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{firstOf(interest.givers)?.name || "Giver"} · {firstOf(interest.givers)?.email}</p>
            {interest.message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 italic">"{interest.message}"</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">{interest.status}</span>
            {interest.status === "pending" && (
              <>
                <button onClick={() => onUpdate(interest.id, "accepted")} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Accept</button>
                <button onClick={() => onUpdate(interest.id, "declined")} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">Decline</button>
              </>
            )}
          </div>
        </article>
      ))}
    </Panel>
  )
}

function DonationsView({ donations, onSelect }: { donations: AdminDonation[]; onSelect: (donation: DonationSummary) => void }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("pending_first")

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? donations.filter(d =>
          (firstOf(d.needs)?.title || "").toLowerCase().includes(q) ||
          (firstOf(firstOf(d.needs)?.organizations)?.name || "").toLowerCase().includes(q) ||
          (firstOf(d.gift_offerings)?.title || "").toLowerCase().includes(q) ||
          (firstOf(d.givers)?.name || "").toLowerCase().includes(q) ||
          (firstOf(d.givers)?.email || "").toLowerCase().includes(q) ||
          d.reference_code.toLowerCase().includes(q) ||
          d.status.toLowerCase().includes(q)
        )
      : donations
    const sorted = [...filtered]
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sort === "amount") sorted.sort((a, b) => Number(b.amount) - Number(a.amount))
    else if (sort === "pending_first") sorted.sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [donations, query, sort])

  return (
    <Panel
      title="Monetary donations & proof of payment"
      toolbar={
        <SearchSortBar
          query={query}
          onQuery={setQuery}
          placeholder="Search by need, organization, donor, reference, or status..."
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: "pending_first", label: "Pending first" },
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "amount", label: "Highest amount" },
          ]}
        />
      }
    >
      {donations.length === 0 ? (
        <Empty text="No monetary donations submitted yet." />
      ) : visible.length === 0 ? (
        <Empty text="No donations match your search." />
      ) : visible.map(item => {
        const need = firstOf(item.needs)
        const gift = firstOf(item.gift_offerings)
        const giver = firstOf(item.givers)
        const orgName = firstOf(need?.organizations)?.name
        const displayTitle = need?.title || gift?.title || "Gift Library Pledge"
        return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect({
            id: item.id,
            amount: item.amount,
            payment_method: item.payment_method,
            status: item.status,
            reference_code: item.reference_code,
            bank_name: item.bank_name,
            proof_storage_path: item.proof_storage_path,
            payer_notes: item.payer_notes,
            admin_notes: item.admin_notes,
            receipt_sent_at: item.receipt_sent_at,
            created_at: item.created_at,
            needTitle: displayTitle,
            orgName,
            giverName: giver?.name,
            giverEmail: giver?.email,
          })}
          className="row w-full text-left"
        >
          <div>
            <h3 className="font-bold">{displayTitle}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {orgName || "General Fund"} · {giver?.name || "Giver"} ({giver?.email}) · Ref: {item.reference_code}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold">{formatCurrency(Number(item.amount))}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusBadgeClasses(item.status)}`}>
              {item.status === "pending" ? (item.proof_storage_path ? "Pending Verification" : "Awaiting Payment") : item.status}
            </span>
          </div>
        </button>
        )
      })}
    </Panel>
  )
}

function UsersView({ profiles, onEdit, onMessage, onSelect }: { profiles: Profile[]; onEdit: (p: Profile) => void; onMessage: (p: Profile) => void; onSelect: (p: Profile) => void }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? profiles.filter(profile =>
          profile.full_name.toLowerCase().includes(q) ||
          profile.email.toLowerCase().includes(q) ||
          profile.role.toLowerCase().includes(q)
        )
      : profiles
    const sorted = [...filtered]
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sort === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name))
    else if (sort === "role") sorted.sort((a, b) => a.role.localeCompare(b.role))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [profiles, query, sort])

  return (
    <Panel
      title="Registered users"
      toolbar={
        <SearchSortBar
          query={query}
          onQuery={setQuery}
          placeholder="Search by name, email, or role..."
          sort={sort}
          onSort={setSort}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "name", label: "Name (A-Z)" },
            { value: "role", label: "Role" },
          ]}
        />
      }
    >
      {profiles.length === 0 ? (
        <Empty text="No users registered." />
      ) : visible.length === 0 ? (
        <Empty text="No users match your search." />
      ) : visible.map(profile => (
        <article
          key={profile.id}
          onClick={() => onSelect(profile)}
          className="row cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <div>
            <h3 className="font-bold flex items-center gap-2">
              {profile.full_name}
              {profile.suspended && (
                <span className="rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Suspended</span>
              )}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 break-all">
              {profile.email}
              {profile.phone && ` · ${profile.phone}`}
              {profile.account_type && ` · ${profile.account_type} account`}
              {` · Joined ${new Date(profile.created_at).toLocaleDateString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(profile) }}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMessage(profile) }}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <MessageSquare className="w-3 h-3" /> Message
            </button>
            <span className="rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">{profile.role}</span>
          </div>
        </article>
      ))}
    </Panel>
  )
}

function MessagesView({ messages, onOpen }: { messages: AdminMessage[]; onOpen: (item: AdminMessage) => void }) {
  return (
    <Panel title="Messages sent to admin">
      {messages.length === 0 ? (
        <Empty text="No messages from users or organizations yet." />
      ) : messages.map(item => (
        <div
          key={item.id}
          onClick={() => onOpen(item)}
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
      ))}
    </Panel>
  )
}

type Granularity = "day" | "month"

function getGranularity(startDate: Date, endDate: Date): Granularity {
  const days = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
  return days <= 45 ? "day" : "month"
}

function bucketKey(date: Date, granularity: Granularity) {
  if (granularity === "day") return date.toISOString().slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function bucketLabel(key: string, granularity: Granularity) {
  if (granularity === "day") return new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

function stepDate(date: Date, granularity: Granularity) {
  const next = new Date(date)
  if (granularity === "day") next.setDate(next.getDate() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next
}

function countByBucket<T>(items: T[], getDate: (item: T) => string, granularity: Granularity) {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = bucketKey(new Date(getDate(item)), granularity)
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

function sumByBucket<T>(items: T[], getDate: (item: T) => string, getValue: (item: T) => number, granularity: Granularity) {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = bucketKey(new Date(getDate(item)), granularity)
    map.set(key, (map.get(key) || 0) + getValue(item))
  }
  return map
}

const growthChartConfig: ChartConfig = {
  organizations: { label: "Organizations", theme: { light: "#2563eb", dark: "#3b82f6" } },
  users: { label: "Users", theme: { light: "#9333ea", dark: "#a855f7" } },
  needs: { label: "Needs", theme: { light: "#059669", dark: "#059669" } },
}

const donationsChartConfig: ChartConfig = {
  amount: { label: "Donated", theme: { light: "#9333ea", dark: "#a855f7" } },
}

const needsCategoryChartConfig: ChartConfig = {
  count: { label: "Needs", theme: { light: "#059669", dark: "#059669" } },
}

const orgStatusChartConfig: ChartConfig = {
  approved: { label: "Approved", theme: { light: "#059669", dark: "#059669" } },
  pending: { label: "Pending", theme: { light: "#d97706", dark: "#d97706" } },
  more_info_requested: { label: "More Info Requested", theme: { light: "#2563eb", dark: "#3b82f6" } },
  rejected: { label: "Rejected", theme: { light: "#e11d48", dark: "#e11d48" } },
}

function ReportsView({ organizations, needs, donations, profiles }: { organizations: Organization[]; needs: Need[]; donations: AdminDonation[]; profiles: Profile[] }) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const inRange = (createdAt: string) => {
    const time = new Date(createdAt).getTime()
    if (from && time < new Date(from).getTime()) return false
    if (to && time > new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) return false
    return true
  }

  const filteredOrgs = useMemo(() => organizations.filter(o => inRange(o.created_at)), [organizations, from, to])
  const filteredNeeds = useMemo(() => needs.filter(n => inRange(n.created_at)), [needs, from, to])
  const filteredDonations = useMemo(() => donations.filter(d => inRange(d.created_at)), [donations, from, to])
  const filteredProfiles = useMemo(() => profiles.filter(p => inRange(p.created_at)), [profiles, from, to])

  const approvedOrgs = filteredOrgs.filter(o => o.verification_status === "approved").length
  const rejectedOrgs = filteredOrgs.filter(o => o.verification_status === "rejected").length
  const fulfilledNeeds = filteredNeeds.filter(n => n.status === "fulfilled").length
  const successfulDonations = filteredDonations.filter(d => d.status === "successful")
  const totalDonated = successfulDonations.reduce((sum, d) => sum + Number(d.amount || 0), 0)

  const rangeLabel = from || to ? `${from || "the start"} to ${to || "now"}` : "all time"

  const timeline = useMemo(() => {
    const allDates = [...filteredOrgs, ...filteredProfiles, ...filteredNeeds, ...filteredDonations].map(x => x.created_at)
    if (allDates.length === 0) return { granularity: "month" as Granularity, keys: [] as string[] }
    const times = allDates.map(d => new Date(d).getTime())
    const startDate = from ? new Date(from) : new Date(Math.min(...times))
    const endDate = to ? new Date(to) : new Date(Math.max(...times))
    const granularity = getGranularity(startDate, endDate)
    const keys: string[] = []
    let cursor = new Date(startDate)
    let guard = 0
    while (cursor <= endDate && guard < 500) {
      keys.push(bucketKey(cursor, granularity))
      cursor = stepDate(cursor, granularity)
      guard++
    }
    return { granularity, keys }
  }, [filteredOrgs, filteredProfiles, filteredNeeds, filteredDonations, from, to])

  const growthData = useMemo(() => {
    const { granularity, keys } = timeline
    const orgCounts = countByBucket(filteredOrgs, o => o.created_at, granularity)
    const userCounts = countByBucket(filteredProfiles, p => p.created_at, granularity)
    const needCounts = countByBucket(filteredNeeds, n => n.created_at, granularity)
    return keys.map(key => ({
      period: bucketLabel(key, granularity),
      organizations: orgCounts.get(key) || 0,
      users: userCounts.get(key) || 0,
      needs: needCounts.get(key) || 0,
    }))
  }, [timeline, filteredOrgs, filteredProfiles, filteredNeeds])

  const donationsTrendData = useMemo(() => {
    const { granularity, keys } = timeline
    const amounts = sumByBucket(successfulDonations, d => d.created_at, d => Number(d.amount || 0), granularity)
    return keys.map(key => ({ period: bucketLabel(key, granularity), amount: amounts.get(key) || 0 }))
  }, [timeline, successfulDonations])

  const needsByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of filteredNeeds) counts.set(n.category, (counts.get(n.category) || 0) + 1)
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [filteredNeeds])

  const orgStatusData = useMemo(() => {
    const counts: Record<string, number> = { approved: 0, pending: 0, more_info_requested: 0, rejected: 0 }
    for (const o of filteredOrgs) counts[o.verification_status] = (counts[o.verification_status] || 0) + 1
    return [
      { status: "approved", value: counts.approved },
      { status: "pending", value: counts.pending },
      { status: "more_info_requested", value: counts.more_info_requested },
      { status: "rejected", value: counts.rejected },
    ].filter(d => d.value > 0)
  }, [filteredOrgs])

  return (
    <div className="space-y-6">
      <Panel title="Report date range">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-auto" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to">To</Label>
            <Input id="report-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="w-auto" />
          </div>
          {(from || to) && (
            <button type="button" onClick={() => { setFrom(""); setTo("") }} className="text-xs font-bold text-blue-600 hover:underline pb-2.5">
              Reset to all time
            </button>
          )}
          <p className="text-xs text-slate-400 pb-2.5">Showing metrics for {rangeLabel}.</p>
        </div>
      </Panel>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="New Organizations" value={filteredOrgs.length} accent="blue" />
        <StatCard icon={CheckCircle2} label="Approved Orgs" value={approvedOrgs} accent="emerald" />
        <StatCard icon={XCircle} label="Rejected Orgs" value={rejectedOrgs} accent="amber" />
        <StatCard icon={Users} label="New Users" value={filteredProfiles.length} accent="purple" />
        <StatCard icon={ClipboardList} label="New Needs" value={filteredNeeds.length} accent="emerald" />
        <StatCard icon={PackageCheck} label="Fulfilled Needs" value={fulfilledNeeds} accent="emerald" />
        <StatCard icon={Banknote} label="Successful Donations" value={successfulDonations.length} accent="amber" />
        <StatCard icon={Banknote} label="Total Donated" value={formatCurrency(totalDonated)} accent="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Platform growth">
          {growthData.length === 0 ? (
            <Empty text="No activity in this range yet." />
          ) : (
            <ChartContainer config={growthChartConfig} className="h-[280px] w-full">
              <LineChart data={growthData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="organizations" stroke="var(--color-organizations)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="users" stroke="var(--color-users)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="needs" stroke="var(--color-needs)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel title="Donations trend">
          {donationsTrendData.every(d => d.amount === 0) ? (
            <Empty text="No successful donations in this range yet." />
          ) : (
            <ChartContainer config={donationsChartConfig} className="h-[280px] w-full">
              <AreaChart data={donationsTrendData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={64} tickFormatter={(v) => formatCurrency(Number(v))} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                <Area type="monotone" dataKey="amount" stroke="var(--color-amount)" fill="var(--color-amount)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel title="Needs by category">
          {needsByCategory.length === 0 ? (
            <Empty text="No needs in this range yet." />
          ) : (
            <ChartContainer config={needsCategoryChartConfig} className="h-[280px] w-full">
              <BarChart data={needsByCategory} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} fontSize={11} width={110} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel title="Organization verification status">
          {orgStatusData.length === 0 ? (
            <Empty text="No organizations in this range yet." />
          ) : (
            <ChartContainer config={orgStatusChartConfig} className="h-[280px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
                <Pie data={orgStatusData} dataKey="value" nameKey="status" innerRadius={55} outerRadius={90} strokeWidth={2} stroke="var(--background)">
                  {orgStatusData.map((entry) => (
                    <Cell key={entry.status} fill={`var(--color-${entry.status})`} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="status" />} />
              </PieChart>
            </ChartContainer>
          )}
        </Panel>
      </div>

      <Panel title="Export detailed reports (CSV)">
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-3">Exports respect the date range above and reflect what's currently on the dashboard.</p>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            label="Organizations"
            onClick={() => downloadCsv(`organizations-${Date.now()}.csv`, toCsv(filteredOrgs, [
              { header: "Name", value: o => o.name },
              { header: "Type", value: o => o.type },
              { header: "Contact Email", value: o => o.contact_email },
              { header: "Phone", value: o => o.phone },
              { header: "City", value: o => o.city },
              { header: "Province", value: o => o.province },
              { header: "Verification Status", value: o => o.verification_status },
              { header: "Registered", value: o => new Date(o.created_at).toISOString() },
            ]))}
          />
          <ExportButton
            label="Needs"
            onClick={() => downloadCsv(`needs-${Date.now()}.csv`, toCsv(filteredNeeds, [
              { header: "Title", value: n => n.title },
              { header: "Organization", value: n => firstOf(n.organizations)?.name },
              { header: "Category", value: n => n.category },
              { header: "Urgency", value: n => n.urgency },
              { header: "Status", value: n => n.status },
              { header: "Created", value: n => new Date(n.created_at).toISOString() },
            ]))}
          />
          <ExportButton
            label="Donations"
            onClick={() => downloadCsv(`donations-${Date.now()}.csv`, toCsv(filteredDonations, [
              { header: "Reference", value: d => d.reference_code },
              { header: "Need", value: d => firstOf(d.needs)?.title || firstOf(d.gift_offerings)?.title || "" },
              { header: "Organization", value: d => firstOf(firstOf(d.needs)?.organizations)?.name },
              { header: "Giver", value: d => firstOf(d.givers)?.name },
              { header: "Giver Email", value: d => firstOf(d.givers)?.email },
              { header: "Amount", value: d => d.amount },
              { header: "Status", value: d => d.status },
              { header: "Payment Method", value: d => d.payment_method },
              { header: "Created", value: d => new Date(d.created_at).toISOString() },
            ]))}
          />
          <ExportButton
            label="Users"
            onClick={() => downloadCsv(`users-${Date.now()}.csv`, toCsv(filteredProfiles, [
              { header: "Name", value: p => p.full_name },
              { header: "Email", value: p => p.email },
              { header: "Role", value: p => p.role },
              { header: "Joined", value: p => new Date(p.created_at).toISOString() },
            ]))}
          />
        </div>
      </Panel>
    </div>
  )
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#233350] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
    >
      <Download className="w-3.5 h-3.5" /> Export {label}
    </button>
  )
}

function Panel({ title, toolbar, children }: { title: string; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {toolbar}
        <div className="mt-5 space-y-3">{children}</div>
      </CardContent>
    </Card>
  )
}

function SearchSortBar({
  query,
  onQuery,
  placeholder,
  sort,
  onSort,
  sortOptions,
}: {
  query: string
  onQuery: (value: string) => void
  placeholder: string
  sort: string
  onSort: (value: string) => void
  sortOptions: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={event => onQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
        />
      </div>
      <select
        value={sort}
        onChange={event => onSort(event.target.value)}
        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
      >
        {sortOptions.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

function SuspendFields({ profile }: { profile: Profile }) {
  const [suspended, setSuspended] = useState(!!profile.suspended)
  return (
    <div className="space-y-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3">
      <label className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
        <input type="checkbox" name="suspended" defaultChecked={profile.suspended || false} onChange={(e) => setSuspended(e.target.checked)} />
        Suspend this account
      </label>
      {suspended && (
        <div className="space-y-1">
          <Label htmlFor="edit-profile-suspended-reason">Reason (shown to the user)</Label>
          <textarea
            id="edit-profile-suspended-reason"
            name="suspended_reason"
            defaultValue={profile.suspended_reason || ""}
            placeholder="E.g., violation of community guidelines"
            className="w-full min-h-16 rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 dark:border-[#233350] p-8 text-center text-sm text-slate-500 dark:text-slate-400">{text}</div>
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; accent: "blue" | "emerald" | "amber" | "purple" }) {
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
