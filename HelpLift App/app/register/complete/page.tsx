"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, Building2, CheckCircle2, FileText, HeartHandshake, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { PasswordRequirements } from "@/components/password-requirements"
import { isPasswordValid } from "@/lib/password"
import { NEED_CATEGORIES } from "@/lib/categories"

const inputClass = "w-full bg-transparent border-0 border-b-2 border-slate-200 dark:border-slate-800 focus:border-blue-600 pb-2 outline-none text-slate-900 dark:text-slate-100 transition-all"

function FieldLabel({ children, required = true }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-slate-400 dark:text-slate-500 normal-case font-medium"> (optional)</span>}
    </label>
  )
}

type DocumentSlot = { type: string; file: File | null }

// Step two of signing up with Google. Google has verified the email, but the
// person still gives the same details as a normal registration (giver or
// organization) and chooses a password. The site keeps sending an unfinished
// Google sign-up here until they're done (see proxy.ts).
export default function CompleteRegistrationPage() {
  const router = useRouter()
  const supabase = createClient()

  const [role, setRole] = useState<"giver" | "organization" | null>(null)
  // Whether they've said what they're registering as. A Google sign-up that
  // started from the Register page has; one that started from Login hasn't.
  const [roleChosen, setRoleChosen] = useState(false)
  const [isChoosing, setIsChoosing] = useState(false)
  const [email, setEmail] = useState("")
  const [googleName, setGoogleName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  // Giver
  const [accountType, setAccountType] = useState<"individual" | "business" | "group">("individual")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [locations, setLocations] = useState("")

  // Organization
  const [orgName, setOrgName] = useState("")
  const [regNum, setRegNum] = useState("")
  const [orgType, setOrgType] = useState("School")
  const [address, setAddress] = useState("")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [contact, setContact] = useState("")
  const [orgPhone, setOrgPhone] = useState("")
  const [mission, setMission] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankAccountHolder, setBankAccountHolder] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankBranchCode, setBankBranchCode] = useState("")
  const [bankAccountType, setBankAccountType] = useState("")
  const [documents, setDocuments] = useState<DocumentSlot[]>([{ type: "registration_certificate", file: null }])

  // Password (both)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordTouched, setPasswordTouched] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace("/login")
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      const fullName = (user.user_metadata?.full_name || user.user_metadata?.name || "") as string
      setEmail(user.email || "")
      setGoogleName(fullName)
      setName(fullName)
      setContact(fullName)
      setRole(profile?.role === "organization" ? "organization" : "giver")
      setRoleChosen(user.user_metadata?.signup_role_chosen === true)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const passwordsMatch = confirmPassword === "" || password === confirmPassword
  const passwordOk = isPasswordValid(password) && password === confirmPassword
  const canSubmit =
    role === "organization"
      ? passwordOk && !!orgName.trim() && !!regNum.trim() && !!address.trim() && !!province.trim() && !!city.trim() && !!contact.trim()
      : passwordOk && !!name.trim() && !!phone.trim()

  const toggleCategory = (category: string) =>
    setCategories(current => (current.includes(category) ? current.filter(c => c !== category) : [...current, category]))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setIsSaving(true)
    setError("")
    try {
      let res: Response
      if (role === "organization") {
        const formData = new FormData()
        const fields: Record<string, string> = {
          orgName, regNum, orgType, address, province, city, contact, phone: orgPhone, mission,
          bankName, bankAccountHolder, bankAccountNumber, bankBranchCode, bankAccountType, password,
        }
        Object.entries(fields).forEach(([key, value]) => formData.append(key, value))
        const attached = documents.filter(d => d.file)
        attached.forEach(d => formData.append("documentFiles", d.file as File))
        formData.append("documentTypes", JSON.stringify(attached.map(d => d.type)))
        res = await fetch("/api/register/complete", { method: "POST", body: formData })
      } else {
        res = await fetch("/api/register/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: name, phone, account_type: accountType, categories: categories.join(","), locations, password }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not finish your registration.")
      // Organizations go through the normal "pending verification" gate from here.
      router.replace(role === "organization" ? "/organisation-dashboard" : "/givers-dashboard")
    } catch (err: any) {
      setError(err.message || "Could not finish your registration.")
      setIsSaving(false)
    }
  }

  const chooseRole = async (choice: "giver" | "organization") => {
    setIsChoosing(true)
    setError("")
    try {
      const res = await fetch("/api/register/choose-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: choice }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not save your choice.")
      setRole(choice)
      setRoleChosen(true)
    } catch (err: any) {
      setError(err.message || "Could not save your choice.")
    } finally {
      setIsChoosing(false)
    }
  }

  const useAnotherAccount = async () => {
    await supabase.auth.signOut()
    router.replace("/register")
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (!roleChosen) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex flex-col items-center py-20 px-4">
        <div className="text-center mb-10">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-3 rounded-2xl shadow-lg inline-block mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Welcome to HelpLift</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-md mx-auto">
            Google has verified <strong>{email}</strong>. How would you like to use HelpLift?
          </p>
        </div>

        {error && (
          <div className="w-full max-w-xl mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700 text-sm font-semibold">
            <AlertCircle className="h-5 w-5 shrink-0" />{error}
          </div>
        )}

        <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => chooseRole("giver")}
            disabled={isChoosing}
            className="p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition-all flex flex-col items-center gap-3 text-center disabled:opacity-60"
          >
            <HeartHandshake className="w-8 h-8 text-blue-600" />
            <span className="font-bold">I want to give</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Register as a giver: individual, business or group.</span>
          </button>
          <button
            type="button"
            onClick={() => chooseRole("organization")}
            disabled={isChoosing}
            className="p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition-all flex flex-col items-center gap-3 text-center disabled:opacity-60"
          >
            <Building2 className="w-8 h-8 text-blue-600" />
            <span className="font-bold">I'm an organization</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Register a school, charity or community group that needs support.</span>
          </button>
        </div>

        {isChoosing && <Loader2 className="mt-6 w-6 h-6 text-blue-600 animate-spin" />}

        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Not you?{" "}
          <button type="button" onClick={useAnotherAccount} className="text-blue-600 font-bold hover:underline">Use a different account</button>
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex flex-col items-center py-20 px-4">
      <div className="text-center mb-10">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-3 rounded-2xl shadow-lg inline-block mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Finish signing up</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-md mx-auto">
          Google has verified your email. {role === "organization"
            ? "Add your organization's details and choose a password to complete your registration."
            : "Add your details and choose a password to complete your giver account."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-8 pb-20">
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700 text-sm font-semibold">
            <AlertCircle className="h-5 w-5 shrink-0" />{error}
          </div>
        )}

        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>Signed in with Google as <strong>{email}</strong>. Email verified.</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Registering as {role === "organization" ? "an organization" : "a giver"}.{" "}
          <button type="button" onClick={() => setRoleChosen(false)} className="font-bold text-blue-600 hover:underline">Wrong type? Change</button>
        </p>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Fields marked <span className="text-red-500 font-bold">*</span> are required.
        </p>

        {role === "organization" ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Organization Details</h2>
            <div>
              <FieldLabel>Organization Name</FieldLabel>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} className={inputClass} placeholder="e.g. Hope Academy Foundation" required />
            </div>
            <div>
              <FieldLabel>Registration Number</FieldLabel>
              <input value={regNum} onChange={e => setRegNum(e.target.value)} className={inputClass} placeholder="NPO / company registration number" required />
            </div>
            <div>
              <FieldLabel>Organization Type</FieldLabel>
              <select value={orgType} onChange={e => setOrgType(e.target.value)} className={inputClass}>
                <option>School</option>
                <option>Church</option>
                <option>Non-Profit</option>
                <option>Welfare Group</option>
              </select>
            </div>
            <div>
              <FieldLabel>Physical Address</FieldLabel>
              <input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} placeholder="Street address" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Province</FieldLabel>
                <input value={province} onChange={e => setProvince(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <FieldLabel>City</FieldLabel>
                <input value={city} onChange={e => setCity(e.target.value)} className={inputClass} required />
              </div>
            </div>
            <div>
              <FieldLabel>Contact Person &amp; Role</FieldLabel>
              <input value={contact} onChange={e => setContact(e.target.value)} className={inputClass} placeholder="e.g. Sarah M., Centre Director" required />
            </div>
            <div>
              <FieldLabel>Contact Email</FieldLabel>
              <input value={email} readOnly className={`${inputClass} text-slate-500 dark:text-slate-400`} />
              <p className="mt-1.5 text-xs text-slate-400">From your Google account. It can't be changed here.</p>
            </div>
            <div>
              <FieldLabel required={false}>Phone Number</FieldLabel>
              <input value={orgPhone} onChange={e => setOrgPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <FieldLabel required={false}>Mission Statement</FieldLabel>
              <textarea value={mission} onChange={e => setMission(e.target.value)} className={`${inputClass} h-24`} placeholder="What does your organization do, and who does it serve?" />
            </div>

            <div className="pt-2">
              <div className="space-y-0.5 mb-3">
                <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Banking Details <span className="text-slate-400 dark:text-slate-500 normal-case font-medium">(optional)</span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">Where donations are forwarded to you. You can also add this later from your dashboard.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><FieldLabel required={false}>Bank Name</FieldLabel><input value={bankName} onChange={e => setBankName(e.target.value)} className={inputClass} placeholder="e.g. ABSA Bank" /></div>
                <div><FieldLabel required={false}>Account Holder Name</FieldLabel><input value={bankAccountHolder} onChange={e => setBankAccountHolder(e.target.value)} className={inputClass} placeholder="Must match your organization's name" /></div>
                <div><FieldLabel required={false}>Account Number</FieldLabel><input value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} className={inputClass} /></div>
                <div><FieldLabel required={false}>Branch Code</FieldLabel><input value={bankBranchCode} onChange={e => setBankBranchCode(e.target.value)} className={inputClass} /></div>
                <div><FieldLabel required={false}>Account Type</FieldLabel><input value={bankAccountType} onChange={e => setBankAccountType(e.target.value)} className={inputClass} placeholder="e.g. Cheque Account" /></div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-0.5">
                <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Supporting Verification Documents <span className="text-slate-400 dark:text-slate-500 normal-case font-medium">(optional)</span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Recommended for quick approval. PDF, PNG or JPG, up to 10 MB each.</p>
              </div>
              {documents.map((doc, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={doc.type}
                    onChange={e => setDocuments(docs => docs.map((d, i) => (i === index ? { ...d, type: e.target.value } : d)))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
                  >
                    <option value="registration_certificate">NPO / NGO Registration Certificate</option>
                    <option value="tax_exemption">SARS Section 18A / Tax Exemption</option>
                    <option value="founding_document">Constitution / Trust Deed</option>
                    <option value="proof_of_banking">Proof of Banking Details (bank letter / statement)</option>
                    <option value="supporting_document">Other Verification Document</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 rounded-xl cursor-pointer">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{doc.file ? doc.file.name : "Select document (.pdf, .png, .jpg)"}</span>
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={e => {
                          const file = e.target.files?.[0] || null
                          setDocuments(docs => docs.map((d, i) => (i === index ? { ...d, file } : d)))
                        }}
                        className="sr-only"
                      />
                    </label>
                    {documents.length > 1 && (
                      <button type="button" aria-label="Remove" onClick={() => setDocuments(docs => docs.filter((_, i) => i !== index))} className="text-slate-400 hover:text-red-600 font-bold shrink-0 px-1">✕</button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setDocuments(docs => [...docs, { type: "supporting_document", file: null }])} className="text-xs font-bold text-blue-600 hover:underline">
                + Add another document
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Giver Information</h2>
            <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-full">
              {(["individual", "business", "group"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={`flex-1 py-3 rounded-full capitalize text-sm font-bold transition-all ${accountType === type ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div>
              <FieldLabel>{accountType === "individual" ? "Full Name" : "Business/Group Name"}</FieldLabel>
              <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder={googleName || undefined} required />
            </div>
            <div>
              <FieldLabel>Email Address</FieldLabel>
              <input value={email} readOnly className={`${inputClass} text-slate-500 dark:text-slate-400`} />
              <p className="mt-1.5 text-xs text-slate-400">From your Google account. It can't be changed here.</p>
            </div>
            <div>
              <FieldLabel>Phone Number</FieldLabel>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <FieldLabel required={false}>Preferred Support Categories</FieldLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NEED_CATEGORIES.map(category => (
                  <label key={category} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={categories.includes(category)} onChange={() => toggleCategory(category)} className="w-4 h-4 accent-blue-600" />
                    {category}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel required={false}>Preferred Locations</FieldLabel>
              <input value={locations} onChange={e => setLocations(e.target.value)} className={inputClass} placeholder="e.g. Gauteng, Cape Town" />
            </div>
          </div>
        )}

        <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Secure your account</h2>
          <div>
            <FieldLabel>Password</FieldLabel>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPasswordTouched(true)}
              type="password"
              className={inputClass}
              placeholder="Choose a strong password"
              required
            />
            {(passwordTouched || password) && <PasswordRequirements password={password} />}
          </div>
          <div>
            <FieldLabel>Confirm Password</FieldLabel>
            <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" className={inputClass} required />
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">Passwords do not match.</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSaving || !canSubmit}
          className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full shadow-lg transition-all disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
          {isSaving ? "Finishing..." : "Complete Registration"}
        </Button>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Not you?{" "}
          <button type="button" onClick={useAnotherAccount} className="text-blue-600 font-bold hover:underline">Use a different account</button>
        </p>
      </form>
    </div>
  )
}
