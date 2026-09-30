"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { showFeedback } from "@/lib/inline-feedback"
import {
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  LogOut,
  Plus,
  UploadCloud,
  XCircle,
  Sparkles,
  Gift,
  ExternalLink,
  Flame,
  AlertTriangle,
  PackageCheck,
  ShieldCheck,
  Image as ImageIcon,
  Quote,
  Pencil,
  Search,
  MessageSquare,
  Eye,
  Bell,
  ClipboardList,
  Users,
  Clock,
  X,
  Send,
  Banknote,
  Wallet,
  Mail,
  Paperclip,
  BarChart3,
  Settings,
  Trash2,
  Heart,
  Star,
  QrCode,
  Award,
  Download,
  RefreshCw,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { firstOf } from "@/lib/utils"
import { useNeedCategories } from "@/lib/use-need-categories"
import { BadgesPanel } from "@/components/badges-panel"
import { OrganizationQrCodeDialog } from "@/components/organization-qr-code-dialog"
import { NeedQrCodeDialog } from "@/components/need-qr-code-dialog"
import { ViewToggle, type ListView } from "@/components/view-toggle"
import { OutcomeBanner } from "@/components/outcome-banner"
import { DonationDetailDialog, statusBadgeClasses, type DonationSummary } from "@/components/donation-detail-dialog"
import { GiftDetailDialog, type GiftDetailSummary } from "@/components/gift-detail-dialog"
import { formatCurrency } from "@/lib/banking"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrganizationTeam } from "@/components/organization-team"
import { OrganizationAnalytics } from "@/components/analytics/organization-analytics"
import { OrganizationWallet } from "@/components/organization-wallet"
import { UserAvatar } from "@/components/user-avatar"
import { MessageViewToggle, SentMessages } from "@/components/sent-messages"
import { getOrgContext, ROLE_LABELS, type OrgRole } from "@/lib/organization-access"
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
import { ChangeEmailFlow, ChangePasswordFlow, DeleteAccountFlow } from "@/components/account-security"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { appendSpeech } from "@/lib/speech-to-text"
import { activateOnKey } from "@/lib/keyboard"
import { ThemeToggle } from "@/components/theme-toggle"
import { FeedbackButton } from "@/components/feedback-button"
import { SupportPlatformDialog } from "@/components/support-platform-dialog"
import { SettingsDialog } from "@/components/settings-dialog"
import { LiveClock } from "@/components/live-clock"
import { PasskeyPrompt } from "@/components/passkey-prompt"
import { useNotificationAlerts } from "@/hooks/use-notification-alerts"

type Organization = {
  id: string
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
  verification_status: string
  verification_notes?: string | null
  logo_url?: string | null
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
  urgency?: "low" | "medium" | "high" | string
  status: string
  rejection_reason?: string | null
  reopen_reason?: string | null
  created_at: string
}

type OrganizationDocument = { id: string; file_name: string; document_type: string; created_at: string; signed_url?: string | null }
type Fulfillment = {
  id: string
  status: string
  notes: string | null
  proof_storage_path?: string | null
  proof_notes?: string | null
  completed_at?: string | null
  created_at: string
  givers: { profile_id: string; name: string; email: string; phone?: string | null; account_type?: string | null; avatar_url?: string | null }[] | { profile_id: string; name: string; email: string; phone?: string | null; account_type?: string | null; avatar_url?: string | null } | null
  support_interests: FulfillmentInterest[] | FulfillmentInterest | null
  gift_offerings: FulfillmentGift[] | FulfillmentGift | null
}
type FulfillmentNeed = { title: string; description: string; category: string; location: string | null; quantity: string | null; due_date: string | null }
type FulfillmentInterest = { message: string | null; needs: FulfillmentNeed[] | FulfillmentNeed | null }
type FulfillmentGift = { title: string; description: string; offering_type: string; quantity_or_value: string | null; location: string | null; conditions: string | null }

// A fulfillment tracks delivery for either an accepted Need interest or an
// approved Gift Library claim - this normalizes either shape into one object
// the list/detail views can render without caring which source it came from.
function fulfillmentDisplay(item: Fulfillment) {
  const need = firstOf(firstOf(item.support_interests)?.needs)
  if (need) {
    return { title: need.title, description: need.description, tag: need.category, location: need.location, quantity: need.quantity, dueDate: need.due_date, conditions: null as string | null, isGift: false }
  }
  const gift = firstOf(item.gift_offerings)
  if (gift) {
    return { title: gift.title, description: gift.description, tag: `Gift · ${gift.offering_type}`, location: gift.location, quantity: gift.quantity_or_value, dueDate: null, conditions: gift.conditions, isGift: true }
  }
  return { title: "Community Need", description: "", tag: null, location: null, quantity: null, dueDate: null, conditions: null as string | null, isGift: false }
}
type Notification = { id: string; type: string; title: string; message: string; sender_name?: string | null; sender_role?: string | null; read_at: string | null; created_at: string; attachment_file_name?: string | null; attachmentUrl?: string | null; attachments?: { id: string; file_name: string | null; url: string | null }[] }
type OrganizationInterest = { id: string; status: string; created_at: string; message: string | null; needs: { title: string }[] | { title: string } | null; givers: { profile_id?: string; name: string; email: string; phone?: string | null; account_type?: string | null; avatar_url?: string | null }[] | { profile_id?: string; name: string; email: string; phone?: string | null; account_type?: string | null; avatar_url?: string | null } | null; photos?: { id: string; file_name: string | null; url: string | null }[] }
type StoryMedia = { id: string; media_type: "image" | "video"; url: string }
type ImpactStory = { id: string; title: string; content: string; author_role?: string | null; image_url?: string | null; video_url?: string | null; created_at: string; media?: StoryMedia[]; status?: "pending" | "approved" | "rejected"; rejection_reason?: string | null }
type AvailableGift = {
  id: string
  title: string
  offering_type: string
  description: string
  quantity_or_value?: string | null
  conditions?: string | null
  location?: string | null
  expiry_date?: string | null
  status: string
  created_at: string
  givers?: { name: string; email?: string } | null
  my_claim_pending?: boolean
  photos?: { id: string; file_name: string | null; url: string | null }[]
}
type ClaimedGift = { id: string; gift_offering_id: string; title: string; offering_type: string; description: string; quantity_or_value?: string | null; motivation: string; status: "pending" | "approved" | "rejected"; claim_notes?: string | null; created_at: string }
type Donation = {
  id: string
  amount: number
  payment_method: string
  status: "pending" | "successful" | "unsuccessful"
  reference_code: string
  created_at: string
  needs: { title: string }[] | { title: string } | null
  gift_offerings: { title: string }[] | { title: string } | null
  givers: { name: string; email: string; profile_id: string }[] | { name: string; email: string; profile_id: string } | null
}
type PlatformDonation = {
  id: string
  amount: number
  payment_method: string
  status: "pending" | "successful" | "unsuccessful"
  reference_code: string
  bank_name: string | null
  proof_storage_path: string | null
  created_at: string
}

export default function OrganizationDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const needCategories = useNeedCategories()

  const [organization, setOrganization] = useState<Organization | null>(null)
  // Whether this account gets emails for its in-app notifications (see
  // profiles.email_notifications_enabled) - lives on profiles, not
  // organizations, since it applies to every role the same way
  // (settings-dialog.tsx).
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  // Role within the organization (owner/manager/viewer). Only used to tailor the
  // UI; the API routes and database policies are what actually enforce it.
  const [memberRole, setMemberRole] = useState<OrgRole>("owner")
  const [needs, setNeeds] = useState<Need[]>([])
  const [documents, setDocuments] = useState<OrganizationDocument[]>([])
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  // Keeps the bell fresh while the page is open and chimes on new notifications.
  useNotificationAlerts<Notification>(setNotifications)
  const [interests, setInterests] = useState<OrganizationInterest[]>([])
  const [stories, setStories] = useState<ImpactStory[]>([])
  const [availableGifts, setAvailableGifts] = useState<AvailableGift[]>([])
  const [claimedGifts, setClaimedGifts] = useState<ClaimedGift[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [platformDonations, setPlatformDonations] = useState<PlatformDonation[]>([])
  const [payfastBanner, setPayfastBanner] = useState<"success" | "cancelled" | null>(null)
  const [paypalBanner, setPaypalBanner] = useState<"success" | "cancelled" | null>(null)
  const [bannerDonationId, setBannerDonationId] = useState<string | null>(null)
  const [selectedDonation, setSelectedDonation] = useState<DonationSummary | null>(null)
  // Prefill for the "Support The Platform" dialog when retrying an
  // unsuccessful one of the organization's own - see handleRetryDonation.
  const [retryPrefill, setRetryPrefill] = useState<{ amount: number; method: "eft" | "payfast" | "paypal" } | null>(null)
  const [selectedGift, setSelectedGift] = useState<GiftDetailSummary | null>(null)
  const [activeTab, setActiveTab] = useState("needs")

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedDocType, setSelectedDocType] = useState("supporting_document")
  const [isUploading, setIsUploading] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState<{ id: string; file_name: string } | null>(null)
  const [isDeletingDoc, setIsDeletingDoc] = useState(false)
  const [deleteDocError, setDeleteDocError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  // Every call site below still says setMessage(...)/setError(...) - kept
  // under their original names so nothing else in this file needs to
  // change - but they're now thin aliases for the shared inline-feedback
  // bubble (next to whichever button triggered it) instead of local state
  // driving a banner at the top of the page.
  const setMessage = (text: string) => showFeedback(text, "success")
  const setError = (text: string) => showFeedback(text, "error")

  // Need Form with Urgency
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    location: "",
    quantity: "",
    target_amount: "",
    due_date: "",
    urgency: "medium"
  })
  const [newNeedAttachments, setNewNeedAttachments] = useState<File[]>([])
  const [similarNeeds, setSimilarNeeds] = useState<{ id: string; title: string; category: string | null; location: string | null; status: string; own: boolean; organization_name: string | null; score: number }[]>([])

  // Advisory duplicate check while a need is being drafted (spec 4.4).
  useEffect(() => {
    if (form.title.trim().length < 4) { setSimilarNeeds([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ title: form.title, description: form.description, category: form.category, location: form.location })
        const response = await fetch(`/api/organization/needs/similar?${params}`, { signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        setSimilarNeeds(Array.isArray(data.similar) ? data.similar : [])
      } catch {
        // Offline or cancelled: the warning is only a courtesy, so stay quiet.
      }
    }, 600)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [form.title, form.description, form.category, form.location])
  const [needAttachments, setNeedAttachments] = useState<Record<string, { id: string; url: string; file_name: string | null }[]>>({})

  // Edit / Delete Need
  const [editingNeed, setEditingNeed] = useState<Need | null>(null)
  const [editNeedForm, setEditNeedForm] = useState({
    title: "", description: "", category: "", location: "", quantity: "", target_amount: "", due_date: "", urgency: "medium",
  })
  const [isSavingNeedEdit, setIsSavingNeedEdit] = useState(false)
  const [deletingNeedId, setDeletingNeedId] = useState<string | null>(null)

  // Fulfillment Verification Modal
  const [verifyingFulfillment, setVerifyingFulfillment] = useState<Fulfillment | null>(null)
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [proofNotes, setProofNotes] = useState("")
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)

  // Impact Story Form
  const [storyTitle, setStoryTitle] = useState("")
  const [storyContent, setStoryContent] = useState("")
  const [storyRole, setStoryRole] = useState("")
  const [storyImages, setStoryImages] = useState<File[]>([])
  const [storyVideoUrlInput, setStoryVideoUrlInput] = useState("")
  const [storyVideoUrls, setStoryVideoUrls] = useState<string[]>([])
  const [isPostingStory, setIsPostingStory] = useState(false)

  // Edit / Delete Impact Story
  const [editingStory, setEditingStory] = useState<ImpactStory | null>(null)
  const [editStoryForm, setEditStoryForm] = useState({ title: "", content: "", author_role: "" })
  const [editStoryNewImages, setEditStoryNewImages] = useState<File[]>([])
  const [editStoryVideoUrlInput, setEditStoryVideoUrlInput] = useState("")
  const [editStoryNewVideoUrls, setEditStoryNewVideoUrls] = useState<string[]>([])
  const [isSavingStoryEdit, setIsSavingStoryEdit] = useState(false)
  const [isAddingStoryMedia, setIsAddingStoryMedia] = useState(false)
  const [deletingStoryMediaId, setDeletingStoryMediaId] = useState<string | null>(null)
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null)

  // Edit Organization Dialog
  const [isEditingOrg, setIsEditingOrg] = useState(false)
  const [isSavingOrg, setIsSavingOrg] = useState(false)
  const [isResubmitting, setIsResubmitting] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // "Your needs" search (client-side, over this organization's own needs)
  const [needsQuery, setNeedsQuery] = useState("")
  const [needsStatusFilter, setNeedsStatusFilter] = useState<"all" | "draft" | "open" | "in_progress" | "fulfilled" | "closed" | "rejected" | "reopen_pending">("all")
  const [needsSort, setNeedsSort] = useState<"newest" | "oldest" | "urgency" | "title">("newest")
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null)
  const [reopenNeed, setReopenNeed] = useState<Need | null>(null)
  const [reopenReason, setReopenReason] = useState("")
  const [reopenFiles, setReopenFiles] = useState<File[]>([])
  const [isSubmittingReopen, setIsSubmittingReopen] = useState(false)

  const [loginEmail, setLoginEmail] = useState("")
  // Settings window: opens the edit-organization / password / delete-account screens below
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showBadges, setShowBadges] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrNeed, setQrNeed] = useState<{ id: string; title: string } | null>(null)
  const [availableGiftsView, setAvailableGiftsView] = useState<ListView>("grid")
  const [orgDialogMode, setOrgDialogMode] = useState<"fields" | "email" | "password" | "delete">("fields")
  const missionRef = useRef<HTMLTextAreaElement>(null)
  // Shared "this row's action button is in flight" tracker for the quick
  // action buttons below (interests, needs, fulfillments) - keyed by
  // "<id>:<action>" so two buttons on the same row don't fight over it.
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const runAction = async (key: string, fn: () => void | Promise<void>) => {
    setBusyAction(key)
    try { await fn() } finally { setBusyAction(null) }
  }

  // Message Admin / Message Giver dialogs
  const [isMessagingAdmin, setIsMessagingAdmin] = useState(false)
  const [showSupportPlatform, setShowSupportPlatform] = useState(false)
  const [messagingGiver, setMessagingGiver] = useState<{ id: string; label: string; defaultMessage?: string } | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Notification | null>(null)
  const [messageView, setMessageView] = useState<"inbox" | "sent">("inbox")
  const [viewingGiver, setViewingGiver] = useState<{ name: string; email: string; phone?: string | null; account_type?: string | null; avatar_url?: string | null } | null>(null)
  const [selectedInterest, setSelectedInterest] = useState<OrganizationInterest | null>(null)

  // Fulfillment detail modal
  const [selectedFulfillment, setSelectedFulfillment] = useState<Fulfillment | null>(null)
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null)
  const [proofGallery, setProofGallery] = useState<{ id: string; fileName: string | null; signedUrl: string | null }[]>([])
  const [isLoadingProof, setIsLoadingProof] = useState(false)
  const [extraProofFiles, setExtraProofFiles] = useState<File[]>([])
  const [isUploadingProof, setIsUploadingProof] = useState(false)
  const [proofUploadNote, setProofUploadNote] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [proofRefreshKey, setProofRefreshKey] = useState(0)

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
    setLoginEmail(user.email || "")

    // role and email_notifications_enabled fetched together - one round trip
    // instead of two. Falls back to a role-only query only in the unlikely
    // case this environment's profiles table predates that column's migration.
    let currentProfile: { role: string; email_notifications_enabled?: boolean } | null =
      (await supabase.from("profiles").select("role, email_notifications_enabled").eq("id", user.id).single()).data
    if (!currentProfile) {
      currentProfile = (await supabase.from("profiles").select("role").eq("id", user.id).single()).data
    }
    if (currentProfile && currentProfile.role !== "organization") {
      if (currentProfile.role === "admin") return router.replace("/admin-dashboard")
      if (currentProfile.role === "giver") return router.replace("/givers-dashboard")
      return router.replace("/login")
    }
    setEmailNotificationsEnabled(currentProfile?.email_notifications_enabled ?? true)

    const orgCtx = await getOrgContext<Organization>(
      supabase,
      user.id,
      "id, name, type, registration_number, contact_name, contact_role, contact_email, phone, address, city, province, mission, bank_name, bank_account_holder, bank_account_number, bank_branch_code, bank_account_type, verification_status, verification_notes, logo_url"
    )
    const org = orgCtx?.organization ?? null
    if (orgCtx) setMemberRole(orgCtx.role)

    if (!org) {
      setError("Your organization profile could not be found. Please contact support if this persists.")
      setIsLoading(false)
      return
    }

    setOrganization(org)

    // Everything below is independent of everything else (attachments are the
    // one exception - they depend on this load's own needs result, so that
    // pair stays together as a single task) - run it all concurrently rather
    // than one fetch after another, exactly like the admin dashboard's
    // loadData(). Previously ~9 sequential round trips here alone.
    await Promise.allSettled([
      // --- Needs (with urgency fallback matching POST API defensive pattern),
      // plus their attachments, which need this query's own result.
      (async () => {
        let needsQuery = supabase
          .from("needs")
          .select("id, title, description, category, location, quantity, target_amount, due_date, urgency, status, rejection_reason, reopen_reason, created_at")
          .eq("organization_id", org.id)
          .order("created_at", { ascending: false })
        let { data: organizationNeeds, error: needsError } = await needsQuery
        if (needsError && needsError.message?.toLowerCase().includes("urgency")) {
          const fallback: any = await supabase
            .from("needs")
            .select("id, title, description, category, location, quantity, target_amount, due_date, status, rejection_reason, reopen_reason, created_at")
            .eq("organization_id", org.id)
            .order("created_at", { ascending: false })
          organizationNeeds = (fallback.data || []).map((item: any) => ({ ...item, urgency: "medium" }))
          needsError = fallback.error
        }
        if (needsError) {
          setError("Could not load your organization's needs: " + needsError.message)
        }
        setNeeds((organizationNeeds || []) as Need[])

        // Load attachments for this organization's needs (public bucket - plain public URLs)
        if (organizationNeeds && organizationNeeds.length > 0) {
          const { data: attachmentRows } = await supabase
            .from("need_attachments")
            .select("id, need_id, storage_path, file_name")
            .in("need_id", organizationNeeds.map((n: any) => n.id))
          const grouped: Record<string, { id: string; url: string; file_name: string | null }[]> = {}
          for (const row of attachmentRows || []) {
            const { data: pub } = supabase.storage.from("need-attachments").getPublicUrl(row.storage_path)
            if (!grouped[row.need_id]) grouped[row.need_id] = []
            grouped[row.need_id].push({ id: row.id, url: pub.publicUrl, file_name: row.file_name })
          }
          setNeedAttachments(grouped)
        } else {
          setNeedAttachments({})
        }
      })(),

      // --- Documents
      (async () => {
        const documentsResponse = await fetch("/api/organization/documents")
        if (documentsResponse.ok) setDocuments((await documentsResponse.json()).documents || [])
      })(),

      // --- Fulfillments
      (async () => {
        const { data: organizationFulfillments } = await supabase
          .from("fulfillments")
          .select("id, status, notes, proof_storage_path, proof_notes, completed_at, created_at, givers(profile_id, name, email, phone, account_type, avatar_url), support_interests(message, needs(title, description, category, location, quantity, due_date)), gift_offerings(title, description, offering_type, quantity_or_value, location, conditions)")
          .eq("organization_id", org.id)
          .order("created_at", { ascending: false })
        setFulfillments((organizationFulfillments || []) as unknown as Fulfillment[])
      })(),

      // --- Notifications
      (async () => {
        const notificationsResponse = await fetch("/api/notifications")
        if (notificationsResponse.ok) setNotifications((await notificationsResponse.json()).notifications || [])
      })(),

      // --- Interests
      (async () => {
        const interestsResponse = await fetch("/api/organization/interests")
        if (interestsResponse.ok) setInterests((await interestsResponse.json()).interests || [])
      })(),

      // --- Stories (defensive)
      (async () => {
        const storiesResponse = await fetch("/api/organization/stories")
        if (storiesResponse.ok) setStories((await storiesResponse.json()).stories || [])
      })(),

      // --- Available gifts from Gift Library
      (async () => {
        const giftsResponse = await fetch("/api/public/gifts")
        if (giftsResponse.ok) setAvailableGifts((await giftsResponse.json()).gifts || [])
      })(),

      // --- This organization's own claim requests (pending/approved/rejected)
      (async () => {
        const claimsResponse = await fetch("/api/organization/gifts/claims")
        if (claimsResponse.ok) setClaimedGifts((await claimsResponse.json()).claims || [])
      })(),

      // --- Donations toward this organization's needs (read-only; admin reviews)
      (async () => {
        const donationsResponse = await fetch("/api/organization/donations")
        if (donationsResponse.ok) setDonations((await donationsResponse.json()).donations || [])
      })(),

      // --- This organization's own "Support The Platform" donations - the
      // only donations it can actually make itself, as opposed to the ones
      // above, which it only ever receives.
      (async () => {
        const platformDonationsResponse = await fetch("/api/donations/platform")
        if (platformDonationsResponse.ok) setPlatformDonations((await platformDonationsResponse.json()).donations || [])
      })(),
    ])

    setIsLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // PayFast/PayPal returning from "Support The Platform" - same pattern as
  // the giver dashboard's own copy of this effect. The cancel endpoint lives
  // under /api/giver/donations/[id]/cancel, but its ownership check already
  // covers a platform donation identified by donor_profile_id regardless of
  // role (a giver's own donation is matched by giver_id instead), so it
  // works unchanged for an organization's own platform donation too.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab")
    const payfast = params.get("payfast")
    const paypal = params.get("paypal")
    const donationId = params.get("donation")
    if (tab) setActiveTab(tab)
    if (payfast === "success" || payfast === "cancelled") setPayfastBanner(payfast)
    if (paypal === "success" || paypal === "cancelled") setPaypalBanner(paypal)
    if (donationId) setBannerDonationId(donationId)
    if (tab || payfast || paypal) window.history.replaceState({}, "", "/organisation-dashboard")
    if (payfast === "cancelled" && donationId) {
      fetch(`/api/giver/donations/${donationId}/cancel`, { method: "POST" })
        .then(() => loadData())
        .catch(() => {})
    }
    if (paypal === "cancelled" && donationId) {
      fetch(`/api/giver/donations/${donationId}/cancel`, { method: "POST" })
        .then(() => loadData())
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedFulfillment) {
      setProofSignedUrl(null)
      setProofGallery([])
      setExtraProofFiles([])
      setProofUploadNote(null)
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
  }, [selectedFulfillment, proofRefreshKey])

  // Owners and managers can attach more proof (photos, receipts, documents)
  // after delivery has started or finished.
  const uploadMoreProof = async () => {
    if (!selectedFulfillment || extraProofFiles.length === 0) return
    setIsUploadingProof(true)
    setProofUploadNote(null)
    try {
      const formData = new FormData()
      extraProofFiles.forEach(file => formData.append("proofs", file))
      const res = await fetch(`/api/fulfillments/${selectedFulfillment.id}/proofs`, { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not add proof.")
      setProofUploadNote({ type: "success", text: data.message || "Proof added." })
      setExtraProofFiles([])
      setProofRefreshKey(key => key + 1)
    } catch (err: any) {
      setProofUploadNote({ type: "error", text: err.message || "Could not add proof." })
    } finally {
      setIsUploadingProof(false)
    }
  }

  const handleCreateNeed = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization) return
    setIsSaving(true)
    setError("")
    setMessage("")

    const formData = new FormData()
    formData.set("title", form.title)
    formData.set("description", form.description)
    formData.set("category", form.category)
    formData.set("location", form.location)
    formData.set("quantity", form.quantity)
    formData.set("target_amount", form.target_amount)
    formData.set("due_date", form.due_date)
    formData.set("urgency", form.urgency)
    newNeedAttachments.forEach(file => formData.append("attachments", file))

    const response = await fetch("/api/organization/needs", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      setError((await response.json()).message || "Need creation failed.")
    } else {
      setMessage("Need saved as a draft with specified urgency level.")
      setForm({
        title: "",
        description: "",
        category: "",
        location: "",
        quantity: "",
        target_amount: "",
        due_date: "",
        urgency: "medium"
      })
      setNewNeedAttachments([])
      setSimilarNeeds([])
      await loadData()
    }
    setIsSaving(false)
  }

  const updateNeedStatus = async (need: Need, status: "closed" | "fulfilled") => {
    const response = await fetch(`/api/organization/needs/${need.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) setError((await response.json()).message || "Need update failed.")
    else await loadData()
  }

  // A closed need can't just reopen itself - it goes back through admin
  // review (see api/organization/needs/[id]/route.ts), so this asks for the
  // organization's motivation up front, same as a reopen request needs, with
  // optional supporting photos/documents (e.g. proof the need has returned)
  // attached the same way the multipart branch already handles them.
  const requestReopenNeed = async (need: Need, reopen_reason: string, files: File[]) => {
    const formData = new FormData()
    formData.set("status", "reopen_pending")
    formData.set("reopen_reason", reopen_reason)
    files.forEach(file => formData.append("attachments", file))

    const response = await fetch(`/api/organization/needs/${need.id}`, { method: "PATCH", body: formData })
    if (!response.ok) setError((await response.json()).message || "Reopen request failed.")
    else { showFeedback("Reopen request sent for admin approval."); await loadData() }
  }

  const openEditNeed = (need: Need) => {
    setEditingNeed(need)
    setEditNeedForm({
      title: need.title,
      description: need.description,
      category: need.category,
      location: need.location || "",
      quantity: need.quantity || "",
      target_amount: need.target_amount != null ? String(need.target_amount) : "",
      due_date: need.due_date || "",
      urgency: need.urgency || "medium",
    })
  }

  const saveNeedEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingNeed) return
    setIsSavingNeedEdit(true)
    setError("")
    const response = await fetch(`/api/organization/needs/${editingNeed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editNeedForm,
        due_date: editNeedForm.due_date || null,
        target_amount: editNeedForm.target_amount ? Number(editNeedForm.target_amount) : null,
      }),
    })
    if (!response.ok) {
      setError((await response.json()).message || "Need update failed.")
    } else {
      setEditingNeed(null)
      setMessage("Need updated.")
      await loadData()
    }
    setIsSavingNeedEdit(false)
  }

  const deleteNeed = async (needId: string) => {
    setDeletingNeedId(needId)
    setError("")
    const response = await fetch(`/api/organization/needs/${needId}`, { method: "DELETE" })
    if (!response.ok) {
      setError((await response.json()).message || "Need deletion failed.")
    } else {
      setMessage("Need deleted.")
      await loadData()
    }
    setDeletingNeedId(null)
  }

  const uploadDocument = async (event: FormEvent) => {
    event.preventDefault()
    if (selectedFiles.length === 0) return setError("Choose at least one document first.")
    setIsUploading(true)
    setError("")
    const fileCount = selectedFiles.length
    try {
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("document_type", selectedDocType)
        const response = await fetch("/api/organization/documents", { method: "POST", body: formData })
        if (!response.ok) throw new Error((await response.json()).message || `Failed to upload ${file.name}.`)
      }
      setSelectedFiles([])
      setSelectedDocType("supporting_document")
      setMessage(fileCount > 1 ? "Documents uploaded for admin review." : "Document uploaded for admin review.")
      await loadData()
    } catch (err: any) {
      setError(err.message || "Document upload failed.")
    } finally {
      setIsUploading(false)
    }
  }

  const deleteDocument = async () => {
    if (!deletingDoc) return
    setDeleteDocError("")
    setIsDeletingDoc(true)
    try {
      const response = await fetch(`/api/organization/documents/${deletingDoc.id}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || "Could not delete this document.")
      setMessage("Document deleted.")
      setDeletingDoc(null)
      await loadData()
    } catch (err: any) {
      // Shown inline in the confirmation dialog itself - the page's top-level
      // error banner can be scrolled well out of view from the Documents tab.
      setDeleteDocError(err.message || "Could not delete this document.")
    } finally {
      setIsDeletingDoc(false)
    }
  }

  // Complete fulfillment with proof verification
  const handleVerifyFulfillment = async (e: FormEvent) => {
    e.preventDefault()
    if (!verifyingFulfillment) return
    setIsSubmittingProof(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("status", "completed")
      formData.append("notes", proofNotes)
      for (const file of proofFiles) {
        formData.append("proofs", file)
      }

      const res = await fetch(`/api/fulfillments/${verifyingFulfillment.id}`, {
        method: "PATCH",
        body: formData,
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.message || "Failed to complete fulfillment.")
      }

      setMessage("Fulfillment completed and verified proof recorded.")
      setVerifyingFulfillment(null)
      setProofFiles([])
      setProofNotes("")
      await loadData()
    } catch (err: any) {
      setError(err.message || "Failed to submit verification.")
    } finally {
      setIsSubmittingProof(false)
    }
  }

  const handleStartFulfillment = async (id: string) => {
    const response = await fetch(`/api/fulfillments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" })
    })
    if (!response.ok) setError((await response.json()).message || "Fulfillment update failed.")
    else await loadData()
  }

  const markNotificationRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" })
    setNotifications(current => current.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  const markAllNotificationsRead = async () => {
    const now = new Date().toISOString()
    setNotifications(current => current.map(item => item.read_at ? item : { ...item, read_at: now }))
    await fetch("/api/notifications/read-all", { method: "PATCH" }).catch(() => {})
  }

  const openMessage = (item: Notification) => {
    if (!item.read_at) markNotificationRead(item.id)
    setSelectedMessage(item)
  }

  const updateInterest = async (id: string, status: "accepted" | "declined") => {
    const response = await fetch(`/api/organization/interests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    })
    if (!response.ok) setError((await response.json()).message || "Interest update failed.")
    else { setMessage(`Interest ${status}.`); await loadData() }
  }

  // Create Impact Story
  const handleCreateStory = async (e: FormEvent) => {
    e.preventDefault()
    if (!storyTitle || !storyContent) return
    setIsPostingStory(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("title", storyTitle)
      formData.append("content", storyContent)
      formData.append("author_role", storyRole)
      storyImages.forEach((file) => formData.append("images", file))
      storyVideoUrls.forEach((url) => formData.append("video_urls", url))

      const res = await fetch("/api/organization/stories", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to publish story.")

      setMessage("Impact Story submitted. It will appear on your public profile once an administrator approves it.")
      setStoryTitle("")
      setStoryContent("")
      setStoryRole("")
      setStoryImages([])
      setStoryVideoUrlInput("")
      setStoryVideoUrls([])
      await loadData()
    } catch (err: any) {
      setError(err.message || "Unable to publish story.")
    } finally {
      setIsPostingStory(false)
    }
  }

  const openEditStory = (story: ImpactStory) => {
    setEditingStory(story)
    setEditStoryForm({
      title: story.title,
      content: story.content,
      author_role: story.author_role || "",
    })
    setEditStoryNewImages([])
    setEditStoryVideoUrlInput("")
    setEditStoryNewVideoUrls([])
  }

  const saveStoryEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingStory) return
    setIsSavingStoryEdit(true)
    setError("")
    try {
      const res = await fetch(`/api/organization/stories/${editingStory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editStoryForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to update story.")
      setMessage("Impact Story updated and sent for administrator review again.")
      setEditingStory(null)
      await loadData()
    } catch (err: any) {
      setError(err.message || "Unable to update story.")
    } finally {
      setIsSavingStoryEdit(false)
    }
  }

  const refreshStories = async (storyIdToReselect?: string) => {
    const res = await fetch("/api/organization/stories")
    if (!res.ok) return
    const freshStories: ImpactStory[] = (await res.json()).stories || []
    setStories(freshStories)
    if (storyIdToReselect) {
      const updated = freshStories.find(s => s.id === storyIdToReselect)
      if (updated) setEditingStory(updated)
    }
  }

  const addStoryMedia = async () => {
    if (!editingStory) return
    if (editStoryNewImages.length === 0 && editStoryNewVideoUrls.length === 0) return
    setIsAddingStoryMedia(true)
    setError("")
    try {
      const formData = new FormData()
      editStoryNewImages.forEach((file) => formData.append("images", file))
      editStoryNewVideoUrls.forEach((url) => formData.append("video_urls", url))
      const res = await fetch(`/api/organization/stories/${editingStory.id}/media`, { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to add media.")
      setEditStoryNewImages([])
      setEditStoryVideoUrlInput("")
      setEditStoryNewVideoUrls([])
      await refreshStories(editingStory.id)
    } catch (err: any) {
      setError(err.message || "Unable to add media.")
    } finally {
      setIsAddingStoryMedia(false)
    }
  }

  const deleteStoryMedia = async (mediaId: string) => {
    if (!editingStory) return
    setDeletingStoryMediaId(mediaId)
    setError("")
    try {
      const res = await fetch(`/api/organization/stories/${editingStory.id}/media/${mediaId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to remove media.")
      await refreshStories(editingStory.id)
    } catch (err: any) {
      setError(err.message || "Unable to remove media.")
    } finally {
      setDeletingStoryMediaId(null)
    }
  }

  const deleteStory = async (storyId: string) => {
    setDeletingStoryId(storyId)
    setError("")
    const response = await fetch(`/api/organization/stories/${storyId}`, { method: "DELETE" })
    if (!response.ok) {
      setError((await response.json()).message || "Story deletion failed.")
    } else {
      setMessage("Impact Story deleted.")
      await loadData()
    }
    setDeletingStoryId(null)
  }

  // Claim Gift Library Offering
  const handleResubmitForReview = async () => {
    setIsResubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/organization/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resubmit: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Unable to resubmit for review.")
      setMessage("Resubmitted for review. An administrator will take another look.")
      await loadData()
    } catch (err: any) {
      setError(err.message || "Unable to resubmit for review.")
    } finally {
      setIsResubmitting(false)
    }
  }

  const handleClaimGift = async (giftId: string, motivation: string, documents: File[] = []) => {
    setError("")
    setMessage("")
    try {
      const formData = new FormData()
      formData.set("motivation", motivation)
      documents.forEach(file => formData.append("documents", file))
      const res = await fetch(`/api/organization/gifts/${giftId}/claim`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to claim gift.")

      setMessage("Claim request sent! A HelpLift administrator will review and confirm it shortly.")
      await loadData()
    } catch (err: any) {
      setError(err.message || "Unable to claim gift.")
      throw err
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  // Retrying an unsuccessful "Support The Platform" donation - the only kind
  // an organization ever pays itself, so unlike the giver dashboard's
  // version of this handler there's no need/gift-offering branching here.
  const handleRetryDonation = (item: DonationSummary) => {
    const method: "eft" | "payfast" | "paypal" = item.payment_method === "payfast" || item.payment_method === "paypal" ? item.payment_method : "eft"
    setSelectedDonation(null)
    setRetryPrefill({ amount: item.amount, method })
    setShowSupportPlatform(true)
  }

  // Whether emails go out for this account's in-app notifications (see
  // profiles.email_notifications_enabled) - applied optimistically, same
  // pattern as the giver dashboard's own copy of this handler.
  const toggleEmailNotifications = async (next: boolean) => {
    setEmailNotificationsEnabled(next)
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_notifications_enabled: next }),
    })
    if (!res.ok) setEmailNotificationsEnabled(!next)
  }

  const saveOrganizationProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingOrg(true)
    setError("")
    const sourceData = new FormData(event.currentTarget)
    const formData = new FormData()
    formData.set("name", (sourceData.get("name") as string)?.trim() || "")
    formData.set("type", (sourceData.get("type") as string)?.trim() || "")
    formData.set("registration_number", (sourceData.get("registration_number") as string)?.trim() || "")
    formData.set("contact_name", (sourceData.get("contact_name") as string)?.trim() || "")
    formData.set("contact_role", (sourceData.get("contact_role") as string)?.trim() || "")
    formData.set("contact_email", (sourceData.get("contact_email") as string)?.trim() || "")
    formData.set("phone", (sourceData.get("phone") as string)?.trim() || "")
    formData.set("address", (sourceData.get("address") as string)?.trim() || "")
    formData.set("city", (sourceData.get("city") as string)?.trim() || "")
    formData.set("province", (sourceData.get("province") as string)?.trim() || "")
    formData.set("mission", (sourceData.get("mission") as string)?.trim() || "")
    formData.set("bank_name", (sourceData.get("bank_name") as string)?.trim() || "")
    formData.set("bank_account_holder", (sourceData.get("bank_account_holder") as string)?.trim() || "")
    formData.set("bank_account_number", (sourceData.get("bank_account_number") as string)?.trim() || "")
    formData.set("bank_branch_code", (sourceData.get("bank_branch_code") as string)?.trim() || "")
    formData.set("bank_account_type", (sourceData.get("bank_account_type") as string)?.trim() || "")
    if (logoFile) formData.set("logo", logoFile)

    const res = await fetch("/api/organization/profile", {
      method: "PATCH",
      body: formData,
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.message || "Organization profile update failed.")
    } else {
      setIsEditingOrg(false)
      setLogoFile(null)
      setMessage("Organization profile updated.")
      await loadData()
    }
    setIsSavingOrg(false)
  }

  const closeOrgDialog = () => {
    setIsEditingOrg(false)
    setOrgDialogMode("fields")
  }

  const bannerDonation = bannerDonationId ? platformDonations.find(d => d.id === bannerDonationId) : null
  const bannerDetail = bannerDonation
    ? { amount: bannerDonation.amount, date: new Date(bannerDonation.created_at).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }), reference: bannerDonation.reference_code }
    : undefined

  const needsUrgencyRank: Record<string, number> = { high: 0, medium: 1, low: 2 }

  const filteredNeeds = useMemo(() => {
    const q = needsQuery.trim().toLowerCase()
    const filtered = needs.filter(need => {
      if (needsStatusFilter !== "all" && need.status !== needsStatusFilter) return false
      if (!q) return true
      return (
        (need.title || "").toLowerCase().includes(q) ||
        (need.description || "").toLowerCase().includes(q) ||
        (need.category || "").toLowerCase().includes(q) ||
        (need.location || "").toLowerCase().includes(q) ||
        need.status.replace(/_/g, " ").toLowerCase().includes(q)
      )
    })
    const sorted = [...filtered]
    if (needsSort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (needsSort === "urgency") sorted.sort((a, b) => (needsUrgencyRank[(a.urgency || "medium").toLowerCase()] ?? 1) - (needsUrgencyRank[(b.urgency || "medium").toLowerCase()] ?? 1))
    else if (needsSort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title))
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return sorted
  }, [needs, needsQuery, needsStatusFilter, needsSort])

  const stats = useMemo(() => ({
    totalNeeds: needs.length,
    openNeeds: needs.filter(n => n.status === "open").length,
    pendingInterests: interests.filter(i => i.status === "pending").length,
    activeFulfillments: fulfillments.filter(f => f.status === "pending" || f.status === "in_progress").length,
  }), [needs, interests, fulfillments])

  // For the "Pending Withdrawals" stat tile only - the Wallet tab has its own
  // full fetch of this same endpoint for the actual withdrawal history/UI.
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0)
  useEffect(() => {
    let cancelled = false
    fetch("/api/organization/wallet")
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const list = (data.withdrawals || []) as { status: string }[]
        setPendingWithdrawals(list.filter(w => w.status === "pending" || w.status === "approved").length)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const unreadCount = notifications.filter(n => !n.read_at).length
  const messages = notifications.filter(n => ["admin_message", "org_message", "admin_announcement"].includes(n.type))
  const unreadMessages = messages.filter(m => !m.read_at).length
  const pendingDonations = donations.filter(d => d.status === "pending").length

  const renderUrgencyBadge = (urgency?: string) => {
    const level = (urgency || "medium").toLowerCase()
    if (level === "high") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 text-xs font-semibold text-red-700 dark:text-red-400">
          <Flame className="w-3 h-3 fill-red-600" /> High
        </span>
      )
    }
    if (level === "medium") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3" /> Medium
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-slate-200 dark:border-[#233350] text-xs font-semibold text-slate-700 dark:text-slate-300">
        <PackageCheck className="w-3 h-3" /> Standard
      </span>
    )
  }

  if (isLoading) return <LoadingState />

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-[2400px] px-4 md:px-10 py-10 md:py-14 space-y-6">

        <div className="flex justify-end">
          <LiveClock />
        </div>

        {/* --- HEADER --- */}
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {organization?.logo_url ? (
              <img src={organization.logo_url} alt={`${organization.name} logo`} className="h-14 w-14 rounded-lg object-cover shadow-lg shadow-blue-600/20" />
            ) : (
              <div className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 p-3.5 text-white shadow-lg shadow-blue-600/20">
                <Building2 className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Organization dashboard</p>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">{organization?.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-slate-500 dark:text-slate-400">{organization?.contact_email}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold ${
                    organization?.verification_status === "approved"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                      : organization?.verification_status === "rejected"
                        ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400"
                        : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {organization?.verification_status === "approved" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {organization?.verification_status?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ThemeToggle className="h-9 w-9" />
            {memberRole !== "viewer" && <FeedbackButton />}
            {memberRole !== "viewer" && (
              <button
                onClick={() => setShowSupportPlatform(true)}
                data-tip="Donate directly to HelpLift - not to any organization"
                className="inline-flex items-center gap-1.5 rounded-sm border border-pink-200 dark:border-pink-900 bg-pink-50 dark:bg-pink-950/40 px-4 py-2 text-sm font-semibold text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-950/70"
              >
                <Heart className="h-3.5 w-3.5" /> Support The Platform
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Notifications"
                  data-tip={unreadCount > 0 ? `Notifications: ${unreadCount} unread. Click to see them.` : "Notifications. You're all caught up."}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740] transition-colors">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); markAllNotificationsRead() }}
                      data-tip="Mark every notification as read"
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">No notifications yet.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map(item => (
                      <DropdownMenuItem
                        key={item.id}
                        onSelect={(e) => { e.preventDefault(); openMessage(item) }}
                        className={`flex flex-col items-start gap-0.5 whitespace-normal ${!item.read_at ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                      >
                        <span className="font-semibold text-xs">{item.title}</span>
                        <span className="text-xs text-muted-foreground line-clamp-2">{item.message}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href="/organizations"
              className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              Organizations
            </Link>

            {organization?.id && (
              <Link
                href={`/organizations/${organization.id}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
              >
                <span>Public Profile</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            )}

            <button
              onClick={() => setActiveTab("documents")}
              data-tip="View and upload your organization's verification documents"
              className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <FileText className="h-3.5 w-3.5" /> Documents
            </button>

            <button
              onClick={() => setShowQrCode(true)}
              aria-label="Get your QR code"
              data-tip="Get a QR code linking to your public profile, to share or print"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740] transition-colors"
            >
              <QrCode className="h-4 w-4" />
            </button>

            <button
              onClick={() => setShowBadges(true)}
              data-tip="Your organization's badges and progress toward the next one"
              className="inline-flex items-center gap-1.5 rounded-sm border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/70"
            >
              <Star className="h-3.5 w-3.5" fill="currentColor" /> Badges
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </button>

            {memberRole !== "viewer" && (
            <button
              onClick={() => setIsMessagingAdmin(true)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Message Admin
            </button>
            )}

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-sm bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>

        {memberRole !== "owner" && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4 text-sm font-semibold text-blue-800 dark:text-blue-300">
            You're signed in as a {ROLE_LABELS[memberRole].toLowerCase()} of {organization?.name}.{" "}
            {memberRole === "viewer"
              ? "You have read-only access, so actions that change data will be declined, and you can’t message administrators."
              : "You can manage needs, interests, fulfillments, stories and messages, and contact administrators. Only owners can edit the organization’s information, manage the team, or request withdrawals."}
          </div>
        )}

        {organization?.verification_status === "more_info_requested" && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">An administrator needs more information before approving your account</p>
            {organization.verification_notes && (
              <p className="text-sm text-amber-700 dark:text-amber-400 italic">"{organization.verification_notes}"</p>
            )}
            <p className="text-xs text-amber-700 dark:text-amber-400">Upload what's needed in the Documents tab, then resubmit for review.</p>
            {memberRole === "owner" ? (
            <button
              onClick={handleResubmitForReview}
              disabled={isResubmitting}
              className="inline-flex items-center gap-2 rounded-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              {isResubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Resubmit for Review
            </button>
            ) : (
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">An owner needs to resubmit the organization for review.</p>
            )}
          </div>
        )}

        {organization?.verification_status !== "approved" && organization?.verification_status !== "more_info_requested" && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm font-semibold text-amber-800 dark:text-amber-300">
            Your account is {organization?.verification_status}. Upload your documents in the Documents tab and wait for admin approval before publishing needs.
          </div>
        )}

        {/* --- STATS ROW: what needs your attention right now, nothing
             that's just a total (that's what the Analytics tab is for) --- */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={ClipboardList} label="Open Needs" value={stats.openNeeds} accent="emerald" />
          <StatCard icon={Users} label="Pending Interests" value={stats.pendingInterests} accent="amber" />
          <StatCard icon={PackageCheck} label="Active Fulfillments" value={stats.activeFulfillments} accent="purple" />
          <StatCard icon={Wallet} label="Pending Withdrawals" value={pendingWithdrawals} accent="pink" />
          <StatCard icon={Mail} label="Unread Messages" value={unreadMessages} accent="blue" />
        </div>

        {/* --- TABS --- */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
          <TabsList className="w-full flex-nowrap justify-start overflow-x-auto">
            <TabsTrigger value="needs" className="shrink-0 gap-1.5 px-2.5"><ClipboardList className="w-4 h-4" />Needs</TabsTrigger>
            <TabsTrigger value="fulfillments" className="shrink-0 gap-1.5 px-2.5"><PackageCheck className="w-4 h-4" />Fulfillments<CountBadge value={stats.activeFulfillments} /></TabsTrigger>
            <TabsTrigger value="interests" className="shrink-0 gap-1.5 px-2.5"><Users className="w-4 h-4" />Interests<CountBadge value={stats.pendingInterests} /></TabsTrigger>
            <TabsTrigger value="donations" className="shrink-0 gap-1.5 px-2.5"><Banknote className="w-4 h-4" />Donations<CountBadge value={pendingDonations} /></TabsTrigger>
            <TabsTrigger value="wallet" className="shrink-0 gap-1.5 px-2.5"><Wallet className="w-4 h-4" />Wallet</TabsTrigger>
            <TabsTrigger value="messages" className="shrink-0 gap-1.5 px-2.5"><Mail className="w-4 h-4" />Messages<CountBadge value={unreadMessages} /></TabsTrigger>
            <TabsTrigger value="stories" className="shrink-0 gap-1.5 px-2.5"><Sparkles className="w-4 h-4" />Impact Stories</TabsTrigger>
            <TabsTrigger value="gifts" className="shrink-0 gap-1.5 px-2.5"><Gift className="w-4 h-4" />Gift Library</TabsTrigger>
            <TabsTrigger value="analytics" className="shrink-0 gap-1.5 px-2.5"><BarChart3 className="w-4 h-4" />Analytics</TabsTrigger>
            {memberRole === "owner" && <TabsTrigger value="team" className="shrink-0 gap-1.5 px-2.5"><Users className="w-4 h-4" />Team</TabsTrigger>}
            {/* Documents lives as a header button now (next to Settings) - pulling it out of this row is what lets everything else fit on one line without scrolling. */}
            <TabsTrigger value="documents" className="hidden" />
          </TabsList>

          {/* Viewers are read-only: a disabled fieldset turns every button, input,
              select and textarea in the tab contents off. The tab list above and
              the header (sign out) stay usable. The API and database enforce it too. */}
          <fieldset disabled={memberRole === "viewer"} className="min-w-0 disabled:opacity-90">

          {/* --- NEEDS TAB --- */}
          <TabsContent value="needs" className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Create a need</CardTitle>
                <CardDescription>Needs are saved as drafts and can be published after admin approval.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateNeed} className="space-y-3">
                  <input
                    required
                    placeholder="Need title (e.g. 50 Winter Jackets for Shelter)"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="field"
                  />
                  <div className="flex justify-end mb-1">
                    <GrammarCheckButton
                      text={form.description}
                      onTextChange={text => setForm(f => ({ ...f, description: text }))}
                    />
                  </div>
                  <div className="relative">
                    <textarea
                      required
                      placeholder="Describe what is needed and who will benefit..."
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      className="field min-h-24 pr-11"
                    />
                    <MicButton className="top-2 right-2" onText={text => setForm(f => ({ ...f, description: appendSpeech(f.description, text) }))} />
                  </div>

                  {similarNeeds.length > 0 && (
                    <div role="status" className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
                      <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> This looks similar to an existing need
                      </p>
                      <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                        To help beneficiaries, please make sure your need is unique. You can still submit it if it is genuinely different.
                      </p>
                      <ul className="space-y-1.5">
                        {similarNeeds.map(item => (
                          <li key={item.id} className="rounded-sm bg-white/70 dark:bg-[#121B2E] px-3 py-2 text-xs">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{item.title}</span>
                            <span className="block text-slate-500 dark:text-slate-400">
                              {item.own ? "Your organization" : item.organization_name || "Another organization"} · {item.status.replace("_", " ")}
                              {item.location ? ` · ${item.location}` : ""} · {item.score}% match
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      required
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="field text-slate-500 dark:text-slate-400"
                    >
                      <option value="" disabled>Select a category</option>
                      {needCategories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <select
                      value={form.urgency}
                      onChange={e => setForm({ ...form, urgency: e.target.value })}
                      className="field text-slate-500 dark:text-slate-400"
                    >
                      <option value="medium">Medium Urgency</option>
                      <option value="high">High / Critical Urgency</option>
                      <option value="low">Standard / Low</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Location (e.g. Pretoria West)"
                      value={form.location}
                      onChange={e => setForm({ ...form, location: e.target.value })}
                      className="field"
                    />
                    <input
                      placeholder="Quantity (e.g. 50 boxes)"
                      value={form.quantity}
                      onChange={e => setForm({ ...form, quantity: e.target.value })}
                      className="field"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    <label className="pl-1">Target amount (optional)</label>
                    <label className="pl-1">Due date (optional)</label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min="0"
                      placeholder="Target Amount (Rands)"
                      value={form.target_amount}
                      onChange={e => setForm({ ...form, target_amount: e.target.value })}
                      className="field"
                    />
                    <input
                      type="date"
                      data-tip="The date by which this need should ideally be fulfilled"
                      value={form.due_date}
                      onChange={e => setForm({ ...form, due_date: e.target.value })}
                      className="field text-slate-400 dark:text-slate-500"
                    />
                  </div>

                  <label className="flex items-center gap-3 p-3 rounded border border-dashed border-slate-300 dark:border-[#2C3E63] cursor-pointer hover:border-blue-500 transition-colors text-xs font-normal text-slate-500 dark:text-slate-400">
                    <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {newNeedAttachments.length > 0
                        ? `${newNeedAttachments.length} file${newNeedAttachments.length === 1 ? "" : "s"} attached`
                        : "Attach photos or documents (optional)"}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                      onChange={e => setNewNeedAttachments(Array.from(e.target.files || []))}
                      className="sr-only"
                    />
                  </label>

                  <button
                    disabled={isSaving}
                    className="inline-flex w-full h-10 items-center justify-center gap-2 rounded bg-slate-900 dark:bg-blue-600 px-5 font-medium text-white hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save draft
                  </button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Your needs</CardTitle>
                <CardDescription>Only needs created by this organization appear here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {needs.length > 0 && (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          value={needsQuery}
                          onChange={e => setNeedsQuery(e.target.value)}
                          placeholder="Search your needs by title, category, or status..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        />
                      </div>
                      <select
                        value={needsSort}
                        onChange={e => setNeedsSort(e.target.value as typeof needsSort)}
                        data-tip="Sort your needs"
                        className="rounded-sm px-3 py-2.5 border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                      >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="urgency">Highest urgency</option>
                        <option value="title">Title (A-Z)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto pb-1">
                      {([
                        ["all", "All"], ["draft", "Draft"], ["open", "Open"], ["in_progress", "In Progress"],
                        ["fulfilled", "Fulfilled"], ["closed", "Closed"], ["reopen_pending", "Reopen Requested"], ["rejected", "Rejected"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setNeedsStatusFilter(value)}
                          data-tip={`Show only ${label.toLowerCase()} needs`}
                          className={`shrink-0 whitespace-nowrap rounded-sm px-3 py-1 text-xs font-semibold transition-colors ${
                            needsStatusFilter === value
                              ? "bg-blue-600 text-white"
                              : "border border-slate-200 dark:border-[#233350] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                  {needs.length === 0 ? (
                    <EmptyState text="No needs created yet." />
                  ) : filteredNeeds.length === 0 ? (
                    <EmptyState text="No needs match your search." />
                  ) : (
                    filteredNeeds.map(need => {
                      const attachments = needAttachments[need.id] || []
                      const canEditOrDelete = ["draft", "open", "in_progress", "rejected"].includes(need.status)
                      const isFinished = need.status === "fulfilled" || need.status === "closed"
                      return (
                      <article
                        key={need.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedNeed(need)}
                        onKeyDown={activateOnKey}
                        data-tip="View the full details of this need"
                        className="cursor-pointer rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-5 space-y-3 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-base">{need.title}</h3>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {need.category} {need.location ? `· ${need.location}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderUrgencyBadge(need.urgency)}
                            <span className="rounded border border-slate-300 dark:border-[#2C3E63] px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600 dark:text-slate-300">
                              {need.status.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>

                        {!isFinished && (
                          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2">
                            {need.description}
                          </p>
                        )}

                        {!isFinished && attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {attachments.map(att => (
                              <a key={att.id} href={att.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="block">
                                {/\.(png|jpe?g|gif|webp)$/i.test(att.file_name || att.url) ? (
                                  <img src={att.url} alt={att.file_name || "Attachment"} className="h-14 w-14 rounded-lg object-cover" />
                                ) : (
                                  <span className="flex items-center justify-center h-14 w-14 rounded-lg text-[10px] font-bold text-blue-600 text-center px-1">📄 {att.file_name?.slice(0, 10) || "File"}</span>
                                )}
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                          {need.status === "draft" && (
                            <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                              <ShieldCheck className="w-3 h-3" />
                              Draft - awaiting administrator approval before public listing
                            </span>
                          )}
                          {need.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 rounded-sm border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 text-xs font-bold text-red-700 dark:text-red-400">
                              <X className="w-3 h-3" />
                              Rejected{need.rejection_reason ? `: ${need.rejection_reason}` : " - edit and it will be reviewed again"}
                            </span>
                          )}
                          {(need.status === "open" || need.status === "in_progress") && (
                            <>
                              <button
                                type="button"
                                onClick={() => setQrNeed({ id: need.id, title: need.title })}
                                data-tip="Get a QR code linking straight to this need - for a flyer or poster"
                                className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                              >
                                <QrCode className="w-3 h-3" /> QR code
                              </button>
                              <button
                                onClick={() => runAction(`${need.id}:close`, () => updateNeedStatus(need, "closed"))}
                                disabled={busyAction?.startsWith(`${need.id}:`)}
                                className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740] disabled:opacity-60"
                              >
                                {busyAction === `${need.id}:close` && <Loader2 className="w-3 h-3 animate-spin" />}
                                Close need
                              </button>
                              <button
                                onClick={() => runAction(`${need.id}:fulfil`, () => updateNeedStatus(need, "fulfilled"))}
                                disabled={busyAction?.startsWith(`${need.id}:`)}
                                className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-60"
                              >
                                {busyAction === `${need.id}:fulfil` && <Loader2 className="w-3 h-3 animate-spin" />}
                                Mark fulfilled
                              </button>
                            </>
                          )}
                          {need.status === "fulfilled" && (
                            <span className="text-xs font-bold text-emerald-700">Need fulfilled</span>
                          )}
                          {need.status === "closed" && (
                            <>
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Need closed</span>
                              <button
                                type="button"
                                onClick={() => { setReopenReason(""); setReopenFiles([]); setReopenNeed(need) }}
                                data-tip="Ask an administrator to reopen this need - you'll need to explain why"
                                className="inline-flex items-center gap-1.5 rounded-sm border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 px-3 py-1.5 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              >
                                <RefreshCw className="w-3 h-3" /> Reopen
                              </button>
                            </>
                          )}
                          {need.status === "reopen_pending" && (
                            <span className="inline-flex items-center gap-1 rounded-sm border border-purple-200 bg-purple-50 dark:bg-purple-950/20 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                              <RefreshCw className="w-3 h-3" />
                              Reopen requested{need.reopen_reason ? `: ${need.reopen_reason}` : " - awaiting administrator approval"}
                            </span>
                          )}
                          {canEditOrDelete && (
                            <button
                              onClick={() => openEditNeed(need)}
                              className="inline-flex items-center gap-1 rounded-sm px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {!isFinished && need.status !== "reopen_pending" && (
                            <button
                              onClick={() => deleteNeed(need.id)}
                              disabled={deletingNeedId === need.id}
                              className="inline-flex items-center gap-1 rounded border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                            >
                              {deletingNeedId === need.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Delete
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

          {/* --- FULFILLMENTS TAB --- */}
          <TabsContent value="fulfillments">
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Fulfillment tracking</CardTitle>
                <CardDescription>Track accepted support through verified completion. Click a row for full details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {fulfillments.length === 0 ? (
                  <EmptyState text="No accepted support to track yet." />
                ) : (
                  fulfillments.map(item => {
                    const display = fulfillmentDisplay(item)
                    return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedFulfillment(item)}
                      onKeyDown={activateOnKey}
                      className="flex w-full cursor-pointer flex-col justify-between gap-3 rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-4 text-left md:flex-row md:items-center hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all"
                    >
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-base">
                          {display.title}
                          {display.isGift && <span className="rounded-sm bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">{display.tag}</span>}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Supporter: {firstOf(item.givers)?.name || "Verified Giver"}
                          {item.notes ? ` · Notes: ${item.notes}` : ""}
                        </p>
                        {item.proof_storage_path && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mt-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Proof verified on file
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-sm bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">
                          {item.status.replace("_", " ")}
                        </span>

                        {item.status === "pending" && memberRole !== "viewer" && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); if (busyAction !== `${item.id}:start`) runAction(`${item.id}:start`, () => handleStartFulfillment(item.id)) }}
                            onKeyDown={activateOnKey}
                            aria-disabled={busyAction === `${item.id}:start`}
                            className="inline-flex items-center gap-1.5 rounded-sm bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 aria-disabled:opacity-60"
                          >
                            {busyAction === `${item.id}:start` && <Loader2 className="w-3 h-3 animate-spin" />}
                            Start Delivery
                          </span>
                        )}

                        {item.status === "in_progress" && memberRole !== "viewer" && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setVerifyingFulfillment(item) }}
                            onKeyDown={activateOnKey}
                            className="rounded-sm bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                          >
                            Verify & Complete
                          </span>
                        )}
                      </div>
                    </div>
                  )})
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- INTERESTS TAB --- */}
          <TabsContent value="interests">
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Giver interests</CardTitle>
                <CardDescription>Review support offers for your needs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {interests.length === 0 ? (
                  <EmptyState text="No giver interests yet." />
                ) : (
                  interests.map(item => {
                    const giver = firstOf(item.givers)
                    const need = firstOf(item.needs)
                    return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedInterest(item)}
                      onKeyDown={activateOnKey}
                      data-tip="View the full details of this expression of interest"
                      className="flex cursor-pointer flex-col justify-between gap-3 rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-4 hover:bg-slate-50 dark:hover:bg-[#1A2740]/40 transition-colors md:flex-row md:items-center"
                    >
                      <div>
                        <p className="font-semibold">{need?.title || "Need"}</p>
                        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <UserAvatar src={giver?.avatar_url} name={giver?.name} className="size-6 text-[10px]" />
                          <span>{giver?.name || "Giver"} · {giver?.email}</span>
                        </p>
                        {item.message && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 italic">"{item.message}"</p>}
                        {item.photos && item.photos.length > 0 && (
                          <div className="flex gap-1.5 mt-2">
                            {item.photos.map(photo => (
                              <a
                                key={photo.id}
                                href={photo.url || undefined}
                                target="_blank"
                                rel="noreferrer"
                                data-tip="Open this photo full-size in a new tab"
                                className="block w-12 h-12 rounded-lg overflow-hidden shrink-0"
                              >
                                {photo.url && <img src={photo.url} alt={photo.file_name || "Attached photo"} className="w-full h-full object-cover" />}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                        <span className="rounded-sm bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">{item.status}</span>
                        {giver && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => setViewingGiver(giver)}
                            onKeyDown={activateOnKey}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-sm px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                          >
                            <Eye className="w-3 h-3" /> Details
                          </span>
                        )}
                        {giver?.profile_id && (
                          <button
                            onClick={() => setMessagingGiver({ id: giver.profile_id!, label: giver.name })}
                            className="inline-flex items-center gap-1 rounded-sm px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                          >
                            <MessageSquare className="w-3 h-3" /> Message
                          </button>
                        )}
                        {item.status === "pending" && (
                          <>
                            <button
                              onClick={() => runAction(`${item.id}:accept`, () => updateInterest(item.id, "accepted"))}
                              disabled={busyAction?.startsWith(`${item.id}:`)}
                              className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {busyAction === `${item.id}:accept` && <Loader2 className="w-3 h-3 animate-spin" />}
                              Accept
                            </button>
                            <button
                              onClick={() => runAction(`${item.id}:decline`, () => updateInterest(item.id, "declined"))}
                              disabled={busyAction?.startsWith(`${item.id}:`)}
                              className="inline-flex items-center gap-1.5 rounded-sm bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {busyAction === `${item.id}:decline` && <Loader2 className="w-3 h-3 animate-spin" />}
                              Decline
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )})
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- DONATIONS TAB (read-only; admin reviews proof of payment) --- */}
          <TabsContent value="donations" className="space-y-4">
            {payfastBanner === "success" && (
              <OutcomeBanner
                variant="success"
                message="We're confirming your PayFast payment now - this can take a few seconds. Refresh if the status below doesn't update right away."
                onDismiss={() => setPayfastBanner(null)}
                detail={bannerDetail}
              />
            )}
            {payfastBanner === "cancelled" && (
              <OutcomeBanner
                variant="unsuccessful"
                message="Your PayFast payment was cancelled or didn't complete - no charge was made. You can try again anytime from Support The Platform."
                onDismiss={() => setPayfastBanner(null)}
              />
            )}
            {paypalBanner === "success" && (
              <OutcomeBanner
                variant="success"
                message="Your PayPal payment was confirmed."
                onDismiss={() => setPaypalBanner(null)}
                detail={bannerDetail}
              />
            )}
            {paypalBanner === "cancelled" && (
              <OutcomeBanner
                variant="unsuccessful"
                message="Your PayPal payment was cancelled or didn't complete - no charge was made. You can try again anytime from Support The Platform."
                onDismiss={() => setPaypalBanner(null)}
              />
            )}
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Monetary donations</CardTitle>
                <CardDescription>Donations toward your needs. Proof of payment is verified by a HelpLift administrator.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {donations.length === 0 ? (
                  <EmptyState text="No monetary donations yet." />
                ) : (
                  donations.map(item => {
                    const donor = firstOf(item.givers)
                    const need = firstOf(item.needs)
                    const gift = firstOf(item.gift_offerings)
                    const displayTitle = need?.title || (gift?.title ? `Gift Library pledge - ${gift.title}` : "General donation")
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDonation({
                          id: item.id,
                          amount: item.amount,
                          payment_method: item.payment_method,
                          status: item.status,
                          reference_code: item.reference_code,
                          created_at: item.created_at,
                          needTitle: displayTitle,
                          giverName: donor?.name,
                          giverEmail: donor?.email,
                          giverProfileId: donor?.profile_id,
                        })}
                        onKeyDown={activateOnKey}
                        className="flex w-full flex-col md:flex-row md:items-center justify-between gap-3 rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-4 text-left hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold text-sm">{displayTitle}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{donor?.name || "Giver"} · Ref: {item.reference_code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{formatCurrency(Number(item.amount))}</span>
                          <span className={`rounded-sm px-3 py-1 text-xs font-bold capitalize ${statusBadgeClasses(item.status)}`}>
                            {item.status}
                          </span>
                          {donor?.profile_id && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setMessagingGiver({ id: donor.profile_id, label: donor.name }) }}
                              className="inline-flex items-center gap-1 rounded-sm px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                            >
                              <MessageSquare className="w-3 h-3" /> Message
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            <Card className="mt-6 border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-600" />
                  Your Platform Donations
                </CardTitle>
                <CardDescription>Donations your organization has made directly to HelpLift. Click one to finish an unpaid EFT or check its status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {platformDonations.length === 0 ? (
                  <EmptyState text="Your organization hasn't donated to the platform yet." />
                ) : (
                  platformDonations.map(item => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={activateOnKey}
                      onClick={() => setSelectedDonation({
                        id: item.id,
                        amount: item.amount,
                        payment_method: item.payment_method,
                        status: item.status,
                        reference_code: item.reference_code,
                        bank_name: item.bank_name,
                        proof_storage_path: item.proof_storage_path,
                        created_at: item.created_at,
                        needTitle: "Support The Platform",
                        is_platform_donation: true,
                      })}
                      className="flex w-full flex-col md:flex-row md:items-center justify-between gap-3 rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-4 text-left hover:border-pink-300 dark:hover:border-pink-800 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div>
                        <p className="font-semibold text-sm">Support The Platform</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Ref: {item.reference_code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{formatCurrency(Number(item.amount))}</span>
                        <span className={`rounded-sm px-3 py-1 text-xs font-bold capitalize ${statusBadgeClasses(item.status)}`}>
                          {item.status === "pending" ? (item.proof_storage_path ? "Pending Verification" : "Awaiting Payment") : item.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- WALLET TAB --- */}
          <TabsContent value="wallet">
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Wallet</CardTitle>
                <CardDescription>Money HelpLift has received on your behalf, and your withdrawal requests.</CardDescription>
              </CardHeader>
              <CardContent>
                <OrganizationWallet memberRole={memberRole} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- MESSAGES TAB --- */}
          <TabsContent value="messages">
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Messages</CardTitle>
                <CardDescription>Direct messages from HelpLift admins and givers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <MessageViewToggle value={messageView} onChange={setMessageView} />
                {messageView === "inbox" && (messages.length === 0 ? (
                  <EmptyState text="No messages yet." />
                ) : (
                  messages.map(item => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openMessage(item)}
                      onKeyDown={activateOnKey}
                      className={`w-full rounded-lg border p-4 text-left cursor-pointer ${item.read_at ? "border-slate-200 dark:border-[#233350]" : "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"}`}
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
                {messageView === "sent" && <SentMessages canReply={memberRole !== "viewer"} />}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- IMPACT STORIES TAB --- */}
          <TabsContent value="stories" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Post an Impact Story
                </CardTitle>
                <CardDescription>Showcase the real difference community support made to inspire further giving.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateStory} className="space-y-4">
                  <input
                    required
                    placeholder="Story Headline (e.g. 50 Learners Equipped with Winter Boots)"
                    value={storyTitle}
                    onChange={e => setStoryTitle(e.target.value)}
                    className="field"
                  />
                  <div className="flex justify-end mb-1">
                    <GrammarCheckButton text={storyContent} onTextChange={setStoryContent} />
                  </div>
                  <div className="relative">
                    <textarea
                      required
                      placeholder="Share the story of what was received, how it helped beneficiaries, and thank supporters..."
                      value={storyContent}
                      onChange={e => setStoryContent(e.target.value)}
                      className="field min-h-28 pr-11"
                    />
                    <MicButton className="top-2 right-2" onText={text => setStoryContent(c => appendSpeech(c, text))} />
                  </div>
                  <input
                    placeholder="Author Title (e.g. Sarah M., Centre Director)"
                    value={storyRole}
                    onChange={e => setStoryRole(e.target.value)}
                    className="field"
                  />

                  <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-300 dark:border-[#2C3E63] cursor-pointer hover:border-blue-500 transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">
                      {storyImages.length === 0
                        ? "Attach story photos (optional, multiple allowed)"
                        : `${storyImages.length} photo${storyImages.length === 1 ? "" : "s"} selected`}
                    </span>
                    <input type="file" accept="image/*" multiple onChange={e => setStoryImages(Array.from(e.target.files || []))} className="sr-only" />
                  </label>
                  {storyImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {storyImages.map((file, index) => (
                        <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-sm bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {file.name}
                          <button aria-label="Remove" type="button" onClick={() => setStoryImages(files => files.filter((_, i) => i !== index))} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Video link (optional - YouTube or Vimeo URL)"
                      value={storyVideoUrlInput}
                      onChange={e => setStoryVideoUrlInput(e.target.value)}
                      className="field"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!storyVideoUrlInput.trim()) return
                        setStoryVideoUrls(urls => [...urls, storyVideoUrlInput.trim()])
                        setStoryVideoUrlInput("")
                      }}
                      className="shrink-0 rounded-sm px-4 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                    >
                      Add
                    </button>
                  </div>
                  {storyVideoUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {storyVideoUrls.map((url, index) => (
                        <span key={`${url}-${index}`} className="inline-flex items-center gap-1.5 rounded-sm bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 max-w-xs">
                          <span className="truncate">{url}</span>
                          <button aria-label="Remove" type="button" onClick={() => setStoryVideoUrls(urls => urls.filter((_, i) => i !== index))} className="text-slate-400 hover:text-red-500 shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    disabled={isPostingStory}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isPostingStory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publish Impact Story
                  </button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Your Impact Stories ({stories.length})</CardTitle>
                <CardDescription>Visible publicly on your organization profile and HelpLift showcase.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                  {stories.length === 0 ? (
                    <EmptyState text="No impact stories yet." />
                  ) : (
                    stories.map(story => {
                      const photoCount = (story.media || []).filter(m => m.media_type === "image").length
                      const videoCount = (story.media || []).filter(m => m.media_type === "video").length
                      return (
                      <article key={story.id} className="rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base">{story.title}</h3>
                          {story.status === "pending" && <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-amber-100 text-amber-700">Awaiting admin approval</span>}
                          {story.status === "rejected" && <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-red-100 text-red-700">Rejected</span>}
                          {story.status === "approved" && <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-700">Published</span>}
                          {videoCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-purple-50 text-purple-700">🎥 {videoCount} video{videoCount === 1 ? "" : "s"}</span>}
                          {photoCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-blue-50 text-blue-700">🖼 {photoCount} photo{photoCount === 1 ? "" : "s"}</span>}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-line">{story.content}</p>
                        {story.status === "rejected" && (
                          <p className="text-xs italic text-red-700 dark:text-red-400">
                            An administrator rejected this story{story.rejection_reason ? `: ${story.rejection_reason}` : "."} Edit it and it will be reviewed again.
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-[#233350]">
                          <span>{story.author_role || "Staff"}</span>
                          <span>{new Date(story.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => openEditStory(story)}
                            className="inline-flex items-center gap-1 rounded-sm px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => deleteStory(story.id)}
                            disabled={deletingStoryId === story.id}
                            className="inline-flex items-center gap-1 rounded border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                          >
                            {deletingStoryId === story.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Delete
                          </button>
                        </div>
                      </article>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- GIFT LIBRARY TAB --- */}
          <TabsContent value="gifts" className="space-y-6">
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-purple-600" />
                    Available Gift Library Offerings ({availableGifts.length})
                  </CardTitle>
                  <CardDescription>Browse proactive pledges from community donors and claim items needed for your mission.</CardDescription>
                </div>
                <ViewToggle view={availableGiftsView} onChange={setAvailableGiftsView} />
              </CardHeader>
              <CardContent>
                <div className={`grid gap-4 ${availableGiftsView === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                  {availableGifts.length === 0 ? (
                    <div className="col-span-full">
                      <EmptyState text="No unallocated gift offerings available at the moment." />
                    </div>
                  ) : (
                    availableGifts.map(gift => (
                      <div
                        key={gift.id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={activateOnKey}
                        onClick={() => setSelectedGift({
                          id: gift.id,
                          title: gift.title,
                          offering_type: gift.offering_type,
                          description: gift.description,
                          quantity_or_value: gift.quantity_or_value,
                          conditions: gift.conditions,
                          location: gift.location,
                          expiry_date: gift.expiry_date,
                          status: gift.status,
                          created_at: gift.created_at,
                          giverName: gift.givers?.name,
                          giverEmail: gift.givers?.email,
                          myClaimPending: gift.my_claim_pending,
                          photos: gift.photos,
                        })}
                        className="text-left rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-4 flex flex-col justify-between space-y-3 hover:border-purple-300 dark:hover:border-purple-800 hover:shadow-sm transition-all"
                      >
                        <div className="space-y-1.5">
                          {gift.photos && gift.photos.length > 0 && gift.photos[0].url && (
                            <img
                              src={gift.photos[0].url}
                              alt={gift.title}
                              className="w-full h-28 object-cover rounded-sm mb-1"
                            />
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-purple-50 text-purple-700 capitalize">
                              {gift.offering_type}
                            </span>
                            {gift.location && <span className="text-[11px] text-slate-400">{gift.location}</span>}
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">{gift.title}</h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{gift.description}</p>
                        </div>
                        {gift.my_claim_pending ? (
                          <span className="text-xs font-bold text-amber-600">Your claim is awaiting a decision →</span>
                        ) : (
                          <span className="text-xs font-bold text-purple-600">View details & claim →</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Your Claim Requests</CardTitle>
                <CardDescription>Claims you've made are finalized once a HelpLift administrator approves them.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {claimedGifts.length === 0 ? (
                  <EmptyState text="You haven't claimed any gift offerings yet." />
                ) : (
                  claimedGifts.map(claim => (
                    <div key={claim.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-4">
                      <div>
                        <p className="font-semibold text-sm">{claim.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{claim.description}</p>
                        {claim.status === "rejected" && claim.claim_notes && <p className="text-xs text-red-600 dark:text-red-400 italic mt-0.5">Admin note: {claim.claim_notes}</p>}
                      </div>
                      <span className={`shrink-0 rounded-sm px-3 py-1 text-xs font-bold capitalize ${
                        claim.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                        claim.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {claim.status === "pending" ? "Awaiting admin approval" : claim.status === "approved" ? "Claimed" : "Declined"}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- DOCUMENTS TAB --- */}
          <TabsContent value="documents" className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-6">
            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Uploaded documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documents.length === 0 ? (
                    <EmptyState text="No documents uploaded yet." />
                  ) : (
                    documents.map(document => (
                      <div key={document.id} className="flex items-center justify-between gap-4 rounded border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#111a2e] p-4">
                        {document.signed_url ? (
                          <a
                            href={document.signed_url}
                            target="_blank"
                            rel="noreferrer"
                            data-tip="Open this document in a new tab"
                            className="flex items-center gap-3 text-sm font-semibold truncate text-blue-600 hover:underline"
                          >
                            <FileText className="h-5 w-5 shrink-0" />
                            <span className="truncate">{document.file_name}</span>
                          </a>
                        ) : (
                          <span className="flex items-center gap-3 text-sm font-semibold truncate">
                            <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                            <span className="truncate">{document.file_name}</span>
                          </span>
                        )}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{document.document_type.replace(/_/g, " ")}</span>
                          {memberRole === "owner" && (
                            <button
                              type="button"
                              onClick={() => setDeletingDoc({ id: document.id, file_name: document.file_name })}
                              aria-label={`Delete ${document.file_name}`}
                              data-tip="Delete this document"
                              className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-blue-600" /> Certificate of Compliance</CardTitle>
                <CardDescription>
                  {organization?.verification_status === "approved"
                    ? "A downloadable PDF confirming your organization is verified and compliant with HelpLift, with today's date and your organization's details - useful to share with funders or partners."
                    : "Available once your organization is verified by HelpLift."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  disabled={organization?.verification_status !== "approved"}
                  asChild={organization?.verification_status === "approved"}
                  data-tip={organization?.verification_status === "approved" ? "Opens a PDF certifying your verification status, dated today" : "Only available once your organization is verified"}
                  className="w-full"
                >
                  {organization?.verification_status === "approved" ? (
                    <a href="/api/organization/compliance-certificate" target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" /> Download certificate
                    </a>
                  ) : (
                    <span><Download className="h-4 w-4" /> Download certificate</span>
                  )}
                </Button>
              </CardContent>
            </Card>
            </div>

            <Card className="border-0 rounded-lg shadow-none">
              <CardHeader>
                <CardTitle>Verification documents</CardTitle>
                <CardDescription>Upload registration or tax evidence for admin review. Maximum 10 MB.</CardDescription>
              </CardHeader>
              <CardContent>
                {memberRole !== "owner" ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Only owners can upload verification documents. You can view the documents your organization has submitted.</p>
                ) : (
                <form onSubmit={uploadDocument} className="space-y-4">
                  <div>
                    <Label htmlFor="org-doc-type">Document type</Label>
                    <select
                      id="org-doc-type"
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value)}
                      className="mt-1 w-full rounded-sm border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="registration_certificate">NPO / NGO Registration Certificate</option>
                      <option value="tax_exemption">SARS Section 18A / Tax Exemption</option>
                      <option value="founding_document">Constitution / Trust Deed</option>
                      <option value="proof_of_banking">Proof of Banking Details (bank letter / statement)</option>
                      <option value="supporting_document">Other Verification Document</option>
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 dark:border-[#2C3E63] p-5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-500">
                    <UploadCloud className="h-5 w-5 text-blue-600" />
                    <span className="truncate">
                      {selectedFiles.length === 0
                        ? "Choose one or more documents"
                        : selectedFiles.length === 1
                        ? selectedFiles[0].name
                        : `${selectedFiles.length} documents selected`}
                    </span>
                    <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={event => setSelectedFiles(Array.from(event.target.files || []))} className="sr-only" />
                  </label>
                  <button disabled={isUploading || selectedFiles.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {selectedFiles.length > 1 ? `Upload ${selectedFiles.length} documents` : "Upload document"}
                  </button>
                </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {memberRole === "owner" && (
            <TabsContent value="team">
              <OrganizationTeam />
            </TabsContent>
          )}
          </fieldset>

          <TabsContent value="analytics">
            <OrganizationAnalytics needs={needs} donations={donations} interests={interests} fulfillments={fulfillments} />
          </TabsContent>
        </Tabs>

        {/* --- BADGES --- */}
        <Dialog open={showBadges} onOpenChange={setShowBadges}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogTitle className="sr-only">Badges</DialogTitle>
            <BadgesPanel endpoint="/api/organization/badges" />
          </DialogContent>
        </Dialog>

        {/* --- QR CODE --- */}
        {organization && (
          <OrganizationQrCodeDialog
            open={showQrCode}
            onOpenChange={setShowQrCode}
            organizationId={organization.id}
            organizationName={organization.name}
          />
        )}

        {/* --- QR CODE FOR ONE NEED --- */}
        {qrNeed && (
          <NeedQrCodeDialog
            open={!!qrNeed}
            onOpenChange={(open) => !open && setQrNeed(null)}
            needId={qrNeed.id}
            needTitle={qrNeed.title}
          />
        )}

        {/* --- NEED DETAILS DIALOG --- */}
        <Dialog open={!!selectedNeed} onOpenChange={(open) => !open && setSelectedNeed(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Need Details</DialogTitle>
            </DialogHeader>
            {selectedNeed && (() => {
              const need = selectedNeed
              const attachments = needAttachments[need.id] || []
              const canEditOrDelete = ["draft", "open", "in_progress", "rejected"].includes(need.status)
              const isFinished = need.status === "fulfilled" || need.status === "closed"
              return (
                <div className="space-y-4 pt-2">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold text-base">{need.title}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {renderUrgencyBadge(need.urgency)}
                      <span className="rounded border border-slate-300 dark:border-[#2C3E63] px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600 dark:text-slate-300">
                        {need.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {need.category} {need.location ? `· ${need.location}` : ""} · Posted {new Date(need.created_at).toLocaleDateString()}
                  </p>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description</p>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">{need.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {need.quantity && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quantity</p>
                        <p className="font-semibold">{need.quantity}</p>
                      </div>
                    )}
                    {need.target_amount != null && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Target amount</p>
                        <p className="font-semibold">{formatCurrency(Number(need.target_amount))}</p>
                      </div>
                    )}
                    {need.due_date && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Due date</p>
                        <p className="font-semibold">{new Date(need.due_date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  {attachments.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {attachments.map(att => (
                          <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="block">
                            {/\.(png|jpe?g|gif|webp)$/i.test(att.file_name || att.url) ? (
                              <img src={att.url} alt={att.file_name || "Attachment"} className="h-16 w-16 rounded-lg object-cover" />
                            ) : (
                              <span className="flex items-center justify-center h-16 w-16 rounded-lg text-[10px] font-bold text-blue-600 text-center px-1">📄 {att.file_name?.slice(0, 10) || "File"}</span>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {need.status === "rejected" && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded p-3">
                      {need.rejection_reason ? `Rejected: ${need.rejection_reason}` : "Rejected - edit and it will be reviewed again"}
                    </p>
                  )}
                  {need.status === "draft" && (
                    <p className="text-xs font-semibold text-amber-700 bg-amber-50 rounded p-3">Draft - awaiting administrator approval before public listing</p>
                  )}
                  {isFinished && (
                    <p className={`text-xs font-semibold ${need.status === "fulfilled" ? "text-emerald-700" : "text-slate-500 dark:text-slate-400"}`}>
                      {need.status === "fulfilled" ? "Need fulfilled" : "Need closed"}
                    </p>
                  )}
                  {need.status === "reopen_pending" && (
                    <p className="flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 rounded p-3">
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      Reopen requested - awaiting administrator approval{need.reopen_reason ? `: ${need.reopen_reason}` : ""}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {(need.status === "open" || need.status === "in_progress") && (
                      <>
                        <Button type="button" variant="outline" onClick={() => setQrNeed({ id: need.id, title: need.title })}>
                          <QrCode className="w-4 h-4" /> QR code
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { const n = need; setSelectedNeed(null); runAction(`${n.id}:close`, () => updateNeedStatus(n, "closed")) }}
                        >
                          Close need
                        </Button>
                        <Button
                          type="button"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => { const n = need; setSelectedNeed(null); runAction(`${n.id}:fulfil`, () => updateNeedStatus(n, "fulfilled")) }}
                        >
                          Mark fulfilled
                        </Button>
                      </>
                    )}
                    {need.status === "closed" && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950/30"
                        onClick={() => { const n = need; setSelectedNeed(null); setReopenReason(""); setReopenFiles([]); setReopenNeed(n) }}
                      >
                        <RefreshCw className="w-4 h-4" /> Reopen
                      </Button>
                    )}
                    {canEditOrDelete && (
                      <Button type="button" variant="outline" onClick={() => { const n = need; setSelectedNeed(null); openEditNeed(n) }}>
                        <Pencil className="w-4 h-4" /> Edit
                      </Button>
                    )}
                    {!isFinished && need.status !== "reopen_pending" && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                        onClick={() => { const n = need; setSelectedNeed(null); deleteNeed(n.id) }}
                      >
                        <X className="w-4 h-4" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>

        <Dialog open={!!reopenNeed} onOpenChange={open => !open && !isSubmittingReopen && setReopenNeed(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request to reopen this need</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This need will go back to an administrator for approval before it's publicly open again.
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Why do you want to reopen this need? <span className="text-red-500">*</span>
                  </label>
                  <GrammarCheckButton text={reopenReason} onTextChange={setReopenReason} />
                </div>
                <div className="relative">
                  <textarea
                    required
                    rows={4}
                    value={reopenReason}
                    onChange={e => setReopenReason(e.target.value)}
                    placeholder="Explain why this need should be reopened..."
                    className="w-full min-h-20 p-3 pr-11 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] rounded-2xl text-sm outline-none focus:border-blue-500"
                  />
                  <MicButton className="top-2 right-2" onText={text => setReopenReason(r => appendSpeech(r, text))} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Supporting photos or documents (optional)</label>
                {reopenFiles.length > 0 && (
                  <ul className="space-y-1.5">
                    {reopenFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#233350] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setReopenFiles(files => files.filter((_, i) => i !== index))}
                          aria-label={`Remove ${file.name}`}
                          data-tip="Remove this file"
                          className="text-slate-400 hover:text-red-600 shrink-0 font-bold px-1"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label
                  data-tip="You can attach multiple files - select several at once, or add them one at a time"
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-[#233350] p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <UploadCloud className="w-5 h-5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {reopenFiles.length === 0 ? "Click to attach file(s) - image or PDF" : "Click to attach more files"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => {
                      setReopenFiles(files => [...files, ...Array.from(e.target.files || [])])
                      e.target.value = ""
                    }}
                  />
                </label>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setReopenNeed(null)} disabled={isSubmittingReopen}>Cancel</Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const n = reopenNeed
                    if (!n) return
                    setIsSubmittingReopen(true)
                    try {
                      await requestReopenNeed(n, reopenReason.trim(), reopenFiles)
                      setReopenNeed(null)
                    } finally {
                      setIsSubmittingReopen(false)
                    }
                  }}
                  disabled={isSubmittingReopen || !reopenReason.trim()}
                  data-tip="Send this reopen request to an administrator for approval"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmittingReopen && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit reopen request
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

      </div>

      {/* --- VERIFICATION PROOF MODAL (Item 6) --- */}
      {verifyingFulfillment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#121B2E] rounded-lg p-6 md:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-bold bg-emerald-50 text-emerald-700 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verification Required
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Verify Fulfillment Completion
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Upload notes, photos, and documents (e.g. delivery receipt, photo with beneficiaries) to verify completion.
                </p>
              </div>
              <button aria-label="Close" onClick={() => setVerifyingFulfillment(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyFulfillment} className="space-y-4">
              <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-lg border border-dashed border-slate-300 dark:border-[#2C3E63] cursor-pointer hover:border-emerald-500 transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">
                <UploadCloud className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {proofFiles.length > 0
                    ? `${proofFiles.length} file${proofFiles.length === 1 ? "" : "s"} selected: ${proofFiles.map(f => f.name).join(", ")}`
                    : "Attach photos, receipts, or documents (you can select multiple)"}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  multiple
                  onChange={e => setProofFiles(Array.from(e.target.files || []))}
                  className="sr-only"
                />
              </label>

              <div className="relative">
                <textarea
                  placeholder="Fulfillment completion notes (e.g. 50 blankets handed over to shelter director on Tuesday)..."
                  value={proofNotes}
                  onChange={e => setProofNotes(e.target.value)}
                  className="w-full min-h-24 p-3 pr-11 border border-slate-200 dark:border-[#233350] bg-slate-50 dark:bg-[#1A2740] rounded-lg text-xs outline-none focus:border-emerald-500"
                />
                <MicButton className="top-2 right-2" onText={text => setProofNotes(n => appendSpeech(n, text))} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingFulfillment(null)}
                  className="px-4 py-2 rounded-sm text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProof}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmittingProof ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Verify & Mark Completed</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT NEED DIALOG --- */}
      <Dialog open={!!editingNeed} onOpenChange={open => !open && setEditingNeed(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Need</DialogTitle>
          </DialogHeader>
          {editingNeed && (
            <form onSubmit={saveNeedEdit} className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <input
                required
                placeholder="Need title"
                value={editNeedForm.title}
                onChange={e => setEditNeedForm({ ...editNeedForm, title: e.target.value })}
                className="field"
              />
              <div className="relative">
                <textarea
                  required
                  placeholder="Description"
                  value={editNeedForm.description}
                  onChange={e => setEditNeedForm({ ...editNeedForm, description: e.target.value })}
                  className="field min-h-24 pr-11"
                />
                <MicButton className="top-2 right-2" onText={text => setEditNeedForm(f => ({ ...f, description: appendSpeech(f.description, text) }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  required
                  value={editNeedForm.category}
                  onChange={e => setEditNeedForm({ ...editNeedForm, category: e.target.value })}
                  className="field text-slate-500 dark:text-slate-400"
                >
                  {needCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  value={editNeedForm.urgency}
                  onChange={e => setEditNeedForm({ ...editNeedForm, urgency: e.target.value })}
                  className="field text-slate-500 dark:text-slate-400"
                >
                  <option value="medium">Medium Urgency</option>
                  <option value="high">High / Critical Urgency</option>
                  <option value="low">Standard / Low</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Location"
                  value={editNeedForm.location}
                  onChange={e => setEditNeedForm({ ...editNeedForm, location: e.target.value })}
                  className="field"
                />
                <input
                  placeholder="Quantity"
                  value={editNeedForm.quantity}
                  onChange={e => setEditNeedForm({ ...editNeedForm, quantity: e.target.value })}
                  className="field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <label className="pl-1">Target amount (optional)</label>
                <label className="pl-1">Due date (optional)</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  placeholder="Target Amount (Rands)"
                  value={editNeedForm.target_amount}
                  onChange={e => setEditNeedForm({ ...editNeedForm, target_amount: e.target.value })}
                  className="field"
                />
                <input
                  type="date"
                  data-tip="The date by which this need should ideally be fulfilled"
                  value={editNeedForm.due_date}
                  onChange={e => setEditNeedForm({ ...editNeedForm, due_date: e.target.value })}
                  className="field text-slate-600 dark:text-slate-300"
                />
              </div>
              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingNeed(null)}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isSavingNeedEdit}>
                  {isSavingNeedEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save changes</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* --- EDIT IMPACT STORY DIALOG --- */}
      <Dialog open={!!editingStory} onOpenChange={open => !open && setEditingStory(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Impact Story</DialogTitle>
          </DialogHeader>
          {editingStory && (
            <div className="space-y-5 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <form onSubmit={saveStoryEdit} className="space-y-3">
                <input
                  required
                  placeholder="Story Headline"
                  value={editStoryForm.title}
                  onChange={e => setEditStoryForm({ ...editStoryForm, title: e.target.value })}
                  className="field"
                />
                <div className="relative">
                  <textarea
                    required
                    placeholder="Story content"
                    value={editStoryForm.content}
                    onChange={e => setEditStoryForm({ ...editStoryForm, content: e.target.value })}
                    className="field min-h-28 pr-11"
                  />
                  <MicButton className="top-2 right-2" onText={text => setEditStoryForm(f => ({ ...f, content: appendSpeech(f.content, text) }))} />
                </div>
                <input
                  placeholder="Author Title (e.g. Sarah M., Centre Director)"
                  value={editStoryForm.author_role}
                  onChange={e => setEditStoryForm({ ...editStoryForm, author_role: e.target.value })}
                  className="field"
                />
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isSavingStoryEdit}>
                  {isSavingStoryEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save changes</span>
                </Button>
              </form>

              <div className="space-y-2 border-t border-slate-100 dark:border-[#233350] pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Photos & videos</p>
                {(editingStory.media || []).length === 0 ? (
                  <p className="text-xs text-slate-400">No media attached yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(editingStory.media || []).map(item => (
                      <div key={item.id} className="relative group">
                        {item.media_type === "image" ? (
                          <img src={item.url} alt="" className="h-16 w-16 rounded-sm object-cover" />
                        ) : (
                          <a href={item.url} target="_blank" rel="noreferrer" className="flex h-16 w-16 items-center justify-center rounded-sm text-xl">
                            🎥
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteStoryMedia(item.id)}
                          disabled={deletingStoryMediaId === item.id}
                          className="absolute -top-1.5 -right-1.5 rounded-sm bg-red-600 text-white p-1 shadow disabled:opacity-50"
                        >
                          {deletingStoryMediaId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-300 dark:border-[#2C3E63] cursor-pointer hover:border-blue-500 transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">
                    {editStoryNewImages.length === 0
                      ? "Add photos (multiple allowed)"
                      : `${editStoryNewImages.length} photo${editStoryNewImages.length === 1 ? "" : "s"} selected`}
                  </span>
                  <input type="file" accept="image/*" multiple onChange={e => setEditStoryNewImages(Array.from(e.target.files || []))} className="sr-only" />
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Video link (YouTube or Vimeo URL)"
                    value={editStoryVideoUrlInput}
                    onChange={e => setEditStoryVideoUrlInput(e.target.value)}
                    className="field"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!editStoryVideoUrlInput.trim()) return
                      setEditStoryNewVideoUrls(urls => [...urls, editStoryVideoUrlInput.trim()])
                      setEditStoryVideoUrlInput("")
                    }}
                    className="shrink-0 rounded-sm px-4 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                  >
                    Add
                  </button>
                </div>
                {editStoryNewVideoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editStoryNewVideoUrls.map((url, index) => (
                      <span key={`${url}-${index}`} className="inline-flex items-center gap-1.5 rounded-sm bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 max-w-xs">
                        <span className="truncate">{url}</span>
                        <button aria-label="Remove" type="button" onClick={() => setEditStoryNewVideoUrls(urls => urls.filter((_, i) => i !== index))} className="text-slate-400 hover:text-red-500 shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={addStoryMedia}
                  disabled={isAddingStoryMedia || (editStoryNewImages.length === 0 && editStoryNewVideoUrls.length === 0)}
                >
                  {isAddingStoryMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>Upload to story</span>
                </Button>
              </div>

              <DialogFooter className="pt-1">
                <Button type="button" variant="outline" onClick={() => setEditingStory(null)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- EDIT ORGANIZATION DIALOG --- */}
      <PasskeyPrompt />

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        // Only owners can edit the organization's information; everyone else can still change their own password.
        onEditProfile={memberRole === "owner" ? () => { setIsSettingsOpen(false); setOrgDialogMode("fields"); setIsEditingOrg(true) } : undefined}
        onChangePassword={() => { setIsSettingsOpen(false); setOrgDialogMode("password"); setIsEditingOrg(true) }}
        onDeleteAccount={() => { setIsSettingsOpen(false); setOrgDialogMode("delete"); setIsEditingOrg(true) }}
        emailNotificationsEnabled={emailNotificationsEnabled}
        onToggleEmailNotifications={toggleEmailNotifications}
      />

      <Dialog open={isEditingOrg} onOpenChange={open => !open && closeOrgDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>
              {orgDialogMode === "email" ? "Change Login Email" : orgDialogMode === "password" ? "Change Password" : orgDialogMode === "delete" ? "Delete Account" : "Edit Your Organization"}
            </DialogTitle>
            <button aria-label="Close"
              type="button"
              onClick={closeOrgDialog}
              className="rounded-sm p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>
          {organization && orgDialogMode === "email" && (
            <ChangeEmailFlow
              currentEmail={loginEmail}
              onBack={() => setOrgDialogMode("fields")}
              onUpdated={async (newEmail) => {
                await fetch("/api/organization/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ login_email: newEmail }),
                }).catch(() => {})
                setLoginEmail(newEmail)
                setMessage("Login email updated.")
                closeOrgDialog()
              }}
            />
          )}
          {organization && orgDialogMode === "password" && (
            <ChangePasswordFlow
              onBack={() => setOrgDialogMode("fields")}
              onUpdated={() => { setMessage("Password updated."); closeOrgDialog() }}
            />
          )}
          {organization && orgDialogMode === "delete" && (
            <DeleteAccountFlow onBack={() => setOrgDialogMode("fields")} />
          )}
          {organization && orgDialogMode === "fields" && (
            <form onSubmit={saveOrganizationProfile} className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <Label htmlFor="edit-org-login-email">Login email</Label>
                <div className="flex gap-2">
                  <Input id="edit-org-login-email" defaultValue={loginEmail} readOnly className="bg-slate-100 dark:bg-[#1A2740] text-slate-500 dark:text-slate-400" />
                  <Button type="button" variant="outline" onClick={() => setOrgDialogMode("email")}>Change</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Organization logo</Label>
                <div className="flex items-center gap-3">
                  {(logoFile || organization.logo_url) && (
                    <img
                      src={logoFile ? URL.createObjectURL(logoFile) : organization.logo_url!}
                      alt="Logo preview"
                      className="h-14 w-14 rounded-sm object-cover"
                    />
                  )}
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm border border-dashed border-slate-300 dark:border-[#233350] cursor-pointer hover:border-blue-500 transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="truncate">{logoFile ? logoFile.name : "Upload logo (PNG or JPG)"}</span>
                    <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-org-name">Organization name</Label>
                  <Input id="edit-org-name" name="name" defaultValue={organization.name} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-type">Organization type</Label>
                  <Input id="edit-org-type" name="type" defaultValue={organization.type} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-reg-number">Registration number</Label>
                  <Input id="edit-org-reg-number" name="registration_number" defaultValue={organization.registration_number ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-contact-name">Contact person</Label>
                  <Input id="edit-org-contact-name" name="contact_name" defaultValue={organization.contact_name ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-contact-role">Contact role</Label>
                  <Input id="edit-org-contact-role" name="contact_role" defaultValue={organization.contact_role ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-email">Contact email</Label>
                  <Input id="edit-org-email" name="contact_email" type="email" defaultValue={organization.contact_email} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-phone">Phone number</Label>
                  <Input id="edit-org-phone" name="phone" defaultValue={organization.phone ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-city">City</Label>
                  <Input id="edit-org-city" name="city" defaultValue={organization.city ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-province">Province</Label>
                  <Input id="edit-org-province" name="province" defaultValue={organization.province ?? undefined} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="edit-org-address">Street address</Label>
                  <Input id="edit-org-address" name="address" defaultValue={organization.address ?? undefined} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="edit-org-mission">Mission statement</Label>
                  <div className="relative">
                    <textarea
                      ref={missionRef}
                      id="edit-org-mission"
                      name="mission"
                      defaultValue={organization.mission ?? undefined}
                      className="w-full min-h-20 rounded-sm bg-white dark:bg-[#121B2E] px-3 py-2 pr-11 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <MicButton
                      className="top-2 right-2"
                      onText={text => {
                        if (missionRef.current) missionRef.current.value = appendSpeech(missionRef.current.value, text)
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2 pt-2 border-t border-slate-100 dark:border-[#233350]">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Banking details</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Where donations collected on your behalf are forwarded to you.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-bank-name">Bank name</Label>
                  <Input id="edit-org-bank-name" name="bank_name" defaultValue={organization.bank_name ?? undefined} placeholder="e.g. ABSA Bank" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-bank-holder">Account holder name</Label>
                  <Input id="edit-org-bank-holder" name="bank_account_holder" defaultValue={organization.bank_account_holder ?? undefined} placeholder="Must match your organization's name" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-bank-number">Account number</Label>
                  <Input id="edit-org-bank-number" name="bank_account_number" defaultValue={organization.bank_account_number ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-bank-branch">Branch code</Label>
                  <Input id="edit-org-bank-branch" name="bank_branch_code" defaultValue={organization.bank_branch_code ?? undefined} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-org-bank-type">Account type</Label>
                  <Input id="edit-org-bank-type" name="bank_account_type" defaultValue={organization.bank_account_type ?? undefined} placeholder="e.g. Cheque Account" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verification status ({organization.verification_status.replace(/_/g, " ")}) is managed by HelpLift administrators and can't be changed here.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => setOrgDialogMode("password")} className="w-full">
                Change password
              </Button>
              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={closeOrgDialog}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isSavingOrg}>
                  {isSavingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isSavingOrg ? "Saving..." : "Save changes"}</span>
                </Button>
              </DialogFooter>
              <div className="pt-3 border-t border-slate-100 dark:border-[#233350]">
                <button
                  type="button"
                  onClick={() => setOrgDialogMode("delete")}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Delete my account
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* --- MESSAGE ADMIN / MESSAGE GIVER DIALOGS --- */}
      <MessageComposeDialog
        open={isMessagingAdmin}
        onOpenChange={setIsMessagingAdmin}
        recipientLabel="Admin"
        target="admin"
        onSent={() => setMessage("Message sent to admin.")}
      />
      {messagingGiver && (
        <MessageComposeDialog
          open={!!messagingGiver}
          onOpenChange={(open) => !open && setMessagingGiver(null)}
          recipientLabel={messagingGiver.label}
          recipientId={messagingGiver.id}
          defaultMessage={messagingGiver.defaultMessage}
          onSent={() => setMessage(`Message sent to ${messagingGiver.label}.`)}
        />
      )}

      <MessageDetailDialog
        canReply={memberRole !== "viewer"}
        open={!!selectedMessage}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
        message={selectedMessage}
      />

      {/* --- GIVER DETAILS DIALOG --- */}
      <Dialog open={!!viewingGiver} onOpenChange={(open) => !open && setViewingGiver(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Giver Details</DialogTitle>
          </DialogHeader>
          {viewingGiver && (
            <div className="space-y-3 pt-2 text-sm">
              <UserAvatar src={viewingGiver.avatar_url} name={viewingGiver.name} className="size-16 text-2xl" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Name</p>
                <p className="font-semibold">{viewingGiver.name}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p>
                <p className="font-semibold">{viewingGiver.email}</p>
              </div>
              {viewingGiver.phone && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone</p>
                  <p className="font-semibold">{viewingGiver.phone}</p>
                </div>
              )}
              {viewingGiver.account_type && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Account type</p>
                  <p className="font-semibold capitalize">{viewingGiver.account_type}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- INTEREST DETAILS DIALOG --- */}
      <Dialog open={!!selectedInterest} onOpenChange={(open) => !open && setSelectedInterest(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Interest Details</DialogTitle>
          </DialogHeader>
          {selectedInterest && (() => {
            const giver = firstOf(selectedInterest.givers)
            const need = firstOf(selectedInterest.needs)
            return (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base">{need?.title || "Need"}</h3>
                  <span className="rounded-sm bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">{selectedInterest.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserAvatar src={giver?.avatar_url} name={giver?.name} className="size-10 text-sm" />
                  <div>
                    <p className="text-sm font-semibold">{giver?.name || "Giver"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{giver?.email}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Submitted</p>
                  <p className="text-sm font-semibold">{new Date(selectedInterest.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Message</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{selectedInterest.message ? `"${selectedInterest.message}"` : "No message was included."}</p>
                </div>
                {selectedInterest.photos && selectedInterest.photos.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Attachments ({selectedInterest.photos.length})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedInterest.photos.map(photo => (
                        <a
                          key={photo.id}
                          href={photo.url || undefined}
                          target="_blank"
                          rel="noreferrer"
                          data-tip="Open this photo full-size in a new tab"
                          className="block aspect-square rounded-sm overflow-hidden"
                        >
                          {photo.url && <img src={photo.url} alt={photo.file_name || "Attached photo"} className="w-full h-full object-cover" />}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {giver?.profile_id && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setMessagingGiver({ id: giver.profile_id!, label: giver.name }); setSelectedInterest(null) }}
                    >
                      <MessageSquare className="w-4 h-4" /> Message
                    </Button>
                  )}
                  {selectedInterest.status === "pending" && (
                    <>
                      <Button
                        type="button"
                        onClick={() => { const id = selectedInterest.id; setSelectedInterest(null); runAction(`${id}:accept`, () => updateInterest(id, "accepted")) }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        onClick={() => { const id = selectedInterest.id; setSelectedInterest(null); runAction(`${id}:decline`, () => updateInterest(id, "declined")) }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Decline
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* --- FULFILLMENT DETAIL MODAL --- */}
      <Dialog open={!!selectedFulfillment} onOpenChange={(open) => !open && setSelectedFulfillment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fulfillment Details</DialogTitle>
          </DialogHeader>
          {selectedFulfillment && (() => {
            const display = fulfillmentDisplay(selectedFulfillment)
            const giverInfo = firstOf(selectedFulfillment.givers)
            return (
              <div className="space-y-4 pt-2">
                <div>
                  <h3 className="flex items-center gap-2 font-bold text-lg">
                    {display.title}
                    {display.isGift && <span className="rounded-sm bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">{display.tag}</span>}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Supporter: {giverInfo?.name || "Verified Giver"} · {giverInfo?.email}
                    {giverInfo?.phone ? ` · ${giverInfo.phone}` : ""}
                    {giverInfo?.account_type ? ` · ${giverInfo.account_type}` : ""}
                  </p>
                </div>
                {display.description && <p className="text-sm text-slate-600 dark:text-slate-300">{display.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {!display.isGift && display.tag && <span className="bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1 rounded-lg">{display.tag}</span>}
                  {display.location && <span className="bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1 rounded-lg">📍 {display.location}</span>}
                  {display.quantity && <span className="bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1 rounded-lg">Qty: {display.quantity}</span>}
                  {display.dueDate && <span className="bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1 rounded-lg">Due {display.dueDate}</span>}
                  {display.conditions && <span className="bg-slate-100 dark:bg-[#1A2740] px-2.5 py-1 rounded-lg">Terms: {display.conditions}</span>}
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
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Giver's message</p>
                    <p className="text-sm italic text-slate-600 dark:text-slate-300">"{firstOf(selectedFulfillment.support_interests)?.message}"</p>
                  </div>
                )}
                {selectedFulfillment.notes && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Your notes</p>
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
                              <span className="flex items-center justify-center h-24 rounded-sm text-xs font-bold text-blue-600 hover:underline">📄 {item.fileName || "View file"}</span>
                            ) : item.signedUrl ? (
                              <img src={item.signedUrl} alt={item.fileName || "Delivery proof"} className="rounded-sm h-24 w-full object-cover" />
                            ) : null}
                          </a>
                        ))}
                      </div>
                    ) : proofSignedUrl ? (
                      <a href={proofSignedUrl} target="_blank" rel="noreferrer" className="block">
                        <img src={proofSignedUrl} alt="Delivery proof" className="rounded-sm max-h-64 w-full object-cover" />
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400">Unable to load proof file.</p>
                    )}
                  </div>
                )}
                {memberRole !== "viewer" && (selectedFulfillment.status === "in_progress" || selectedFulfillment.status === "completed") && (
                  <div className="space-y-2 rounded-lg border border-dashed border-slate-300 dark:border-[#233350] p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Add more proof</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Attach extra photos, receipts or documents (images or PDFs, up to 10 MB each). The giver is notified.</p>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={event => setExtraProofFiles(Array.from(event.target.files || []))}
                      className="block w-full text-xs file:mr-3 file:rounded-sm file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700"
                    />
                    {proofUploadNote && (
                      <p className={`text-xs font-semibold ${proofUploadNote.type === "success" ? "text-emerald-600" : "text-red-600"}`}>{proofUploadNote.text}</p>
                    )}
                    <Button type="button" variant="outline" className="w-full" disabled={isUploadingProof || extraProofFiles.length === 0} onClick={uploadMoreProof}>
                      {isUploadingProof ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                      {extraProofFiles.length > 1 ? `Upload ${extraProofFiles.length} files` : "Upload file"}
                    </Button>
                  </div>
                )}
                {giverInfo?.profile_id && memberRole !== "viewer" && selectedFulfillment.status === "completed" && (
                  <Button
                    type="button"
                    variant="outline"
                    data-tip="Send a pre-filled thank-you message, like the one for monetary donations"
                    className="w-full"
                    onClick={() => setMessagingGiver({
                      id: giverInfo.profile_id,
                      label: giverInfo.name,
                      defaultMessage: `Thank you so much for ${display.isGift ? "your gift" : "your support"} - "${display.title}"! We've received it and really appreciate it.`,
                    })}
                  >
                    <Mail className="w-4 h-4 mr-1.5" /> Thank {giverInfo.name}
                  </Button>
                )}
                {giverInfo?.profile_id && memberRole !== "viewer" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setMessagingGiver({ id: giverInfo.profile_id, label: giverInfo.name })}
                  >
                    <MessageSquare className="w-4 h-4 mr-1.5" /> Message {giverInfo.name}
                  </Button>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* --- DONATION DETAIL MODAL (read-only for donations received; the
          organization's own "Support The Platform" donations additionally
          get the Retry button, via isOwnPayer inside the dialog itself) --- */}
      <DonationDetailDialog
        open={!!selectedDonation}
        onOpenChange={(open) => !open && setSelectedDonation(null)}
        donation={selectedDonation}
        role="organization"
        onChanged={async () => { setSelectedDonation(null); await loadData() }}
        onRetry={handleRetryDonation}
      />

      {/* --- SUPPORT THE PLATFORM MODAL --- */}
      <SupportPlatformDialog
        open={showSupportPlatform}
        onOpenChange={(open) => { setShowSupportPlatform(open); if (!open) setRetryPrefill(null) }}
        onDone={() => setMessage("Thank you! Your proof of payment has been submitted for verification.")}
        initialAmount={retryPrefill?.amount}
        initialMethod={retryPrefill?.method}
      />

      {/* --- GIFT DETAIL / CLAIM MODAL --- */}
      <GiftDetailDialog
        open={!!selectedGift}
        onOpenChange={(open) => !open && setSelectedGift(null)}
        gift={selectedGift}
        role="organization"
        canClaim={memberRole !== "viewer" && organization?.verification_status === "approved"}
        onClaim={async (motivation, documents) => { if (selectedGift) await handleClaimGift(selectedGift.id, motivation, documents) }}
      />

      {/* --- DELETE DOCUMENT CONFIRMATION --- */}
      <AlertDialog open={!!deletingDoc} onOpenChange={open => { if (!open) setDeletingDoc(null); setDeleteDocError("") }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingDoc?.file_name}" will be permanently deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteDocError && (
            <p role="alert" className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm font-semibold text-red-700 dark:text-red-400">
              <XCircle className="h-4 w-4 shrink-0" /> {deleteDocError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDoc}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingDoc}
              onClick={(e) => { e.preventDefault(); deleteDocument() }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeletingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent: "blue" | "emerald" | "amber" | "purple" | "pink" }) {
  const accentClasses = {
    blue: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400",
    purple: "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400",
    pink: "bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400",
  }[accent]

  return (
    <div className="rounded-lg bg-white dark:bg-[#121B2E] p-4 flex items-center gap-3 shadow-sm">
      <div className={`rounded-sm p-2.5 ${accentClasses}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-extrabold leading-none">{value}</p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0B1220]">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </main>
  )
}

function CountBadge({ value }: { value: number }) {
  if (value === 0) return null
  return <span className="ml-0.5 inline-flex items-center justify-center rounded-sm bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">{value}</span>
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 dark:border-[#2C3E63] p-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {text}
    </div>
  )
}
