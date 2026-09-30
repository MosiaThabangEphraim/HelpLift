"use client"

import { useEffect, useState } from "react"
import { Award, Banknote, CheckCircle2, ChevronLeft, ChevronRight, Heart, Loader2, Megaphone, Plus, Tag, Trash2, Trophy, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { showFeedback } from "@/lib/inline-feedback"

type BankAccountRow = {
  id: string
  key: string
  bank_name: string
  account_name: string
  account_number: string
  branch_code: string
  account_type: string
  swift_code: string | null
  is_active: boolean
}
type CategoryRow = { id: string; name: string; is_active: boolean }

// Platform-wide settings an administrator controls without a code change:
// maintenance mode, withdrawal min/max amounts, HelpLift's own bank accounts
// (shown on the donation payment screens) and need categories.
export function PlatformSettingsAdmin() {
  const [isLoading, setIsLoading] = useState(true)
  // A single shared "feedback" slot didn't work well across a settings panel
  // this long - a message about a bank account far down the page rendering
  // at some other fixed spot is the same "too far from the actual button"
  // problem as the old page-level banners. Kept under its original name and
  // {type, text} shape so none of this file's many call sites need to
  // change; it now shows next to whichever control triggered it instead.
  const setFeedback = (fb: { type: "success" | "error"; text: string } | null) => {
    if (fb) showFeedback(fb.text, fb.type)
  }

  // --- Maintenance mode + withdrawal limits ---
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState("")
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false)
  const [withdrawalMin, setWithdrawalMin] = useState("0")
  const [withdrawalMax, setWithdrawalMax] = useState("")
  const [isSavingLimits, setIsSavingLimits] = useState(false)
  const [donationMin, setDonationMin] = useState("0")
  const [donationMax, setDonationMax] = useState("")
  const [isSavingDonationLimits, setIsSavingDonationLimits] = useState(false)
  const [loginBannerEnabled, setLoginBannerEnabled] = useState(false)
  const [loginBannerMessage, setLoginBannerMessage] = useState("")
  const [loginBannerAttachments, setLoginBannerAttachments] = useState<{ path: string; name: string }[]>([])
  const [isSavingLoginBanner, setIsSavingLoginBanner] = useState(false)

  // --- Badge thresholds --- (all kept as strings for the number inputs,
  // parsed to numbers only when saving)
  const [badgeGiver, setBadgeGiver] = useState({
    milestoneBronze: "500", milestoneSilver: "2500", milestoneGold: "10000",
    streakMonths: "3", needsFulfilledMin: "3", categoryChampionMin: "5",
    wellRoundedCategoriesMin: "4", giftLibraryContributorMin: "3",
    platformSupporterMin: "1", reachOrgsMin: "3",
  })
  const [badgeOrg, setBadgeOrg] = useState({
    needsFulfilledBronze: "5", needsFulfilledSilver: "20", needsFulfilledGold: "50",
    fundsRaisedBronze: "5000", fundsRaisedSilver: "25000", fundsRaisedGold: "100000",
    storytellerMin: "3", reliabilityMinRate: "80", reliabilityMinSample: "5",
    responsivenessMaxHours: "48", responsivenessMinSample: "3",
  })
  const [isSavingBadges, setIsSavingBadges] = useState(false)

  // --- Monthly spotlight (Giver / Organization of the Month) override ---
  const [spotlightData, setSpotlightData] = useState<{
    period: string
    periodLabel: string
    giver: { current: { subjectId: string; name: string; metric: number; isOverride: boolean } | null; candidates: { subjectId: string; name: string; metric: number }[] }
    organization: { current: { subjectId: string; name: string; logoUrl: string | null; metric: number; isOverride: boolean } | null; candidates: { subjectId: string; name: string; metric: number; logoUrl?: string | null }[] }
  } | null>(null)
  const [isLoadingSpotlight, setIsLoadingSpotlight] = useState(true)
  const [busySpotlightKey, setBusySpotlightKey] = useState<string | null>(null)

  // --- Bank accounts ---
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([])
  const [newBank, setNewBank] = useState({ bank_name: "", account_name: "", account_number: "", branch_code: "", account_type: "", swift_code: "" })
  const [isAddingBank, setIsAddingBank] = useState(false)
  const [busyBankId, setBusyBankId] = useState<string | null>(null)

  // --- Need categories ---
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const load = async () => {
    const [settingsRes, banksRes, categoriesRes] = await Promise.all([
      fetch("/api/admin/settings"),
      fetch("/api/admin/bank-accounts"),
      fetch("/api/admin/need-categories"),
    ])
    const settings = await settingsRes.json().catch(() => ({}))
    if (settingsRes.ok) {
      setMaintenanceEnabled(!!settings.maintenanceMode?.enabled)
      setMaintenanceMessage(settings.maintenanceMode?.message || "")
      setWithdrawalMin(String(settings.withdrawalLimits?.min ?? 0))
      setWithdrawalMax(settings.withdrawalLimits?.max === null || settings.withdrawalLimits?.max === undefined ? "" : String(settings.withdrawalLimits.max))
      setDonationMin(String(settings.platformDonationLimits?.min ?? 0))
      setDonationMax(settings.platformDonationLimits?.max === null || settings.platformDonationLimits?.max === undefined ? "" : String(settings.platformDonationLimits.max))
      setLoginBannerEnabled(!!settings.loginBanner?.enabled)
      setLoginBannerMessage(settings.loginBanner?.message || "")
      setLoginBannerAttachments(Array.isArray(settings.loginBanner?.attachments) ? settings.loginBanner.attachments : [])
      const g = settings.badgeThresholds?.giver
      const o = settings.badgeThresholds?.organization
      if (g) {
        setBadgeGiver({
          milestoneBronze: String(g.milestoneAmounts?.bronze ?? 500),
          milestoneSilver: String(g.milestoneAmounts?.silver ?? 2500),
          milestoneGold: String(g.milestoneAmounts?.gold ?? 10000),
          streakMonths: String(g.streakMonths ?? 3),
          needsFulfilledMin: String(g.needsFulfilledMin ?? 3),
          categoryChampionMin: String(g.categoryChampionMin ?? 5),
          wellRoundedCategoriesMin: String(g.wellRoundedCategoriesMin ?? 4),
          giftLibraryContributorMin: String(g.giftLibraryContributorMin ?? 3),
          platformSupporterMin: String(g.platformSupporterMin ?? 1),
          reachOrgsMin: String(g.reachOrgsMin ?? 3),
        })
      }
      if (o) {
        setBadgeOrg({
          needsFulfilledBronze: String(o.needsFulfilledAmounts?.bronze ?? 5),
          needsFulfilledSilver: String(o.needsFulfilledAmounts?.silver ?? 20),
          needsFulfilledGold: String(o.needsFulfilledAmounts?.gold ?? 50),
          fundsRaisedBronze: String(o.fundsRaisedAmounts?.bronze ?? 5000),
          fundsRaisedSilver: String(o.fundsRaisedAmounts?.silver ?? 25000),
          fundsRaisedGold: String(o.fundsRaisedAmounts?.gold ?? 100000),
          storytellerMin: String(o.storytellerMin ?? 3),
          reliabilityMinRate: String(o.reliabilityMinRate ?? 80),
          reliabilityMinSample: String(o.reliabilityMinSample ?? 5),
          responsivenessMaxHours: String(o.responsivenessMaxHours ?? 48),
          responsivenessMinSample: String(o.responsivenessMinSample ?? 3),
        })
      }
    }
    const banks = await banksRes.json().catch(() => ({}))
    if (banksRes.ok) setBankAccounts(banks.accounts || [])
    const cats = await categoriesRes.json().catch(() => ({}))
    if (categoriesRes.ok) setCategories(cats.categories || [])
    setIsLoading(false)
  }

  useEffect(() => { load() }, [])

  const loadSpotlight = async (period?: string) => {
    setIsLoadingSpotlight(true)
    const res = await fetch(period ? `/api/admin/spotlights?period=${period}` : "/api/admin/spotlights")
    const data = await res.json().catch(() => null)
    if (res.ok && data) setSpotlightData(data)
    setIsLoadingSpotlight(false)
  }

  useEffect(() => { loadSpotlight() }, [])

  const shiftPeriod = (period: string, delta: number) => {
    const [y, m] = period.split("-").map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }

  const selectSpotlightCandidate = async (subjectType: "giver" | "organization", subjectId: string) => {
    if (!spotlightData) return
    setBusySpotlightKey(`${subjectType}:${subjectId}`)
    setFeedback(null)
    const res = await fetch("/api/admin/spotlights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: spotlightData.period, subject_type: subjectType, subject_id: subjectId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not save this override." })
    else setFeedback({ type: "success", text: "Spotlight updated." })
    await loadSpotlight(spotlightData.period)
    setBusySpotlightKey(null)
  }

  const saveMaintenance = async () => {
    setIsSavingMaintenance(true)
    setFeedback(null)
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "maintenance_mode", value: { enabled: maintenanceEnabled, message: maintenanceMessage } }),
    })
    const data = await res.json().catch(() => ({}))
    setFeedback(res.ok ? { type: "success", text: "Maintenance mode saved." } : { type: "error", text: data.message || "Could not save." })
    setIsSavingMaintenance(false)
  }

  const saveLimits = async () => {
    setIsSavingLimits(true)
    setFeedback(null)
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "withdrawal_limits", value: { min: Number(withdrawalMin), max: withdrawalMax.trim() === "" ? null : Number(withdrawalMax) } }),
    })
    const data = await res.json().catch(() => ({}))
    setFeedback(res.ok ? { type: "success", text: "Withdrawal limits saved." } : { type: "error", text: data.message || "Could not save." })
    setIsSavingLimits(false)
  }

  const saveDonationLimits = async () => {
    setIsSavingDonationLimits(true)
    setFeedback(null)
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "platform_donation_limits", value: { min: Number(donationMin), max: donationMax.trim() === "" ? null : Number(donationMax) } }),
    })
    const data = await res.json().catch(() => ({}))
    setFeedback(res.ok ? { type: "success", text: "Platform donation limits saved." } : { type: "error", text: data.message || "Could not save." })
    setIsSavingDonationLimits(false)
  }

  // Setting/replacing the banner's text now happens via "Send Announcement"
  // (deliver as "Login page banner" or "Both") - this just turns an already-
  // live one back off, keeping its last message around in case it's turned
  // back on the same way later.
  const turnOffLoginBanner = async () => {
    setIsSavingLoginBanner(true)
    setFeedback(null)
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "login_banner", value: { enabled: false, message: loginBannerMessage, attachments: loginBannerAttachments } }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) setLoginBannerEnabled(false)
    setFeedback(res.ok ? { type: "success", text: "Login banner turned off." } : { type: "error", text: data.message || "Could not save." })
    setIsSavingLoginBanner(false)
  }

  const saveBadgeThresholds = async () => {
    setIsSavingBadges(true)
    setFeedback(null)
    const n = (s: string) => Number(s)
    const value = {
      giver: {
        milestoneAmounts: { bronze: n(badgeGiver.milestoneBronze), silver: n(badgeGiver.milestoneSilver), gold: n(badgeGiver.milestoneGold) },
        streakMonths: n(badgeGiver.streakMonths),
        needsFulfilledMin: n(badgeGiver.needsFulfilledMin),
        categoryChampionMin: n(badgeGiver.categoryChampionMin),
        wellRoundedCategoriesMin: n(badgeGiver.wellRoundedCategoriesMin),
        giftLibraryContributorMin: n(badgeGiver.giftLibraryContributorMin),
        platformSupporterMin: n(badgeGiver.platformSupporterMin),
        reachOrgsMin: n(badgeGiver.reachOrgsMin),
      },
      organization: {
        needsFulfilledAmounts: { bronze: n(badgeOrg.needsFulfilledBronze), silver: n(badgeOrg.needsFulfilledSilver), gold: n(badgeOrg.needsFulfilledGold) },
        fundsRaisedAmounts: { bronze: n(badgeOrg.fundsRaisedBronze), silver: n(badgeOrg.fundsRaisedSilver), gold: n(badgeOrg.fundsRaisedGold) },
        storytellerMin: n(badgeOrg.storytellerMin),
        reliabilityMinRate: n(badgeOrg.reliabilityMinRate),
        reliabilityMinSample: n(badgeOrg.reliabilityMinSample),
        responsivenessMaxHours: n(badgeOrg.responsivenessMaxHours),
        responsivenessMinSample: n(badgeOrg.responsivenessMinSample),
      },
    }
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "badge_thresholds", value }),
    })
    const data = await res.json().catch(() => ({}))
    setFeedback(res.ok ? { type: "success", text: "Badge thresholds saved." } : { type: "error", text: data.message || "Could not save." })
    setIsSavingBadges(false)
  }

  const addBankAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingBank(true)
    setFeedback(null)
    const res = await fetch("/api/admin/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBank),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setNewBank({ bank_name: "", account_name: "", account_number: "", branch_code: "", account_type: "", swift_code: "" })
      await load()
    } else {
      setFeedback({ type: "error", text: data.message || "Could not add this account." })
    }
    setIsAddingBank(false)
  }

  const toggleBankActive = async (account: BankAccountRow) => {
    setBusyBankId(account.id)
    setFeedback(null)
    const res = await fetch(`/api/admin/bank-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !account.is_active }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not update this account." })
    await load()
    setBusyBankId(null)
  }

  const deleteBankAccount = async (account: BankAccountRow) => {
    if (!window.confirm(`Delete ${account.bank_name}? This only works if it has never been used for a donation.`)) return
    setBusyBankId(account.id)
    setFeedback(null)
    const res = await fetch(`/api/admin/bank-accounts/${account.id}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not delete this account." })
    await load()
    setBusyBankId(null)
  }

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    setIsAddingCategory(true)
    setFeedback(null)
    const res = await fetch("/api/admin/need-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setNewCategoryName("")
      await load()
    } else {
      setFeedback({ type: "error", text: data.message || "Could not add this category." })
    }
    setIsAddingCategory(false)
  }

  const saveRename = async (category: CategoryRow) => {
    if (!renameValue.trim() || renameValue.trim() === category.name) { setRenamingId(null); return }
    setBusyCategoryId(category.id)
    setFeedback(null)
    const res = await fetch(`/api/admin/need-categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not rename this category." })
    else setFeedback({ type: "success", text: `Renamed - needs already using "${category.name}" were updated too.` })
    setRenamingId(null)
    await load()
    setBusyCategoryId(null)
  }

  const toggleCategoryActive = async (category: CategoryRow) => {
    setBusyCategoryId(category.id)
    setFeedback(null)
    const res = await fetch(`/api/admin/need-categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !category.is_active }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not update this category." })
    await load()
    setBusyCategoryId(null)
  }

  const deleteCategory = async (category: CategoryRow) => {
    if (!window.confirm(`Delete "${category.name}"? This only works if no need uses it.`)) return
    setBusyCategoryId(category.id)
    setFeedback(null)
    const res = await fetch(`/api/admin/need-categories/${category.id}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not delete this category." })
    await load()
    setBusyCategoryId(null)
  }

  const inputClass = "w-full rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
  }

  return (
    <div className="space-y-6">

      {/* --- Maintenance mode --- */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold">Maintenance mode</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          When on, everyone except signed-in administrators is shown a maintenance page instead of the site - useful for planned downtime.
        </p>
        <div className="flex items-center gap-3">
          <Switch
            checked={maintenanceEnabled}
            onCheckedChange={setMaintenanceEnabled}
            aria-label="Maintenance mode"
            data-tip={maintenanceEnabled ? "Turn maintenance mode off - the site becomes visible to everyone again" : "Turn maintenance mode on - blocks the whole site for everyone except signed-in admins"}
          />
          <span className="text-sm font-semibold">{maintenanceEnabled ? "On - the site is blocked for non-admins" : "Off - the site is live"}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="maintenance-message">Message shown to visitors</Label>
            <GrammarCheckButton text={maintenanceMessage} onTextChange={setMaintenanceMessage} />
          </div>
          <textarea
            id="maintenance-message"
            value={maintenanceMessage}
            onChange={e => setMaintenanceMessage(e.target.value)}
            className={`${inputClass} min-h-16`}
            placeholder="HelpLift is undergoing scheduled maintenance. Please check back shortly."
          />
        </div>
        <Button type="button" onClick={saveMaintenance} disabled={isSavingMaintenance} data-tip="Save maintenance mode and this message" className="bg-amber-600 hover:bg-amber-700 text-white">
          {isSavingMaintenance ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Save
        </Button>
      </section>

      {/* --- Login page banner --- */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold">Login page banner</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          A dismissible note shown to everyone who lands on the login page - set (or replaced) from "Send Announcement" (deliver as "Login page banner" or "Both"), not here.
          This just shows its current status and lets you turn an already-live one off.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[#233350] p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{loginBannerEnabled ? "On - shown on the login page" : "Off - nothing shown"}</p>
            {loginBannerEnabled && loginBannerMessage && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">"{loginBannerMessage}"</p>}
            {loginBannerEnabled && loginBannerAttachments.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">{loginBannerAttachments.length} attachment{loginBannerAttachments.length === 1 ? "" : "s"}</p>
            )}
          </div>
          {loginBannerEnabled && (
            <Button type="button" variant="outline" size="sm" onClick={turnOffLoginBanner} disabled={isSavingLoginBanner} className="shrink-0">
              {isSavingLoginBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Turn off
            </Button>
          )}
        </div>
      </section>

      {/* --- Withdrawal limits --- */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold">Withdrawal amounts</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">The minimum and maximum an organization may request in a single withdrawal. Leave maximum blank for no limit.</p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div className="space-y-1">
            <Label htmlFor="withdrawal-min">Minimum (R)</Label>
            <Input id="withdrawal-min" type="number" min="0" step="0.01" value={withdrawalMin} onChange={e => setWithdrawalMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="withdrawal-max">Maximum (R, optional)</Label>
            <Input id="withdrawal-max" type="number" min="0" step="0.01" value={withdrawalMax} onChange={e => setWithdrawalMax(e.target.value)} placeholder="No limit" />
          </div>
        </div>
        <Button type="button" onClick={saveLimits} disabled={isSavingLimits} data-tip="Save the minimum and maximum withdrawal amounts" className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSavingLimits ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Save
        </Button>
      </section>

      {/* --- Support The Platform donation limits --- */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-600" />
          <h3 className="text-sm font-bold">Support The Platform donation amounts</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">The minimum and maximum a giver may donate directly to HelpLift in one "Support The Platform" donation. Leave maximum blank for no limit.</p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div className="space-y-1">
            <Label htmlFor="donation-min">Minimum (R)</Label>
            <Input id="donation-min" type="number" min="0" step="0.01" value={donationMin} onChange={e => setDonationMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="donation-max">Maximum (R, optional)</Label>
            <Input id="donation-max" type="number" min="0" step="0.01" value={donationMax} onChange={e => setDonationMax(e.target.value)} placeholder="No limit" />
          </div>
        </div>
        <Button type="button" onClick={saveDonationLimits} disabled={isSavingDonationLimits} data-tip="Save the minimum and maximum platform donation amounts" className="bg-pink-600 hover:bg-pink-700 text-white">
          {isSavingDonationLimits ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Save
        </Button>
      </section>

      {/* --- Badge thresholds --- */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold">Badge thresholds</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The minimums givers and organizations need to reach to earn each motivational badge. Anniversary-style badges (account age) aren't configurable here - a year is a year.
          Once someone earns a badge it's theirs permanently, even if you raise a threshold afterwards - this only changes who earns it from now on.
        </p>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Giver badges</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Milestone - Bronze (R)</Label><Input type="number" min="0" value={badgeGiver.milestoneBronze} onChange={e => setBadgeGiver({ ...badgeGiver, milestoneBronze: e.target.value })} /></div>
            <div className="space-y-1"><Label>Milestone - Silver (R)</Label><Input type="number" min="0" value={badgeGiver.milestoneSilver} onChange={e => setBadgeGiver({ ...badgeGiver, milestoneSilver: e.target.value })} /></div>
            <div className="space-y-1"><Label>Milestone - Gold (R)</Label><Input type="number" min="0" value={badgeGiver.milestoneGold} onChange={e => setBadgeGiver({ ...badgeGiver, milestoneGold: e.target.value })} /></div>
            <div className="space-y-1"><Label>Consistent Giver - consecutive months</Label><Input type="number" min="1" value={badgeGiver.streakMonths} onChange={e => setBadgeGiver({ ...badgeGiver, streakMonths: e.target.value })} /></div>
            <div className="space-y-1"><Label>Needs Champion - needs fulfilled</Label><Input type="number" min="1" value={badgeGiver.needsFulfilledMin} onChange={e => setBadgeGiver({ ...badgeGiver, needsFulfilledMin: e.target.value })} /></div>
            <div className="space-y-1"><Label>Category Champion - donations to one category</Label><Input type="number" min="1" value={badgeGiver.categoryChampionMin} onChange={e => setBadgeGiver({ ...badgeGiver, categoryChampionMin: e.target.value })} /></div>
            <div className="space-y-1"><Label>Well-Rounded Giver - distinct categories</Label><Input type="number" min="1" value={badgeGiver.wellRoundedCategoriesMin} onChange={e => setBadgeGiver({ ...badgeGiver, wellRoundedCategoriesMin: e.target.value })} /></div>
            <div className="space-y-1"><Label>Gift Library Contributor - offerings claimed</Label><Input type="number" min="1" value={badgeGiver.giftLibraryContributorMin} onChange={e => setBadgeGiver({ ...badgeGiver, giftLibraryContributorMin: e.target.value })} /></div>
            <div className="space-y-1"><Label>Platform Supporter - donations</Label><Input type="number" min="1" value={badgeGiver.platformSupporterMin} onChange={e => setBadgeGiver({ ...badgeGiver, platformSupporterMin: e.target.value })} /></div>
            <div className="space-y-1"><Label>Community Connector - organizations supported</Label><Input type="number" min="1" value={badgeGiver.reachOrgsMin} onChange={e => setBadgeGiver({ ...badgeGiver, reachOrgsMin: e.target.value })} /></div>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-[#233350]">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Organization badges</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Needs fulfilled - Bronze</Label><Input type="number" min="0" value={badgeOrg.needsFulfilledBronze} onChange={e => setBadgeOrg({ ...badgeOrg, needsFulfilledBronze: e.target.value })} /></div>
            <div className="space-y-1"><Label>Needs fulfilled - Silver</Label><Input type="number" min="0" value={badgeOrg.needsFulfilledSilver} onChange={e => setBadgeOrg({ ...badgeOrg, needsFulfilledSilver: e.target.value })} /></div>
            <div className="space-y-1"><Label>Needs fulfilled - Gold</Label><Input type="number" min="0" value={badgeOrg.needsFulfilledGold} onChange={e => setBadgeOrg({ ...badgeOrg, needsFulfilledGold: e.target.value })} /></div>
            <div className="space-y-1"><Label>Funds raised - Bronze (R)</Label><Input type="number" min="0" value={badgeOrg.fundsRaisedBronze} onChange={e => setBadgeOrg({ ...badgeOrg, fundsRaisedBronze: e.target.value })} /></div>
            <div className="space-y-1"><Label>Funds raised - Silver (R)</Label><Input type="number" min="0" value={badgeOrg.fundsRaisedSilver} onChange={e => setBadgeOrg({ ...badgeOrg, fundsRaisedSilver: e.target.value })} /></div>
            <div className="space-y-1"><Label>Funds raised - Gold (R)</Label><Input type="number" min="0" value={badgeOrg.fundsRaisedGold} onChange={e => setBadgeOrg({ ...badgeOrg, fundsRaisedGold: e.target.value })} /></div>
            <div className="space-y-1"><Label>Storyteller - approved stories</Label><Input type="number" min="1" value={badgeOrg.storytellerMin} onChange={e => setBadgeOrg({ ...badgeOrg, storytellerMin: e.target.value })} /></div>
            <div className="space-y-1"><Label>Reliable Partner - completion rate (%)</Label><Input type="number" min="0" max="100" value={badgeOrg.reliabilityMinRate} onChange={e => setBadgeOrg({ ...badgeOrg, reliabilityMinRate: e.target.value })} /></div>
            <div className="space-y-1"><Label>Reliable Partner - min. fulfillments</Label><Input type="number" min="1" value={badgeOrg.reliabilityMinSample} onChange={e => setBadgeOrg({ ...badgeOrg, reliabilityMinSample: e.target.value })} /></div>
            <div className="space-y-1"><Label>Fast Responder - max. average hours</Label><Input type="number" min="1" value={badgeOrg.responsivenessMaxHours} onChange={e => setBadgeOrg({ ...badgeOrg, responsivenessMaxHours: e.target.value })} /></div>
            <div className="space-y-1"><Label>Fast Responder - min. responses</Label><Input type="number" min="1" value={badgeOrg.responsivenessMinSample} onChange={e => setBadgeOrg({ ...badgeOrg, responsivenessMinSample: e.target.value })} /></div>
          </div>
        </div>

        <Button type="button" onClick={saveBadgeThresholds} disabled={isSavingBadges} data-tip="Save every badge threshold above" className="bg-amber-600 hover:bg-amber-700 text-white">
          {isSavingBadges ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Save
        </Button>
      </section>

      {/* --- Monthly spotlight override --- */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold">Giver / Organization of the Month</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Automatically the giver who supported the most needs, and the organization that fulfilled the most needs, in the period shown - the same one shown on the homepage.
          Pick a runner-up (or anyone else) below to override either winner for that period.
        </p>

        {isLoadingSpotlight ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-amber-600" /></div>
        ) : spotlightData ? (
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => loadSpotlight(shiftPeriod(spotlightData.period, -1))}
                data-tip="Previous month"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-[#233350] hover:bg-slate-50 dark:hover:bg-[#1A2740]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-bold w-40 text-center">{spotlightData.periodLabel}</p>
              <button
                type="button"
                onClick={() => loadSpotlight(shiftPeriod(spotlightData.period, 1))}
                data-tip="Next month"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-[#233350] hover:bg-slate-50 dark:hover:bg-[#1A2740]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["giver", "organization"] as const).map((subjectType) => {
                const section = spotlightData[subjectType]
                return (
                  <div key={subjectType} className="rounded-xl border border-slate-200 dark:border-[#233350] p-3 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {subjectType === "giver" ? "Giver of the Month" : "Organization of the Month"}
                    </p>
                    {section.current ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{section.current.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {section.current.metric} {subjectType === "giver" ? "needs supported" : "needs fulfilled"}
                            {section.current.isOverride && " · admin pick"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No qualifying activity this period.</p>
                    )}

                    {section.candidates.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-[#233350]">
                        <p className="text-[11px] font-semibold text-slate-400">Runners-up</p>
                        {section.candidates
                          .filter((c) => c.subjectId !== section.current?.subjectId)
                          .map((c) => (
                            <button
                              key={c.subjectId}
                              type="button"
                              onClick={() => selectSpotlightCandidate(subjectType, c.subjectId)}
                              disabled={busySpotlightKey === `${subjectType}:${c.subjectId}`}
                              className="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-[#1A2740] disabled:opacity-50"
                            >
                              <span className="truncate font-semibold">{c.name}</span>
                              <span className="text-slate-400 shrink-0">
                                {busySpotlightKey === `${subjectType}:${c.subjectId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : c.metric}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Could not load spotlight data.</p>
        )}
      </section>

      {/* --- Bank accounts --- */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold">HelpLift's bank accounts</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Shown to donors on the payment screen for manual EFT donations. Retiring an account hides it from new donations without affecting past ones.</p>

        <div className="space-y-2">
          {bankAccounts.length === 0 && <p className="text-xs text-slate-400">No bank accounts yet.</p>}
          {bankAccounts.map(account => (
            <div key={account.id} className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3 ${account.is_active ? "border-slate-200 dark:border-[#233350]" : "border-slate-200 dark:border-[#233350] opacity-60"}`}>
              <div className="text-xs">
                <p className="font-bold text-sm">{account.bank_name}{!account.is_active && <span className="ml-2 font-normal text-slate-400">(retired)</span>}</p>
                <p className="text-slate-500 dark:text-slate-400">{account.account_name} · {account.account_number} · Branch {account.branch_code} · {account.account_type}{account.swift_code ? ` · ${account.swift_code}` : ""}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleBankActive(account)}
                  disabled={busyBankId === account.id}
                  data-tip={account.is_active ? "Hide this account from new donations, without affecting past ones" : "Offer this account to donors again"}
                  className="rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740] disabled:opacity-50"
                >
                  {busyBankId === account.id ? <Loader2 className="w-3 h-3 animate-spin" /> : account.is_active ? "Retire" : "Reactivate"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteBankAccount(account)}
                  disabled={busyBankId === account.id}
                  aria-label="Delete"
                  data-tip="Permanently delete this account - only works if no donation has ever used it"
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addBankAccount} className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#233350]">
          <input required placeholder="Bank name" value={newBank.bank_name} onChange={e => setNewBank({ ...newBank, bank_name: e.target.value })} className={inputClass} />
          <input required placeholder="Account name" value={newBank.account_name} onChange={e => setNewBank({ ...newBank, account_name: e.target.value })} className={inputClass} />
          <input required placeholder="Account number" value={newBank.account_number} onChange={e => setNewBank({ ...newBank, account_number: e.target.value })} className={inputClass} />
          <input required placeholder="Branch code" value={newBank.branch_code} onChange={e => setNewBank({ ...newBank, branch_code: e.target.value })} className={inputClass} />
          <input required placeholder="Account type" value={newBank.account_type} onChange={e => setNewBank({ ...newBank, account_type: e.target.value })} className={inputClass} />
          <input placeholder="SWIFT code (optional)" value={newBank.swift_code} onChange={e => setNewBank({ ...newBank, swift_code: e.target.value })} className={inputClass} />
          <Button type="submit" disabled={isAddingBank} data-tip="Add this as a new account donors can pay into" className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {isAddingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add bank account
          </Button>
        </form>
      </section>

      {/* --- Need categories --- */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#233350] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-bold">Need categories</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Renaming updates every need already using the old name too. Retiring hides a category from new needs without affecting needs that already use it.</p>

        <div className="space-y-2">
          {categories.length === 0 && <p className="text-xs text-slate-400">No categories yet.</p>}
          {categories.map(category => (
            <div key={category.id} className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3 ${category.is_active ? "border-slate-200 dark:border-[#233350]" : "border-slate-200 dark:border-[#233350] opacity-60"}`}>
              {renamingId === category.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveRename(category); if (e.key === "Escape") setRenamingId(null) }}
                  className={`${inputClass} flex-1 min-w-0`}
                />
              ) : (
                <p className="text-sm font-semibold">{category.name}{!category.is_active && <span className="ml-2 font-normal text-xs text-slate-400">(retired)</span>}</p>
              )}
              <div className="flex items-center gap-2 shrink-0">
                {renamingId === category.id ? (
                  <>
                    <button type="button" onClick={() => saveRename(category)} disabled={busyCategoryId === category.id} data-tip="Save this name - needs already using the old name are updated too" className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                      {busyCategoryId === category.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                    </button>
                    <button type="button" onClick={() => setRenamingId(null)} data-tip="Discard this rename" className="text-xs font-bold text-slate-500">Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { setRenamingId(category.id); setRenameValue(category.name) }} data-tip="Rename this category" className="rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740]">Rename</button>
                    <button
                      type="button"
                      onClick={() => toggleCategoryActive(category)}
                      disabled={busyCategoryId === category.id}
                      data-tip={category.is_active ? "Hide this category from new needs, without affecting needs that already use it" : "Offer this category again"}
                      className="rounded-full border border-slate-200 dark:border-[#233350] px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1A2740] disabled:opacity-50"
                    >
                      {busyCategoryId === category.id ? <Loader2 className="w-3 h-3 animate-spin" /> : category.is_active ? "Retire" : "Reactivate"}
                    </button>
                    <button type="button" onClick={() => deleteCategory(category)} disabled={busyCategoryId === category.id} aria-label="Delete" data-tip="Permanently delete this category - only works if no need uses it" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addCategory} className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#233350]">
          <input placeholder="New category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className={`${inputClass} flex-1`} />
          <Button type="submit" disabled={isAddingCategory || !newCategoryName.trim()} data-tip="Add this as a new need category" className="bg-purple-600 hover:bg-purple-700 text-white shrink-0">
            {isAddingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </Button>
        </form>
      </section>
    </div>
  )
}
