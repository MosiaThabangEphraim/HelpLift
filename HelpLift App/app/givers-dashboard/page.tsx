"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { showFeedback } from "@/lib/inline-feedback"
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
  BarChart3,
  Image as ImageIcon,
  Heart,
  Star,
  LocateFixed,
  MapPin,
} from "lucide-react"
import { getCurrentPosition, haversineKm, NEAR_ME_RADIUS_KM, reverseGeocodePlaceNames } from "@/lib/geolocation"
import { ViewToggle, type ListView } from "@/components/view-toggle"
import { OutcomeBanner } from "@/components/outcome-banner"
import { createClient } from "@/lib/supabase/client"
import { firstOf } from "@/lib/utils"
import { DonateDialog } from "@/components/donate-dialog"
import { BadgesPanel } from "@/components/badges-panel"
import { ChangeEmailFlow, ChangePasswordFlow, DeleteAccountFlow } from "@/components/account-security"
import { PledgeFinancialDialog } from "@/components/pledge-financial-dialog"
import { DonationDetailDialog, statusBadgeClasses, type DonationSummary } from "@/components/donation-detail-dialog"
import { GiftDetailDialog, type GiftDetailSummary } from "@/components/gift-detail-dialog"
import { formatCurrency } from "@/lib/banking"
import { useNeedCategories } from "@/lib/use-need-categories"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { appendSpeech } from "@/lib/speech-to-text"
import { activateOnKey } from "@/lib/keyboard"
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
import { SupportPlatformDialog } from "@/components/support-platform-dialog"
import { SettingsDialog } from "@/components/settings-dialog"
import { LiveClock } from "@/components/live-clock"
import { PasskeyPrompt } from "@/components/passkey-prompt"
import { useNotificationAlerts } from "@/hooks/use-notification-alerts"
import { GiverAnalytics } from "@/components/analytics/giver-analytics"
import { UserAvatar } from "@/components/user-avatar"
import { MessageViewToggle, SentMessages } from "@/components/sent-messages"

type Giver = { id: string; name: string; email: string; phone: string | null; account_type: string; preferred_categories: string[] | null; preferred_locations: string[] | null; avatar_url?: string | null; spotlight_opt_out?: boolean }
type Need = {
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
  urgency?: "low" | "medium" | "high" | string
  status?: string
  organizations: { id?: string; name: string; verification_status: string; profile_id?: string; city?: string | null; province?: string | null }[] | { id?: string; name: string; verification_status: string; profile_id?: string; city?: string | null; province?: string | null } | null
}
type Interest = { id: string; status: string; message: string | null; created_at: string; needs: { title: string; organizations: { name: string; profile_id: string | null }[] | { name: string; profile_id: string | null } | null }[] | { title: string; organizations: { name: string; profile_id: string | null }[] | { name: string; profile_id: string | null } | null } | null; photos?: { id: string; file_name: string | null; url: string | null }[] }
type FulfillmentOrg = { name: string; profile_id?: string; phone?: string | null; contact_email?: string | null }
type FulfillmentNeed = { title: string; description: string; category: string; location: string | null; quantity: string | null; due_date: string | null; organizations: FulfillmentOrg[] | FulfillmentOrg | null }
type FulfillmentInterest = { message: string | null; needs: FulfillmentNeed[] | FulfillmentNeed | null }
type FulfillmentGift = { title: string; description: string; offering_type: string; quantity_or_value: string | null; location: string | null; conditions: string | null }
type Fulfillment = {
  id: string
  status: string
  notes: string | null
  proof_storage_path?: string | null
  proof_notes?: string | null
  completed_at?: string | null
  created_at: string
  support_interests: FulfillmentInterest[] | FulfillmentInterest | null
  gift_offerings: FulfillmentGift[] | FulfillmentGift | null
  organizations: FulfillmentOrg[] | FulfillmentOrg | null
}

// A fulfillment tracks delivery for either an accepted Need interest or an
// approved Gift Library claim - this normalizes either shape into one object
// the list/detail views can render without caring which source it came from.
function fulfillmentDisplay(item: Fulfillment) {
  const need = firstOf(firstOf(item.support_interests)?.needs)
  if (need) {
    return { title: need.title, description: need.description, tag: need.category, location: need.location, quantity: need.quantity, dueDate: need.due_date, conditions: null as string | null, isGift: false, org: firstOf(need.organizations) }
  }
  const gift = firstOf(item.gift_offerings)
  if (gift) {
    return { title: gift.title, description: gift.description, tag: `Gift · ${gift.offering_type}`, location: gift.location, quantity: gift.quantity_or_value, dueDate: null, conditions: gift.conditions, isGift: true, org: firstOf(item.organizations) }
  }
  return { title: "Community Need", description: "", tag: null, location: null, quantity: null, dueDate: null, conditions: null as string | null, isGift: false, org: firstOf(item.organizations) }
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
  is_platform_donation?: boolean
  need_id: string | null
  gift_offering_id: string | null
}
type MyGift = {
  id: string
  title: string
  offering_type: string
  description: string
  quantity_or_value?: string | null
  conditions?: string | null
  location?: string | null
  expiry_date?: string | null
  status: string
  rejection_reason?: string | null
  created_at: string
  organizations?: { name: string }[] | { name: string } | null
  photos?: { id: string; file_name: string | null; url: string | null }[]
}

export default function GiverDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const needCategories = useNeedCategories()

  const [giver, setGiver] = useState<Giver | null>(null)
  // Whether this account gets emails for its in-app notifications (see
  // profiles.email_notifications_enabled) - lives on profiles, not givers,
  // since it applies to every role the same way (settings-dialog.tsx).
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  // Whether a correct password alone signs this account in, or an emailed
  // code is also required (profiles.two_factor_enabled, checked in api/login).
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true)
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
  // Prefill for whichever donation dialog "Retry" opens - shared across all
  // three, since only one is ever open at a time. Cleared whenever any of
  // them closes so a later normal (non-retry) open doesn't inherit it.
  const [retryPrefill, setRetryPrefill] = useState<{ amount: number; method: "eft" | "payfast" | "paypal"; purpose?: string } | null>(null)
  // Retrying a need-based donation only has an id/title to work with (unlike
  // donatingNeed, which carries a need's full details from the Browse Needs
  // list) - kept separate so DonateDialog's own `need` prop type doesn't
  // need widening just for this.
  const [retryNeedTarget, setRetryNeedTarget] = useState<{ id: string; title: string } | null>(null)
  // "message" doubles as the controlled value of the "express interest" note
  // textarea further down (its onChange/mic-input calls setMessage directly) -
  // every OTHER setMessage(...)/setError(...) call in this file is a one-off
  // confirmation, redirected to the shared inline-feedback bubble instead of
  // the old top-of-page banner, so it shows up next to whatever button the
  // person actually clicked. setError is now just a thin alias for that; kept
  // under its original name so none of its call sites below need to change.
  const [message, setMessage] = useState("")
  const setError = (text: string) => showFeedback(text, "error")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState("needs")
  const [payfastBanner, setPayfastBanner] = useState<"success" | "cancelled" | null>(null)
  const [paypalBanner, setPaypalBanner] = useState<"success" | "cancelled" | null>(null)
  // Which donation the PayFast/PayPal return banner is about, once its id is
  // known - looked up in the already-loaded donations list once it arrives,
  // to show real amount/reference/date on the popup rather than nothing.
  const [bannerDonationId, setBannerDonationId] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Notification | null>(null)
  const [messageView, setMessageView] = useState<"inbox" | "sent">("inbox")

  // Gift Pledge Modal state
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showFinancialPledge, setShowFinancialPledge] = useState(false)
  const [showSupportPlatform, setShowSupportPlatform] = useState(false)
  const [giftForm, setGiftForm] = useState({
    title: "",
    offering_type: "goods",
    description: "",
    quantity_or_value: "",
    conditions: "",
    location: "",
    expiry_date: ""
  })
  const [giftPhotos, setGiftPhotos] = useState<File[]>([])
  const [interestPhotos, setInterestPhotos] = useState<File[]>([])
  const [isSubmittingGift, setIsSubmittingGift] = useState(false)

  // Settings window: opens the edit-profile / delete-account screens below
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showBadges, setShowBadges] = useState(false)

  // Edit Profile Dialog state
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileDialogMode, setProfileDialogMode] = useState<"fields" | "email" | "password" | "delete">("fields")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)
  const [avatarNote, setAvatarNote] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Message Admin dialog
  const [isMessagingAdmin, setIsMessagingAdmin] = useState(false)
  const [messagingOrg, setMessagingOrg] = useState<{ id: string; label: string } | null>(null)
  const [selectedInterest, setSelectedInterest] = useState<Interest | null>(null)

  // Fulfillment detail modal
  const [selectedFulfillment, setSelectedFulfillment] = useState<Fulfillment | null>(null)
  const [selectedMyGift, setSelectedMyGift] = useState<MyGift | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const runAction = async (key: string, fn: () => void | Promise<void>) => {
    setBusyAction(key)
    try { await fn() } finally { setBusyAction(null) }
  }
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null)
  const [proofGallery, setProofGallery] = useState<{ id: string; fileName: string | null; signedUrl: string | null }[]>([])
  const [isLoadingProof, setIsLoadingProof] = useState(false)

  // Open needs search (client-side, over the already-fetched open needs)
  const [needsQuery, setNeedsQuery] = useState("")
  // Recommended-needs mode - see filteredNeeds below.
  const [needsMode, setNeedsMode] = useState<"preferences" | "nearMe" | "both">("preferences")
  const [nearMePlaces, setNearMePlaces] = useState<string[]>([])
  const [nearMeCoords, setNearMeCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isLocatingNeeds, setIsLocatingNeeds] = useState(false)
  const [needsLocationError, setNeedsLocationError] = useState("")
  const [needsView, setNeedsView] = useState<ListView>("grid")
  const [myGiftsView, setMyGiftsView] = useState<ListView>("grid")
  const [detailNeed, setDetailNeed] = useState<Need | null>(null)

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

    // role, email_notifications_enabled and two_factor_enabled fetched
    // together - one round trip instead of three. Falls back to a role-only
    // query (same fallback pattern as givers.avatar_url/spotlight_opt_out
    // below) only in the unlikely case this environment's profiles table
    // predates those columns' migrations.
    let currentProfile: { role: string; email_notifications_enabled?: boolean; two_factor_enabled?: boolean } | null =
      (await supabase.from("profiles").select("role, email_notifications_enabled, two_factor_enabled").eq("id", user.id).single()).data
    if (!currentProfile) {
      currentProfile = (await supabase.from("profiles").select("role").eq("id", user.id).single()).data
    }
    if (currentProfile && currentProfile.role !== "giver") {
      if (currentProfile.role === "admin") return router.replace("/admin-dashboard")
      if (currentProfile.role === "organization") return router.replace("/organisation-dashboard")
      return router.replace("/login")
    }
    setEmailNotificationsEnabled(currentProfile?.email_notifications_enabled ?? true)
    setTwoFactorEnabled(currentProfile?.two_factor_enabled ?? true)

    let { data: giverProfile } = await supabase
      .from("givers")
      .select("id, name, email, phone, account_type, preferred_categories, preferred_locations, avatar_url, spotlight_opt_out")
      .eq("profile_id", user.id)
      .single()
    // avatar_url/spotlight_opt_out only exist once their migrations have been
    // applied; without them the query above fails as a whole, so retry
    // without those columns rather than reporting the giver as missing.
    if (!giverProfile) {
      const retry = await supabase
        .from("givers")
        .select("id, name, email, phone, account_type, preferred_categories, preferred_locations")
        .eq("profile_id", user.id)
        .single()
      giverProfile = retry.data ? { ...retry.data, avatar_url: null, spotlight_opt_out: false } : null
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
        .select("id, title, description, category, location, latitude, longitude, quantity, target_amount, due_date, urgency, status, organizations(id, name, verification_status, profile_id, city, province)")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false }),
      supabase
        .from("support_interests")
        .select("id, status, message, created_at, needs(title, organizations(name, profile_id)), support_interest_photos(id, storage_path, file_name)")
        .eq("giver_id", giverProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("fulfillments")
        .select("id, status, notes, proof_storage_path, proof_notes, completed_at, created_at, support_interests(message, needs(title, description, category, location, quantity, due_date, organizations(name, profile_id, phone, contact_email))), gift_offerings(title, description, offering_type, quantity_or_value, location, conditions), organizations(name, profile_id, phone, contact_email)")
        .eq("giver_id", giverProfile.id)
        .order("created_at", { ascending: false }),
    ])

    setNeeds((openNeeds || []) as unknown as Need[])
    const interestsWithPhotoUrls = await Promise.all((submittedInterests || []).map(async (item: any) => {
      const photos = await Promise.all((item.support_interest_photos || []).map(async (p: any) => {
        const { data: signed } = await supabase.storage.from("support-interest-photos").createSignedUrl(p.storage_path, 3600)
        return { id: p.id, file_name: p.file_name, url: signed?.signedUrl || null }
      }))
      const { support_interest_photos, ...rest } = item
      return { ...rest, photos }
    }))
    setInterests(interestsWithPhotoUrls as unknown as Interest[])
    setFulfillments((giverFulfillments || []) as unknown as Fulfillment[])

    // These three are independent of each other - run together rather than
    // one after another (same fix as the admin/org dashboards' loadData()).
    await Promise.allSettled([
      (async () => {
        const notificationsResponse = await fetch("/api/notifications")
        if (notificationsResponse.ok) setNotifications((await notificationsResponse.json()).notifications || [])
      })(),
      (async () => {
        const giftsRes = await fetch("/api/giver/gifts")
        if (giftsRes.ok) {
          const gData = await giftsRes.json()
          setMyGifts(gData.gifts || [])
        }
      })(),
      (async () => {
        const donationsRes = await fetch("/api/giver/donations")
        if (donationsRes.ok) setDonations((await donationsRes.json()).donations || [])
      })(),
    ])

    setIsLoading(false)
  }

  useEffect(() => { loadData() }, [])

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
    if (tab || payfast || paypal) window.history.replaceState({}, "", "/givers-dashboard")
    // PayFast sent them back without completing checkout - its own success/failure
    // webhook never fires in that case, so without this the donation would sit as
    // "pending" forever. Safe to do from the browser: it can only downgrade this
    // donor's own still-pending donation to "unsuccessful", never approve anything.
    if (payfast === "cancelled" && donationId) {
      fetch(`/api/giver/donations/${donationId}/cancel`, { method: "POST" })
        .then(() => loadData())
        .catch(() => {})
    }
    // Same situation for PayPal, but only when they cancelled on PayPal's own
    // page - that redirect (cancel_url) never touches our server at all,
    // unlike an approved payment which always round-trips through
    // /api/public/paypal/return first and already resolves the donation.
    if (paypal === "cancelled" && donationId) {
      fetch(`/api/giver/donations/${donationId}/cancel`, { method: "POST" })
        .then(() => loadData())
        .catch(() => {})
    }
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

    const formData = new FormData()
    formData.set("need_id", selectedNeed.id)
    formData.set("message", message)
    interestPhotos.forEach(file => formData.append("photos", file))
    const response = await fetch("/api/giver/interests", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      setError((await response.json()).message || "Interest submission failed.")
    } else {
      setSelectedNeed(null)
      setInterestPhotos([])
      showFeedback("Thank you! Your interest has been submitted.")
      await loadData()
    }
    setIsSending(false)
  }

  const handlePledgeGift = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingGift(true)
    setError("")

    try {
      const formData = new FormData()
      Object.entries(giftForm).forEach(([key, value]) => formData.set(key, value))
      giftPhotos.forEach(file => formData.append("photos", file))
      const res = await fetch("/api/giver/gifts", {
        method: "POST",
        body: formData,
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
      setGiftPhotos([])
      showFeedback("Gift offering pledged! It will be listed in the Gift Library once approved by an admin.")
      await loadData()
    } catch (err: any) {
      setError(err.message || "Failed to submit gift.")
    } finally {
      setIsSubmittingGift(false)
    }
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

  // Requests live location for "near me" recommended needs (see
  // lib/geolocation.ts) - triggered whenever the mode switches to one that
  // needs it, so there's no separate "enable" step to find.
  const locateForNeeds = async () => {
    setIsLocatingNeeds(true)
    setNeedsLocationError("")
    try {
      const position = await getCurrentPosition()
      setNearMeCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
      const places = await reverseGeocodePlaceNames(position.coords.latitude, position.coords.longitude)
      if (places.length === 0) throw new Error("Could not determine your area from your location.")
      setNearMePlaces(places)
    } catch (err: any) {
      setNeedsLocationError(err.message || "Could not use your location.")
      setNeedsMode("preferences")
    } finally {
      setIsLocatingNeeds(false)
    }
  }

  const changeNeedsMode = (mode: "preferences" | "nearMe" | "both") => {
    setNeedsMode(mode)
    if (mode !== "preferences" && !nearMeCoords) locateForNeeds()
  }

  // Retrying an unsuccessful donation - opens whichever creation dialog
  // matches what it originally was, prefilled with its amount/method (and
  // purpose, for a Gift Library pledge), so nothing has to be re-typed. This
  // always creates a brand-new donation; the failed one is left as-is.
  const handleRetryDonation = (item: DonationSummary) => {
    const method: "eft" | "payfast" | "paypal" = item.payment_method === "payfast" || item.payment_method === "paypal" ? item.payment_method : "eft"
    setSelectedDonation(null)
    if (item.is_platform_donation) {
      setRetryPrefill({ amount: item.amount, method })
      setShowSupportPlatform(true)
    } else if (item.gift_offering_id) {
      setRetryPrefill({ amount: item.amount, method, purpose: item.needTitle })
      setShowFinancialPledge(true)
    } else if (item.need_id) {
      setRetryPrefill({ amount: item.amount, method })
      setRetryNeedTarget({ id: item.need_id, title: item.needTitle })
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  // Opts out of ever being picked as "Giver of the Month" on the public
  // homepage (see 20260928000200_giver_spotlight_opt_out.sql) - an
  // organization has no equivalent, since its activity is already public
  // everywhere else. Applied optimistically; reverted if the save fails.
  const toggleSpotlightOptOut = async (next: boolean) => {
    setGiver(current => (current ? { ...current, spotlight_opt_out: next } : current))
    const res = await fetch("/api/giver/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotlight_opt_out: next }),
    })
    if (!res.ok) setGiver(current => (current ? { ...current, spotlight_opt_out: !next } : current))
  }

  // Whether emails go out for this account's in-app notifications (see
  // profiles.email_notifications_enabled) - applied optimistically, same
  // pattern as toggleSpotlightOptOut above.
  const toggleEmailNotifications = async (next: boolean) => {
    setEmailNotificationsEnabled(next)
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_notifications_enabled: next }),
    })
    if (!res.ok) setEmailNotificationsEnabled(!next)
  }

  // Whether an emailed code is also required at sign-in (see
  // profiles.two_factor_enabled, checked in api/login) - applied
  // optimistically, same pattern as toggleEmailNotifications above.
  const toggleTwoFactor = async (next: boolean) => {
    setTwoFactorEnabled(next)
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ two_factor_enabled: next }),
    })
    if (!res.ok) setTwoFactorEnabled(!next)
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
      showFeedback("Profile updated.")
      await loadData()
    }
    setIsSavingProfile(false)
  }

  const closeProfileDialog = () => {
    setIsEditingProfile(false)
    setProfileDialogMode("fields")
  }

  // Recommended by default (preference and/or "near me"), not the full public
  // list - the full list is still one click away via "View Public Board".
  // Same matching rules as notify_matching_givers() in the database and the
  // public Browse Needs page; "near me" is lib/geolocation.ts's reverse-geocode
  // + text-match, same as there.
  const hasPreferences = !!(giver?.preferred_categories?.length || giver?.preferred_locations?.length)

  const bannerDonation = bannerDonationId ? donations.find(d => d.id === bannerDonationId) : null
  const bannerDetail = bannerDonation
    ? { amount: bannerDonation.amount, date: new Date(bannerDonation.created_at).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }), reference: bannerDonation.reference_code }
    : undefined

  const filteredNeeds = useMemo(() => {
    const q = needsQuery.trim().toLowerCase()
    return needs.filter(need => {
      const matchesSearch = !q ||
        (need.title || "").toLowerCase().includes(q) ||
        (need.description || "").toLowerCase().includes(q) ||
        (need.category || "").toLowerCase().includes(q) ||
        (need.location || "").toLowerCase().includes(q) ||
        (firstOf(need.organizations)?.name || "").toLowerCase().includes(q)
      if (!matchesSearch) return false

      const org = firstOf(need.organizations)
      const needPlace = [need.location, org?.city, org?.province].filter(Boolean).join(" ").toLowerCase()
      const preferredCategories = giver?.preferred_categories || []
      const preferredLocations = giver?.preferred_locations || []
      const matchesPreferences =
        (preferredCategories.length === 0 || preferredCategories.some(c => c.trim().toLowerCase() === (need.category || "").trim().toLowerCase())) &&
        (preferredLocations.length === 0 || preferredLocations.some(l => l.trim() && needPlace.includes(l.trim().toLowerCase())))
      // Real distance, not place-name text matching (see lib/geolocation.ts) -
      // a need with no coordinates yet (geocoding failed, or it predates
      // this feature and hasn't been edited since) simply can't match "near
      // me", same as while nearMeCoords is still resolving.
      const matchesNearMe =
        !!nearMeCoords && need.latitude != null && need.longitude != null &&
        haversineKm(nearMeCoords.lat, nearMeCoords.lng, need.latitude, need.longitude) <= NEAR_ME_RADIUS_KM

      if (needsMode === "both") return matchesPreferences || matchesNearMe
      if (needsMode === "nearMe") return matchesNearMe
      return matchesPreferences
    })
  }, [needs, needsQuery, giver, needsMode, nearMeCoords])

  // Unlike the other three tiles (all "my own" counts), openNeeds used to be
  // needs.length - every open/in-progress need on the whole platform,
  // regardless of whether it has anything to do with this giver. Recomputed
  // here the same way "Recommended for you" decides what to show by default
  // (matchesPreferences, ignoring the search box and the near-me toggle -
  // those are this render's transient UI state, not something a header stat
  // should shift with), so it reads as "needs open for you" like the rest of
  // this row, not a global platform count.
  const recommendedOpenNeedsCount = useMemo(() => {
    const preferredCategories = giver?.preferred_categories || []
    const preferredLocations = giver?.preferred_locations || []
    return needs.filter(need => {
      const org = firstOf(need.organizations)
      const needPlace = [need.location, org?.city, org?.province].filter(Boolean).join(" ").toLowerCase()
      return (
        (preferredCategories.length === 0 || preferredCategories.some(c => c.trim().toLowerCase() === (need.category || "").trim().toLowerCase())) &&
        (preferredLocations.length === 0 || preferredLocations.some(l => l.trim() && needPlace.includes(l.trim().toLowerCase())))
      )
    }).length
  }, [needs, giver])

  const stats = useMemo(() => ({
    openNeeds: recommendedOpenNeedsCount,
    // Same fix as openNeeds above, same reasoning: these were lifetime
    // totals (every interest/pledge ever submitted, including ones long
    // since resolved), not "still open" counts like Active Fulfillments
    // already was. "Accepted"/"declined" interests and
    // "claimed"/"rejected"/"expired" pledges are done, one way or another -
    // only what's still awaiting a decision or still live on the Gift
    // Library belongs in an at-a-glance header stat.
    myInterests: interests.filter(i => i.status === "pending").length,
    myGifts: myGifts.filter(g => g.status === "pending" || g.status === "approved" || g.status === "pending_claim").length,
    activeFulfillments: fulfillments.filter(f => f.status === "pending" || f.status === "in_progress").length,
  }), [recommendedOpenNeedsCount, interests, myGifts, fulfillments])

  const unreadCount = notifications.filter(n => !n.read_at).length
  const messages = notifications.filter(n => ["admin_message", "org_message", "admin_announcement"].includes(n.type))
  const unreadMessages = messages.filter(m => !m.read_at).length
  const pendingDonations = donations.filter(d => d.status === "pending").length

  const renderUrgencyBadge = (urgency?: string) => {
    const level = (urgency || "medium").toLowerCase()
    if (level === "high") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">
          <Flame className="w-3 h-3 fill-red-600" /> High Urgency
        </span>
      )
    }
    if (level === "medium") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">
          <AlertTriangle className="w-3 h-3" /> Medium
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
        <PackageCheck className="w-3 h-3" /> Standard
      </span>
    )
  }

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0B1220]"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></main>

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1220] text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-[2400px] px-4 md:px-10 py-10 md:py-14 space-y-6">

        <div className="flex justify-end">
          <LiveClock />
        </div>

        {/* --- HEADER --- */}
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <UserAvatar src={giver?.avatar_url} name={giver?.name} className="size-14 text-xl shadow-lg shadow-blue-600/20" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Giver dashboard</p>
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">Welcome, {giver?.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-slate-500 dark:text-slate-400">{giver?.email}</span>
                <span className="inline-flex items-center rounded bg-slate-100 dark:bg-[#1A2740] px-2 py-0.5 text-[11px] font-bold capitalize">
                  {giver?.account_type} Supporter
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ThemeToggle className="h-9 w-9" />
            <FeedbackButton />
            <button
              onClick={() => setShowSupportPlatform(true)}
              data-tip="Donate directly to HelpLift - not to any organization"
              className="inline-flex items-center gap-1.5 rounded border border-pink-200 dark:border-pink-900 bg-pink-50 dark:bg-pink-950/40 px-4 py-2 text-sm font-semibold text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-950/70"
            >
              <Heart className="h-3.5 w-3.5" /> Support The Platform
            </button>

            <Link
              href="/organizations"
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              Organizations
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Notifications"
                  data-tip={unreadCount > 0 ? `Notifications: ${unreadCount} unread. Click to see them.` : "Notifications. You're all caught up."}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740] transition-colors">
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

            <button
              onClick={() => setShowGiftModal(true)}
              className="inline-flex items-center gap-2 rounded bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 shadow-sm shadow-purple-600/20"
            >
              <Gift className="h-4 w-4" /> Pledge a Gift
            </button>

            <button
              onClick={() => setShowBadges(true)}
              data-tip="Your badges and progress toward the next one"
              className="inline-flex items-center gap-1.5 rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/70"
            >
              <Star className="h-3.5 w-3.5" fill="currentColor" /> Badges
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </button>

            <button
              onClick={() => setIsMessagingAdmin(true)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#1A2740]"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Message Admin
            </button>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>

        {/* --- STATS ROW --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={ClipboardList} label="Needs For You" value={stats.openNeeds} accent="blue" />
          <StatCard icon={Users} label="Pending Interests" value={stats.myInterests} accent="emerald" />
          <StatCard icon={Gift} label="Active Gift Pledges" value={stats.myGifts} accent="purple" />
          <StatCard icon={PackageCheck} label="Active Fulfillments" value={stats.activeFulfillments} accent="amber" />
        </div>

        {/* --- TABS --- */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
          <TabsList className="w-full flex-nowrap justify-start overflow-x-auto">
            <TabsTrigger value="needs" className="shrink-0 gap-1.5"><ClipboardList className="w-4 h-4" />Browse Needs</TabsTrigger>
            <TabsTrigger value="interests" className="shrink-0 gap-1.5"><Users className="w-4 h-4" />My Interests</TabsTrigger>
            <TabsTrigger value="gifts" className="shrink-0 gap-1.5"><Gift className="w-4 h-4" />Gift Library</TabsTrigger>
            <TabsTrigger value="fulfillments" className="shrink-0 gap-1.5"><PackageCheck className="w-4 h-4" />Fulfillments<CountBadge value={stats.activeFulfillments} /></TabsTrigger>
            <TabsTrigger value="donations" className="shrink-0 gap-1.5"><Banknote className="w-4 h-4" />My Donations<CountBadge value={pendingDonations} /></TabsTrigger>
            <TabsTrigger value="messages" className="shrink-0 gap-1.5"><Mail className="w-4 h-4" />Messages<CountBadge value={unreadMessages} /></TabsTrigger>
            <TabsTrigger value="analytics" className="shrink-0 gap-1.5"><BarChart3 className="w-4 h-4" />Analytics</TabsTrigger>
          </TabsList>

          {/* --- BROWSE NEEDS TAB --- */}
          <TabsContent value="needs">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Recommended for you</CardTitle>
                  <CardDescription>Needs matching your preferences and/or your current location - not the full public list.</CardDescription>
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
                      className="w-full pl-10 pr-4 py-2.5 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1 rounded border border-slate-200 dark:border-[#233350] p-1">
                    {([
                      { key: "preferences", label: "By preference", tip: "Matches your saved preferred categories and locations (Settings)" },
                      { key: "nearMe", label: "Near me", tip: "Uses your device's live location, just once - it isn't saved" },
                      { key: "both", label: "Both", tip: "Shows a need matching either your preferences or your location" },
                    ] as const).map(option => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => changeNeedsMode(option.key)}
                        aria-pressed={needsMode === option.key}
                        data-tip={option.tip}
                        className={`rounded px-3.5 py-1.5 text-xs font-bold transition-colors ${
                          needsMode === option.key ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                    {isLocatingNeeds && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 mx-1.5" />}
                  </div>
                  <ViewToggle view={needsView} onChange={setNeedsView} />
                </div>
                {needsMode !== "preferences" && needsLocationError && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">{needsLocationError}</p>
                )}
                {needsMode !== "preferences" && nearMePlaces.length > 0 && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <LocateFixed className="w-3.5 h-3.5" /> Showing needs near {nearMePlaces.slice(0, 2).join(", ")}
                  </p>
                )}
                {needsMode !== "nearMe" && hasPreferences && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                    <Star className="w-3.5 h-3.5" />
                    Matching your preferences
                    {giver?.preferred_categories?.length ? ` - categories: ${giver.preferred_categories.join(", ")}` : ""}
                    {giver?.preferred_locations?.length ? `${giver?.preferred_categories?.length ? " ·" : " -"} locations: ${giver.preferred_locations.join(", ")}` : ""}
                  </p>
                )}
                {needsMode !== "nearMe" && !hasPreferences && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Set preferred categories and locations in Settings to get better recommendations "by preference".
                  </p>
                )}

                <div className={`grid gap-4 max-h-[640px] overflow-y-auto pr-1 ${needsView === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                  {needs.length === 0 ? (
                    <div className="md:col-span-2"><EmptyState text="No open needs are available yet." /></div>
                  ) : filteredNeeds.length === 0 ? (
                    <div className="md:col-span-2">
                      <EmptyState
                        text={
                          needsMode === "both"
                            ? "No needs match your preferences or your location right now - view the full Public Board."
                            : needsMode === "nearMe"
                            ? "No needs near you right now - try 'Both', or view the full Public Board."
                            : "No recommended needs right now - try 'Both', or view the full Public Board."
                        }
                      />
                    </div>
                  ) : (
                    filteredNeeds.map(need => {
                      const organization = firstOf(need.organizations)
                      return (
                        <article
                          key={need.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetailNeed(need)}
                          onKeyDown={activateOnKey}
                          className="rounded border border-slate-200 dark:border-[#233350] p-5 space-y-3 cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-bold text-base">{need.title}</h3>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {organization?.id ? (
                                  <Link href={`/organizations/${organization.id}`} target="_blank" onClick={e => e.stopPropagation()} className="font-semibold text-blue-600 hover:underline">
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
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">
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
                                onClick={e => { e.stopPropagation(); setDonatingNeed(need) }}
                                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                              >
                                <Banknote className="h-3.5 w-3.5" /> Donate Money
                              </button>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedNeed(need) }}
                              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                            >
                              <Send className="h-3.5 w-3.5" /> Express interest
                            </button>
                            {organization?.profile_id && (
                              <button
                                onClick={e => { e.stopPropagation(); setMessagingOrg({ id: organization.profile_id!, label: organization.name }) }}
                                className="inline-flex items-center gap-2 rounded border border-slate-200 dark:border-[#233350] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
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
                    <div
                      key={interest.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedInterest(interest)}
                      onKeyDown={activateOnKey}
                      data-tip="View the full details of this expression of interest"
                      className="cursor-pointer rounded border border-slate-200 dark:border-[#233350] p-4 space-y-2 hover:bg-slate-50 dark:hover:bg-[#1A2740]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-sm">{firstOf(interest.needs)?.title || "Need"}</p>
                        <span className={`rounded px-2 py-0.5 text-xs font-bold capitalize ${
                          interest.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300"
                        }`}>
                          {interest.status}
                        </span>
                      </div>
                      {interest.message && <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{interest.message}"</p>}
                      {interest.photos && interest.photos.length > 0 && (
                        <div className="flex gap-1.5">
                          {interest.photos.map(photo => (
                            <a
                              key={photo.id}
                              href={photo.url || undefined}
                              target="_blank"
                              rel="noreferrer"
                              data-tip="Open this photo full-size in a new tab"
                              className="block w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-[#233350] shrink-0"
                            >
                              {photo.url && <img src={photo.url} alt={photo.file_name || "Attached photo"} className="w-full h-full object-cover" />}
                            </a>
                          ))}
                        </div>
                      )}
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
                <div className="flex items-center gap-3 shrink-0">
                  <ViewToggle view={myGiftsView} onChange={setMyGiftsView} />
                  <button
                    onClick={() => setShowGiftModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:underline shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Offering</span>
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`grid gap-4 ${myGiftsView === "grid" ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"}`}>
                  {myGifts.length === 0 ? (
                    <div className="col-span-full">
                      <EmptyState text="You haven't posted any offerings to the Gift Library yet." />
                    </div>
                  ) : (
                    myGifts.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedMyGift(g)}
                        className="text-left rounded border border-slate-200 dark:border-[#233350] p-4 flex flex-col justify-between space-y-2 hover:border-purple-300 dark:hover:border-purple-800 hover:shadow-sm transition-all"
                      >
                        <div>
                          {g.photos && g.photos.length > 0 && g.photos[0].url && (
                            <img
                              src={g.photos[0].url}
                              alt={g.title}
                              className="w-full h-28 object-cover rounded border border-slate-100 dark:border-[#233350] mb-2"
                            />
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 capitalize">
                              {g.offering_type}
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded capitalize ${
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
                      </button>
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
                  fulfillments.map(item => {
                    const display = fulfillmentDisplay(item)
                    return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedFulfillment(item)}
                      className="flex w-full flex-col md:flex-row md:items-center justify-between gap-3 rounded border border-slate-200 dark:border-[#233350] p-4 text-left hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all"
                    >
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-sm">
                          {display.title}
                          {display.isGift && <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">{display.tag}</span>}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.notes || "No notes yet."}</p>
                        {item.proof_storage_path && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-1">
                            <CheckCircle2 className="w-3 h-3" /> Delivery proof attached
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 dark:bg-[#1A2740] px-3 py-1 text-xs font-bold capitalize">
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                    </button>
                  )})
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
                    message="Your PayFast payment was cancelled or didn't complete - no charge was made. You can try again anytime from the need you'd like to support."
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
                    message="Your PayPal payment was cancelled or didn't complete - no charge was made. You can try again anytime from the need you'd like to support."
                    onDismiss={() => setPaypalBanner(null)}
                  />
                )}
                {donations.length === 0 ? (
                  <EmptyState text="You haven't made any monetary donations yet." />
                ) : (
                  donations.map(item => {
                    const needInfo = firstOf(item.needs)
                    const orgName = firstOf(needInfo?.organizations)?.name
                    const giftTitle = firstOf(item.gift_offerings)?.title
                    const displayTitle = item.is_platform_donation ? "Support The Platform" : needInfo?.title || giftTitle || "Gift Library Pledge"
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
                          is_platform_donation: item.is_platform_donation,
                          need_id: item.need_id,
                          gift_offering_id: item.gift_offering_id,
                        })}
                        className="flex w-full flex-col md:flex-row md:items-center justify-between gap-3 rounded border border-slate-200 dark:border-[#233350] p-4 text-left hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all"
                      >
                        <div>
                          <p className="font-semibold text-sm">{displayTitle}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.is_platform_donation ? "HelpLift" : orgName || "General Fund"} · Ref: {item.reference_code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{formatCurrency(Number(item.amount))}</span>
                          <span className={`rounded px-3 py-1 text-xs font-bold capitalize ${statusBadgeClasses(item.status)}`}>
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
                      role="button"
                      tabIndex={0}
                      onClick={() => openMessage(item)}
                      onKeyDown={activateOnKey}
                      className={`w-full rounded border p-4 text-left cursor-pointer ${item.read_at ? "border-slate-200 dark:border-[#233350]" : "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"}`}
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

        {/* --- BADGES --- */}
        <Dialog open={showBadges} onOpenChange={setShowBadges}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogTitle className="sr-only">Badges</DialogTitle>
            <BadgesPanel endpoint="/api/giver/badges" />
          </DialogContent>
        </Dialog>

        {/* --- NEED DETAILS MODAL (opened by clicking a recommended need's card) --- */}
        <Dialog open={!!detailNeed} onOpenChange={(open) => !open && setDetailNeed(null)}>
          <DialogContent className="sm:max-w-lg">
            {detailNeed && (() => {
              const organization = firstOf(detailNeed.organizations)
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 flex-wrap">
                      {detailNeed.title}
                      {renderUrgencyBadge(detailNeed.urgency)}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {organization?.id ? (
                        <Link href={`/organizations/${organization.id}`} target="_blank" className="font-semibold text-blue-600 hover:underline">
                          {organization.name}
                        </Link>
                      ) : (
                        organization?.name || "Verified Organization"
                      )}
                      {" "}· {detailNeed.category}
                      {organization?.verification_status === "approved" && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Verified</span>
                      )}
                    </p>

                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">{detailNeed.description}</p>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {detailNeed.location && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</p>
                          <p className="font-semibold">{detailNeed.location}</p>
                        </div>
                      )}
                      {detailNeed.quantity && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quantity</p>
                          <p className="font-semibold">{detailNeed.quantity}</p>
                        </div>
                      )}
                      {detailNeed.due_date && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Due</p>
                          <p className="font-semibold">{detailNeed.due_date}</p>
                        </div>
                      )}
                      {detailNeed.target_amount != null && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Target</p>
                          <p className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(Number(detailNeed.target_amount))}</p>
                        </div>
                      )}
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                      {detailNeed.target_amount != null && (
                        <Button type="button" onClick={() => { setDonatingNeed(detailNeed); setDetailNeed(null) }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Banknote className="h-4 w-4" /> Donate Money
                        </Button>
                      )}
                      <Button type="button" onClick={() => { setSelectedNeed(detailNeed); setDetailNeed(null) }} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Send className="h-4 w-4" /> Express interest
                      </Button>
                      {organization?.profile_id && (
                        <Button type="button" variant="outline" onClick={() => { setMessagingOrg({ id: organization.profile_id!, label: organization.name }); setDetailNeed(null) }}>
                          <MessageSquare className="h-4 w-4" /> Message Organization
                        </Button>
                      )}
                    </DialogFooter>
                  </div>
                </>
              )
            })()}
          </DialogContent>
        </Dialog>

        {/* --- EXPRESS INTEREST MODAL --- */}
        {selectedNeed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md space-y-5 rounded bg-white dark:bg-[#121B2E] p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold">Express interest</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedNeed.title}</p>
              </div>
              <div className="relative">
                <textarea
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  placeholder="Add a message for the organization (optional)..."
                  className="min-h-28 w-full rounded border border-slate-200 dark:border-[#233350] p-3 pr-11 text-sm outline-none focus:border-blue-500"
                />
                <MicButton className="top-2 right-2" onText={text => setMessage(m => appendSpeech(m, text))} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Photos (optional)
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
                  className="flex flex-col items-center justify-center gap-1.5 rounded border-2 border-dashed border-slate-300 dark:border-[#233350] p-3.5 text-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
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
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setSelectedNeed(null)} className="rounded border border-slate-200 dark:border-[#233350] px-4 py-2 text-xs font-bold">
                  Cancel
                </button>
                <button onClick={submitInterest} disabled={isSending} className="inline-flex items-center gap-2 rounded bg-slate-900 px-5 py-2 text-xs font-bold text-white disabled:opacity-60">
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
            <div className="w-full max-w-lg bg-white dark:bg-[#121B2E] rounded p-6 md:p-8 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold bg-purple-50 text-purple-700 mb-2">
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
                  className="w-full p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded text-xs outline-none focus:border-purple-500"
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
                    className="p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded text-xs font-semibold outline-none focus:border-purple-500"
                  >
                    <option value="goods">Goods / Supplies</option>
                    <option value="services">Professional Service</option>
                    <option value="financial">Financial Assistance</option>
                  </select>
                  <input
                    placeholder="Quantity or Value"
                    value={giftForm.quantity_or_value}
                    onChange={e => setGiftForm({ ...giftForm, quantity_or_value: e.target.value })}
                    className="p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded text-xs outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex justify-end mb-1">
                  <GrammarCheckButton
                    text={giftForm.description}
                    onTextChange={text => setGiftForm(f => ({ ...f, description: text }))}
                  />
                </div>
                <div className="relative">
                  <textarea
                    required
                    placeholder="Detailed description of the offering and condition..."
                    value={giftForm.description}
                    onChange={e => setGiftForm({ ...giftForm, description: e.target.value })}
                    className="w-full min-h-24 p-3 pr-11 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded text-xs outline-none focus:border-purple-500"
                  />
                  <MicButton className="top-2 right-2" onText={text => setGiftForm(f => ({ ...f, description: appendSpeech(f.description, text) }))} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <label className="pl-1">Location (optional)</label>
                  <label className="pl-1">Expiry date (optional)</label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Location / Area"
                    value={giftForm.location}
                    onChange={e => setGiftForm({ ...giftForm, location: e.target.value })}
                    className="p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded text-xs outline-none focus:border-purple-500"
                  />
                  <input
                    type="date"
                    data-tip="The date after which this offering is no longer available"
                    value={giftForm.expiry_date}
                    onChange={e => setGiftForm({ ...giftForm, expiry_date: e.target.value })}
                    className="p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded text-xs outline-none focus:border-purple-500 text-slate-600 dark:text-slate-300"
                  />
                </div>

                <input
                  placeholder="Conditions / Requirements (e.g. Must collect with truck)"
                  value={giftForm.conditions}
                  onChange={e => setGiftForm({ ...giftForm, conditions: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] rounded text-xs outline-none focus:border-purple-500"
                />

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pl-1">Photos (optional)</label>
                  {giftPhotos.length > 0 && (
                    <ul className="space-y-1.5">
                      {giftPhotos.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded bg-slate-50 dark:bg-[#1A2740] border border-slate-200 dark:border-[#233350] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setGiftPhotos(photos => photos.filter((_, i) => i !== index))}
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
                    className="flex flex-col items-center justify-center gap-1.5 rounded border-2 border-dashed border-slate-300 dark:border-[#233350] p-3.5 text-center cursor-pointer hover:border-purple-400 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {giftPhotos.length === 0 ? "Click to attach photo(s) of the item" : "Click to attach more photos"}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        setGiftPhotos(photos => [...photos, ...Array.from(e.target.files || [])])
                        e.target.value = ""
                      }}
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGiftModal(false)}
                    className="px-4 py-2 rounded border border-slate-200 dark:border-[#233350] text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingGift}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 disabled:opacity-50"
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
      <PasskeyPrompt />

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        onEditProfile={() => { setIsSettingsOpen(false); setProfileDialogMode("fields"); setIsEditingProfile(true) }}
        onDeleteAccount={() => { setIsSettingsOpen(false); setProfileDialogMode("delete"); setIsEditingProfile(true) }}
        spotlightOptOut={giver?.spotlight_opt_out ?? false}
        onToggleSpotlightOptOut={toggleSpotlightOptOut}
        emailNotificationsEnabled={emailNotificationsEnabled}
        onToggleEmailNotifications={toggleEmailNotifications}
        twoFactorEnabled={twoFactorEnabled}
        onToggleTwoFactor={toggleTwoFactor}
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
              className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
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
                showFeedback("Email updated.")
                closeProfileDialog()
                await loadData()
              }}
            />
          )}
          {giver && profileDialogMode === "password" && (
            <ChangePasswordFlow
              onBack={() => setProfileDialogMode("fields")}
              onUpdated={() => { showFeedback("Password updated."); closeProfileDialog() }}
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
                    <label className={`inline-flex cursor-pointer items-center rounded border border-slate-200 dark:border-[#233350] px-3.5 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740] ${isUpdatingAvatar ? "pointer-events-none opacity-60" : ""}`}>
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
                  className="w-full rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                  <option value="group">Group</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Preferred support categories</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {needCategories.map(category => (
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
        onSent={() => showFeedback("Message sent to admin.")}
      />

      {/* --- MESSAGE ORGANIZATION DIALOG --- */}
      {messagingOrg && (
        <MessageComposeDialog
          open={!!messagingOrg}
          onOpenChange={(open) => !open && setMessagingOrg(null)}
          recipientLabel={messagingOrg.label}
          recipientId={messagingOrg.id}
          onSent={() => showFeedback(`Message sent to ${messagingOrg.label}.`)}
        />
      )}

      {/* --- INTEREST DETAILS DIALOG --- */}
      <Dialog open={!!selectedInterest} onOpenChange={(open) => !open && setSelectedInterest(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Interest Details</DialogTitle>
          </DialogHeader>
          {selectedInterest && (() => {
            const need = firstOf(selectedInterest.needs)
            const org = need ? firstOf(need.organizations) : null
            return (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base">{need?.title || "Need"}</h3>
                  <span className={`rounded px-3 py-1 text-xs font-bold capitalize ${
                    selectedInterest.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-300"
                  }`}>
                    {selectedInterest.status}
                  </span>
                </div>
                {org?.name && <p className="text-sm text-slate-500 dark:text-slate-400">{org.name}</p>}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Submitted</p>
                  <p className="text-sm font-semibold">{new Date(selectedInterest.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Your message</p>
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
                          className="block aspect-square rounded overflow-hidden border border-slate-200 dark:border-[#233350]"
                        >
                          {photo.url && <img src={photo.url} alt={photo.file_name || "Attached photo"} className="w-full h-full object-cover" />}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {org?.profile_id && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setMessagingOrg({ id: org.profile_id!, label: org.name }); setSelectedInterest(null) }}
                  >
                    <Send className="w-4 h-4" /> Message the organization
                  </Button>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

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
            const display = fulfillmentDisplay(selectedFulfillment)
            return (
              <div className="space-y-4 pt-2">
                <div>
                  <h3 className="flex items-center gap-2 font-bold text-lg">
                    {display.title}
                    {display.isGift && <span className="rounded bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">{display.tag}</span>}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {display.org?.name || "Organization"}{!display.isGift && display.tag ? ` · ${display.tag}` : ""}
                    {display.org?.contact_email ? ` · ${display.org.contact_email}` : ""}
                    {display.org?.phone ? ` · ${display.org.phone}` : ""}
                  </p>
                </div>
                {display.description && <p className="text-sm text-slate-600 dark:text-slate-300">{display.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                {selectedFulfillment.status !== "completed" && selectedFulfillment.status !== "cancelled" && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">The organization marks this as delivered once they've received it - message them below to coordinate.</p>
                )}
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
                              <span className="flex items-center justify-center h-24 rounded border border-slate-200 dark:border-[#233350] text-xs font-bold text-blue-600 hover:underline">📄 {item.fileName || "View file"}</span>
                            ) : item.signedUrl ? (
                              <img src={item.signedUrl} alt={item.fileName || "Delivery proof"} className="rounded h-24 w-full object-cover border border-slate-200 dark:border-[#233350]" />
                            ) : null}
                          </a>
                        ))}
                      </div>
                    ) : proofSignedUrl ? (
                      <a href={proofSignedUrl} target="_blank" rel="noreferrer" className="block">
                        <img src={proofSignedUrl} alt="Delivery proof" className="rounded max-h-64 w-full object-cover border border-slate-200 dark:border-[#233350]" />
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400">Unable to load proof file.</p>
                    )}
                  </div>
                )}
                {display.org?.profile_id && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setMessagingOrg({ id: display.org!.profile_id!, label: display.org?.name || "the organization" })}
                  >
                    <MessageSquare className="w-4 h-4 mr-1.5" /> Message {display.org?.name || "the organization"}
                  </Button>
                )}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* --- DONATE MODAL --- */}
      <DonateDialog
        open={!!donatingNeed || !!retryNeedTarget}
        onOpenChange={(open) => { if (!open) { setDonatingNeed(null); setRetryNeedTarget(null); setRetryPrefill(null) } }}
        need={donatingNeed ? { id: donatingNeed.id, title: donatingNeed.title } : retryNeedTarget}
        onDone={async () => { showFeedback("Thank you! Your proof of payment has been submitted for verification."); await loadData() }}
        initialAmount={retryPrefill?.amount}
        initialMethod={retryPrefill?.method}
      />

      {/* --- FINANCIAL GIFT PLEDGE MODAL --- */}
      <PledgeFinancialDialog
        open={showFinancialPledge}
        onOpenChange={(open) => { setShowFinancialPledge(open); if (!open) setRetryPrefill(null) }}
        onDone={async () => { showFeedback("Thank you! Your proof of payment has been submitted for verification."); await loadData() }}
        initialAmount={retryPrefill?.amount}
        initialMethod={retryPrefill?.method}
        initialPurpose={retryPrefill?.purpose}
      />

      {/* --- SUPPORT THE PLATFORM MODAL --- */}
      <SupportPlatformDialog
        open={showSupportPlatform}
        onOpenChange={(open) => { setShowSupportPlatform(open); if (!open) setRetryPrefill(null) }}
        onDone={async () => { showFeedback("Thank you! Your proof of payment has been submitted for verification."); await loadData() }}
        initialAmount={retryPrefill?.amount}
        initialMethod={retryPrefill?.method}
      />

      {/* --- DONATION DETAIL MODAL --- */}
      <DonationDetailDialog
        open={!!selectedDonation}
        onOpenChange={(open) => !open && setSelectedDonation(null)}
        donation={selectedDonation}
        role="giver"
        onChanged={async () => { setSelectedDonation(null); await loadData() }}
        onRetry={handleRetryDonation}
      />

      {/* --- MY GIFT OFFERING DETAIL MODAL (read-only) --- */}
      <GiftDetailDialog
        open={!!selectedMyGift}
        onOpenChange={(open) => !open && setSelectedMyGift(null)}
        gift={selectedMyGift ? {
          id: selectedMyGift.id,
          title: selectedMyGift.title,
          offering_type: selectedMyGift.offering_type,
          description: selectedMyGift.description,
          quantity_or_value: selectedMyGift.quantity_or_value,
          conditions: selectedMyGift.conditions,
          location: selectedMyGift.location,
          expiry_date: selectedMyGift.expiry_date,
          status: selectedMyGift.status,
          rejection_reason: selectedMyGift.rejection_reason,
          created_at: selectedMyGift.created_at,
          claimedByOrgName: firstOf(selectedMyGift.organizations)?.name,
          photos: selectedMyGift.photos,
        } as GiftDetailSummary : null}
        role="giver"
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
    <div className="rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] p-4 flex items-center gap-3 shadow-sm">
      <div className={`rounded p-2.5 ${accentClasses}`}>
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
  return <span className="ml-0.5 inline-flex items-center justify-center rounded bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">{value}</span>
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded border border-dashed border-slate-300 dark:border-[#233350] p-8 text-center text-sm text-slate-500 dark:text-slate-400">{text}</div>
}
