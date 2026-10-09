"use client"

import { useEffect, useMemo, useRef, useState, FormEvent } from "react"
import { fileUrl } from "@/lib/file-links"
import { useTabTransition } from "@/lib/use-tab-transition"
import { AdminDeleteButton } from "@/components/admin-delete-button"
import { stageFormFiles } from "@/lib/stage-uploads"
import { describeUploadLimit, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RefreshButton } from "@/components/refresh-button"
import { DashboardTour } from "@/components/dashboard-tour"
import { recordSignOut } from "@/components/activity-tracker"
import { showFeedback } from "@/lib/inline-feedback"
import {
  Building2,
  Check,
  ChevronDown,
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
  Wallet,
  Phone,
  MapPin,
  FileText,
  UploadCloud,
  BarChart3,
  Download,
  History,
  Paperclip,
  Megaphone,
  Settings,
  Bell,
  Star,
  Heart,
  Globe,
  Home,
  Activity,
  Code2,
  Flag,
  RefreshCw,
  Inbox,
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
import { GiftDetailDialog, type GiftDetailSummary, type GiftClaimSummary } from "@/components/gift-detail-dialog"
import { NeedDetailDialog, type NeedDetailSummary } from "@/components/need-detail-dialog"
import { formatCurrency } from "@/lib/banking"
import { toCsv, downloadCsv } from "@/lib/csv"
import { downloadChartAsImage } from "@/lib/chart-export"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SettingsDialog } from "@/components/settings-dialog"
import { AnalogClock } from "@/components/analog-clock"
import { TimeGreeting } from "@/components/time-greeting"
import { setReturnTo } from "@/lib/window-return"
import { ChangeEmailFlow, ChangePasswordFlow } from "@/components/account-security"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { appendSpeech } from "@/lib/speech-to-text"
import { activateOnKey } from "@/lib/keyboard"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageComposeDialog } from "@/components/message-compose-dialog"
import { RejectReasonDialog } from "@/components/reject-reason-dialog"
import { MessageViewToggle, SentMessages } from "@/components/sent-messages"
import { AdminFeedback } from "@/components/admin-feedback"
import { AdminLoginActivity } from "@/components/admin-login-activity"
import { AdminLiveActivity } from "@/components/admin-live-activity"
import { AdminDeveloperReports } from "@/components/admin-developer-reports"
import { AdminInquiries, type InquiriesView } from "@/components/admin-inquiries"
import { DashboardSearch, platformSettingsSearchItems, settingsSearchItems, themeSearchItem, type DashboardSearchItem } from "@/components/dashboard-search"
import { MobileAttentionGrid, MobileSectionHeading, MobileSectionNav, type MobileSection } from "@/components/mobile-section-nav"
import { AdminFulfillmentsView, type AdminFulfillment } from "@/components/admin-fulfillments"
import { PlatformSettingsAdmin } from "@/components/platform-settings-admin"
import { MessageDetailDialog } from "@/components/message-detail-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AnnouncementComposeDialog } from "@/components/announcement-compose-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { CountUp } from "@/components/count-up"
import { NotificationsWindow } from "@/components/notifications-window"
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
type Need = { id: string; title: string; description: string; category: string; urgency?: string; status: "draft" | "open" | "in_progress" | "fulfilled" | "closed" | "rejected" | "reopen_pending"; rejection_reason?: string | null; reopen_reason?: string | null; organizations: { name: string }[] | { name: string } | null; created_at: string; location?: string | null; quantity?: string | null; target_amount?: number | string | null; due_date?: string | null; need_attachments?: { id: string; storage_path: string; file_name: string | null; url: string }[] }
type AdminMessage = { id: string; type?: string; title: string; message: string; sender_name?: string | null; sender_role?: string | null; read_at: string | null; created_at: string; attachment_file_name?: string | null; attachmentUrl?: string | null; attachments?: { id: string; file_name: string | null; url: string | null }[] }
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
  status: "pending" | "approved" | "rejected" | "claimed"
  rejection_reason?: string | null
  claims: GiftClaimSummary[]
  created_at: string
  givers?: { name: string; email: string } | null
  organizations?: { name: string } | null
  photos?: { id: string; file_name: string | null; url: string | null }[]
}

function toGiftDetailSummary(gift: AdminGift): GiftDetailSummary {
  return {
    id: gift.id,
    title: gift.title,
    offering_type: gift.offering_type,
    description: gift.description,
    quantity_or_value: gift.quantity_or_value,
    conditions: gift.conditions,
    location: gift.location,
    expiry_date: gift.expiry_date,
    status: gift.status,
    rejection_reason: gift.rejection_reason,
    claims: gift.claims,
    created_at: gift.created_at,
    giverName: gift.givers?.name,
    giverEmail: gift.givers?.email,
    claimedByOrgName: gift.organizations?.name,
    photos: gift.photos,
  }
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
  is_platform_donation?: boolean
  donor?: { full_name: string; email: string }[] | { full_name: string; email: string } | null
  guest_name?: string | null
  guest_email?: string | null
}

type AdminWithdrawal = {
  id: string
  amount: number
  status: "pending" | "approved" | "rejected" | "paid" | "cancelled"
  rejection_reason: string | null
  proof_storage_path: string | null
  proof_file_name: string | null
  proof_url: string | null
  paid_at: string | null
  reviewed_at: string | null
  created_at: string
  organizations: { id: string; name: string; bank_name: string | null; bank_account_holder: string | null; bank_account_number: string | null; bank_branch_code: string | null; bank_account_type: string | null }[] | { id: string; name: string; bank_name: string | null; bank_account_holder: string | null; bank_account_number: string | null; bank_branch_code: string | null; bank_account_type: string | null } | null
  requester: { full_name: string; email: string }[] | { full_name: string; email: string } | null
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [needs, setNeeds] = useState<Need[]>([])
  const [documents, setDocuments] = useState<OrganizationDocument[]>([])
  const [verificationHistory, setVerificationHistory] = useState<OrgVerificationHistoryEntry[]>([])
  const [gifts, setGifts] = useState<AdminGift[]>([])
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [stories, setStories] = useState<AdminStory[]>([])
  const [fulfillments, setFulfillments] = useState<AdminFulfillment[]>([])
  // Asked whenever something is rejected/declined, so the admin can optionally
  // explain why; the reason is included in the notification sent to the user.
  const [rejectDialog, setRejectDialog] = useState<{ title: string; description: string; run: (reason: string) => Promise<void> | void } | null>(null)
  const [donations, setDonations] = useState<AdminDonation[]>([])
  const [selectedDonation, setSelectedDonation] = useState<DonationSummary | null>(null)
  const [selectedGift, setSelectedGift] = useState<GiftDetailSummary | null>(null)
  const [selectedOrgDetail, setSelectedOrgDetail] = useState<Organization | null>(null)
  const [selectedNeedDetail, setSelectedNeedDetail] = useState<Need | null>(null)
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [selectedUserDetail, setSelectedUserDetail] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<"needs" | "users" | "gifts" | "messages" | "donations" | "withdrawals" | "stories" | "fulfillments" | "reports" | "feedback" | "security" | "activity" | "dev-reports" | "inquiries">("users")
  // The Users tab has four views: organizations (verification), givers,
  // administrators (with the invite form) and every account.
  const [usersView, setUsersView] = useState<"organizations" | "givers" | "admins" | "people">("organizations")
  // Smooth tab transitions (lib/use-tab-transition.ts): tab bar first, then the header's buttons.
  const { changeTab, tabMotion } = useTabTransition(
    ["needs", "gifts", "donations", "withdrawals", "stories", "fulfillments", "users", "messages", "inquiries", "reports", "activity", "security", "feedback", "dev-reports"],
    activeTab,
    setActiveTab
  )
  const openOrganizations = () => { setUsersView("organizations"); changeTab("users") }
  // The Inquiries tab: anonymous tip-offs or homepage contact-form inquiries.
  const [inquiriesView, setInquiriesView] = useState<InquiriesView>("tip-offs")
  const [isLoading, setIsLoading] = useState(true)
  // Distinct from the setError(...) alias below - this one gates the whole
  // page (loadData() failing outright, e.g. "not actually an admin"), so it
  // has to be real, persistent state, not a bubble that fades after a few
  // seconds.
  const [loadError, setLoadError] = useState("")
  // Thin alias, kept under its original name so its many call sites below
  // don't need to change - shows next to whatever button triggered it
  // instead of a banner at the top of the page.
  const setError = (text: string) => showFeedback(text, "error")
  const [adminInviteEmail, setAdminInviteEmail] = useState("")
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false)
  const [adminInviteFeedback, setAdminInviteFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [adminInvitations, setAdminInvitations] = useState<{ id: string; email: string; expires_at: string; created_at: string }[]>([])
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null)

  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [messagingRecipient, setMessagingRecipient] = useState<{ id: string; label: string } | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null)
  const [isAnnouncing, setIsAnnouncing] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsMode, setSettingsMode] = useState<"menu" | "email" | "password" | "platform">("menu")
  const [ownEmail, setOwnEmail] = useState("")
  const [settingsMessage, setSettingsMessage] = useState("")

  // Bumped by the header's refresh button: sections that load their own data
  // (given it as refreshKey below) re-fetch too - in place, keeping their filters.
  const [refreshKey, setRefreshKey] = useState(0)
  const refreshAll = async () => {
    setRefreshKey(key => key + 1)
    await loadData()
  }

  const loadData = async () => {
    let firstError = ""
    const recordError = (msg: string) => { firstError = firstError || msg }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.replace("/admin-login")
    if (user.email) setOwnEmail(user.email)
    const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (currentProfile?.role !== "admin") {
      if (currentProfile?.role === "organization") return router.replace("/organisation-dashboard")
      if (currentProfile?.role === "giver") return router.replace("/givers-dashboard")
      setLoadError("This dashboard is restricted to administrators.")
      setIsLoading(false)
      return
    }

    // Every section below is independent of every other, so they're fired
    // off together instead of one after another - previously this was ~12
    // sequential round trips (plus a redundant, always-run documents fetch,
    // and an N+1 loop per message attachment), which alone could add up to
    // 10-15s. Run concurrently, the wall-clock cost is roughly the single
    // slowest section rather than the sum of all of them.
    await Promise.allSettled([
      // --- Organizations (load full fields needed for edit dialog)
      (async () => {
        try {
          const orgColumns = "id, profile_id, name, type, registration_number, contact_name, contact_role, contact_email, verification_status, verification_notes, phone, address, city, province, mission, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type, logo_url, created_at"
          // profiles(registration_complete): an account a Google/LinkedIn/
          // Microsoft sign-in created for someone who never registered isn't a
          // real registration (it's deleted - see app/auth/callback) - hide those placeholder
          // orgs until then. Falls back to no filtering if that migration hasn't
          // been applied yet.
          let { data, error: err } = await supabase
            .from("organizations")
            .select(`${orgColumns}, profiles(registration_complete)`)
            .order("created_at", { ascending: false })
          if (err && err.message?.toLowerCase().includes("registration_complete")) {
            const fallback = await supabase.from("organizations").select(orgColumns).order("created_at", { ascending: false })
            data = fallback.data as any
            err = fallback.error
          }
          if (err) throw err
          setOrganizations(
            (data || [])
              .filter((org: any) => org.profiles?.registration_complete !== false)
              .map(({ profiles, ...org }: any) => org) as Organization[]
          )
        } catch (e: any) {
          recordError(e?.message || "Organizations load failed.")
          console.error("Admin orgs load error:", e)
        }
      })(),

      // --- Users / Profiles
      (async () => {
        try {
          let { data, error: err } = await supabase
            .from("profiles")
            .select("id, full_name, email, role, suspended, suspended_reason, created_at, registration_complete")
            .order("created_at", { ascending: false })
          if (err && err.message?.toLowerCase().includes("registration_complete")) {
            const fallback = await supabase.from("profiles").select("id, full_name, email, role, suspended, suspended_reason, created_at").order("created_at", { ascending: false })
            data = fallback.data as any
            err = fallback.error
          }
          if (err) throw err

          const { data: giverRows } = await supabase.from("givers").select("profile_id, phone, account_type")
          const giverByProfileId: Record<string, { phone: string | null; account_type: string | null }> = {}
          for (const row of giverRows || []) {
            giverByProfileId[row.profile_id] = { phone: row.phone, account_type: row.account_type }
          }

          const withGiverDetails = (data || [])
            // An unfinished account left by a provider sign-in isn't a real
            // account to moderate - same rule as organizations above.
            .filter((profile: any) => profile.registration_complete !== false)
            .map((profile) => ({
              ...profile,
              phone: giverByProfileId[profile.id]?.phone ?? null,
              account_type: giverByProfileId[profile.id]?.account_type ?? null,
            }))
          setProfiles(withGiverDetails as Profile[])
        } catch (e: any) {
          recordError(e?.message || "Users load failed.")
          console.error("Admin users load error:", e)
        }
      })(),

      // --- Pending admin invitations
      (async () => {
        try {
          const res = await fetch("/api/admin/invitations")
          const data = await res.json().catch(() => ({}))
          if (res.ok) setAdminInvitations(data.invitations || [])
        } catch (e) {
          console.error("Admin invitations load error:", e)
        }
      })(),

      // --- Withdrawals
      (async () => {
        try {
          const res = await fetch("/api/admin/withdrawals")
          const data = await res.json().catch(() => ({}))
          if (res.ok) setWithdrawals(data.withdrawals || [])
        } catch (e) {
          console.error("Admin withdrawals load error:", e)
        }
      })(),

      // --- Needs (with urgency fallback retry - exactly matching org dashboard fix)
      (async () => {
        try {
          const needColumns = "id, title, description, category, urgency, status, rejection_reason, reopen_reason, location, quantity, target_amount, due_date, organizations(name), created_at, need_attachments(id, storage_path, file_name)"
          let needsQuery = supabase
            .from("needs")
            .select(needColumns)
            .order("created_at", { ascending: false })
          let { data: needsData, error: needsErr } = await needsQuery
          if (needsErr && needsErr.message?.toLowerCase().includes("urgency")) {
            const fallback: any = await supabase
              .from("needs")
              .select(needColumns.replace("urgency, ", ""))
              .order("created_at", { ascending: false })
            needsData = (fallback.data || []).map((item: any) => ({ ...item, urgency: "medium" }))
            needsErr = fallback.error
          }
          if (needsErr) throw needsErr
          setNeeds(((needsData || []) as any[]).map(item => ({
            ...item,
            need_attachments: (item.need_attachments || []).map((a: any) => ({
              ...a,
              url: supabase.storage.from("need-attachments").getPublicUrl(a.storage_path).data.publicUrl,
            })),
          })) as unknown as Need[])
        } catch (e: any) {
          recordError(e?.message || "Needs load failed.")
          console.error("Admin needs load error:", e)
          setNeeds([])
        }
      })(),

      // --- Org Documents. The direct-query fallback only ever ran to cover
      // the API route failing, but it used to run unconditionally on every
      // load either way - now it only fires when the API call actually fails.
      (async () => {
        try {
          const documentsResponse = await fetch("/api/admin/documents")
          if (documentsResponse.ok) {
            setDocuments((await documentsResponse.json()).documents || [])
            return
          }
          throw new Error(`Documents API responded with ${documentsResponse.status}`)
        } catch (e) {
          console.error("Admin docs API load error, falling back to direct query:", e)
          try {
            const { data, error: err } = await supabase
              .from("organization_documents")
              .select("id, organization_id, file_name, document_type")
              .order("created_at", { ascending: false })
            if (!err) setDocuments((data || []) as OrganizationDocument[])
          } catch (e2: any) {
            console.error("Admin docs direct load error:", e2)
          }
        }
      })(),

      // --- Organization verification history (audit trail)
      (async () => {
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
      })(),

      // --- Gift Library
      (async () => {
        try {
          const giftsRes = await fetch("/api/admin/gifts")
          if (giftsRes.ok) {
            const gData = await giftsRes.json()
            setGifts(gData.gifts || [])
          }
        } catch (e: any) {
          console.error("Admin gifts load error:", e)
        }
      })(),

      // --- Messages sent to admin (direct messages from users/organizations),
      // plus contact-form inquiries and tip-off alerts for the Inquiries tab
      (async () => {
        try {
          const { data, error: err } = await supabase
            .from("notifications")
            .select("id, type, title, message, sender_id, sender_name, sender_role, reply_to_snippet, read_at, delivered_at, created_at, attachment_storage_path, attachment_file_name")
            .in("type", ["message_to_admin", "contact_inquiry", "platform_feedback", "developer_report", "tip_off", "need_update"])
            .order("created_at", { ascending: false })
          if (err) throw err

          // An admin viewing this list is the "delivered" moment for anything
          // that hasn't reached that state yet (see /api/notifications for
          // the same idea on the giver/org side).
          const undelivered = (data || []).filter(item => !item.delivered_at).map(item => item.id)
          if (undelivered.length > 0) {
            const deliveredAt = new Date().toISOString()
            await supabase.from("notifications").update({ delivered_at: deliveredAt }).in("id", undelivered)
            for (const item of data || []) {
              if (undelivered.includes(item.id)) item.delivered_at = deliveredAt
            }
          }
          // Attachment lookups for every message also run together rather
          // than one message at a time (still one round trip per message -
          // see the loadData fetch-consolidation note above for the next step).
          const withAttachments = await Promise.all((data || []).map(async (item) => {
            let attachmentUrl: string | null = null
            const signedUrlPromise = item.attachment_storage_path
              ? Promise.resolve({ data: { signedUrl: fileUrl("message-attachments", item.attachment_storage_path) } })
              : Promise.resolve({ data: null })
            const attachmentRowsPromise = supabase
              .from("notification_attachments")
              .select("id, storage_path, file_name")
              .eq("notification_id", item.id)
              .order("created_at", { ascending: true })
            const [{ data: signed }, { data: attachmentRows }] = await Promise.all([signedUrlPromise, attachmentRowsPromise])
            attachmentUrl = signed?.signedUrl || null
            const attachments = await Promise.all((attachmentRows || []).map(async (row) => {
              const rowSigned = { signedUrl: fileUrl("message-attachments", row.storage_path) }
              return { id: row.id, file_name: row.file_name, url: rowSigned?.signedUrl || null }
            }))
            return { ...item, attachmentUrl, attachments }
          }))
          setMessages(withAttachments as AdminMessage[])
        } catch (e: any) {
          console.error("Admin messages load error:", e)
        }
      })(),

      // --- Fulfillments (deliveries) and their proof
      (async () => {
        try {
          const fulfillmentsRes = await fetch("/api/admin/fulfillments")
          if (fulfillmentsRes.ok) setFulfillments((await fulfillmentsRes.json()).fulfillments || [])
        } catch (e: any) {
          console.error("Admin fulfillments load error:", e)
        }
      })(),

      // --- Impact stories awaiting review
      (async () => {
        try {
          const storiesRes = await fetch("/api/admin/stories")
          if (storiesRes.ok) setStories((await storiesRes.json()).stories || [])
        } catch (e: any) {
          console.error("Admin stories load error:", e)
        }
      })(),

      // --- Donations
      (async () => {
        try {
          const donationsRes = await fetch("/api/admin/donations")
          if (donationsRes.ok) setDonations((await donationsRes.json()).donations || [])
        } catch (e: any) {
          console.error("Admin donations load error:", e)
        }
      })(),
    ])

    if (firstError) setLoadError(firstError)
    setIsLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const updateOrganization = async (id: string, verification_status: Organization["verification_status"], verification_notes?: string) => {
    if (verification_status === "rejected" && verification_notes === undefined) {
      setRejectDialog({
        title: "Reject organization",
        description: "The organization will be told it was rejected. You can add a message explaining why.",
        run: reason => performOrganizationUpdate(id, verification_status, reason || undefined),
      })
      return
    }
    await performOrganizationUpdate(id, verification_status, verification_notes)
  }

  const performOrganizationUpdate = async (id: string, verification_status: Organization["verification_status"], verification_notes?: string) => {
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

  // Housekeeping only - a fulfilled/closed need is a permanent record until
  // an admin explicitly clears it out; see api/admin/needs/[id]/route.ts for
  // why it's admin-only and only ever on those two end states.
  const deleteNeedRecord = async (_id: string) => {
    showFeedback("Need deleted.")
    await loadData()
  }

  // After any record is deleted with AdminDeleteButton (lib/admin-delete.ts).
  const afterDelete = async () => {
    showFeedback("Deleted.")
    await loadData()
  }

  // Initial listing moderation only (pending -> approved/rejected). Reviewing
  // a claim on an already-approved listing is a separate action - see
  // reviewGiftClaim, since an offering can have several claims at once.
  const updateGift = async (id: string, status: "approved" | "rejected", rejection_reason?: string) => {
    if (status === "rejected" && rejection_reason === undefined) {
      setRejectDialog({
        title: gifts.find(g => g.id === id)?.status === "approved" ? "Remove from the Gift Library" : "Reject gift offering",
        description: gifts.find(g => g.id === id)?.status === "approved"
          ? "The offering comes out of the Gift Library and the giver is told. You can add a message explaining why."
          : "The giver will be told their offering was rejected. You can add a message explaining why.",
        run: reason => updateGift(id, status, reason),
      })
      return
    }
    const response = await fetch(`/api/admin/gifts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejection_reason }),
    })
    if (!response.ok) setError((await response.json()).message || "Gift update failed.")
    else await loadData()
  }

  const reviewGiftClaim = async (claimId: string, approve: boolean, notes?: string) => {
    const response = await fetch(`/api/admin/gifts/claims/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, notes }),
    })
    if (!response.ok) {
      setError((await response.json()).message || "Could not review this claim.")
      return
    }
    // Declining one claim leaves the dialog open (there may be other pending
    // claims on the same offering still to review), so it needs fresh data -
    // not just the rest of the dashboard - reflecting the decision just made.
    const giftsRes = await fetch("/api/admin/gifts")
    if (giftsRes.ok) {
      const freshGifts: AdminGift[] = (await giftsRes.json()).gifts || []
      setGifts(freshGifts)
      setSelectedGift(prev => {
        if (!prev) return prev
        const fresh = freshGifts.find(g => g.id === prev.id)
        return fresh ? toGiftDetailSummary(fresh) : prev
      })
    }
  }

  // Housekeeping only - see api/admin/gifts/claims/[claimId]/route.ts for why
  // this is admin-only and blocked while a claim is still pending.
  const deleteGiftClaim = async (_claimId: string) => {
    showFeedback("Claim deleted.")
    const giftsRes = await fetch("/api/admin/gifts")
    if (giftsRes.ok) setGifts((await giftsRes.json()).gifts || [])
  }

  // Housekeeping only - see api/admin/fulfillments/[id]/route.ts for why this
  // is admin-only and blocked until the fulfillment is completed or cancelled.
  const deleteFulfillmentRecord = async (_id: string) => {
    showFeedback("Fulfillment deleted.")
    const fulfillmentsRes = await fetch("/api/admin/fulfillments")
    if (fulfillmentsRes.ok) setFulfillments((await fulfillmentsRes.json()).fulfillments || [])
  }

  const reviewWithdrawal = async (id: string, status: "approved" | "rejected", rejection_reason?: string) => {
    if (status === "rejected" && rejection_reason === undefined) {
      setRejectDialog({
        title: "Decline withdrawal",
        description: "The organization will be told their withdrawal request was declined. You can add a message explaining why.",
        run: reason => reviewWithdrawal(id, status, reason),
      })
      return
    }
    const response = await fetch(`/api/admin/withdrawals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejection_reason }),
    })
    if (!response.ok) setError((await response.json()).message || "Withdrawal update failed.")
    else await loadData()
  }

  const uploadWithdrawalProof = async (id: string, file: File) => {
    const formData = new FormData()
    formData.set("file", file)
    let body: FormData
    try {
      body = await stageFormFiles(formData, UPLOAD_LIMITS.withdrawalProof)
    } catch (err: any) {
      setError(err.message)
      return false
    }
    const response = await fetch(`/api/admin/withdrawals/${id}/proof`, { method: "POST", body })
    if (!response.ok) {
      setError((await response.json()).message || "Could not attach proof of payment.")
      return false
    }
    await loadData()
    return true
  }

  const reviewStory = async (id: string, status: "approved" | "rejected", reason?: string) => {
    if (status === "rejected" && reason === undefined) {
      setRejectDialog({
        title: "Reject impact story",
        description: "The organization will be told the story was rejected and can edit it to be reviewed again. You can add a message explaining why.",
        run: message => reviewStory(id, status, message),
      })
      return
    }
    const response = await fetch(`/api/admin/stories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    })
    if (!response.ok) setError((await response.json().catch(() => ({}))).message || "Story review failed.")
    else await loadData()
  }

  const logout = async () => { await recordSignOut(); await supabase.auth.signOut(); router.replace("/admin-login") }

  const markMessageRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {})
    setMessages(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  // Messages to admin aren't scoped to one recipient the way a giver's or
  // org's own notifications are (any admin can see and act on one), so this
  // updates the same set of ids the Messages tab already has loaded directly,
  // rather than /api/notifications/read-all (which only touches the caller's
  // own recipient_id).
  const markAllMessagesRead = async () => {
    const unreadIds = messages.filter(m => !m.read_at).map(m => m.id)
    if (unreadIds.length === 0) return
    const now = new Date().toISOString()
    setMessages(current => current.map(item => item.read_at ? item : { ...item, read_at: now }))
    try {
      await supabase.from("notifications").update({ read_at: now }).in("id", unreadIds)
    } catch {}
  }

  const openMessage = (item: AdminMessage) => {
    if (!item.read_at) markMessageRead(item.id)
    setSelectedMessage(item)
  }

  const inviteAdministrator = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsCreatingAdmin(true)
    setAdminInviteFeedback(null)
    const response = await fetch("/api/admin/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: adminInviteEmail }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setAdminInviteFeedback({ ok: false, text: data.message || "Invitation failed." })
    } else {
      setAdminInviteEmail("")
      setAdminInviteFeedback({
        ok: true,
        text: data.email_sent ? "Invitation email sent." : `Email couldn't be sent - share this link instead: ${data.invite_url}`,
      })
      await loadData()
    }
    setIsCreatingAdmin(false)
  }

  const revokeAdminInvitation = async (id: string) => {
    setRevokingInviteId(id)
    try {
      await fetch(`/api/admin/invitations/${id}`, { method: "DELETE" })
      await loadData()
    } finally {
      setRevokingInviteId(null)
    }
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
      registration_number: (formData.get("registration_number") as string)?.trim() || null,
      contact_name: (formData.get("contact_name") as string)?.trim() || null,
      contact_role: (formData.get("contact_role") as string)?.trim() || null,
      mission: (formData.get("mission") as string)?.trim() || null,
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
    // Giver details (only on the form for givers).
    if (formData.has("giver_phone")) payload.phone = ((formData.get("giver_phone") as string) || "").trim()
    if (formData.has("giver_account_type")) payload.account_type = formData.get("giver_account_type") as string
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
  if (loadError && profiles.length === 0) return <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0B1220] p-6"><div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">{loadError}</div></main>

  // Contact-form inquiries and tip-off alerts live in the Inquiries tab, not Messages.
  const isInquiry = (m: AdminMessage) => m.type === "contact_inquiry" || m.type === "tip_off"
  // Organization need updates (closed/fulfilled/reopen asked) only live in the bell.
  const inboxMessages = messages.filter(m => !isInquiry(m) && m.type !== "need_update")
  const contactInquiries = messages.filter(m => m.type === "contact_inquiry")
  const unreadMessages = inboxMessages.filter(m => !m.read_at).length
  const unreadInquiries = messages.filter(m => isInquiry(m) && !m.read_at).length
  // Opening the tip-offs list counts as reading their alerts.
  const selectSection = (value: string) => (value === "inquiries" && inquiriesView === "tip-offs" ? openTipOffs() : changeTab(value))
  const openTipOffs = () => {
    for (const m of messages) if (m.type === "tip_off" && !m.read_at) markMessageRead(m.id)
    setInquiriesView("tip-offs")
    changeTab("inquiries")
  }
  const pendingApprovals = organizations.filter(o => o.verification_status === "pending").length
  // "Pending" for donations means proof is actually on file to review - an
  // EFT donation with no proof uploaded yet has nothing for an admin to act on.
  const pendingDonations = donations.filter(d => d.status === "pending" && !!d.proof_storage_path).length
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending" || w.status === "approved").length
  const fulfilledNeeds = needs.filter(n => n.status === "fulfilled").length
  // Matches canModerate in NeedsView: drafts awaiting their first review,
  // previously-rejected needs an org could resubmit for another look, and
  // closed needs an org wants reopened.
  const needsAwaitingReview = needs.filter(n => n.status === "draft" || n.status === "rejected" || n.status === "reopen_pending").length
  // A listing awaiting its first review, or a claim on an already-approved
  // listing awaiting approval - both need an admin's attention.
  const pendingGifts = gifts.filter(g => g.status === "pending" || g.claims.some(c => c.status === "pending")).length
  const pendingStories = stories.filter(s => s.status === "pending").length
  // The Users tab's groups: chips on desktop, a dropdown on phones.
  const usersViewOptions = [
    { value: "organizations", label: "Organizations", icon: Building2, count: organizations.length, gradient: "from-blue-500 to-indigo-600", hint: "Verification and documents" },
    { value: "givers", label: "Givers", icon: Heart, count: profiles.filter(p => p.role === "giver").length, gradient: "from-pink-500 to-rose-600", hint: "Individuals, businesses and groups" },
    { value: "admins", label: "Admins", icon: ShieldCheck, count: profiles.filter(p => p.role === "admin").length, gradient: "from-slate-600 to-slate-800", hint: "The HelpLift team and invitations" },
    { value: "people", label: "All users", icon: Users, count: profiles.length, gradient: "from-emerald-500 to-teal-600", hint: "Every account on HelpLift" },
  ] as const
  // Phones: a bottom bar + "More" sheet instead of the long tab row (components/mobile-section-nav.tsx).
  const mobilePrimarySections: MobileSection[] = [
    { id: "users", label: "Users", icon: Users, count: pendingApprovals, gradient: "from-blue-500 to-indigo-600", hint: "Organizations, givers and admins" },
    { id: "needs", label: "Needs", icon: ClipboardList, count: needsAwaitingReview, gradient: "from-emerald-500 to-teal-600", hint: "Review, approve and reopen needs" },
    { id: "donations", label: "Donations", icon: Banknote, count: pendingDonations, gradient: "from-amber-500 to-orange-500", hint: "Confirm EFT proof of payment" },
    { id: "messages", label: "Messages", icon: Mail, count: unreadMessages, gradient: "from-sky-500 to-blue-600", hint: "Messages sent to the HelpLift team" },
  ]
  const mobileMoreSections: MobileSection[] = [
    { id: "gifts", label: "Gift Library", icon: Gift, count: pendingGifts, gradient: "from-purple-500 to-fuchsia-600", hint: "Pledges and claims to review" },
    { id: "withdrawals", label: "Withdrawals", icon: Wallet, count: pendingWithdrawals, gradient: "from-pink-500 to-rose-600", hint: "Pay out organizations" },
    { id: "stories", label: "Impact Stories", icon: FileText, count: pendingStories, gradient: "from-violet-500 to-purple-600", hint: "Approve stories before they go live" },
    { id: "fulfillments", label: "Fulfillments", icon: PackageCheck, gradient: "from-teal-500 to-cyan-600", hint: "Every delivery and its proof" },
    { id: "inquiries", label: "Inquiries", icon: Inbox, count: unreadInquiries, gradient: "from-orange-500 to-red-500", hint: "Tip-offs and contact-form messages" },
    { id: "reports", label: "Reports", icon: BarChart3, gradient: "from-indigo-500 to-blue-600", hint: "Totals, visits and charts" },
    { id: "activity", label: "Live activity", icon: Activity, gradient: "from-emerald-500 to-green-600", hint: "Who's online and what they're doing" },
    { id: "security", label: "Security", icon: ShieldCheck, gradient: "from-slate-600 to-slate-800", hint: "Every sign-in attempt" },
    { id: "feedback", label: "Feedback", icon: Star, gradient: "from-amber-400 to-yellow-500", hint: "Ratings and ideas from users" },
    { id: "dev-reports", label: "Dev reports", icon: Code2, gradient: "from-slate-500 to-blue-700", hint: "Bugs and ideas from the Developers page" },
  ]
  // Desktop "search anything" (components/dashboard-search.tsx): sections, actions and settings.
  const openAdminSettings = () => { setSettingsMode("menu"); setSettingsMessage(""); setIsSettingsOpen(true) }
  const openPlatformSettings = () => { setSettingsMessage(""); setSettingsMode("platform"); setIsSettingsOpen(true) }
  const openUsersView = (view: typeof usersView) => { setUsersView(view); selectSection("users") }
  const searchItems: DashboardSearchItem[] = [
    ...[...mobilePrimarySections, ...mobileMoreSections].map(section => ({
      id: `section-${section.id}`,
      label: section.label,
      group: "Sections" as const,
      icon: section.icon,
      hint: section.hint,
      onSelect: () => selectSection(section.id),
    })),
    { id: "action-announce", label: "Send an announcement", group: "Actions", icon: Megaphone, keywords: "announcement banner notice broadcast email users login homepage", onSelect: () => setIsAnnouncing(true) },
    { id: "action-settings", label: "Open Settings", group: "Actions", icon: Settings, keywords: "settings preferences options", onSelect: openAdminSettings },
    { id: "action-refresh", label: "Refresh the dashboard", group: "Actions", icon: RefreshCw, keywords: "reload refresh update", onSelect: () => { refreshAll() } },
    { id: "action-invite-admin", label: "Invite an administrator", group: "Actions", icon: Users, keywords: "invite admin add administrator team", onSelect: () => { setUsersView("admins"); selectSection("users") } },
    { id: "action-organizations", label: "Review organizations", group: "Actions", icon: Building2, keywords: "verify approve organizations documents pending", onSelect: openOrganizations },
    { id: "action-tip-offs", label: "Anonymous tip-offs", group: "Actions", icon: Flag, keywords: "tip off whistleblower report fraud", onSelect: () => openTipOffs() },
    themeSearchItem,
    { id: "action-home", label: "Go to the homepage", group: "Actions", icon: Home, keywords: "home homepage website", onSelect: () => router.push("/") },
    ...settingsSearchItems(openAdminSettings, { editProfile: false, loginEmail: true, platform: true, emailNotifications: false, giverSpotlight: false, deleteAccount: false }),
    // Inside other screens: Platform settings, the Users groups, Inquiries and announcements.
    ...platformSettingsSearchItems(openPlatformSettings),
    { id: "users-organizations", label: "Organizations (verification)", group: "Sections", icon: Building2, hint: "Users - organizations", keywords: "organizations verify approve documents pending", onSelect: () => openUsersView("organizations") },
    { id: "users-givers", label: "Givers", group: "Sections", icon: Heart, hint: "Users - givers", keywords: "givers donors individuals businesses", onSelect: () => openUsersView("givers") },
    { id: "users-admins", label: "Administrators", group: "Sections", icon: ShieldCheck, hint: "Users - admins and invitations", keywords: "admins administrators invite team", onSelect: () => openUsersView("admins") },
    { id: "users-all", label: "All users", group: "Sections", icon: Users, hint: "Users - every account", keywords: "all users accounts people", onSelect: () => openUsersView("people") },
    { id: "inquiries-contact", label: "Contact inquiries", group: "Sections", icon: Mail, hint: "Inquiries - homepage contact form", keywords: "contact form inquiry questions", onSelect: () => { setInquiriesView("contact"); selectSection("inquiries") } },
    { id: "announce-banner", label: "Login page banner", group: "Actions", icon: Megaphone, hint: "Send an announcement", keywords: "login banner announcement notice", onSelect: () => setIsAnnouncing(true) },
    { id: "announce-homepage", label: "Homepage notice", group: "Actions", icon: Megaphone, hint: "Send an announcement", keywords: "homepage notice announcement banner", onSelect: () => setIsAnnouncing(true) },
  ]
  const totalDonated = donations.filter(d => d.status === "successful").reduce((sum, d) => sum + Number(d.amount || 0), 0)

  // The bell combines actual messages with everything else sitting in a
  // moderation queue - a pending org, a need awaiting review, a gift/claim,
  // a withdrawal, a story - so it reads as one "what needs me" inbox instead
  // of messages-only. Queue items have no read/unread state of their own
  // (they're "unread" for as long as they're still pending); opening one
  // just switches to the tab where it's actually reviewed, since there's no
  // message body to show for them the way MessageDetailDialog expects.
  const notificationItems: {
    id: string
    icon: React.ComponentType<{ className?: string }>
    title: string
    subtitle: string
    created_at: string
    read: boolean
    onOpen: () => void
  }[] = [
    ...messages.map(m => ({
      id: `message-${m.id}`,
      icon: m.type === "developer_report" ? Code2 : m.type === "tip_off" ? Flag : m.type === "need_update" ? ClipboardList : Mail,
      title: m.title,
      subtitle: m.message,
      created_at: m.created_at,
      read: !!m.read_at,
      onOpen: () => {
        if (m.type === "tip_off") return openTipOffs()
        if (m.type === "need_update") { if (!m.read_at) markMessageRead(m.id); return changeTab("needs") }
        openMessage(m)
      },
    })),
    ...organizations.filter(o => o.verification_status === "pending").map(o => ({
      id: `org-${o.id}`,
      icon: Building2,
      title: "Organization awaiting approval",
      subtitle: o.name,
      created_at: o.created_at,
      read: false,
      onOpen: openOrganizations,
    })),
    ...needs.filter(n => n.status === "draft" || n.status === "rejected" || n.status === "reopen_pending").map(n => ({
      id: `need-${n.id}`,
      icon: ClipboardList,
      title: n.status === "draft" ? "Need awaiting review" : n.status === "reopen_pending" ? "Need reopen requested" : "Need resubmitted for review",
      subtitle: n.title,
      created_at: n.created_at,
      read: false,
      onOpen: () => setActiveTab("needs"),
    })),
    ...gifts.filter(g => g.status === "pending" || g.claims.some(c => c.status === "pending")).map(g => ({
      id: `gift-${g.id}`,
      icon: Gift,
      title: g.status === "pending" ? "Gift offering awaiting review" : "Gift claim awaiting review",
      subtitle: g.title,
      created_at: g.created_at,
      read: false,
      onOpen: () => setActiveTab("gifts"),
    })),
    ...withdrawals.filter(w => w.status === "pending" || w.status === "approved").map(w => ({
      id: `withdrawal-${w.id}`,
      icon: Wallet,
      title: "Withdrawal request",
      subtitle: `${firstOf(w.organizations)?.name || "Organization"} · ${formatCurrency(Number(w.amount))}`,
      created_at: w.created_at,
      read: false,
      onOpen: () => setActiveTab("withdrawals"),
    })),
    ...stories.filter(s => s.status === "pending").map(s => ({
      id: `story-${s.id}`,
      icon: FileText,
      title: "Impact story awaiting review",
      subtitle: `${firstOf(s.organizations)?.name || "Organization"} · ${s.title}`,
      created_at: s.created_at,
      read: false,
      onOpen: () => setActiveTab("stories"),
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const unreadNotifications = notificationItems.filter(item => !item.read).length

  return (
    <main className="admin-readable min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 max-md:pb-24">
      <div className="mx-auto max-w-[2400px] px-4 md:px-10 py-6 md:py-14 space-y-6">

        {/* Greeting for the time of day, with the clock and date beside it. */}
        <div className="flex flex-wrap items-center justify-end max-md:flex-nowrap max-md:justify-between gap-x-8 max-md:gap-x-3 gap-y-3">
          <DashboardSearch items={searchItems} placeholder="Search sections, actions and settings..." />
          <TimeGreeting name={profiles.find(p => p.email === ownEmail)?.full_name} firstNameOnly />
          <AnalogClock />
        </div>

        {/* --- HEADER --- */}
        <header className="flex flex-wrap items-center justify-between gap-5 max-md:gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded bg-gradient-to-br from-slate-800 to-slate-950 dark:from-blue-600 dark:to-indigo-600 p-3.5 text-white shadow-lg shadow-slate-900/20 dark:shadow-blue-600/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">HelpLift administration</p>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">Moderation dashboard</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Review platform verification, needs, gifts, and access.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mobile-toolbar">
            <button
              onClick={() => setIsAnnouncing(true)}
              aria-label="Send an announcement"
              data-tip="Send an announcement to users or show a banner on the login page"
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70"
            >
              <Megaphone className="h-4 w-4" />
            </button>
            <button
              data-tour="live-activity"
              data-tip="See who's online and what everyone is doing right now"
              onClick={() => changeTab("activity")}
              aria-pressed={activeTab === "activity"}
              className={`max-md:hidden inline-flex items-center gap-2 rounded border px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "activity"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-200 dark:border-[#233350] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live activity
            </button>
            {([
              { tab: "security", icon: ShieldCheck, name: "Security", tip: "Every sign-in attempt, successful or not" },
              { tab: "feedback", icon: Star, name: "Feedback", tip: "Ratings and ideas from givers and organizations" },
              { tab: "dev-reports", icon: Code2, name: "Dev reports", tip: "Bugs and ideas sent from the Developers page" },
            ] as const).map(({ tab, icon: Icon, name, tip }) => (
              <button
                key={tab}
                data-tour={tab}
                onClick={() => changeTab(tab)}
                aria-pressed={activeTab === tab}
                data-tip={tip}
                className={`max-md:hidden inline-flex items-center gap-2 rounded border px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                }`}
              >
                <Icon className="h-4 w-4" /> {name}
              </button>
            ))}
            <button
              data-tour="settings"
              aria-label="Settings"
              data-tip="Settings - your login email and password, and platform settings"
              onClick={() => { setSettingsMode("menu"); setSettingsMessage(""); setIsSettingsOpen(true) }}
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <Settings className="h-4 w-4" />
            </button>

            <NotificationsWindow
              unreadCount={unreadNotifications}
              buttonTip={unreadNotifications > 0 ? `Notifications: ${unreadNotifications} need attention. Click to see them.` : "Notifications. You're all caught up."}
              onMarkAllRead={unreadMessages > 0 ? markAllMessagesRead : undefined}
              markAllTip="Mark every message as read (doesn't affect items still awaiting review)"
              items={notificationItems.map(item => ({
                id: item.id,
                title: item.title,
                subtitle: item.subtitle,
                read: item.read,
                createdAt: item.created_at,
                icon: item.icon,
                onOpen: item.onOpen,
              }))}
            />

            <RefreshButton onRefresh={refreshAll} />
            <Link
              href="/"
              aria-label="Home"
              data-tip="Go to the HelpLift homepage"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Home className="w-4 h-4" />
            </Link>
            <ThemeToggle className="h-9 w-9" />
            <button onClick={logout} aria-label="Sign out" className="inline-flex items-center gap-2 rounded bg-slate-900 dark:bg-slate-100 px-4 py-2 max-md:h-9 max-md:w-9 max-md:justify-center max-md:px-0 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white">
              <LogOut className="h-4 w-4" /> <span className="max-md:hidden">Sign out</span>
            </button>
          </div>
        </header>

        {/* --- STATS ROW: what needs an admin's attention right now, nothing
             that's just a total (those live in the Reports tab instead) --- */}
        <MobileAttentionGrid
          onSelect={selectSection}
          items={[
            { id: "users", label: "Approvals", value: pendingApprovals, icon: AlertTriangle, tone: "text-amber-600" },
            { id: "needs", label: "Needs", value: needsAwaitingReview, icon: ClipboardList, tone: "text-emerald-600" },
            { id: "gifts", label: "Gifts", value: pendingGifts, icon: Gift, tone: "text-purple-600" },
            { id: "donations", label: "Donations", value: pendingDonations, icon: Banknote, tone: "text-amber-600" },
            { id: "withdrawals", label: "Withdrawals", value: pendingWithdrawals, icon: Wallet, tone: "text-pink-600" },
            { id: "stories", label: "Stories", value: pendingStories, icon: FileText, tone: "text-violet-600" },
            { id: "messages", label: "Messages", value: unreadMessages, icon: Mail, tone: "text-blue-600" },
          ]}
        />
        <div data-tour="admin-stats" className="max-md:hidden grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-x-6 gap-y-4">
          <StatCard icon={AlertTriangle} label="Pending Approvals" value={pendingApprovals} accent="amber" />
          <StatCard icon={ClipboardList} label="Needs Awaiting Review" value={needsAwaitingReview} accent="emerald" />
          <StatCard icon={Gift} label="Pending Gifts" value={pendingGifts} accent="blue" />
          <StatCard icon={Banknote} label="Pending Donations" value={pendingDonations} accent="amber" />
          <StatCard icon={Wallet} label="Pending Withdrawals" value={pendingWithdrawals} accent="pink" />
          <StatCard icon={FileText} label="Pending Stories" value={pendingStories} accent="purple" />
          <StatCard icon={Mail} label="Unread Messages" value={unreadMessages} accent="blue" />
        </div>

        {/* --- TABS --- */}
        <Tabs value={activeTab} onValueChange={selectSection} className="gap-6 max-md:gap-4">
          <MobileSectionHeading section={[...mobilePrimarySections, ...mobileMoreSections].find(section => section.id === activeTab)} />
          <MobileSectionNav primary={mobilePrimarySections} more={mobileMoreSections} active={activeTab} onSelect={selectSection} />
          <TabsList className="w-full flex-nowrap max-xl:flex-wrap max-xl:gap-y-1 justify-start overflow-x-auto max-md:hidden">
            <TabsTrigger value="needs" data-tour="tab-needs" className="shrink-0 gap-1.5 px-2.5"><ClipboardList className="w-4 h-4" />Needs<CountBadge value={needsAwaitingReview} /></TabsTrigger>
            <TabsTrigger value="gifts" className="shrink-0 gap-1.5 px-2.5"><Gift className="w-4 h-4" />Gift Library<CountBadge value={pendingGifts} /></TabsTrigger>
            <TabsTrigger value="donations" data-tour="tab-donations" className="shrink-0 gap-1.5 px-2.5"><Banknote className="w-4 h-4" />Donations<CountBadge value={pendingDonations} /></TabsTrigger>
            <TabsTrigger value="withdrawals" data-tour="tab-withdrawals" className="shrink-0 gap-1.5 px-2.5"><Wallet className="w-4 h-4" />Withdrawals<CountBadge value={pendingWithdrawals} /></TabsTrigger>
            <TabsTrigger value="stories" data-tour="tab-stories" className="shrink-0 gap-1.5 px-2.5"><FileText className="w-4 h-4" />Impact Stories<CountBadge value={pendingStories} /></TabsTrigger>
            <TabsTrigger value="fulfillments" className="shrink-0 gap-1.5 px-2.5"><PackageCheck className="w-4 h-4" />Fulfillments</TabsTrigger>
            <TabsTrigger value="users" data-tour="tab-users" className="shrink-0 gap-1.5 px-2.5"><Users className="w-4 h-4" />Users<CountBadge value={pendingApprovals} /></TabsTrigger>
            <TabsTrigger value="messages" className="shrink-0 gap-1.5 px-2.5"><Mail className="w-4 h-4" />Messages<CountBadge value={unreadMessages} /></TabsTrigger>
            <TabsTrigger value="inquiries" data-tip="Anonymous tip-offs and contact-form inquiries from the website" className="shrink-0 gap-1.5 px-2.5"><Inbox className="w-4 h-4" />Inquiries<CountBadge value={unreadInquiries} /></TabsTrigger>
            <TabsTrigger value="reports" data-tour="tab-reports" className="shrink-0 gap-1.5 px-2.5"><BarChart3 className="w-4 h-4" />Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="needs" className={tabMotion}>
            <NeedsView needs={needs} onUpdate={updateNeed} onDelete={deleteNeedRecord} onSelect={setSelectedNeedDetail} />
          </TabsContent>
          <TabsContent value="gifts" className={tabMotion}>
            <GiftsView gifts={gifts} onUpdate={updateGift} onSelect={gift => setSelectedGift(toGiftDetailSummary(gift))} onDeleted={afterDelete} />
          </TabsContent>
          <TabsContent value="donations" className={tabMotion}>
            <DonationsView donations={donations} onSelect={setSelectedDonation} onDeleted={afterDelete} />
          </TabsContent>
          <TabsContent value="withdrawals" className={tabMotion}>
            <WithdrawalsView withdrawals={withdrawals} onReview={reviewWithdrawal} onUploadProof={uploadWithdrawalProof} onDeleted={afterDelete} />
          </TabsContent>
          <TabsContent value="feedback" className={tabMotion}>
            <AdminFeedback refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="fulfillments" className={tabMotion}>
            <AdminFulfillmentsView fulfillments={fulfillments} onDelete={deleteFulfillmentRecord} onChanged={loadData} />
          </TabsContent>
          <TabsContent value="stories" className={tabMotion}>
            <StoriesView stories={stories} onReview={reviewStory} onDeleted={afterDelete} />
          </TabsContent>
          <TabsContent value="messages" className={tabMotion}>
            <MessagesView refreshKey={refreshKey} messages={inboxMessages} onOpen={item => { setReturnTo("Messages", () => {}); openMessage(item) }} onDeleted={afterDelete} />
          </TabsContent>
          <TabsContent value="inquiries" className={tabMotion}>
            <AdminInquiries
              refreshKey={refreshKey}
              view={inquiriesView}
              onViewChange={view => (view === "tip-offs" ? openTipOffs() : setInquiriesView(view))}
              inquiries={contactInquiries}
              onOpenInquiry={item => { setReturnTo("Inquiries", () => {}); openMessage(item as AdminMessage) }}
              onDeleted={afterDelete}
              onOpenOrganization={id => {
                const org = organizations.find(o => o.id === id)
                if (org) setSelectedOrgDetail(org)
              }}
            />
          </TabsContent>
          <TabsContent value="users" className={`space-y-6 ${tabMotion}`}>
            {/* Phones: one dropdown to pick the group. */}
            {(() => {
              const current = usersViewOptions.find(option => option.value === usersView) || usersViewOptions[0]
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Showing ${current.label}. Change group`}
                      className="md:hidden flex w-full items-center gap-3 rounded-2xl bg-white dark:bg-[#121B2E] px-3 py-2.5 text-left shadow-sm"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${current.gradient} text-white`}>
                        <current.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Showing</span>
                        <span className="block truncate text-sm font-bold">{current.label} <span className="font-semibold text-slate-400">({current.count})</span></span>
                      </span>
                      {current.value === "organizations" && <CountBadge value={pendingApprovals} />}
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={6} className="md:hidden w-(--radix-dropdown-menu-trigger-width) rounded-2xl border-0 p-1.5 shadow-xl">
                    {usersViewOptions.map(option => (
                      <DropdownMenuItem
                        key={option.value}
                        onSelect={() => setUsersView(option.value)}
                        className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${usersView === option.value ? "bg-blue-50 dark:bg-blue-950/50" : ""}`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${option.gradient} text-white`}>
                          <option.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">{option.label}</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">{option.hint}</span>
                        </span>
                        {option.value === "organizations" && <CountBadge value={pendingApprovals} />}
                        <span className="text-xs font-semibold text-slate-400">{option.count}</span>
                        {usersView === option.value && <Check className="h-4 w-4 text-blue-600" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            })()}

            <div className="max-md:hidden flex flex-wrap items-center gap-2" role="group" aria-label="Users view">
              {usersViewOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUsersView(option.value)}
                  aria-pressed={usersView === option.value}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                    usersView === option.value ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#233350]"
                  }`}
                >
                  <option.icon className="h-4 w-4" /> {option.label}
                  <span className="text-xs opacity-80">({option.count})</span>
                  {option.value === "organizations" && <CountBadge value={pendingApprovals} />}
                </button>
              ))}
            </div>

            {usersView === "organizations" ? (
              <OrganizationsView organizations={organizations} documents={documents} onUpdate={updateOrganization} onEdit={setEditingOrganization} onMessage={(org) => setMessagingRecipient({ id: org.profile_id, label: org.name })} onSelect={setSelectedOrgDetail} onDeleted={afterDelete} />
            ) : (
            <>
            {usersView === "admins" && (
            <Card>
              <CardHeader>
                <CardTitle>Invite administrator</CardTitle>
                <CardDescription>They'll get an email with a link to set their own name and password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form onSubmit={inviteAdministrator} className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input required type="email" placeholder="Admin email" value={adminInviteEmail} onChange={event => setAdminInviteEmail(event.target.value)} className="field" />
                  <button data-tip="Send an email invitation to become an administrator" disabled={isCreatingAdmin} className="inline-flex items-center justify-center gap-2 rounded bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                    {isCreatingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Send invitation
                  </button>
                </form>
                {adminInviteFeedback && (
                  <p className={`text-xs font-semibold break-all ${adminInviteFeedback.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {adminInviteFeedback.text}
                  </p>
                )}
                {adminInvitations.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#233350]">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending invitations</p>
                    {adminInvitations.map(invite => (
                      <div key={invite.id} className="flex items-center justify-between gap-3 rounded bg-slate-50 dark:bg-[#0B1220] px-3 py-2 text-sm">
                        <span className="truncate font-semibold">{invite.email}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-slate-400">Expires {new Date(invite.expires_at).toLocaleDateString()}</span>
                          <button type="button" data-tip="Cancel this invitation" disabled={revokingInviteId === invite.id} onClick={() => revokeAdminInvitation(invite.id)} className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline disabled:opacity-60">
                            {revokingInviteId === invite.id && <Loader2 className="w-3 h-3 animate-spin" />}
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
            <UsersView
              key={usersView}
              profiles={usersView === "givers" ? profiles.filter(p => p.role === "giver") : usersView === "admins" ? profiles.filter(p => p.role === "admin") : profiles}
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
            </>
            )}
          </TabsContent>
          <TabsContent value="reports" className={tabMotion}>
            <ReportsView refreshKey={refreshKey} organizations={organizations} needs={needs} donations={donations} profiles={profiles} gifts={gifts} withdrawals={withdrawals} />
          </TabsContent>
          <TabsContent value="security" className={tabMotion}>
            <AdminLoginActivity refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="activity" className={tabMotion}>
            <AdminLiveActivity refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="dev-reports" className={tabMotion}>
            <AdminDeveloperReports refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>

      {ownEmail && <DashboardTour role="admin" name={profiles.find(p => p.email === ownEmail)?.full_name} />}

      {/* --- Edit Organization Dialog --- */}
      <Dialog open={!!editingOrganization} onOpenChange={open => !open && setEditingOrganization(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Edit Organization</DialogTitle>
            <button aria-label="Close"
              type="button"
              onClick={() => setEditingOrganization(null)}
              className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
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
                <div className="space-y-1">
                  <Label htmlFor="edit-org-reg">Registration number</Label>
                  <Input id="edit-org-reg" name="registration_number" defaultValue={editingOrganization.registration_number ?? undefined} placeholder="NPO / company number" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-contact-name">Contact person</Label>
                  <Input id="edit-org-contact-name" name="contact_name" defaultValue={editingOrganization.contact_name ?? undefined} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="edit-org-contact-role">Contact person&apos;s role</Label>
                  <Input id="edit-org-contact-role" name="contact_role" defaultValue={editingOrganization.contact_role ?? undefined} placeholder="e.g. Director" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="edit-org-mission">Mission</Label>
                  <textarea id="edit-org-mission" name="mission" defaultValue={editingOrganization.mission ?? undefined} rows={3} className="field" />
                </div>
                <p className="sm:col-span-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Banking details can only be changed by the organization&apos;s owner, since withdrawals are paid to them.
                </p>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="edit-org-status">Verification status</Label>
                  <select
                    id="edit-org-status"
                    name="verification_status"
                    defaultValue={editingOrganization.verification_status}
                    className="w-full rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* --- Admin's own Settings (email / password) --- */}
      <SettingsDialog
        open={isSettingsOpen && settingsMode === "menu"}
        onOpenChange={open => setIsSettingsOpen(open)}
        onChangeEmail={() => { setSettingsMessage(""); setSettingsMode("email") }}
        onChangePassword={() => { setSettingsMessage(""); setSettingsMode("password") }}
        onPlatformSettings={() => { setSettingsMessage(""); setSettingsMode("platform") }}
      />
      <Dialog open={isSettingsOpen && settingsMode !== "menu"} onOpenChange={open => !open && setSettingsMode("menu")}>
        <DialogContent showCloseButton={false} className="overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>
              {settingsMode === "email" ? "Change Login Email" : settingsMode === "password" ? "Change Password" : "Platform Settings"}
            </DialogTitle>
            <button aria-label="Close" type="button" onClick={() => setSettingsMode("menu")} className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2740]">
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>
          {settingsMessage && <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{settingsMessage}</p>}
          {settingsMode === "email" && (
            <ChangeEmailFlow
              currentEmail={ownEmail}
              onBack={() => setSettingsMode("menu")}
              onUpdated={async (newEmail) => {
                await fetch("/api/admin/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ login_email: newEmail }),
                }).catch(() => {})
                setOwnEmail(newEmail)
                setSettingsMessage("Login email updated.")
                setSettingsMode("menu")
              }}
            />
          )}
          {settingsMode === "password" && (
            <ChangePasswordFlow
              onBack={() => setSettingsMode("menu")}
              onUpdated={() => { setSettingsMessage("Password updated."); setSettingsMode("menu") }}
            />
          )}
          {settingsMode === "platform" && <PlatformSettingsAdmin />}
        </DialogContent>
      </Dialog>

      {/* --- Edit Profile Dialog --- */}
      <Dialog open={!!editingProfile} onOpenChange={open => !open && setEditingProfile(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Edit User Profile</DialogTitle>
            <button aria-label="Close"
              type="button"
              onClick={() => setEditingProfile(null)}
              className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
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
                {editingProfile.role === "giver" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="edit-profile-phone">Phone</Label>
                      <Input id="edit-profile-phone" name="giver_phone" type="tel" defaultValue={editingProfile.phone ?? undefined} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-profile-account-type">Account type</Label>
                      <select id="edit-profile-account-type" name="giver_account_type" defaultValue={editingProfile.account_type || "individual"} className="field">
                        <option value="individual">Individual</option>
                        <option value="business">Business</option>
                        <option value="group">Group</option>
                      </select>
                    </div>
                  </div>
                )}
                <RoleFields key={`role-${editingProfile.id}`} profile={editingProfile} />
                <div className="space-y-1">
                  <Label htmlFor="edit-profile-password">Reset password (optional, 8+ chars)</Label>
                  <Input id="edit-profile-password" name="password" type="password" placeholder="Leave blank to keep current password" />
                </div>
                <SuspendFields key={`suspend-${editingProfile.id}`} profile={editingProfile} />
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
              This deletes {deletingProfile?.full_name}'s ({deletingProfile?.email}) account and all associated data - needs, donations, messages, everything linked to them. This cannot be undone.
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

      <NeedDetailDialog
        open={!!selectedNeedDetail}
        onOpenChange={(open) => !open && setSelectedNeedDetail(null)}
        need={selectedNeedDetail ? {
          id: selectedNeedDetail.id,
          title: selectedNeedDetail.title,
          description: selectedNeedDetail.description,
          category: selectedNeedDetail.category,
          urgency: selectedNeedDetail.urgency,
          status: selectedNeedDetail.status,
          rejection_reason: selectedNeedDetail.rejection_reason,
          reopen_reason: selectedNeedDetail.reopen_reason,
          organization_name: firstOf(selectedNeedDetail.organizations)?.name,
          location: selectedNeedDetail.location,
          quantity: selectedNeedDetail.quantity,
          target_amount: selectedNeedDetail.target_amount,
          due_date: selectedNeedDetail.due_date,
          created_at: selectedNeedDetail.created_at,
          attachments: selectedNeedDetail.need_attachments,
        } as NeedDetailSummary : null}
        onUpdate={async (id, status, rejection_reason) => { await updateNeed(id, status, rejection_reason); setSelectedNeedDetail(null) }}
      />

      <GiftDetailDialog
        open={!!selectedGift}
        onOpenChange={(open) => !open && setSelectedGift(null)}
        gift={selectedGift}
        role="admin"
        onModerate={async (status) => { if (selectedGift) await updateGift(selectedGift.id, status); setSelectedGift(null) }}
        onClaimReview={reviewGiftClaim}
        onClaimDelete={deleteGiftClaim}
      />

      <OrganizationDetailDialog
        onDeleted={async () => { setSelectedOrgDetail(null); await afterDelete() }}
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
      <RejectReasonDialog
        open={!!rejectDialog}
        title={rejectDialog?.title || ""}
        description={rejectDialog?.description || ""}
        onCancel={() => setRejectDialog(null)}
        onConfirm={async reason => {
          const dialog = rejectDialog
          setRejectDialog(null)
          if (dialog) await dialog.run(reason)
        }}
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
            <div className="w-8 h-8 rounded bg-slate-900 dark:bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">{profile.full_name.charAt(0).toUpperCase()}</span>
            </div>
            {profile.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-[#1A2740] capitalize">{profile.role}</span>
            {profile.account_type && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-[#1A2740] capitalize">{profile.account_type} account</span>
            )}
            {profile.suspended && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-red-50 text-red-700">Suspended</span>
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
            <div className="rounded bg-red-50 dark:bg-red-950/30 p-3 text-xs font-semibold text-red-800 dark:text-red-300">
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

function OrganizationsView({ organizations, documents, onUpdate, onEdit, onMessage, onSelect, onDeleted }: { onDeleted: () => void | Promise<void>; organizations: Organization[]; documents: OrganizationDocument[]; onUpdate: (id: string, status: Organization["verification_status"], verification_notes?: string) => void | Promise<void>; onEdit: (org: Organization) => void; onMessage: (org: Organization) => void; onSelect: (org: Organization) => void }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")
  const [requestingInfoId, setRequestingInfoId] = useState<string | null>(null)
  const [infoNotes, setInfoNotes] = useState("")
  const [viewingDocsOrg, setViewingDocsOrg] = useState<Organization | null>(null)
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null)
  const run = async (id: string, action: string, fn: () => void | Promise<void>) => {
    setBusy({ id, action })
    try { await fn() } finally { setBusy(null) }
  }

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
          <article key={org.id} role="button" tabIndex={0} onClick={() => onSelect(org)} onKeyDown={activateOnKey} className="row cursor-pointer">
            <div>
              <h3 className="font-bold text-base">{org.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 break-all max-md:hidden">
                {org.type} · {org.contact_email} · {orgDocuments.length} document{orgDocuments.length === 1 ? "" : "s"} · Registered {new Date(org.created_at).toLocaleDateString()}
              </p>
              <p className="md:hidden truncate text-sm text-slate-500 dark:text-slate-400">{org.type} · {[org.city, org.province].filter(Boolean).join(", ") || org.contact_email}</p>
              {(org.city || org.province || org.phone) && (
                <p className="max-md:hidden text-[11px] text-slate-400 mt-0.5">
                  {[org.city, org.province].filter(Boolean).join(", ")}
                  {org.phone ? ` · Tel: ${org.phone}` : ""}
                </p>
              )}
              {orgDocuments.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setViewingDocsOrg(org) }}
                  className="max-md:hidden mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded"
                >
                  <FileText className="w-3.5 h-3.5" /> View Documents ({orgDocuments.length})
                </button>
              )}
              {org.verification_notes && (
                <p className="mt-2 text-xs italic text-amber-700 dark:text-amber-400 max-md:line-clamp-1">Last note: {org.verification_notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onEdit(org)}
                className="max-md:hidden inline-flex items-center gap-1 btn-pill btn-pill--neutral"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button
                type="button"
                onClick={() => onMessage(org)}
                className="max-md:hidden inline-flex items-center gap-1 btn-pill btn-pill--neutral"
              >
                <MessageSquare className="w-3 h-3" /> Message
              </button>
              <span className="rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">{org.verification_status.replace(/_/g, " ")}</span>
              {(org.verification_status === "pending" || org.verification_status === "more_info_requested") && (
                <>
                  <button
                    onClick={() => run(org.id, "approve", () => onUpdate(org.id, "approved"))}
                    disabled={busy?.id === org.id}
                    className="inline-flex items-center gap-1.5 btn-pill btn-pill--green disabled:opacity-60"
                  >
                    {busy?.id === org.id && busy.action === "approve" && <Loader2 className="w-3 h-3 animate-spin" />}
                    Approve
                  </button>
                  <button onClick={() => onUpdate(org.id, "rejected")} disabled={busy?.id === org.id} className="btn-pill btn-pill--red disabled:opacity-60">Reject</button>
                  {requestingInfoId === org.id ? (
                    <div className="flex items-center gap-2 w-full mt-2 basis-full">
                      <input
                        value={infoNotes}
                        onChange={e => setInfoNotes(e.target.value)}
                        placeholder="What additional information is needed?"
                        className="field flex-1 text-xs py-2"
                      />
                      <button
                        onClick={() => {
                          if (!infoNotes.trim()) return
                          const notes = infoNotes.trim()
                          run(org.id, "info", async () => { await onUpdate(org.id, "more_info_requested", notes); setRequestingInfoId(null); setInfoNotes("") })
                        }}
                        disabled={busy?.id === org.id}
                        className="inline-flex items-center gap-1.5 btn-pill btn-pill--amber-solid shrink-0 disabled:opacity-60"
                      >
                        {busy?.id === org.id && busy.action === "info" && <Loader2 className="w-3 h-3 animate-spin" />}
                        Send request
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setRequestingInfoId(org.id)} className="btn-pill btn-pill--amber">Request Info</button>
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
            {viewingDocsOrg?.name} - Documents
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-1 max-h-[60vh] overflow-y-auto pr-1">
          {viewingDocsOrg && documents.filter(d => d.organization_id === viewingDocsOrg.id).length === 0 ? (
            <p className="text-sm text-slate-400">No documents uploaded.</p>
          ) : (
            viewingDocsOrg && documents.filter(d => d.organization_id === viewingDocsOrg.id).map(document => (
              <div key={document.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 dark:border-[#233350] p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{document.file_name}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{document.document_type.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {document.signed_url ? (
                    <a href={document.signed_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline">
                      View
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Unavailable</span>
                  )}
                  <AdminDeleteButton kind="organization-document" id={document.id} onDeleted={onDeleted} iconOnly />
                </div>
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
  open, onOpenChange, organization, documents, history, onEdit, onMessage, onUpdate, onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: Organization | null
  documents: OrganizationDocument[]
  history: OrgVerificationHistoryEntry[]
  onEdit: (org: Organization) => void
  onMessage: (org: Organization) => void
  onUpdate: (id: string, status: Organization["verification_status"], verification_notes?: string) => Promise<void> | void
  onDeleted?: () => Promise<void> | void
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
  // Every status can be changed: pending ones reviewed, approved ones revoked
  // (e.g. after a confirmed tip-off) and rejected ones reconsidered.
  const canModerate = true
  const isApproved = organization.verification_status === "approved"
  const isRejected = organization.verification_status === "rejected"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {organization.logo_url ? (
              <img src={organization.logo_url} alt="" className="w-8 h-8 rounded object-cover" />
            ) : (
              <Building2 className="w-5 h-5 text-blue-600" />
            )}
            {organization.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-[#1A2740] capitalize">{organization.type}</span>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded capitalize ${
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
                <p className="font-semibold">{organization.contact_name || "-"}{organization.contact_role ? ` · ${organization.contact_role}` : ""}</p>
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
            <div className="rounded border border-slate-200 dark:border-[#233350] p-3 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Banking details (for payout reference)</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{organization.bank_name || "-"}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{organization.bank_account_holder || "-"}</p>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                Acc: {organization.bank_account_number || "-"} · Branch: {organization.bank_branch_code || "-"}
              </p>
              {organization.bank_account_type && <p className="text-xs text-slate-600 dark:text-slate-300">{organization.bank_account_type}</p>}
            </div>
          )}

          {organization.verification_notes && (
            <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
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
                  <a key={document.id} href={document.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded">
                    <FileText className="w-3.5 h-3.5" /> {document.file_name} <span className="font-normal text-slate-400 capitalize">({document.document_type.replace(/_/g, " ")})</span>
                  </a>
                ) : (
                  <span key={document.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1.5 rounded">
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
            <AdminDeleteButton kind="organization" id={organization.id} iconOnly={false} label="Delete organization" className="mr-auto h-9" onDeleted={() => onDeleted?.()} />
            <button type="button" onClick={() => onMessage(organization)} className="btn-pill btn-pill--neutral h-9">
              <MessageSquare /> Message
            </button>
            <button type="button" onClick={() => onEdit(organization)} className="btn-pill btn-pill--neutral h-9">
              <Pencil /> Edit
            </button>
          </DialogFooter>

          {canModerate && (
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-[#233350]">
              {showRequestInfo && (
                <div className="mt-3">
                  <div className="flex justify-end mb-1">
                    <GrammarCheckButton text={infoNotes} onTextChange={setInfoNotes} />
                  </div>
                  <div className="relative">
                    <textarea
                      value={infoNotes}
                      onChange={e => setInfoNotes(e.target.value)}
                      placeholder="What additional information is needed?"
                      className="w-full min-h-16 p-3 pr-11 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded text-sm outline-none focus:border-amber-500"
                    />
                    <MicButton className="top-2 right-2" onText={text => setInfoNotes(n => appendSpeech(n, text))} />
                  </div>
                </div>
              )}
              <DialogFooter className="pt-2 gap-2 flex-wrap">
                {showRequestInfo ? (
                  <button type="button" onClick={() => infoNotes.trim() && onUpdate(organization.id, "more_info_requested", infoNotes.trim())} className="btn-pill btn-pill--amber-solid h-9">
                    Send request
                  </button>
                ) : (
                  <button type="button" onClick={() => setShowRequestInfo(true)} className="btn-pill btn-pill--amber h-9">
                    Request Info
                  </button>
                )}
                {!isRejected && (
                  <button type="button" onClick={() => onUpdate(organization.id, "rejected")} data-tip={isApproved ? "Remove this organization's verification - its needs come off the platform until it's approved again" : undefined} className="btn-pill btn-pill--red h-9">
                    {isApproved ? "Revoke verification" : "Reject"}
                  </button>
                )}
                {!isApproved && (
                  <button type="button" onClick={() => onUpdate(organization.id, "approved")} className="btn-pill btn-pill--green h-9">
                    {isRejected ? "Reconsider & approve" : "Approve"}
                  </button>
                )}
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NeedsView({ needs, onUpdate, onDelete, onSelect }: { needs: Need[]; onUpdate: (id: string, status: Need["status"], rejection_reason?: string) => void | Promise<void>; onDelete: (id: string) => void | Promise<void>; onSelect: (need: Need) => void }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  // Closing a live need (open or in progress), with an optional reason for the organization.
  const [closingId, setClosingId] = useState<string | null>(null)
  const [closeReason, setCloseReason] = useState("")
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null)
  const run = async (id: string, action: string, fn: () => void | Promise<void>) => {
    setBusy({ id, action })
    try { await fn() } finally { setBusy(null) }
  }

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
        const isReopenRequest = need.status === "reopen_pending"
        const canModerate = need.status === "draft" || need.status === "rejected" || isReopenRequest
        return (
        <article
          key={need.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(need)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(need) } }}
          className={`row cursor-pointer ${need.status === "draft" ? "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/10" : need.status === "rejected" ? "border-red-200 bg-red-50/40 dark:bg-red-950/10" : isReopenRequest ? "border-purple-200 bg-purple-50/40 dark:border-purple-900 dark:bg-purple-950/10" : ""}`}
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">{need.title}</h3>
              {need.status === "draft" && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Awaiting approval</span>}
              {need.status === "rejected" && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">Rejected</span>}
              {isReopenRequest && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Reopen requested</span>}
              {need.urgency === "high" && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">High Urgency</span>}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{firstOf(need.organizations)?.name || "Organization"} · {need.category}</p>
            {need.status === "rejected" && need.rejection_reason && (
              <p className="mt-1 text-xs italic text-red-700 dark:text-red-400 max-md:line-clamp-1">Reason: {need.rejection_reason}</p>
            )}
            {isReopenRequest && need.reopen_reason && (
              <p className="mt-1 text-xs italic text-purple-700 dark:text-purple-400 max-md:line-clamp-1">Motivation: {need.reopen_reason}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
            <span className="rounded-full bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">{need.status.replace(/_/g, " ")}</span>
            {canModerate && (
              <button
                onClick={() => run(need.id, "approve", () => onUpdate(need.id, "open"))}
                disabled={busy?.id === need.id}
                className="inline-flex items-center gap-1.5 btn-pill btn-pill--blue disabled:opacity-60"
              >
                {busy?.id === need.id && busy.action === "approve" && <Loader2 className="w-3 h-3 animate-spin" />}
                {isReopenRequest ? "Approve reopen" : "Approve & Publish"}
              </button>
            )}
            {canModerate && (
              rejectingId === need.id ? (
                <div className="flex items-center gap-2 w-full mt-2 basis-full">
                  <input
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder={isReopenRequest ? "Reason for declining the reopen request (optional, shared with the organization)" : "Reason for rejection (optional, shared with the organization)"}
                    className="field flex-1 text-xs py-2"
                  />
                  <button
                    onClick={() => {
                      const reason = rejectReason.trim() || undefined
                      run(need.id, "reject", async () => { await onUpdate(need.id, isReopenRequest ? "closed" : "rejected", reason); setRejectingId(null); setRejectReason("") })
                    }}
                    disabled={busy?.id === need.id}
                    className="inline-flex items-center gap-1.5 btn-pill btn-pill--red-solid shrink-0 disabled:opacity-60"
                  >
                    {busy?.id === need.id && busy.action === "reject" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {isReopenRequest ? "Confirm decline" : "Confirm reject"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setRejectingId(need.id)} disabled={busy?.id === need.id} className="btn-pill btn-pill--red disabled:opacity-60">{isReopenRequest ? "Decline" : "Reject"}</button>
              )
            )}
            {(need.status === "open" || need.status === "in_progress") && (
              closingId === need.id ? (
                <div className="flex items-center gap-2 w-full mt-2 basis-full">
                  <input
                    value={closeReason}
                    onChange={e => setCloseReason(e.target.value)}
                    placeholder="Why is it being closed? (optional, shared with the organization)"
                    className="field flex-1 text-xs py-2"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      const reason = closeReason.trim() || undefined
                      run(need.id, "close", async () => { await onUpdate(need.id, "closed", reason); setClosingId(null); setCloseReason("") })
                    }}
                    disabled={busy?.id === need.id}
                    className="inline-flex items-center gap-1.5 btn-pill btn-pill--dark-solid shrink-0 disabled:opacity-60"
                  >
                    {busy?.id === need.id && busy.action === "close" && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirm close
                  </button>
                  <button onClick={() => { setClosingId(null); setCloseReason("") }} className="text-xs font-bold text-slate-500 shrink-0">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setClosingId(need.id)}
                  disabled={busy?.id === need.id}
                  data-tip="Close this need so it stops taking offers and donations. The organization and its givers are notified."
                  className="inline-flex items-center gap-1.5 btn-pill btn-pill--neutral disabled:opacity-60"
                >
                  <XCircle className="w-3.5 h-3.5" /> Close need
                </button>
              )
            )}
            <AdminDeleteButton kind="need" id={need.id} onDeleted={() => onDelete(need.id)} />
          </div>
        </article>
        )
      })}
    </Panel>
  )
}

function GiftsView({ gifts, onUpdate, onSelect, onDeleted }: { gifts: AdminGift[]; onUpdate: (id: string, status: "approved" | "rejected") => void | Promise<void>; onSelect: (gift: AdminGift) => void; onDeleted: () => void | Promise<void> }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null)
  const run = async (id: string, action: string, fn: () => void | Promise<void>) => {
    setBusy({ id, action })
    try { await fn() } finally { setBusy(null) }
  }

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
      ) : visible.map(gift => {
        const pendingClaims = gift.claims.filter(c => c.status === "pending")
        return (
        <article
          key={gift.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(gift)}
          onKeyDown={activateOnKey}
          className="row flex-wrap cursor-pointer"
        >
          <div className="flex items-start gap-3 min-w-0">
            {gift.photos && gift.photos.length > 0 && gift.photos[0].url && (
              <img
                src={gift.photos[0].url}
                alt={gift.title}
                className="w-16 h-16 max-md:w-12 max-md:h-12 object-cover rounded border border-slate-200 dark:border-[#233350] shrink-0"
              />
            )}
            <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">{gift.title}</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 capitalize">
                {gift.offering_type}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 max-md:hidden">{gift.description}</p>
            <p className="text-xs text-slate-400 max-md:truncate">Pledged by: {gift.givers?.name || "Giver"}<span className="max-md:hidden"> ({gift.givers?.email || "No email"})</span></p>
            {gift.status === "claimed" && gift.organizations?.name && (
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Claimed by: {gift.organizations.name}</p>
            )}
            {pendingClaims.length > 0 && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {pendingClaims.length} pending claim{pendingClaims.length === 1 ? "" : "s"} - {pendingClaims.map(c => c.organization_name).join(", ")} (open to review)
              </p>
            )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
            <span className={`rounded px-3 py-1 text-xs font-bold capitalize ${
              gift.status === "approved" ? "bg-emerald-50 text-emerald-700" :
              gift.status === "claimed" ? "bg-blue-50 text-blue-700" : "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300"
            }`}>
              {gift.status}
            </span>
            {gift.status === "pending" && gift.offering_type === "financial" && (
              <>
                <span data-tip="This pledge is approved automatically once its donation is confirmed - it isn't reviewed here" className="rounded bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                  Awaiting payment
                </span>
                <button onClick={() => onUpdate(gift.id, "rejected")} disabled={busy?.id === gift.id} data-tip="Cancel this pledge, e.g. if it was abandoned and will never be paid" className="btn-pill btn-pill--red disabled:opacity-60">Cancel</button>
              </>
            )}
            {gift.status === "pending" && gift.offering_type !== "financial" && (
              <>
                <button
                  onClick={() => run(gift.id, "approve", () => onUpdate(gift.id, "approved"))}
                  disabled={busy?.id === gift.id}
                  className="inline-flex items-center gap-1.5 btn-pill btn-pill--green disabled:opacity-60"
                >
                  {busy?.id === gift.id && busy.action === "approve" && <Loader2 className="w-3 h-3 animate-spin" />}
                  Approve
                </button>
                <button onClick={() => onUpdate(gift.id, "rejected")} disabled={busy?.id === gift.id} className="btn-pill btn-pill--red disabled:opacity-60">Reject</button>
              </>
            )}
            {gift.status === "approved" && gift.offering_type !== "financial" && (
              <button
                onClick={() => onUpdate(gift.id, "rejected")}
                disabled={busy?.id === gift.id}
                data-tip="Take this offering out of the Gift Library. The giver is told, with your reason."
                className="btn-pill btn-pill--neutral disabled:opacity-60"
              >
                <XCircle /> Remove from library
              </button>
            )}
            {/* Financial pledges are money, so they're never deleted (lib/admin-delete.ts). */}
            {gift.offering_type !== "financial" && <AdminDeleteButton kind="gift" id={gift.id} onDeleted={onDeleted} />}
          </div>
        </article>
        )
      })}
    </Panel>
  )
}

function DonationsView({ donations, onSelect, onDeleted }: { donations: AdminDonation[]; onSelect: (donation: DonationSummary) => void; onDeleted: () => void | Promise<void> }) {
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
          (firstOf(d.donor)?.full_name || "").toLowerCase().includes(q) ||
          (firstOf(d.donor)?.email || "").toLowerCase().includes(q) ||
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
        const donor = firstOf(item.donor)
        const donorName = giver?.name || donor?.full_name || item.guest_name
        const donorEmail = giver?.email || donor?.email || item.guest_email
        const orgName = firstOf(need?.organizations)?.name
        const displayTitle = item.is_platform_donation ? "Support The Platform" : need?.title || gift?.title || "Gift Library Pledge"
        return (
        <div key={item.id} className="flex items-center gap-2">
        <button
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
            giverName: donorName,
            giverEmail: donorEmail,
          })}
          className="row w-full min-w-0 flex-1 text-left"
        >
          <div>
            <h3 className="flex items-center gap-2 font-bold">
              {displayTitle}
              {item.is_platform_donation && <span className="rounded bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-700">Platform Support</span>}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {item.is_platform_donation ? "HelpLift" : orgName || "General Fund"} · {donorName || "Donor"}<span className="max-md:hidden"> ({donorEmail}) · Ref: {item.reference_code}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold">{formatCurrency(Number(item.amount))}</span>
            <span className={`rounded px-3 py-1 text-xs font-bold capitalize ${statusBadgeClasses(item.status)}`}>
              {item.status === "pending" ? (item.proof_storage_path ? "Pending Verification" : "Awaiting Payment") : item.status}
            </span>
          </div>
        </button>
        </div>
        )
      })}
    </Panel>
  )
}

const WITHDRAWAL_STATUS_LABEL: Record<AdminWithdrawal["status"], string> = {
  pending: "Pending review",
  approved: "Approved - awaiting transfer",
  rejected: "Declined",
  paid: "Transfer Complete",
  cancelled: "Cancelled by organization",
}
const WITHDRAWAL_STATUS_CLASSES: Record<AdminWithdrawal["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
  paid: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300",
}

function WithdrawalProofUpload({ withdrawal, onUploadProof }: { withdrawal: AdminWithdrawal; onUploadProof: (id: string, file: File) => Promise<boolean> }) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const submit = async () => {
    if (!file) return
    setIsUploading(true)
    const ok = await onUploadProof(withdrawal.id, file)
    setIsUploading(false)
    if (ok) setFile(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={e => setFile(e.target.files?.[0] || null)}
        className="text-xs file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700"
      />
        <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">{describeUploadLimit(UPLOAD_LIMITS.withdrawalProof)}</span>
      <button
        type="button"
        onClick={submit}
        disabled={!file || isUploading}
        className="inline-flex items-center gap-1.5 btn-pill btn-pill--green disabled:opacity-50"
      >
        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
        Attach proof & mark paid
      </button>
    </div>
  )
}

function WithdrawalsView({
  withdrawals,
  onReview,
  onUploadProof,
  onDeleted,
}: {
  withdrawals: AdminWithdrawal[]
  onReview: (id: string, status: "approved" | "rejected", rejection_reason?: string) => void | Promise<void>
  onUploadProof: (id: string, file: File) => Promise<boolean>
  onDeleted: () => void | Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("pending_first")
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null)
  const run = async (id: string, action: string, fn: () => void | Promise<void>) => {
    setBusy({ id, action })
    try { await fn() } finally { setBusy(null) }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? withdrawals.filter(w =>
          (firstOf(w.organizations)?.name || "").toLowerCase().includes(q) ||
          (firstOf(w.requester)?.full_name || "").toLowerCase().includes(q) ||
          w.status.toLowerCase().includes(q)
        )
      : withdrawals
    const sorted = [...filtered]
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sort === "amount") sorted.sort((a, b) => Number(b.amount) - Number(a.amount))
    else if (sort === "pending_first") sorted.sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [withdrawals, query, sort])

  return (
    <Panel
      title="Withdrawal requests"
      toolbar={
        <SearchSortBar
          query={query}
          onQuery={setQuery}
          placeholder="Search by organization, requester, or status..."
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
      {withdrawals.length === 0 ? (
        <Empty text="No withdrawal requests yet." />
      ) : visible.length === 0 ? (
        <Empty text="No withdrawal requests match your search." />
      ) : visible.map(w => {
        const org = firstOf(w.organizations)
        const requester = firstOf(w.requester)
        return (
          <article key={w.id} className="row items-start">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">{org?.name || "Organization"}</h3>
                <span className="font-bold text-blue-600">{formatCurrency(Number(w.amount))}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Requested by {requester?.full_name || "a team member"} · {new Date(w.created_at).toLocaleDateString()}
              </p>
              {org && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bank: {org.bank_name || "-"} · {org.bank_account_holder || "-"} · Acc {org.bank_account_number || "-"} · Branch {org.bank_branch_code || "-"} · {org.bank_account_type || "-"}
                </p>
              )}
              {w.status === "rejected" && w.rejection_reason && (
                <p className="text-xs italic text-red-700 dark:text-red-400">Reason: {w.rejection_reason}</p>
              )}
              {w.status === "paid" && w.proof_url && (
                <a href={w.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline">
                  <FileText className="w-3.5 h-3.5" /> View proof of payment{w.paid_at ? ` · ${new Date(w.paid_at).toLocaleDateString()}` : ""}
                </a>
              )}
              {w.status === "approved" && <WithdrawalProofUpload withdrawal={w} onUploadProof={onUploadProof} />}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
              <span className={`rounded px-3 py-1 text-xs font-bold capitalize ${WITHDRAWAL_STATUS_CLASSES[w.status]}`}>
                {WITHDRAWAL_STATUS_LABEL[w.status]}
              </span>
              {w.status === "pending" && (
                <>
                  <button
                    onClick={() => run(w.id, "approve", () => onReview(w.id, "approved"))}
                    disabled={busy?.id === w.id}
                    className="inline-flex items-center gap-1.5 btn-pill btn-pill--blue disabled:opacity-60"
                  >
                    {busy?.id === w.id && busy.action === "approve" && <Loader2 className="w-3 h-3 animate-spin" />}
                    Approve
                  </button>
                  <button onClick={() => onReview(w.id, "rejected")} disabled={busy?.id === w.id} className="btn-pill btn-pill--red disabled:opacity-60">Decline</button>
                </>
              )}
            </div>
          </article>
        )
      })}
    </Panel>
  )
}

const ROLE_HELP: Record<string, string> = {
  owner: "Full control of the organization, including its profile, documents, team, and requesting withdrawals.",
  manager: "Manages needs, donations and messages, but can't edit organization details.",
  coordinator: "Handles deliveries (fulfillments and proof), messages and impact stories. Can't change needs, offers or claims, or see money.",
}

// Role editing for one person. Platform role (admin / giver) is saved with the form; an
// organization member's team role (owner / manager / coordinator) is saved straight away.
function RoleFields({ profile }: { profile: Profile }) {
  const isOrgAccount = profile.role === "organization"
  const [membership, setMembership] = useState<{ organization_name: string; role: string; is_primary_owner: boolean } | null>(null)
  const [teamRole, setTeamRole] = useState("")
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOrgAccount) return
    fetch(`/api/admin/users/${profile.id}/team`)
      .then(res => res.json())
      .then(data => { if (data.membership) { setMembership(data.membership); setTeamRole(data.membership.role) } })
      .catch(() => {})
  }, [isOrgAccount, profile.id])

  const saveTeamRole = async () => {
    setSaving(true)
    setStatus(null)
    const res = await fetch(`/api/admin/users/${profile.id}/team`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: teamRole }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setMembership(data.membership)
      setStatus({ ok: true, text: "Team role updated and the person was notified." })
    } else {
      setStatus({ ok: false, text: data.message || "Couldn't update the role." })
      if (membership) setTeamRole(membership.role)
    }
    setSaving(false)
  }

  const selectClass = "w-full rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-3 rounded border border-slate-200 dark:border-[#233350] p-3">
      <div className="space-y-1">
        <Label htmlFor="edit-profile-role">Account role</Label>
        {isOrgAccount ? (
          <>
            <input type="hidden" name="role" value="organization" />
            <p className="rounded bg-slate-100 dark:bg-[#1A2740] px-3 py-2 text-sm font-semibold capitalize text-slate-600 dark:text-slate-300">Organization</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Organization accounts can't be converted to another account type.</p>
          </>
        ) : (
          <>
            <select id="edit-profile-role" name="role" defaultValue={profile.role} className={selectClass}>
              <option value="giver">Giver</option>
              <option value="admin">Admin (full access to this dashboard)</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400">Saved with "Save changes". The person is notified. You can't change your own role.</p>
          </>
        )}
      </div>

      {isOrgAccount && membership && (
        <div className="space-y-1">
          <Label htmlFor="edit-team-role">Role in {membership.organization_name}</Label>
          <div className="flex gap-2">
            <select id="edit-team-role" value={teamRole} onChange={e => setTeamRole(e.target.value)} className={selectClass} disabled={membership.is_primary_owner}>
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="coordinator">Coordinator</option>
            </select>
            <Button type="button" variant="outline" onClick={saveTeamRole} disabled={saving || teamRole === membership.role || membership.is_primary_owner}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {membership.is_primary_owner ? "Primary owner: this role can't be lowered." : ROLE_HELP[teamRole]}
          </p>
          {status && <p className={`text-xs font-semibold ${status.ok ? "text-emerald-600" : "text-red-600"}`}>{status.text}</p>}
        </div>
      )}
    </div>
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
          role="button"
          tabIndex={0}
          onClick={() => onSelect(profile)}
          onKeyDown={activateOnKey}
          className="row row-compact cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <div className="min-w-0">
            <h3 className="font-bold flex items-center gap-2 max-md:truncate">
              {profile.full_name}
              {profile.suspended && (
                <span className="rounded bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Suspended</span>
              )}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="break-all max-md:block max-md:truncate max-md:break-normal">{profile.email}</span>
              {profile.phone && <span className="max-md:hidden"> · {profile.phone}</span>}
              <span className="max-md:hidden"> · </span>
              <span className="max-md:hidden">
                {profile.account_type && <span className="capitalize">{profile.account_type} account · </span>}
                Joined {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(profile) }}
              className="max-md:hidden inline-flex items-center gap-1 btn-pill btn-pill--neutral"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMessage(profile) }}
              className="max-md:hidden inline-flex items-center gap-1 btn-pill btn-pill--neutral"
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

function MessagesView({ messages, onOpen, onDeleted, refreshKey = 0 }: { refreshKey?: number; messages: AdminMessage[]; onOpen: (item: AdminMessage) => void; onDeleted: () => void | Promise<void> }) {
  const [view, setView] = useState<"inbox" | "sent">("inbox")
  return (
    <Panel title="Messages sent to admin" toolbar={<MessageViewToggle value={view} onChange={setView} />}>
      {view === "sent" ? (
        <SentMessages refreshKey={refreshKey} />
      ) : messages.length === 0 ? (
        <Empty text="No messages from users or organizations yet." />
      ) : messages.map(item => (
        <div
          key={item.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(item)}
          onKeyDown={activateOnKey}
          className={`w-full rounded border p-4 text-left cursor-pointer ${item.read_at ? "border-slate-200 dark:border-[#233350]" : "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-sm">{item.sender_name || "Unknown sender"}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()}</span>
              <AdminDeleteButton kind="message" id={item.id} onDeleted={onDeleted} iconOnly />
            </div>
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

const platformSupportChartConfig: ChartConfig = {
  amount: { label: "Platform Support", theme: { light: "#db2777", dark: "#ec4899" } },
}

const needsCategoryChartConfig: ChartConfig = {
  count: { label: "Needs", theme: { light: "#059669", dark: "#059669" } },
}

const claimsChartConfig: ChartConfig = {
  claims: { label: "Claims", theme: { light: "#0891b2", dark: "#22d3ee" } },
}

const claimStatusChartConfig: ChartConfig = {
  approved: { label: "Approved", theme: { light: "#059669", dark: "#059669" } },
  pending: { label: "Pending", theme: { light: "#d97706", dark: "#d97706" } },
  rejected: { label: "Rejected", theme: { light: "#e11d48", dark: "#e11d48" } },
}

const giftsChartConfig: ChartConfig = {
  gifts: { label: "Gift offerings", theme: { light: "#7c3aed", dark: "#a78bfa" } },
}

const giftStatusChartConfig: ChartConfig = {
  approved: { label: "Approved", theme: { light: "#059669", dark: "#059669" } },
  pending: { label: "Pending", theme: { light: "#d97706", dark: "#d97706" } },
  claimed: { label: "Claimed", theme: { light: "#2563eb", dark: "#3b82f6" } },
  rejected: { label: "Rejected", theme: { light: "#e11d48", dark: "#e11d48" } },
}

const withdrawalsChartConfig: ChartConfig = {
  amount: { label: "Paid out", theme: { light: "#059669", dark: "#10b981" } },
}

const withdrawalStatusChartConfig: ChartConfig = {
  paid: { label: "Paid", theme: { light: "#059669", dark: "#059669" } },
  approved: { label: "Approved", theme: { light: "#2563eb", dark: "#3b82f6" } },
  pending: { label: "Pending", theme: { light: "#d97706", dark: "#d97706" } },
  rejected: { label: "Rejected", theme: { light: "#e11d48", dark: "#e11d48" } },
  cancelled: { label: "Cancelled", theme: { light: "#64748b", dark: "#94a3b8" } },
}

const siteVisitsChartConfig: ChartConfig = {
  visits: { label: "Visits", theme: { light: "#2563eb", dark: "#3b82f6" } },
  unique_visitors: { label: "Unique visitors", theme: { light: "#9333ea", dark: "#a855f7" } },
}

type SiteVisitDayRow = { day: string; visits: number; unique_visitors: number }
type SiteVisitMonthRow = { month: string; visits: number; unique_visitors: number }
type SiteVisitStats = {
  today: { visits: number; unique_visitors: number }
  thisMonth: { visits: number; unique_visitors: number }
  daily: SiteVisitDayRow[]
  monthly: SiteVisitMonthRow[]
}

function isoDateLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// "Today" and "7/30/90 days" all end on today; only the start moves.
function quickVisitRange(days: number) {
  const to = new Date()
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (days - 1))
  return { from: isoDateLocal(from), to: isoDateLocal(to) }
}

// Site visits: how many people (and how many distinct people) hit the site,
// per day over a filterable range and per month over the last year. Its own
// self-contained panel - own data fetch, own date filter - rather than
// folded into the report-wide date range above, since it comes from a
// completely different source (site_visits, recorded by
// components/site-visit-tracker.tsx) than everything else on this tab.
function SiteVisitsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [range, setRange] = useState(() => quickVisitRange(30))
  const [stats, setStats] = useState<SiteVisitStats | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/analytics/site-visits?from=${range.from}&to=${range.to}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || "Could not load site-visit analytics.")
        if (!cancelled) {
          setStats(data)
          setError("")
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Could not load site-visit analytics.")
      }
    }
    load()
    return () => { cancelled = true }
  }, [range.from, range.to, refreshKey])

  const dailyData = (stats?.daily || []).map(row => ({
    label: new Date(row.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    visits: row.visits,
    unique_visitors: row.unique_visitors,
  }))
  const monthlyData = (stats?.monthly || []).map(row => ({
    label: new Date(row.month).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
    visits: row.visits,
    unique_visitors: row.unique_visitors,
  }))
  const presets = [
    { label: "Today", days: 1 },
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
  ]

  return (
    <Panel title="Site visits">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="visits-from">From</Label>
          <Input id="visits-from" type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className="w-auto" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="visits-to">To</Label>
          <Input id="visits-to" type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className="w-auto" />
        </div>
        <div className="flex items-center gap-1.5 pb-2.5 flex-wrap">
          {presets.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setRange(quickVisitRange(preset.days))}
              className="btn-pill btn-pill--neutral"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded bg-red-50 dark:bg-red-950/40 p-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Globe} label="Visits today" value={stats?.today.visits ?? "-"} accent="blue" />
            <StatCard icon={Users} label="Unique visitors today" value={stats?.today.unique_visitors ?? "-"} accent="purple" />
            <StatCard icon={Globe} label="Visits this month" value={stats?.thisMonth.visits ?? "-"} accent="blue" />
            <StatCard icon={Users} label="Unique visitors this month" value={stats?.thisMonth.unique_visitors ?? "-"} accent="purple" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Daily ({range.from} to {range.to})</p>
              {dailyData.length === 0 ? (
                <Empty text="No visits recorded in this range yet." />
              ) : (
                <ChartFrame filename={`site-visits-daily-${range.from}-to-${range.to}`}>
                  <ChartContainer config={siteVisitsChartConfig} className="h-[260px] w-full">
                    <LineChart data={dailyData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="visits" stroke="var(--color-visits)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="unique_visitors" stroke="var(--color-unique_visitors)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ChartContainer>
                </ChartFrame>
              )}
            </div>

            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Monthly (last 12 months)</p>
              {monthlyData.length === 0 ? (
                <Empty text="No visits recorded yet." />
              ) : (
                <ChartFrame filename="site-visits-monthly">
                  <ChartContainer config={siteVisitsChartConfig} className="h-[260px] w-full">
                    <LineChart data={monthlyData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="visits" stroke="var(--color-visits)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="unique_visitors" stroke="var(--color-unique_visitors)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ChartContainer>
                </ChartFrame>
              )}
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}

function ReportsView({ organizations, needs, donations, profiles, gifts, withdrawals, refreshKey = 0 }: { refreshKey?: number; organizations: Organization[]; needs: Need[]; donations: AdminDonation[]; profiles: Profile[]; gifts: AdminGift[]; withdrawals: AdminWithdrawal[] }) {
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
  const filteredGifts = useMemo(() => gifts.filter(g => inRange(g.created_at)), [gifts, from, to])
  const filteredWithdrawals = useMemo(() => withdrawals.filter(w => inRange(w.created_at)), [withdrawals, from, to])

  // One gift offering can carry several claims (one per interested
  // organization), so they're flattened out of `gifts` here rather than
  // counted per-offering - "New Claims" means claims submitted, not
  // offerings claimed. The parent offering's title/type comes along so the
  // claims CSV export can show what each claim was actually for.
  const allClaims = useMemo(
    () => gifts.flatMap(g => g.claims.map(c => ({ ...c, gift_title: g.title, gift_offering_type: g.offering_type }))),
    [gifts]
  )
  const filteredClaims = useMemo(() => allClaims.filter(c => inRange(c.created_at)), [allClaims, from, to])

  // All-time totals for the overview tiles above the date filter - these are
  // deliberately NOT scoped by from/to, since they sit above the "Report
  // date range" panel and are meant to answer "how is the platform doing
  // overall", not "what happened in the selected range" (that's what the
  // charts below the filter are for).
  const totalApprovedOrgs = organizations.filter(o => o.verification_status === "approved").length
  const totalFulfilledNeeds = needs.filter(n => n.status === "fulfilled").length
  const allSuccessfulDonations = donations.filter(d => d.status === "successful")
  const totalDonatedAllTime = allSuccessfulDonations.reduce((sum, d) => sum + Number(d.amount || 0), 0)
  const totalPlatformSupportAllTime = allSuccessfulDonations.filter(d => d.is_platform_donation).reduce((sum, d) => sum + Number(d.amount || 0), 0)
  const totalPaidOutAllTime = withdrawals.filter(w => w.status === "paid").reduce((sum, w) => sum + Number(w.amount || 0), 0)

  const successfulDonations = filteredDonations.filter(d => d.status === "successful")
  // "Support The Platform" donations (see 20260926000400_platform_donations.sql)
  // are a subset of the same donations table - a direct gift to HelpLift
  // itself, not toward any need. Broken out here rather than just a raw
  // total so its trend over time is visible, same as every other figure
  // on this tab.
  const successfulPlatformDonations = successfulDonations.filter(d => d.is_platform_donation)
  const paidWithdrawals = filteredWithdrawals.filter(w => w.status === "paid")

  const rangeLabel = from || to ? `${from || "the start"} to ${to || "now"}` : "all time"

  const timeline = useMemo(() => {
    const allDates = [...filteredOrgs, ...filteredProfiles, ...filteredNeeds, ...filteredDonations, ...filteredClaims, ...filteredGifts, ...filteredWithdrawals].map(x => x.created_at)
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
  }, [filteredOrgs, filteredProfiles, filteredNeeds, filteredDonations, filteredClaims, filteredGifts, filteredWithdrawals, from, to])

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

  const platformSupportTrendData = useMemo(() => {
    const { granularity, keys } = timeline
    const amounts = sumByBucket(successfulPlatformDonations, d => d.created_at, d => Number(d.amount || 0), granularity)
    return keys.map(key => ({ period: bucketLabel(key, granularity), amount: amounts.get(key) || 0 }))
  }, [timeline, successfulPlatformDonations])

  const claimsTrendData = useMemo(() => {
    const { granularity, keys } = timeline
    const counts = countByBucket(filteredClaims, c => c.created_at, granularity)
    return keys.map(key => ({ period: bucketLabel(key, granularity), claims: counts.get(key) || 0 }))
  }, [timeline, filteredClaims])

  // Deliberately uses every claim, not filteredClaims - "how many claims are
  // currently sitting in each status" is a snapshot of the review queue
  // right now, not something tied to when they were submitted (same
  // reasoning as giftStatusData/withdrawalStatusData further down).
  const claimStatusData = useMemo(() => {
    const counts: Record<string, number> = { approved: 0, pending: 0, rejected: 0 }
    for (const c of allClaims) counts[c.status] = (counts[c.status] || 0) + 1
    return [
      { status: "approved", value: counts.approved },
      { status: "pending", value: counts.pending },
      { status: "rejected", value: counts.rejected },
    ].filter(d => d.value > 0)
  }, [allClaims])

  const needsByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of filteredNeeds) counts.set(n.category, (counts.get(n.category) || 0) + 1)
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [filteredNeeds])

  const giftsTrendData = useMemo(() => {
    const { granularity, keys } = timeline
    const counts = countByBucket(filteredGifts, g => g.created_at, granularity)
    return keys.map(key => ({ period: bucketLabel(key, granularity), gifts: counts.get(key) || 0 }))
  }, [timeline, filteredGifts])

  // Every gift offering's CURRENT status, not filteredGifts - same reasoning
  // as claimStatusData: "what's sitting in the library right now" is a
  // snapshot, not tied to when each offering was originally submitted.
  const giftStatusData = useMemo(() => {
    const counts: Record<string, number> = { approved: 0, pending: 0, rejected: 0, claimed: 0 }
    for (const g of gifts) counts[g.status] = (counts[g.status] || 0) + 1
    return [
      { status: "approved", value: counts.approved },
      { status: "pending", value: counts.pending },
      { status: "claimed", value: counts.claimed },
      { status: "rejected", value: counts.rejected },
    ].filter(d => d.value > 0)
  }, [gifts])

  const withdrawalsTrendData = useMemo(() => {
    const { granularity, keys } = timeline
    const amounts = sumByBucket(paidWithdrawals, w => w.created_at, w => Number(w.amount || 0), granularity)
    return keys.map(key => ({ period: bucketLabel(key, granularity), amount: amounts.get(key) || 0 }))
  }, [timeline, paidWithdrawals])

  // Every withdrawal request's CURRENT status, not filteredWithdrawals -
  // same reasoning as giftStatusData/claimStatusData.
  const withdrawalStatusData = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, approved: 0, paid: 0, rejected: 0, cancelled: 0 }
    for (const w of withdrawals) counts[w.status] = (counts[w.status] || 0) + 1
    return [
      { status: "paid", value: counts.paid },
      { status: "approved", value: counts.approved },
      { status: "pending", value: counts.pending },
      { status: "rejected", value: counts.rejected },
      { status: "cancelled", value: counts.cancelled },
    ].filter(d => d.value > 0)
  }, [withdrawals])

  return (
    <div className="space-y-6">
      <SiteVisitsPanel refreshKey={refreshKey} />

      {/* All-time totals - the platform's overall state, unaffected by the
          date filter below. A status breakdown (approved/rejected/pending/
          etc.) for claims, gifts, orgs and withdrawals already has its own
          chart further down, so it isn't repeated as a tile too. */}
      <TotalsSummary
        groups={[
          {
            title: "People",
            items: [
              { label: "Organizations", value: organizations.length },
              { label: "Approved organizations", value: totalApprovedOrgs },
              { label: "Users", value: profiles.length },
            ],
          },
          {
            title: "Needs & gifts",
            items: [
              { label: "Needs", value: needs.length },
              { label: "Fulfilled needs", value: totalFulfilledNeeds },
              { label: "Gift offerings", value: gifts.length },
              { label: "Claims", value: allClaims.length },
            ],
          },
          {
            title: "Money",
            items: [
              { label: "Successful donations", value: allSuccessfulDonations.length },
              { label: "Total donated", value: totalDonatedAllTime, money: true },
              { label: "Platform support", value: totalPlatformSupportAllTime, money: true },
              { label: "Withdrawal requests", value: withdrawals.length },
              { label: "Paid out", value: totalPaidOutAllTime, money: true },
            ],
          },
        ]}
      />

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Platform growth">
          {growthData.length === 0 ? (
            <Empty text="No activity in this range yet." />
          ) : (
            <ChartFrame filename="platform-growth">
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
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Donations trend">
          {donationsTrendData.every(d => d.amount === 0) ? (
            <Empty text="No successful donations in this range yet." />
          ) : (
            <ChartFrame filename="donations-trend">
              <ChartContainer config={donationsChartConfig} className="h-[280px] w-full">
                <AreaChart data={donationsTrendData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={64} tickFormatter={(v) => formatCurrency(Number(v))} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                  <Area type="monotone" dataKey="amount" stroke="var(--color-amount)" fill="var(--color-amount)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Platform support trend">
          {platformSupportTrendData.every(d => d.amount === 0) ? (
            <Empty text="No successful platform-support donations in this range yet." />
          ) : (
            <ChartFrame filename="platform-support-trend">
              <ChartContainer config={platformSupportChartConfig} className="h-[280px] w-full">
                <AreaChart data={platformSupportTrendData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={64} tickFormatter={(v) => formatCurrency(Number(v))} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                  <Area type="monotone" dataKey="amount" stroke="var(--color-amount)" fill="var(--color-amount)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Needs by category">
          {needsByCategory.length === 0 ? (
            <Empty text="No needs in this range yet." />
          ) : (
            <ChartFrame filename="needs-by-category">
              <ChartContainer config={needsCategoryChartConfig} className="h-[280px] w-full">
                <BarChart data={needsByCategory} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} fontSize={11} width={110} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Gift claims trend">
          {claimsTrendData.every(d => d.claims === 0) ? (
            <Empty text="No gift claims in this range yet." />
          ) : (
            <ChartFrame filename="gift-claims-trend">
              <ChartContainer config={claimsChartConfig} className="h-[280px] w-full">
                <AreaChart data={claimsTrendData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="claims" stroke="var(--color-claims)" fill="var(--color-claims)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Gift claims by status">
          {claimStatusData.length === 0 ? (
            <Empty text="No gift claims yet." />
          ) : (
            <ChartFrame filename="gift-claims-by-status">
              <ChartContainer config={claimStatusChartConfig} className="h-[280px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
                  <Pie data={claimStatusData} dataKey="value" nameKey="status" innerRadius={55} outerRadius={90} strokeWidth={2} stroke="var(--background)">
                    {claimStatusData.map((entry) => (
                      <Cell key={entry.status} fill={`var(--color-${entry.status})`} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                </PieChart>
              </ChartContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Gift Library trend">
          {giftsTrendData.every(d => d.gifts === 0) ? (
            <Empty text="No gift offerings in this range yet." />
          ) : (
            <ChartFrame filename="gift-library-trend">
              <ChartContainer config={giftsChartConfig} className="h-[280px] w-full">
                <AreaChart data={giftsTrendData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="gifts" stroke="var(--color-gifts)" fill="var(--color-gifts)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Gift Library by status">
          {giftStatusData.length === 0 ? (
            <Empty text="No gift offerings yet." />
          ) : (
            <ChartFrame filename="gift-library-by-status">
              <ChartContainer config={giftStatusChartConfig} className="h-[280px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
                  <Pie data={giftStatusData} dataKey="value" nameKey="status" innerRadius={55} outerRadius={90} strokeWidth={2} stroke="var(--background)">
                    {giftStatusData.map((entry) => (
                      <Cell key={entry.status} fill={`var(--color-${entry.status})`} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                </PieChart>
              </ChartContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Withdrawals trend (paid out)">
          {withdrawalsTrendData.every(d => d.amount === 0) ? (
            <Empty text="No paid withdrawals in this range yet." />
          ) : (
            <ChartFrame filename="withdrawals-trend">
              <ChartContainer config={withdrawalsChartConfig} className="h-[280px] w-full">
                <AreaChart data={withdrawalsTrendData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={64} tickFormatter={(v) => formatCurrency(Number(v))} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                  <Area type="monotone" dataKey="amount" stroke="var(--color-amount)" fill="var(--color-amount)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </ChartFrame>
          )}
        </Panel>

        <Panel title="Withdrawals by status">
          {withdrawalStatusData.length === 0 ? (
            <Empty text="No withdrawal requests yet." />
          ) : (
            <ChartFrame filename="withdrawals-by-status">
              <ChartContainer config={withdrawalStatusChartConfig} className="h-[280px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
                  <Pie data={withdrawalStatusData} dataKey="value" nameKey="status" innerRadius={55} outerRadius={90} strokeWidth={2} stroke="var(--background)">
                    {withdrawalStatusData.map((entry) => (
                      <Cell key={entry.status} fill={`var(--color-${entry.status})`} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                </PieChart>
              </ChartContainer>
            </ChartFrame>
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
          <ExportButton
            label="Gift Claims"
            onClick={() => downloadCsv(`gift-claims-${Date.now()}.csv`, toCsv(filteredClaims, [
              { header: "Gift Offering", value: c => c.gift_title },
              { header: "Offering Type", value: c => c.gift_offering_type },
              { header: "Organization", value: c => c.organization_name },
              { header: "Motivation", value: c => c.motivation },
              { header: "Status", value: c => c.status },
              { header: "Notes", value: c => c.claim_notes },
              { header: "Created", value: c => new Date(c.created_at).toISOString() },
            ]))}
          />
          <ExportButton
            label="Gift Library"
            onClick={() => downloadCsv(`gift-library-${Date.now()}.csv`, toCsv(filteredGifts, [
              { header: "Title", value: g => g.title },
              { header: "Type", value: g => g.offering_type },
              { header: "Giver", value: g => g.givers?.name },
              { header: "Giver Email", value: g => g.givers?.email },
              { header: "Quantity/Value", value: g => g.quantity_or_value },
              { header: "Status", value: g => g.status },
              { header: "Rejection Reason", value: g => g.rejection_reason },
              { header: "Claims", value: g => g.claims.length },
              { header: "Created", value: g => new Date(g.created_at).toISOString() },
            ]))}
          />
          <ExportButton
            label="Withdrawals"
            onClick={() => downloadCsv(`withdrawals-${Date.now()}.csv`, toCsv(filteredWithdrawals, [
              { header: "Organization", value: w => firstOf(w.organizations)?.name },
              { header: "Requested By", value: w => firstOf(w.requester)?.full_name },
              { header: "Amount", value: w => w.amount },
              { header: "Status", value: w => w.status },
              { header: "Rejection Reason", value: w => w.rejection_reason },
              { header: "Paid At", value: w => w.paid_at ? new Date(w.paid_at).toISOString() : "" },
              { header: "Created", value: w => new Date(w.created_at).toISOString() },
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
      className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-[#233350] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
    >
      <Download className="w-3.5 h-3.5" /> Export {label}
    </button>
  )
}

type AdminStory = {
  id: string
  title: string
  content: string
  author_role?: string | null
  image_url?: string | null
  video_url?: string | null
  status: "pending" | "approved" | "rejected"
  rejection_reason?: string | null
  created_at: string
  organizations: { id: string; name: string } | { id: string; name: string }[] | null
  media: { id: string; media_type: "image" | "video"; url: string }[]
}

// Impact stories are only public once an administrator approves them.
function StoriesView({ stories, onReview, onDeleted }: { onDeleted: () => void | Promise<void>; stories: AdminStory[]; onReview: (id: string, status: "approved" | "rejected", reason?: string) => void | Promise<void> }) {
  const [filter, setFilter] = useState<"pending" | "all">("pending")
  const visible = filter === "pending" ? stories.filter(s => s.status === "pending") : stories
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null)
  const run = async (id: string, action: string, fn: () => void | Promise<void>) => {
    setBusy({ id, action })
    try { await fn() } finally { setBusy(null) }
  }

  return (
    <Panel
      title="Impact stories"
      toolbar={
        <div className="flex items-center gap-2 text-xs font-bold">
          <button onClick={() => setFilter("pending")} className={`rounded px-3 py-1.5 ${filter === "pending" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740]"}`}>Awaiting review</button>
          <button onClick={() => setFilter("all")} className={`rounded px-3 py-1.5 ${filter === "all" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-[#1A2740]"}`}>All stories</button>
        </div>
      }
    >
      {visible.length === 0 ? (
        <Empty text={filter === "pending" ? "No impact stories are waiting for review." : "No impact stories yet."} />
      ) : visible.map(story => {
        const org = firstOf(story.organizations)
        const badge =
          story.status === "approved" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : story.status === "rejected" ? "bg-red-100 text-red-700 border-red-200"
          : "bg-amber-100 text-amber-700 border-amber-200"
        return (
          <article key={story.id} className="rounded border border-slate-200 dark:border-[#233350] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base">{story.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border capitalize ${badge}`}>{story.status === "pending" ? "Awaiting review" : story.status}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{org?.name || "Organization"} · {story.author_role || "Staff"} · {new Date(story.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {story.status !== "approved" && (
                  <button
                    onClick={() => run(story.id, "approve", () => onReview(story.id, "approved"))}
                    disabled={busy?.id === story.id}
                    className="inline-flex items-center gap-1.5 btn-pill btn-pill--green disabled:opacity-60"
                  >
                    {busy?.id === story.id && busy.action === "approve" && <Loader2 className="w-3 h-3 animate-spin" />}
                    Approve &amp; Publish
                  </button>
                )}
                {story.status !== "rejected" && (
                  <button
                    onClick={() => story.status === "approved" ? run(story.id, "unpublish", () => onReview(story.id, "rejected")) : onReview(story.id, "rejected")}
                    disabled={busy?.id === story.id}
                    className="inline-flex items-center gap-1.5 btn-pill btn-pill--red disabled:opacity-60"
                  >
                    {busy?.id === story.id && busy.action === "unpublish" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {story.status === "approved" ? "Unpublish" : "Reject"}
                  </button>
                )}
                <AdminDeleteButton kind="story" id={story.id} onDeleted={onDeleted} />
              </div>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">{story.content}</p>
            {story.status === "rejected" && story.rejection_reason && (
              <p className="text-xs italic text-red-700 dark:text-red-400">Reason given: {story.rejection_reason}</p>
            )}
            {(story.media.length > 0 || story.image_url || story.video_url) && (
              <div className="flex flex-wrap gap-2">
                {story.image_url && <a href={story.image_url} target="_blank" rel="noreferrer"><img src={story.image_url} alt="" className="h-20 w-20 rounded object-cover" /></a>}
                {story.media.map(m => m.media_type === "image" ? (
                  <a key={m.id} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" className="h-20 w-20 rounded object-cover" /></a>
                ) : (
                  <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="inline-flex h-20 items-center rounded bg-purple-50 px-3 text-xs font-bold text-purple-700">🎥 Video</a>
                ))}
                {story.video_url && <a href={story.video_url} target="_blank" rel="noreferrer" className="inline-flex h-20 items-center rounded bg-purple-50 px-3 text-xs font-bold text-purple-700">🎥 Video link</a>}
              </div>
            )}
          </article>
        )
      })}
    </Panel>
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

// Wraps a chart with a small "Download" button that saves it as a .png image.
// Wraps a chart with a small "Download" button that saves it as a real .png
// image of the chart itself (colors, legend and all) - see
// lib/chart-export.ts for why the whole container, not just the <svg>.
function ChartFrame({ filename, children }: { filename: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div>
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={() => downloadChartAsImage(ref.current, filename)}
          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#233350] px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
        >
          <Download className="w-3 h-3" /> Download
        </button>
      </div>
      <div ref={ref}>{children}</div>
    </div>
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
          className="w-full pl-10 pr-4 py-2.5 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
        />
      </div>
      <select
        value={sort}
        onChange={event => onSort(event.target.value)}
        className="px-4 py-2.5 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
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
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  return (
    <div className="space-y-2 rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3">
      <label className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
        <input type="checkbox" name="suspended" defaultChecked={profile.suspended || false} onChange={(e) => setSuspended(e.target.checked)} />
        Suspend this account
      </label>
      {suspended && (
        <div className="space-y-1">
          <Label htmlFor="edit-profile-suspended-reason">Reason (shown to the user)</Label>
          <div className="relative">
            <textarea
              ref={reasonRef}
              id="edit-profile-suspended-reason"
              name="suspended_reason"
              defaultValue={profile.suspended_reason || ""}
              placeholder="E.g., violation of community guidelines"
              className="w-full min-h-16 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 pr-11 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <MicButton
              className="top-2 right-2"
              onText={text => {
                if (reasonRef.current) reasonRef.current.value = appendSpeech(reasonRef.current.value, text)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border border-dashed border-slate-300 dark:border-[#233350] p-8 text-center text-sm text-slate-500 dark:text-slate-400">{text}</div>
}

// All-time totals in the Reports tab: a few short labelled columns (no boxes
// or icons), so related numbers read together at a glance.
function TotalsSummary({ groups }: { groups: { title: string; items: { label: string; value: number; money?: boolean }[] }[] }) {
  return (
    <section className="grid gap-x-10 gap-y-6 border-t border-slate-200 dark:border-[#233350] pt-4 md:grid-cols-3" aria-label="All-time totals">
      {groups.map(group => (
        <div key={group.title}>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.title}</h3>
          <dl className="divide-y divide-slate-100 dark:divide-[#233350]">
            {group.items.map(item => (
              <div key={item.label} className="flex items-baseline justify-between gap-4 py-1.5">
                <dt className="text-sm text-slate-600 dark:text-slate-400">{item.label}</dt>
                <dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  <CountUp value={item.value} prefix={item.money ? "R" : ""} decimals={item.money ? 2 : 0} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  )
}

function StatCard({ icon: Icon, label, value, accent, prefix = "", decimals = 0 }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; accent: "blue" | "emerald" | "amber" | "purple" | "pink"; prefix?: string; decimals?: number }) {
  const accentClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    purple: "text-purple-600 dark:text-purple-400",
    pink: "text-pink-600 dark:text-pink-400",
  }[accent]

  // Flat, like the rest of the dashboard: no box or fill, just a rule above and below.
  return (
    <div className="flex items-center gap-3 max-md:gap-2 border-y border-slate-200 dark:border-[#233350] py-3 max-md:py-2">
      <Icon className={`h-5 w-5 max-md:h-4 max-md:w-4 shrink-0 ${accentClasses}`} />
      <div>
        <p className="text-2xl max-md:text-xl font-extrabold leading-none">
          {typeof value === "number" ? <CountUp value={value} prefix={prefix} decimals={decimals} /> : value}
        </p>
        <p className="text-xs max-md:text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 max-md:leading-tight">{label}</p>
      </div>
    </div>
  )
}

function CountBadge({ value }: { value: number }) {
  if (value === 0) return null
  return <span className="ml-0.5 inline-flex items-center justify-center rounded bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">{value}</span>
}
