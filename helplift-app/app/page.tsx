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
  Heart,
  Code2,
  Mail,
  KeyRound,
  Banknote,
  Ban,
  Flag,
  HelpCircle
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
import { OrgLogo } from "@/components/org-logo"
import { HomepageNotice } from "@/components/homepage-notice"
import { MaximizeToggle } from "@/components/maximize-toggle"
import { Reveal } from "@/components/reveal"
import { CONTACT_OTHER_TOPIC_MAX, CONTACT_TOPICS } from "@/lib/contact-topics"
import { ScrollProgress } from "@/components/scroll-progress"
import { SpotlightGlow, spotlightMove } from "@/components/spotlight-card"
import { BrandLogo } from "@/components/brand-logo"

// -------------------- Data (HelpLift Ecosystem) --------------------
const faqs = [
  { question: "How do I join HelpLift?", answer: "Choose Join the Platform and register as a giver (an individual, business or group) or as an organization. Givers must be 18 or older. You can sign up with your email or with Google, Microsoft or LinkedIn, and joining is free." },
  { question: "Is HelpLift free to use?", answer: "Yes. There are no platform fees for organizations to post needs or for givers to browse, pledge and donate. HelpLift is kept running by voluntary donations through Support The Platform." },
  { question: "How do you verify organizations?", answer: "Every organization is reviewed by a HelpLift administrator before it can use the platform. We check their registration documents, tax exemption status and community footprint. Until approved, an organization can only see its verification status, and its needs aren't shown publicly." },
  { question: "How do I support a need?", answer: "Open a need on the needs board and choose Support this Need. You can send the organization an expression of interest explaining how you'd like to help, or donate money towards it. Expressing interest needs a free giver account." },
  { question: "How can I donate, and will I get a receipt?", answer: "You can donate by EFT (bank transfer, then upload your proof of payment), PayFast or PayPal - if you're paying from outside South Africa, use PayPal. PayFast and PayPal donations are confirmed automatically; EFT donations are confirmed by an administrator. Once a donation is confirmed, a receipt is emailed to you." },
  { question: "What is the Gift Library?", answer: "The Gift Library lets individuals and businesses offer goods, services or funds before a specific need exists - for example surplus stock or free professional services. Verified organizations can browse the offerings and claim them, and an administrator approves each claim." },
  { question: "How do organizations receive donated money?", answer: "Confirmed donations go into the organization's HelpLift wallet. The organization's owner can request a withdrawal to its verified bank account, and each withdrawal is reviewed by an administrator before it's paid out." },
  { question: "Can I find needs near me?", answer: "Yes. On the needs board, use Near me to see needs close to your location - no account needed. Signed-in givers can also see needs that match the categories and areas they chose when registering." },
  { question: "Can I donate to HelpLift without an account?", answer: "Yes - Support The Platform lets anyone donate to HelpLift itself with just a name and email for the receipt. These donations keep the platform running; they don't go to any organization." },
  { question: "Will my personal details be shown publicly?", answer: "No. Organizations' public profiles never show donations or donors, and we never share your contact details. Givers can opt out of being featured as Giver of the Month in Settings. See our Privacy Policy for the full details." },
  { question: "How do I stay safe from scammers?", answer: "HelpLift will never ask you to pay a fee to receive a donation, claim a gift, verify your account, or unlock funds. We will never ask for your password, PIN, or a one-time verification code. All payments happen through the platform's own donation flow - never by direct bank transfer to an individual, WhatsApp, or a \"processing fee\" request. If anyone claiming to be from HelpLift asks you to pay upfront or share login details, it's a scam - please report it to us immediately." },
  { question: "How do I keep my account secure?", answer: "Use a strong password, and turn on two-factor sign-in in Settings for an emailed code at every sign-in. You can also add a passkey to sign in with your fingerprint, face or device PIN. After repeated wrong passwords, an account is locked until it's unlocked with an emailed code." },
  { question: "Who is Lifty?", answer: "Lifty is HelpLift's AI assistant - the chat button in the corner of every page. Ask it how anything on HelpLift works, or about open needs and organizations, by typing or speaking. It can also read its answers aloud." },
  { question: "Can I use HelpLift on my phone?", answer: "Yes. HelpLift works in any modern browser on phones, tablets and computers, and you can install it like an app from your browser's menu. It also offers larger text, light, dark, high-contrast and grayscale themes, and read-aloud." },
  { question: "How do I report a problem or suggest an improvement?", answer: "Use the contact form on this page, or the form on the Developers page to report a bug or suggest an improvement - anonymously if you prefer. Signed-in users can also use the Feedback button or message an administrator from their dashboard." },
]

export default function LandingPage() {
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeStoryIndex, setActiveStoryIndex] = useState(0)
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [faqSearchQuery, setFaqSearchQuery] = useState("")
  const [showAllFaqs, setShowAllFaqs] = useState(false)
  const [allFaqsSearch, setAllFaqsSearch] = useState("")
  const matchesFaq = (faq: { question: string; answer: string }, query: string) =>
    faq.question.toLowerCase().includes(query.toLowerCase()) || faq.answer.toLowerCase().includes(query.toLowerCase())
  const matchingFaqs = faqs.filter(faq => matchesFaq(faq, faqSearchQuery))

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
  const [contactTopic, setContactTopic] = useState("")
  const [contactOtherTopic, setContactOtherTopic] = useState("")
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
            organizationLogo: s.organizations?.logo_url || null,
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
        body: JSON.stringify({ email: contactEmail, topic: contactTopic, otherTopic: contactOtherTopic, message: contactMessage }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || "Unable to send your message.")
      setContactFeedback({ type: "success", text: data.message })
      setContactEmail("")
      setContactMessage("")
      setContactTopic("")
      setContactOtherTopic("")
    } catch (err: any) {
      setContactFeedback({ type: "error", text: err.message || "Unable to send your message." })
    } finally {
      setIsSendingContact(false)
    }
  }

  const currentStory = stories[activeStoryIndex] || null

  const navLinks = [
    { name: "Home", id: "home", tip: "Back to the top of the page" },
    { name: "Needs", id: "featured-needs", tip: "Jump to urgent community needs" },
    { name: "Platform", id: "platform", tip: "Jump to how HelpLift works" },
    { name: "Impact", id: "impact", tip: "Jump to impact stories from organizations" },
    { name: "FAQ", id: "faq", tip: "Jump to common questions and the contact form" },
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
            ? "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] w-full max-w-3xl"
            : "bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shadow-sm w-full max-w-4xl"
        }`}>
          <div className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" />
            <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-slate-100">HelpLift</span>
          </div>

          <div className="hidden md:flex items-center gap-1 bg-slate-100/60 dark:bg-slate-800/50 p-1 rounded">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => handleScrollToSection(e, link.id)}
                data-tip={link.tip}
                className="px-5 py-2 rounded text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all duration-300"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Kept outside the section links (which hide on phones) so it's visible on every screen size. */}
            <Link
              href="/developers"
              data-tip="Report a bug or suggest an improvement - anonymously"
              className="inline-flex items-center gap-1.5 rounded bg-slate-900/5 dark:bg-white/10 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Code2 className="h-4 w-4" />
              <span>Developers</span>
            </Link>
            <ThemeToggle className="h-9 w-9" />
            <button
              onClick={() => router.push(dashboardPath || "/login")}
              data-tip={dashboardPath ? "You're signed in - go to your dashboard" : undefined}
              className="hidden md:inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 px-6 py-2.5 text-sm font-bold text-white transition-all duration-300 bg-slate-900 dark:bg-blue-600 border border-transparent rounded hover:bg-slate-800 dark:hover:bg-blue-700 hover:shadow-lg hover:shadow-slate-200 dark:hover:shadow-none hover:-translate-y-0.5"
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

      <ScrollProgress />
      <main>
        {/* --- HERO SECTION --- */}
        <section id="home" className="relative pt-5 pb-4 md:pt-28 md:pb-6 overflow-hidden px-4">
          {/* Background: a faint dotted grid and two slowly drifting colour blobs. */}
          <div aria-hidden="true" className="hero-grid absolute inset-0 -z-10" />
          <div aria-hidden="true" className="blob-drift absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-300/20 rounded-full blur-[120px] -z-10 mix-blend-multiply opacity-60" />
          <div aria-hidden="true" className="blob-drift absolute top-20 left-[15%] w-[380px] h-[380px] bg-indigo-300/20 rounded-full blur-[110px] -z-10 opacity-60 [animation-delay:-7s]" />

          {/* Admin's public notice (Send Announcement -> Homepage public notice). Extra
              top margin on phones so the floating navbar doesn't cover it. */}
          <HomepageNotice className="mt-16 md:mt-0 mb-8" />
          
          <Reveal className="max-w-5xl mx-auto text-center space-y-4">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.15]">
              Giving made <span className="text-sheen text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600">transparent.</span>
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
                className="group inline-flex items-center justify-center px-8 py-4 text-base font-bold text-slate-700 dark:text-slate-200 transition-all duration-300 bg-slate-900/5 dark:bg-white/10 rounded hover:bg-slate-900/10 dark:hover:bg-white/15 w-full sm:w-auto"
              >
                View Open Needs
              </button>
            </div>
            
            <div className="pt-2 flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-slate-400">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 100% Verified NPOs</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Zero Platform Fees</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Direct Impact</div>
            </div>
          </Reveal>
        </section>

        {/* --- MODERN BENTO BOX FEATURES (PLATFORM) --- */}
        {platformStats && (
          <section id="statistics" aria-label="Platform statistics" className="max-w-6xl mx-auto px-4 pb-4">
            {/* Big numbers only - each counts up a moment after the one before it. */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-10 py-6">
              {[
                { value: platformStats.organizations, label: "Verified organizations" },
                { value: platformStats.givers, label: "Registered givers" },
                { value: platformStats.openNeeds, label: "Open needs" },
                { value: platformStats.fulfilledNeeds, label: "Needs fulfilled" },
                { value: platformStats.totalDonated, prefix: "R", label: `Donated (${platformStats.donationCount.toLocaleString()} gifts)` },
                { value: platformStats.stories, label: "Impact stories" },
              ].map(({ value, prefix, label }, index) => (
                <Reveal key={label} delay={index * 90}>
                  <div className="text-center">
                    <p className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight tabular-nums whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 leading-tight">
                      <CountUp value={value} prefix={prefix} duration={2200} delay={index * 140} easing="expo" />
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* --- HOW IT WORKS: one panel, four features --- */}
        <section id="platform" className="max-w-6xl mx-auto px-4 py-10">
          <Reveal>
            <SectionHeader icon={LayoutDashboard} eyebrow="How it works" title="A structured ecosystem." subtitle="Replacing chaotic group chats with streamlined, secure philanthropy." />
          </Reveal>
          <Reveal delay={100}>
            <div className="reveal-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { icon: Gift, tint: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400", title: "The Gift Library", text: "Don't wait for a need to be posted. Proactively list surplus inventory, bulk goods, or pro-bono services for verified organizations to claim." },
                { icon: ShieldCheck, tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400", title: "Verified Trust", text: "Every entity undergoes strict vetting for tax status and community footprint before joining." },
                { icon: LayoutDashboard, tint: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400", title: "Central Dashboard", text: "Track open requests, coordinate drop-offs, and generate fulfillment reports." },
                { icon: Users, tint: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400", title: "Direct Matching", text: "Givers are alerted about new needs that match their location and the causes they care about." },
              ].map(({ icon: Icon, tint, title, text }) => (
                <div key={title} className="group rounded-2xl p-6 transition-colors duration-300 hover:bg-white/70 dark:hover:bg-slate-900/40">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-full ${tint} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-justify-smart">{text}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* --- FEATURED & URGENT NEEDS PREVIEW --- */}
        <section id="featured-needs" className="max-w-6xl mx-auto px-4 py-10">
          <Reveal>
            <SectionHeader
              icon={Flame}
              eyebrow="Urgent needs"
              title="Community requests."
              subtitle="Direct verified requests from non-profits, schools, and community welfare initiatives."
              action={
                <Link href="/needs" className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  Explore all needs <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              }
            />
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {isLoadingNeeds ? (
              [0, 1, 2].map(i => <div key={i} className={`${PANEL} h-60 animate-pulse`} />)
            ) : featuredNeeds.length === 0 ? (
              <div className={`${PANEL} col-span-full p-10 text-center`}>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No open needs right now - check back soon, or browse verified organizations directly.</p>
              </div>
            ) : (
              featuredNeeds.map((need: any, index: number) => {
                const org = Array.isArray(need.organizations) ? need.organizations[0] : need.organizations
                return (
                  <Reveal key={need.id} delay={index * 90}>
                    <div className={`${PANEL} group h-full p-6 flex flex-col justify-between gap-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white dark:hover:bg-slate-900/70`}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{need.category}</span>
                          {need.urgency === "high" ? (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center gap-1">
                              <Flame className="w-3 h-3 fill-red-500" /> High urgency
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">Open</span>
                          )}
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 line-clamp-1">{need.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">{need.description}</p>
                        <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 pt-1 min-w-0">
                          <OrgLogo src={org?.logo_url} name={org?.name || "Verified Organization"} className="h-6 w-6 text-[10px]" />
                          <span className="truncate">{org?.name || "Verified Organization"}{need.location ? ` · ${need.location}` : ""}</span>
                        </p>
                      </div>
                      <Link href={`/needs?search=${encodeURIComponent(need.title)}`} className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 px-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:shadow-blue-600/40">
                        Support this need <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </Reveal>
                )
              })
            )}
          </div>
        </section>

        {/* --- NEEDS MAP & LIVE ACTIVITY --- */}
        <section id="needs-map" aria-labelledby="needs-map-heading" className="max-w-6xl mx-auto px-4 py-10">
          <Reveal>
            <SectionHeader id="needs-map-heading" icon={MapPin} eyebrow="Happening now" title="Needs across South Africa." subtitle="Every pin is a verified request. Click one to see it in full on the needs board." />
          </Reveal>
          <Reveal delay={100}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 overflow-hidden rounded-2xl">
                {isLoadingNeeds ? (
                  <div className="h-[380px] md:h-[440px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ) : (
                  <div className="overflow-hidden rounded-xl">
                    <NeedsMap needs={mapNeeds} />
                  </div>
                )}
              </div>
              <div>
                <LiveActivityFeed />
              </div>
            </div>
          </Reveal>
        </section>

        <MonthlySpotlight />

        {/* --- IMPACT STORIES --- */}
        <section id="impact" className="max-w-6xl mx-auto px-4 py-10">
          <Reveal>
            <SectionHeader
              icon={Quote}
              eyebrow="Impact stories"
              title="Real impact, documented."
              subtitle="See how verified contributions are actively shaping and supporting local communities."
              action={stories.length > 0 ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveStoryIndex((prev) => (prev - 1 + stories.length) % stories.length)}
                    aria-label="Previous story"
                    data-tip="Previous story"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 transition-all hover:-translate-x-0.5 hover:text-blue-600"
                  >
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </button>
                  <button
                    onClick={() => setActiveStoryIndex((prev) => (prev + 1) % stories.length)}
                    aria-label="Next story"
                    data-tip="Next story"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 transition-all hover:translate-x-0.5 hover:text-blue-600"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              ) : undefined}
            />
          </Reveal>

          <Reveal delay={100}>
            <div className={`${PANEL} grid grid-cols-1 md:grid-cols-2 overflow-hidden`}>
              <div className="relative min-h-[260px] md:min-h-[440px] bg-slate-100 dark:bg-slate-800">
                {currentStory?.imageUrl ? (
                  <img key={currentStory.id} src={currentStory.imageUrl} alt={currentStory.title} className="absolute inset-0 w-full h-full object-cover animate-in fade-in duration-700" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-slate-900">
                    <HeartHandshake className="w-24 h-24 text-blue-200 dark:text-blue-900" strokeWidth={1.25} />
                  </div>
                )}
              </div>

              {!isLoadingStories && !currentStory ? (
                <div className="p-8 md:p-10 flex flex-col justify-center gap-3">
                  <Quote className="w-9 h-9 text-blue-200 dark:text-blue-900" />
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">No impact stories yet.</h3>
                  <p className="text-slate-500 dark:text-slate-400">Verified organizations will share real outcomes here as they publish updates.</p>
                </div>
              ) : currentStory ? (
                <div key={`rev-${currentStory.id}`} className="p-8 md:p-10 flex flex-col animate-in fade-in slide-in-from-right-4 duration-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 dark:bg-blue-950 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                      <MapPin className="w-3.5 h-3.5" /> {currentStory.location}
                    </span>
                    <span className="flex gap-0.5">
                      {[...Array(currentStory.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </span>
                  </div>
                  <h3 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100 line-clamp-2">{currentStory.title}</h3>
                  {/* Capped and floored to the same 3-line block so the card keeps one height as stories rotate. */}
                  <blockquote className="mt-3 text-base text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 min-h-[4.75rem] text-justify-smart">
                    &ldquo;{currentStory.review}&rdquo;
                  </blockquote>
                  <div className="mt-2">
                    <ReadAloudButton text={currentStory.review} label="Listen to this story" />
                  </div>
                  <div className="mt-auto pt-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <OrgLogo src={currentStory.organizationLogo} name={currentStory.organization} className="h-11 w-11 text-sm" />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{currentStory.reviewer}</div>
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{currentStory.organization}</div>
                      </div>
                    </div>
                    <button onClick={() => setOpenStory(currentStory)} className="group shrink-0 inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
                      Read full story <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-10 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
              )}
            </div>
          </Reveal>
        </section>

        {/* --- ALL FAQs WINDOW --- */}
        <Dialog
          open={showAllFaqs}
          onOpenChange={(open) => {
            setShowAllFaqs(open)
            // Start from the homepage search when opening it.
            if (open) setAllFaqsSearch(faqSearchQuery)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
                  <HelpCircle className="h-4 w-4" />
                </span>
                Frequently asked questions
              </DialogTitle>
            </DialogHeader>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search all questions..."
                value={allFaqsSearch}
                onChange={(e) => setAllFaqsSearch(e.target.value)}
                className="w-full rounded-xl border border-transparent bg-slate-100 dark:bg-slate-800 pl-11 pr-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              {faqs.filter(faq => matchesFaq(faq, allFaqsSearch)).map(faq => (
                <FaqItem
                  key={faq.question}
                  faq={faq}
                  number={faqs.indexOf(faq) + 1}
                  isOpen={openFaq === faq.question}
                  onToggle={() => setOpenFaq(openFaq === faq.question ? null : faq.question)}
                  tinted
                />
              ))}
              {faqs.every(faq => !matchesFaq(faq, allFaqsSearch)) && (
                <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No questions match your search.</p>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Still need help?{" "}
              <a
                href="#contact"
                onClick={() => setShowAllFaqs(false)}
                className="font-semibold text-blue-600 hover:underline"
              >
                Ask us using the contact form
              </a>
              , or ask Lifty in the corner of the page.
            </p>
          </DialogContent>
        </Dialog>

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
                  <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line text-justify-smart">{openStory.review}</p>
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <OrgLogo src={openStory.organizationLogo} name={openStory.organization} className="h-10 w-10 text-sm" />
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="relative w-full max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto pt-12 md:pt-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-6 md:p-8 shadow-2xl text-center space-y-6">
              <MaximizeToggle />
              <div className="w-14 h-14 bg-pink-50 dark:bg-pink-950/60 border border-pink-100 dark:border-pink-900 rounded flex items-center justify-center mx-auto text-pink-600 dark:text-pink-400">
                <Heart className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Support the platform</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  HelpLift is free - we don&apos;t charge organizations, givers or anyone else a cent to use the platform.
                  Donations to HelpLift itself (not to any organization) are what keep it running and growing.
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Sign in for a donation history you can track from your dashboard, or donate right now without an account -
                  we&apos;ll just need your name and email for the receipt.
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

        {/* --- FAQ / CONTACT --- */}
        <section id="faq" className="max-w-6xl mx-auto px-4 py-10 scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* FAQs */}
            <Reveal className="lg:col-span-7">
              <SectionHeader icon={HelpCircle} eyebrow="FAQs" title="Questions? We've got answers." subtitle="Everything you need to know about HelpLift - and a direct line to us if it isn't here." />
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search FAQs..."
                  value={faqSearchQuery}
                  onChange={(e) => setFaqSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-transparent bg-white/80 dark:bg-slate-900/60 pl-11 pr-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                />
              </div>
              <div className="reveal-stagger space-y-3">
                {matchingFaqs.slice(0, FAQ_PREVIEW_COUNT).map(faq => (
                  <FaqItem
                    key={faq.question}
                    faq={faq}
                    number={faqs.indexOf(faq) + 1}
                    isOpen={openFaq === faq.question}
                    onToggle={() => setOpenFaq(openFaq === faq.question ? null : faq.question)}
                  />
                ))}
                {matchingFaqs.length === 0 && (
                  <p className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No questions match your search. Try other words, or ask us using the form.
                  </p>
                )}
              </div>
              {matchingFaqs.length > FAQ_PREVIEW_COUNT || !faqSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setShowAllFaqs(true)}
                  data-tip="Open every frequently asked question in one window"
                  className="group mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400"
                >
                  {faqSearchQuery ? "See all matching questions" : "See all questions"}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              ) : null}
            </Reveal>

            {/* Contact */}
            <Reveal delay={120} className="lg:col-span-5">
              <div id="contact" className="scroll-mt-24 relative lg:pt-[4.5rem]">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
                  <MessageSquare className="w-5 h-5" />
                </span>
                <h3 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">Partner with us or get in touch</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-justify-smart">Need help registering your organization? Reach out. This is also where you can contact us with any other inquiry or question.</p>
                <a href="mailto:helplift_platform@yahoo.com" data-tip="Email HelpLift from your email app" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline">
                  <Mail className="w-4 h-4" /> helplift_platform@yahoo.com
                </a>

                {contactFeedback && (
                  <div className={`mt-5 p-4 rounded-xl text-sm font-semibold ${
                    contactFeedback.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                  }`}>
                    {contactFeedback.text}
                  </div>
                )}

                <form className="mt-5 space-y-4" onSubmit={handleContactSubmit}>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email address</label>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      className="w-full rounded-xl border border-transparent bg-white/80 dark:bg-slate-900/60 px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-topic" className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Topic</label>
                    <select
                      id="contact-topic"
                      value={contactTopic}
                      onChange={(e) => setContactTopic(e.target.value)}
                      required
                      className={`w-full rounded-xl border border-transparent bg-white/80 dark:bg-slate-900/60 px-4 py-3 text-sm font-medium transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 ${contactTopic ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}`}
                    >
                      <option value="" disabled>What is your message about?</option>
                      {CONTACT_TOPICS.map(topic => (
                        <option key={topic.id} value={topic.id}>{topic.label}</option>
                      ))}
                    </select>
                    {contactTopic === "other" && (
                      <input
                        type="text"
                        value={contactOtherTopic}
                        onChange={(e) => setContactOtherTopic(e.target.value)}
                        maxLength={CONTACT_OTHER_TOPIC_MAX}
                        required
                        autoFocus
                        placeholder="Tell us the topic in a few words"
                        aria-label="Your topic"
                        className="mt-2 w-full rounded-xl border border-transparent bg-white/80 dark:bg-slate-900/60 px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 animate-in fade-in slide-in-from-top-1 duration-300"
                      />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Message</label>
                      <GrammarCheckButton text={contactMessage} onTextChange={setContactMessage} />
                    </div>
                    <div className="relative">
                      <textarea
                        placeholder="How can we assist you?"
                        rows={4}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        required
                        className="w-full resize-none rounded-xl border border-transparent bg-white/80 dark:bg-slate-900/60 px-4 py-3 pr-12 text-sm font-medium text-slate-900 dark:text-slate-100 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                      />
                      <MicButton className="top-3 right-3" onText={text => setContactMessage(m => appendSpeech(m, text))} />
                    </div>
                  </div>
                  <button type="submit" disabled={isSendingContact} data-tip="Send your message to the HelpLift team - we'll reply by email" className="btn-shine group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:-translate-y-0.5 hover:shadow-blue-600/40 disabled:opacity-60">
                    {isSendingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSendingContact ? "Sending..." : "Send Message"}
                    {!isSendingContact && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                  </button>
                </form>
              </div>
            </Reveal>
          </div>
        </section>

        {/* --- SAFETY PROMISE + SUPPORT THE PLATFORM --- */}
        <section aria-labelledby="safety-heading" className="max-w-6xl mx-auto px-4 pt-4">
          <Reveal>
            <div className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-5">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500 text-white">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </span>
                    Your safety matters
                  </p>
                  <h2 id="safety-heading" className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    HelpLift will never ask you to pay
                  </h2>
                  <p className="mt-4 text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed text-justify-smart">
                    Every payment on HelpLift happens through the platform&apos;s own donation flow. If anyone claiming to be from
                    HelpLift asks you to pay upfront or share your login details, it&apos;s a scam.
                  </p>
                </div>
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { icon: Banknote, title: "No fees, ever", text: "Never a fee to receive a donation, claim a gift, verify your account or \"unlock\" funds." },
                    { icon: KeyRound, title: "No passwords or codes", text: "We'll never ask for your password, PIN or a one-time verification code." },
                    { icon: Ban, title: "No side payments", text: "Never a bank transfer to an individual, a WhatsApp payment or a \"processing fee\"." },
                  ].map(({ icon: Icon, title, text }, index) => (
                    <Reveal key={title} delay={120 + index * 110} className="">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950 text-orange-500 dark:text-orange-400">
                        <Icon className="w-5 h-5" strokeWidth={1.9} />
                      </span>
                      <h3 className="mt-4 font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{text}</p>
                    </Reveal>
                  ))}
                </div>
              </div>

              <div className="reveal-stagger mt-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <a
                  href="#contact"
                  onClick={() => setContactTopic("scam")}
                  data-tip="Tell us about anyone asking you to pay or share your login details"
                  className="btn-shine group inline-flex h-12 items-center gap-2.5 self-start rounded-xl bg-slate-900 dark:bg-slate-800 px-5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <Flag className="w-4 h-4" /> Report a scam to us
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
                <div className="flex flex-col-reverse md:flex-row md:items-center gap-3 md:gap-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed md:max-w-[17rem] md:text-right">
                    Donations go directly to HelpLift, not to any organization. Your support keeps it running and growing. Thank you! 💙
                  </p>
                  <button
                    onClick={handleSupportPlatformClick}
                    data-tip="Donate to HelpLift itself - it keeps the platform free for everyone"
                    className="btn-shine group inline-flex h-12 shrink-0 items-center gap-2.5 self-start md:self-auto rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 px-5 text-sm font-bold text-white shadow-lg shadow-pink-600/25 transition-all hover:-translate-y-0.5 hover:shadow-pink-600/40"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white">
                      <Heart className="heartbeat w-3.5 h-3.5 fill-pink-600 text-pink-600" />
                    </span>
                    Support The Platform
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* --- FOOTER --- */}
        <footer className="relative pt-6 pb-6">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <BrandLogo className="h-10 w-10" />
                <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-slate-100">HelpLift</span>
              </div>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Giving made transparent. Impact made real.</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-bold text-slate-500 dark:text-slate-400">
              <Link href="/privacy" data-tip="How HelpLift collects, uses and protects your information" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
              <Link href="/terms" data-tip="The rules for using HelpLift" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-4 mt-6 text-center text-sm font-medium text-slate-400">
            © 2026 HelpLift. Empowering verified community support.
          </div>
        </footer>
      </main>

    </div>
  )
}

// --- Homepage section building blocks ----------------------------------------

// A soft, slightly lighter area used by the sections below the hero - no
// outline or shadow, so sections blend into the page rather than sitting on it.
const PANEL = "rounded-2xl bg-white/70 dark:bg-slate-900/40"

// Section heading: a small icon label, a bold title and a short line under it,
// with an optional action (button or arrows) on the right.
function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  action,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>
  eyebrow: string
  title: string
  subtitle?: string
  action?: React.ReactNode
  id?: string
}) {
  return (
    <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400">
          <span className="reveal-pop flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {eyebrow}
        </p>
        <h2 id={id} className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="mt-2 text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// How many questions show beside the contact form; the rest are in the
// "See all questions" window.
const FAQ_PREVIEW_COUNT = 6

// One expandable question - in the homepage list and the all-questions window.
function FaqItem({
  faq,
  number,
  isOpen,
  onToggle,
  tinted = false,
}: {
  faq: { question: string; answer: string }
  number: number
  isOpen: boolean
  onToggle: () => void
  /** Use a grey fill (inside a white window) instead of the page's white one. */
  tinted?: boolean
}) {
  const idle = tinted
    ? "bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
    : "bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900/70"
  return (
    <div className={`rounded-xl transition-colors duration-300 ${isOpen ? "bg-blue-50/80 dark:bg-blue-950/30" : idle}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={activateOnKey}
        className="group flex w-full items-center gap-4 px-4 py-4 text-left cursor-pointer focus:outline-none"
      >
        <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950 px-2 text-xs font-bold text-blue-600 dark:text-blue-400">
          {String(number).padStart(2, "0")}
        </span>
        <span className={`flex-1 text-sm md:text-base font-bold transition-colors ${isOpen ? "text-blue-600" : "text-slate-900 dark:text-slate-100 group-hover:text-blue-600"}`}>
          {faq.question}
        </span>
        <span className={`shrink-0 text-blue-600 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </span>
      </div>
      <div className={`grid transition-all duration-500 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="px-4 pb-5 pl-[4.25rem] text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-justify-smart">{faq.answer}</p>
        </div>
      </div>
    </div>
  )
}
