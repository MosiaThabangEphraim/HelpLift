"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  HeartHandshake, 
  ShieldCheck, 
  ArrowRight, 
  MapPin, 
  Send, 
  Star, 
  Plus, 
  Minus, 
  Sparkles, 
  LayoutDashboard, 
  Gift,
  Users,
  CheckCircle2,
  Quote,
  Search,
  MessageSquare,
  Flame,
  ExternalLink,
  Loader2,
  Heart
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StoryMediaGallery } from "@/components/story-media-gallery"
import { MicButton } from "@/components/mic-button"
import { GrammarCheckButton } from "@/components/grammar-check-button"
import { appendSpeech } from "@/lib/speech-to-text"
import { activateOnKey } from "@/lib/keyboard"
import { createClient } from "@/lib/supabase/client"
import { SupportPlatformDialog } from "@/components/support-platform-dialog"
import { GuestSupportPlatformDialog } from "@/components/guest-support-platform-dialog"
import { MonthlySpotlight } from "@/components/monthly-spotlight"
import { ShareButtons } from "@/components/share-buttons"
import { OutcomeBanner } from "@/components/outcome-banner"
import { ReadAloudButton } from "@/components/read-aloud-button"
import { CountUp } from "@/components/count-up"
import { NeedsMap } from "@/components/needs-map"
import { LiveActivityFeed } from "@/components/live-activity-feed"

// -------------------- Data (HelpLift Ecosystem) --------------------
const faqs = [
  { question: "How do you verify organizations?", answer: "Every organization undergoes a strict vetting process. Our Main Admin reviews their registration documents, tax exemption status, and community footprint before approving their profile." },
  { question: "What is the Gift Library?", answer: "The Gift Library allows individuals and businesses to proactively post offerings-like surplus inventory, free professional services, or bulk goods. Organizations can then browse and request these offerings." },
  { question: "Is HelpLift free to use?", answer: "Yes, the platform is entirely free for verified organizations to post needs and for givers to browse and fulfill them." },
  { question: "How do I stay safe from scammers?", answer: "HelpLift will never ask you to pay a fee to receive a donation, claim a gift, verify your account, or unlock funds. We will never ask for your password, PIN, or a one-time verification code. All payments happen through the platform's own donation flow - never by direct bank transfer to an individual, WhatsApp, or a \"processing fee\" request. If anyone claiming to be from HelpLift asks you to pay upfront or share login details, it's a scam - please report it to us immediately." },
]

export default function LandingPage() {
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeStoryIndex, setActiveStoryIndex] = useState(0)
  const [openFaq, setOpenFaq] = useState<string | null>(faqs[0]?.question ?? null)
  const [faqSearchQuery, setFaqSearchQuery] = useState("")

  // Dynamic Data - populated from the database only; no hardcoded demo content.
  const [featuredNeeds, setFeaturedNeeds] = useState<any[]>([])
  const [mapNeeds, setMapNeeds] = useState<any[]>([])
  const [isLoadingNeeds, setIsLoadingNeeds] = useState(true)
  const [platformStats, setPlatformStats] = useState<{ organizations: number; givers: number; openNeeds: number; fulfilledNeeds: number; stories: number; donationCount: number; totalDonated: number } | null>(null)
  const [stories, setStories] = useState<any[]>([])
  const [isLoadingStories, setIsLoadingStories] = useState(true)
  const [openStory, setOpenStory] = useState<any | null>(null)
  const [isStoryLightboxOpen, setIsStoryLightboxOpen] = useState(false)

  // Signed-in visitors get "My Dashboard" instead of "Sign In" - same check as
  // the shared PublicNavbar, which this page replaces with its own nav.
  const [dashboardPath, setDashboardPath] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      const paths: Record<string, string> = { giver: "/givers-dashboard", organization: "/organisation-dashboard", admin: "/admin-dashboard" }
      if (profile?.role && paths[profile.role]) setDashboardPath(paths[profile.role])
    }).catch(() => {})
  }, [])

  // --- "Support The Platform" ---
  const [showSupportPlatform, setShowSupportPlatform] = useState(false)
  const [showGuestSupportPlatform, setShowGuestSupportPlatform] = useState(false)
  const [showSupportAuthPrompt, setShowSupportAuthPrompt] = useState(false)
  const [platformDonationBanner, setPlatformDonationBanner] = useState<"success" | "cancelled" | null>(null)

  const handleSupportPlatformClick = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setShowSupportAuthPrompt(true)
      return
    }
    setShowSupportPlatform(true)
  }

  // A guest's PayFast/PayPal checkout fully navigates the browser away and
  // back - recover the pending donation's id + email that
  // guest-support-platform-dialog.tsx stashed in localStorage right before
  // that redirect, so a "cancelled" return can be resolved the same way the
  // signed-in dashboards do it for their own donations.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const outcome = params.get("platformDonation")
    const donationId = params.get("donation")
    if (outcome === "success" || outcome === "cancelled") {
      setPlatformDonationBanner(outcome)
      window.history.replaceState({}, "", "/")
    }
    if (!donationId) return
    try {
      const raw = localStorage.getItem("helplift_guest_platform_donation")
      if (!raw) return
      const pending = JSON.parse(raw)
      if (pending?.id !== donationId) return
      if (outcome === "cancelled") {
        fetch(`/api/public/donations/platform/${donationId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: pending.email }),
        }).catch(() => {})
      }
      localStorage.removeItem("helplift_guest_platform_donation")
    } catch {}
  }, [])

  // --- "Partner with us" contact form ---
  const [contactEmail, setContactEmail] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [isSendingContact, setIsSendingContact] = useState(false)
  const [contactFeedback, setContactFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    fetch("/api/public/stats")
      .then(res => res.json())
      .then(data => { if (data.success && data.stats) setPlatformStats(data.stats) })
      .catch(() => {})

    // Fetch real featured needs
    fetch("/api/public/needs")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.needs)) {
          setFeaturedNeeds(data.needs.slice(0, 3))
          setMapNeeds(data.needs)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingNeeds(false))

    // Fetch dynamic impact stories
    fetch("/api/public/stories")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.stories)) {
          const mapped = data.stories.map((s: any, idx: number) => ({
            id: s.id || idx,
            organizationId: s.organizations?.id || null,
            title: s.title,
            organization: s.organizations?.name || "Verified Organization",
            location: [s.organizations?.city, s.organizations?.province].filter(Boolean).join(", ") || "Community Outreach",
            review: s.content,
            reviewer: s.author_role || "Operations Team",
            rating: 5,
            imageUrl: s.image_url || null,
            videoUrl: s.video_url || null,
            media: Array.isArray(s.media) ? s.media : [],
          }))
          setStories(mapped)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingStories(false))
  }, [])

  useEffect(() => {
    if (stories.length === 0) return
    const interval = setInterval(() => {
      setActiveStoryIndex((prev) => (prev + 1) % stories.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [stories.length])

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSendingContact(true)
    setContactFeedback(null)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contactEmail, message: contactMessage }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || "Unable to send your message.")
      setContactFeedback({ type: "success", text: data.message })
      setContactEmail("")
      setContactMessage("")
    } catch (err: any) {
      setContactFeedback({ type: "error", text: err.message || "Unable to send your message." })
    } finally {
      setIsSendingContact(false)
    }
  }

  const currentStory = stories[activeStoryIndex] || null

  const navLinks = [
    { name: "Home", id: "home" },
    { name: "Needs", id: "featured-needs" },
    { name: "Platform", id: "platform" },
    { name: "Impact", id: "impact" },
    { name: "FAQ", id: "faq" },
  ]

  const handleScrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-100 selection:text-blue-900 scroll-smooth font-sans relative">
      
      {/* --- FLOATING GLASS NAVIGATION --- */}
      <nav 
        className={`fixed top-6 left-0 right-0 z-[100] transition-all duration-500 flex justify-center px-4`}
      >
        <div className={`flex items-center justify-between px-6 py-3 rounded transition-all duration-500 ${
          isScrolled
            ? "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] w-full max-w-3xl"
            : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-100/50 dark:border-slate-800/50 shadow-sm w-full max-w-4xl"
        }`}>
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-1.5 rounded">
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-slate-100">HelpLift</span>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-slate-50/50 dark:bg-slate-800/50 p-1 rounded border border-slate-100 dark:border-slate-800">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => handleScrollToSection(e, link.id)}
                className="px-5 py-2 rounded text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all duration-300"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="h-9 w-9" />
            <button
              onClick={() => router.push(dashboardPath || "/login")}
              data-tip={dashboardPath ? "You're signed in - go to your dashboard" : undefined}
              className="hidden md:inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white transition-all duration-300 bg-slate-900 dark:bg-blue-600 border border-transparent rounded hover:bg-slate-800 dark:hover:bg-blue-700 hover:shadow-lg hover:shadow-slate-200 dark:hover:shadow-none hover:-translate-y-0.5"
            >
              {dashboardPath ? (
                <>
                  <LayoutDashboard className="w-4 h-4" /> My Dashboard
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* --- HERO SECTION --- */}
        <section id="home" className="relative pt-5 pb-5 md:pt-30 md:pb-10 overflow-hidden px-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-300/20 rounded blur-[120px] -z-10 mix-blend-multiply opacity-60" />
          
          <div className="max-w-5xl mx-auto text-center space-y-4">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.15]">
              Giving made <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">transparent.</span>
              <br className="hidden md:block" /> Impact made real.
            </h1>
            
            <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Connect directly with verified organizations. Whether offering goods, services, or funding, HelpLift guarantees your contribution reaches those who need it most.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button 
                onClick={() => router.push("/register")}
                className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white transition-all duration-300 bg-gradient-to-b from-blue-500 to-blue-600 rounded shadow-[0_8px_30px_rgb(37,99,235,0.24)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:-translate-y-0.5 overflow-hidden w-full sm:w-auto"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Join the Platform 
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
              
              <button 
                onClick={() => router.push("/needs")}
                className="group inline-flex items-center justify-center px-8 py-4 text-base font-bold text-slate-700 dark:text-slate-200 transition-all duration-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm w-full sm:w-auto"
              >
                View Open Needs
              </button>
            </div>
            
            <div className="pt-2 flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-slate-400">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded border border-slate-100 dark:border-slate-800 shadow-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 100% Verified NPOs</div>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded border border-slate-100 dark:border-slate-800 shadow-sm"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Zero Platform Fees</div>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded border border-slate-100 dark:border-slate-800 shadow-sm"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Direct Impact</div>
            </div>
          </div>
        </section>

        {/* --- MODERN BENTO BOX FEATURES (PLATFORM) --- */}
        {platformStats && (
          <section id="statistics" aria-label="Platform statistics" className="max-w-6xl mx-auto px-4 pb-10">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { icon: ShieldCheck, value: platformStats.organizations, label: "Verified organizations" },
                { icon: Users, value: platformStats.givers, label: "Registered givers" },
                { icon: Flame, value: platformStats.openNeeds, label: "Open needs" },
                { icon: CheckCircle2, value: platformStats.fulfilledNeeds, label: "Needs fulfilled" },
                { icon: Gift, value: platformStats.totalDonated, prefix: "R", label: `Donated (${platformStats.donationCount.toLocaleString()} gifts)` },
                { icon: Sparkles, value: platformStats.stories, label: "Impact stories" },
              ].map(({ icon: Icon, value, prefix, label }) => (
                <div key={label} className="rounded border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center shadow-sm">
                  <Icon className="w-5 h-5 mx-auto text-blue-600 dark:text-blue-400" />
                  <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    <CountUp value={value} prefix={prefix} />
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="platform" className="max-w-6xl mx-auto px-4 py-2">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">A structured ecosystem.</h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">Replacing chaotic group chats with streamlined, secure philanthropy.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">
            <div className="md:col-span-2 relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-10 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:border-slate-200 dark:border-slate-800 transition-all duration-500 group flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] transition-opacity duration-500 group-hover:opacity-[0.04]">
                <Gift className="w-64 h-64 text-purple-900" />
              </div>
              <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950 rounded flex items-center justify-center border border-purple-100 dark:border-purple-900 mb-6 group-hover:scale-110 transition-transform duration-500">
                <Gift className="w-6 h-6 text-purple-600" />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">The Gift Library</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-md text-lg">
                  Don't wait for a need to be posted. Proactively list surplus inventory, bulk goods, or pro-bono services for verified organizations to claim.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-10 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:border-slate-200 dark:border-slate-800 transition-all duration-500 group flex flex-col justify-between">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950 rounded flex items-center justify-center border border-emerald-100 dark:border-emerald-900 mb-6 group-hover:scale-110 transition-transform duration-500">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Verified Trust</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Every entity undergoes strict vetting for tax status and community footprint before joining.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-10 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:border-slate-200 dark:border-slate-800 transition-all duration-500 group flex flex-col justify-between">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950 rounded flex items-center justify-center border border-blue-100 dark:border-blue-900 mb-6 group-hover:scale-110 transition-transform duration-500">
                <LayoutDashboard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Central Dashboard</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Track open requests, coordinate drop-offs, and generate fulfillment reports.
                </p>
              </div>
            </div>

            <div className="md:col-span-2 relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-10 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:border-slate-200 dark:border-slate-800 transition-all duration-500 group flex flex-col justify-between">
               <div className="absolute -bottom-10 -right-10 p-8 opacity-[0.02] transition-opacity duration-500 group-hover:opacity-[0.04]">
                <Users className="w-72 h-72 text-orange-900" />
              </div>
              <div className="w-14 h-14 bg-orange-50 dark:bg-orange-950 rounded flex items-center justify-center border border-orange-100 dark:border-orange-900 mb-6 group-hover:scale-110 transition-transform duration-500">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">Direct Matching</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-md text-lg">
                  Our system intelligently alerts givers about new needs that align with their specific geographic location and historical giving preferences.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- FEATURED & URGENT NEEDS PREVIEW (Item 1 & 3) --- */}
        <section id="featured-needs" className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 text-xs font-bold uppercase tracking-wider mb-3">
                <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                <span>Urgent Needs Awaiting Support</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Community Requests
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Direct verified requests from non-profits, schools, and community welfare initiatives.
              </p>
            </div>

            <Link
              href="/needs"
              className="inline-flex items-center gap-2 px-6 py-3 rounded bg-slate-900 dark:bg-blue-600 text-white font-bold text-sm hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-md shrink-0 self-start md:self-auto"
            >
              <span>Explore All Needs</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoadingNeeds ? (
              [0, 1, 2].map(i => (
                <div key={i} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm h-56 animate-pulse" />
              ))
            ) : featuredNeeds.length === 0 ? (
              <div className="col-span-full rounded border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
                <p className="text-slate-500 dark:text-slate-400 font-medium">No open needs right now - check back soon, or browse verified organizations directly.</p>
              </div>
            ) : (
              featuredNeeds.map((need: any) => {
                const org = Array.isArray(need.organizations) ? need.organizations[0] : need.organizations
                return (
                  <div key={need.id} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{need.category}</span>
                        {need.urgency === "high" ? (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 flex items-center gap-1">
                            <Flame className="w-3 h-3 fill-red-500" /> High Urgency
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400">Open</span>
                        )}
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 line-clamp-1">{need.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">{need.description}</p>
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 pt-1 truncate">
                        {org?.name || "Verified Organization"} {need.location ? `· ${need.location}` : ""}
                      </p>
                    </div>
                    <Link href={`/needs?search=${encodeURIComponent(need.title)}`} className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors shadow-sm">
                      <span>Support this Need</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* --- NEEDS MAP & LIVE ACTIVITY --- */}
        <section id="needs-map" aria-labelledby="needs-map-heading" className="max-w-6xl mx-auto px-4 py-12">
          <div className="mb-8 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 text-xs font-bold uppercase tracking-wider mb-3">
              <MapPin className="w-3.5 h-3.5" />
              <span>Happening now</span>
            </div>
            <h2 id="needs-map-heading" className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Needs across South Africa
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Every pin is a verified request. Click one to see it in full on the needs board.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {isLoadingNeeds ? (
                <div className="h-[380px] md:h-[440px] rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
              ) : (
                <NeedsMap needs={mapNeeds} />
              )}
            </div>
            <LiveActivityFeed />
          </div>
        </section>

        <MonthlySpotlight />

        {/* --- IMPACT STORIES --- */}
        <section id="impact" className="py-15 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white dark:from-slate-950 via-blue-50/30 dark:via-slate-900/30 to-[#FAFAFA] dark:to-slate-950 -z-10" />

          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
              <div className="max-w-xl">
                <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Real impact, documented.</h2>
                <p className="text-lg text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">See how verified contributions are actively shaping and supporting local communities.</p>
              </div>
              {stories.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveStoryIndex((prev) => (prev - 1 + stories.length) % stories.length)}
                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm transition-all hover:-translate-x-0.5"
                  >
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </button>
                  <button
                    onClick={() => setActiveStoryIndex((prev) => (prev + 1) % stories.length)}
                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm transition-all hover:translate-x-0.5"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative min-h-[500px]">
              <div className="absolute right-0 top-0 w-full md:w-2/3 h-[400px] md:h-[500px] rounded-[2.5rem] bg-slate-100 dark:bg-slate-900 overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
                {currentStory?.imageUrl ? (
                  <img src={currentStory.imageUrl} alt={currentStory.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 dark:from-blue-950 to-indigo-50 dark:to-slate-900 opacity-50 mix-blend-multiply dark:mix-blend-normal" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <HeartHandshake className="w-64 h-64" />
                    </div>
                  </>
                )}
              </div>

              {!isLoadingStories && !currentStory ? (
                <div className="relative pt-32 md:pt-16 md:w-1/2 z-10">
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white dark:border-slate-800 p-10 md:p-14 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] flex flex-col items-start gap-3">
                    <Quote className="w-10 h-10 text-blue-200 dark:text-blue-900" />
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">No impact stories yet.</h3>
                    <p className="text-slate-500 dark:text-slate-400">Verified organizations will share real outcomes here as they publish updates.</p>
                  </div>
                </div>
              ) : currentStory ? (
                <div className="relative pt-32 md:pt-16 md:w-1/2 z-10" key={`rev-${currentStory.id}`}>
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white dark:border-slate-800 p-10 md:p-14 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] animate-in fade-in slide-in-from-left-8 duration-700">
                      <Quote className="w-10 h-10 text-blue-200 dark:text-blue-900 mb-6" />

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-6">
                        <MapPin className="w-3.5 h-3.5" /> {currentStory.location}
                      </div>

                      <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 line-clamp-2 min-h-[3.5rem]">{currentStory.title}</h3>

                      <div className="flex gap-1 mb-6">
                        {[...Array(currentStory.rating)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>

                      {/* Both capped AND floored to the same 3-line block - a long
                          review can run much longer than a short one, and a max-height
                          cap alone (line-clamp) still lets a short review sit shorter
                          than a long one; the min-height makes every story reserve the
                          same space regardless, so the card's height (and everything
                          below it on the page) stays constant as it auto-rotates.
                          "Read full story" already exists as the place to read the
                          whole thing. */}
                      <blockquote className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium line-clamp-3 min-h-[5.5rem]">
                        "{currentStory.review}"
                      </blockquote>
                      <div className="mb-10 mt-2">
                        <ReadAloudButton text={currentStory.review} label="Listen to this story" />
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 shrink-0 rounded bg-slate-900 dark:bg-blue-600 flex items-center justify-center shadow-md">
                            <span className="text-white font-bold">{currentStory.reviewer.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{currentStory.reviewer}</div>
                            <div className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{currentStory.organization}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setOpenStory(currentStory)}
                          className="shrink-0 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Read full story
                        </button>
                      </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* --- FULL IMPACT STORY MODAL --- */}
        <Dialog open={!!openStory} onOpenChange={(open) => !open && setOpenStory(null)}>
          <DialogContent
            className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
            onEscapeKeyDown={(e) => { if (isStoryLightboxOpen) e.preventDefault() }}
            onPointerDownOutside={(e) => {
              if ((e.target as HTMLElement | null)?.closest?.("[data-story-lightbox]")) e.preventDefault()
            }}
          >
            {openStory && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">{openStory.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    <MapPin className="w-3.5 h-3.5" /> {openStory.location}
                  </div>
                  <StoryMediaGallery
                    title={openStory.title}
                    onLightboxOpenChange={setIsStoryLightboxOpen}
                    media={
                      openStory.media && openStory.media.length > 0
                        ? openStory.media
                        : [
                            ...(openStory.videoUrl ? [{ id: "legacy-video", media_type: "video", url: openStory.videoUrl }] : []),
                            ...(openStory.imageUrl ? [{ id: "legacy-image", media_type: "image", url: openStory.imageUrl }] : []),
                          ]
                    }
                  />
                  <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{openStory.review}</p>
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-blue-600 flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">{openStory.reviewer.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{openStory.reviewer}</div>
                        <div className="text-xs font-medium text-blue-600 dark:text-blue-400">{openStory.organization}</div>
                      </div>
                    </div>
                    {openStory.organizationId && (
                      <ShareButtons
                        url={typeof window !== "undefined" ? `${window.location.origin}/organizations/${openStory.organizationId}?story=${openStory.id}` : ""}
                        title={openStory.title}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* --- SUPPORT THE PLATFORM --- */}
        <SupportPlatformDialog open={showSupportPlatform} onOpenChange={setShowSupportPlatform} />
        <GuestSupportPlatformDialog open={showGuestSupportPlatform} onOpenChange={setShowGuestSupportPlatform} />

        {platformDonationBanner === "success" && (
          <OutcomeBanner
            variant="success"
            message="Your donation to HelpLift was received. A receipt will be emailed to you shortly."
            onDismiss={() => setPlatformDonationBanner(null)}
          />
        )}
        {platformDonationBanner === "cancelled" && (
          <OutcomeBanner
            variant="unsuccessful"
            message="Your donation was cancelled or didn't complete, so no charge was made. Feel free to try again any time."
            onDismiss={() => setPlatformDonationBanner(null)}
          />
        )}

        {showSupportAuthPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-6 md:p-8 shadow-2xl text-center space-y-6">
              <div className="w-14 h-14 bg-pink-50 dark:bg-pink-950/60 border border-pink-100 dark:border-pink-900 rounded flex items-center justify-center mx-auto text-pink-600 dark:text-pink-400">
                <Heart className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Support the platform</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Sign in for a donation history you can track from your dashboard, or donate right now without an account -
                  we'll just need your name and email for the receipt.
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => { setShowSupportAuthPrompt(false); setShowGuestSupportPlatform(true) }}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded bg-pink-600 hover:bg-pink-700 text-white font-bold text-sm shadow-md shadow-pink-600/20 transition-all"
                >
                  <Heart className="w-4 h-4" />
                  <span>Donate without an account</span>
                </button>
                <button
                  onClick={() => router.push("/login")}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-bold text-sm transition-all"
                >
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => router.push("/register")}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-bold text-sm transition-all"
                >
                  <span>Register</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setShowSupportAuthPrompt(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* --- FAQ / CONTACT SECTION --- */}
        <section id="faq" className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
            
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Common Questions</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Everything you need to know about the platform.</p>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search FAQs..."
                  value={faqSearchQuery}
                  onChange={(e) => setFaqSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-5 py-3.5 bg-[#FAFAFA] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2">
                {faqs
                  .filter(faq => 
                    faq.question.toLowerCase().includes(faqSearchQuery.toLowerCase()) || 
                    faq.answer.toLowerCase().includes(faqSearchQuery.toLowerCase())
                  )
                  .map((faq) => (
                  <div key={faq.question} className="border-b border-slate-200 dark:border-slate-800 last:border-0 group">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenFaq(openFaq === faq.question ? null : faq.question)}
                      onKeyDown={activateOnKey}
                      className="w-full py-6 flex items-center justify-between text-left cursor-pointer focus:outline-none"
                    >
                      <span className={`font-bold text-lg transition-colors ${openFaq === faq.question ? 'text-blue-600' : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600'}`}>
                        {faq.question}
                      </span>
                      <div className={`ml-4 shrink-0 transition-transform duration-300 ${openFaq === faq.question ? 'rotate-180 text-blue-600' : 'text-slate-400'}`}>
                        {openFaq === faq.question ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      </div>
                    </div>
                    <div className={`overflow-hidden transition-all duration-500 ease-in-out ${openFaq === faq.question ? 'max-h-96 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed pr-8">
                         {faq.answer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50 dark:bg-blue-950 rounded blur-2xl -z-10" />
               <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">Partner with us or get in touch</h3>
               <p className="text-slate-500 dark:text-slate-400 mb-2">Need help registering your organization? Reach out. This is also where you can contact us with any other inquiry or question.</p>
               <p className="text-slate-500 dark:text-slate-400 mb-8">
                 Prefer email? Write to us at{" "}
                 <a href="mailto:helplift_platform@yahoo.com" className="font-semibold text-blue-600 hover:underline">helplift_platform@yahoo.com</a>.
               </p>

               {contactFeedback && (
                 <div className={`mb-5 p-4 rounded text-sm font-semibold ${
                   contactFeedback.type === "success"
                     ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                     : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                 }`}>
                   {contactFeedback.text}
                 </div>
               )}

               <form className="space-y-5" onSubmit={handleContactSubmit}>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      className="w-full px-5 py-4 bg-[#FAFAFA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                     <div className="flex items-center justify-between gap-2 mb-2">
                       <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Message</label>
                       <GrammarCheckButton text={contactMessage} onTextChange={setContactMessage} />
                     </div>
                    <div className="relative">
                      <textarea
                        placeholder="How can we assist you?"
                        rows={4}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        required
                        className="w-full px-5 py-4 pr-12 bg-[#FAFAFA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium resize-none text-slate-900 dark:text-slate-100"
                      />
                      <MicButton className="top-3 right-3" onText={text => setContactMessage(m => appendSpeech(m, text))} />
                    </div>
                  </div>
                  <button type="submit" disabled={isSendingContact} className="w-full group inline-flex items-center justify-center px-6 py-4 text-sm font-bold text-white transition-all duration-300 bg-slate-900 dark:bg-blue-600 rounded hover:bg-slate-800 dark:hover:bg-blue-700 hover:shadow-lg hover:shadow-slate-200 dark:hover:shadow-none hover:-translate-y-0.5 disabled:opacity-60">
                     <span className="flex items-center gap-2">
                       {isSendingContact ? "Sending..." : "Send Message"}
                       {isSendingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />}
                     </span>
                  </button>
               </form>
            </div>

            <div className="md:col-start-2 bg-pink-50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900 rounded-[2.5rem] p-10 relative overflow-hidden">
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-pink-100 dark:bg-pink-900/40 rounded blur-2xl -z-10" />
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-5 h-5 text-pink-600" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Support The Platform</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                This donation goes directly to HelpLift - not to any organization. We don't charge organizations or
                givers a cent to use the platform, so your support is what helps us keep it running and growing.
                Thank you for believing in what we're doing. 💙
              </p>
              <button
                onClick={handleSupportPlatformClick}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold text-white transition-all duration-300 bg-pink-600 rounded hover:bg-pink-700 hover:shadow-lg hover:-translate-y-0.5"
              >
                <Heart className="w-4 h-4" />
                <span>Support The Platform</span>
              </button>
            </div>
          </div>
        </section>

        {/* --- SCAM SAFETY NOTICE --- */}
        <section className="max-w-6xl mx-auto px-4 py-8">
          <div className="rounded-[2.5rem] border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-8 md:p-10">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded bg-amber-100 dark:bg-amber-900/50 p-3 text-amber-700 dark:text-amber-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Stay safe: HelpLift will never ask you to pay</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">
                  We will never ask you to pay a fee to receive a donation, claim a gift, verify your account, or "unlock"
                  funds - and we will never ask for your password, PIN, or a one-time verification code. Every payment on
                  HelpLift happens through the platform's own donation flow, never by direct bank transfer to an
                  individual, WhatsApp, or a "processing fee" request.
                </p>
                <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">
                  If anyone claiming to be from HelpLift asks you to pay upfront or share your login details, it's a scam
                  - please{" "}
                  <a href="#faq" className="font-semibold text-amber-700 dark:text-amber-400 hover:underline">report it to us</a>{" "}
                  right away.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- FOOTER --- */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pt-16 pb-8">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded shadow-sm">
                <HeartHandshake className="w-6 h-6 text-white" />
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-slate-100">HelpLift</span>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-bold text-slate-500 dark:text-slate-400">
              <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-4 mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center text-sm font-medium text-slate-400">
            © 2026 HelpLift. Empowering verified community support.
          </div>
        </footer>
      </main>

    </div>
  )
}