"use client"

import { useState, Suspense, FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, ShieldCheck, HeartHandshake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [token, setToken] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    setMessage("")

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: "signup",
      })
      if (error) throw error

      setStatus("success")
      setMessage("Your account is verified. Redirecting you in...")
      setTimeout(() => router.push("/login?verified=1"), 2000)
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Invalid or expired code. Please try again.")
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center bg-background overflow-x-hidden">

      {/* --- BACKGROUND DECORATIONS --- */}
      <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[50%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 w-full max-w-[600px] px-6 pb-10 pt-24 flex flex-col items-center z-20">

        {status !== "success" ? (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* WELCOME/INFO SECTION */}
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mx-auto">
                <HeartHandshake className="w-4 h-4" />
                <span>HelpLift Account Verification</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground leading-none uppercase">
                Verify Your <span className="text-primary italic">Account</span>
              </h1>

              <p className="text-muted-foreground text-base max-w-sm mx-auto">
                Enter the code we emailed you to finalize your access to the platform.
              </p>
            </div>

            {/* FORM SECTION */}
            <div className="w-full px-4 md:px-8">
              {status === "loading" ? (
                <div className="flex flex-col items-center gap-6 py-12">
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                  <p className="text-muted-foreground text-sm">Verifying your account...</p>
                </div>
              ) : (
                <form onSubmit={handleVerify} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 ml-1">Account Email Address</label>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex w-full h-12 bg-transparent border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:outline-none focus-visible:border-primary transition-all text-foreground rounded-none"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80 ml-1">Verification Code</label>
                    <div className="relative group">
                      <div className="absolute left-0 bottom-3 pl-2">
                        <ShieldCheck className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      </div>
                      <Input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter code from email..."
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="flex w-full pl-10 h-12 bg-transparent border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:outline-none focus-visible:border-primary transition-all text-foreground rounded-none font-mono tracking-[0.3em]"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-2xl transition-all shadow-xl shadow-primary/20 active:scale-[0.98]"
                  >
                    Complete Verification
                  </Button>
                </form>
              )}

              {status === "error" && (
                <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-center gap-2 text-red-600 font-bold">
                    <XCircle className="w-5 h-5" />
                    <span>Verification Failed</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{message}</p>
                  <Button
                    variant="outline"
                    onClick={() => setStatus("idle")}
                    className="rounded-full px-6 border-border hover:bg-muted text-xs font-bold"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              <div className="mt-12 text-center">
                <p className="text-xs text-muted-foreground/60 leading-relaxed italic">
                  Need organization verification assistance? Contact <span className="text-primary font-bold cursor-pointer hover:underline">HelpLift Support</span>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* SUCCESS STATE */
          <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500 pt-10">
            <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-primary/20">
              <CheckCircle2 className="w-10 h-10 text-primary animate-bounce" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-black tracking-tight uppercase">Success!</h2>
              <p className="text-muted-foreground text-base max-w-sm mx-auto">
                {message}
              </p>
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary/40 animate-spin" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">Redirecting to login</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER STRIP */}
      <footer className="w-full py-8 text-center mt-auto">
         <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em]">
            HelpLift Community Ecosystem • POPIA & GDPR Compliant
         </p>
      </footer>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
