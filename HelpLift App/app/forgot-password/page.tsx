"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  Mail, 
  ChevronLeft, 
  Loader2, 
  Send,
  HeartHandshake
} from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [email, setEmail] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg("")

    try {
      const response = await fetch("/api/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || "Unable to send verification code.")
      setIsSubmitted(true)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Unable to send verification code.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center bg-background overflow-x-hidden">
      
      {/* --- BACKGROUND DECORATIONS --- */}
      <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[50%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 w-full max-w-[600px] px-6 pb-10 pt-24 flex flex-col items-center z-20">
        
        {/* BACK TO LOGIN LINK */}
        <div className="w-full mb-8">
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>

        {!isSubmitted ? (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* WELCOME/INFO SECTION */}
            <div className="text-center space-y-4 mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mx-auto">
                <HeartHandshake className="w-4 h-4" />
                <span>HelpLift Account Recovery</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground leading-none uppercase">
                Reset Your <span className="text-primary italic">Password</span>
              </h1>
              
              <p className="text-muted-foreground text-base max-w-sm mx-auto">
                Enter your registered account email and we'll send you a verification code to regain access.
              </p>
            </div>

            {/* FORM SECTION */}
            <div className="w-full px-4 md:px-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {errorMsg && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{errorMsg}</p>}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground/80 ml-1">Account Email Address</label>
                  <div className="relative group">
                    <div className="absolute left-0 bottom-3 pl-2">
                      <Mail className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    </div>
                    <input 
                      type="email" 
                      placeholder="name@example.com" 
                      className="flex w-full pl-10 h-12 bg-transparent border-0 border-b-2 border-border focus:ring-0 focus:outline-none focus:border-primary transition-all text-foreground"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-2xl transition-all shadow-xl shadow-primary/20 active:scale-[0.98]"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending Code...
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      Send Verification Code
                      <Send className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="mt-12 text-center">
                <p className="text-xs text-muted-foreground/60 leading-relaxed italic">
                  Need organization verification assistance? Contact <span className="text-primary font-bold cursor-pointer hover:underline">HelpLift Support</span>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* SUCCESS STATE */
          <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-primary/20">
              <Send className="w-10 h-10 text-primary" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-black tracking-tight">Check Your Email</h2>
              <p className="text-muted-foreground text-base">
                A verification code has been sent to <br />
                <span className="text-foreground font-bold underline decoration-primary/30 decoration-2">{email}</span>
              </p>
            </div>

            <div className="pt-4 space-y-4">
              <Button
                onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-2xl transition-all shadow-xl shadow-primary/20 active:scale-[0.98]"
              >
                Enter Verification Code
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsSubmitted(false)}
                className="rounded-full px-8 border-border hover:bg-muted font-bold"
              >
                Try a different email
              </Button>
              <p className="text-sm text-muted-foreground">
                Didn't receive it? Check your spam folder, or go back and resend.
              </p>
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
