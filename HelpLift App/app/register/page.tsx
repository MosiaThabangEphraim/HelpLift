"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Building, Briefcase, FileText, AlertCircle, Loader2 } from "lucide-react"
import { PasswordRequirements } from "@/components/password-requirements"
import { isPasswordValid, isValidEmail } from "@/lib/password"
import { NEED_CATEGORIES } from "@/lib/categories"
import { GoogleSignInButton } from "@/components/google-sign-in-button"
import { BackButton } from "@/components/back-button"

function FieldLabel({ children, required = true }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-slate-400 dark:text-slate-500 normal-case font-medium"> (optional)</span>}
    </label>
  )
}

const inputClass = "w-full bg-transparent border-0 border-b-2 border-slate-200 dark:border-slate-800 focus:border-blue-600 pb-2 outline-none text-slate-900 dark:text-slate-100 transition-all"

export default function RegisterPage() {
  const router = useRouter()
  const [role, setRole] = useState<"organization" | "giver" | null>(null)

  // State for Organization Fields
  const [orgName, setOrgName] = useState("")
  const [regNum, setRegNum] = useState("")
  const [orgType, setOrgType] = useState("School")
  const [address, setAddress] = useState("")
  const [province, setProvince] = useState("")
  const [city, setCity] = useState("")
  const [contact, setContact] = useState("")
  const [email, setEmail] = useState("")
  const [mission, setMission] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankAccountHolder, setBankAccountHolder] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankBranchCode, setBankBranchCode] = useState("")
  const [bankAccountType, setBankAccountType] = useState("")
  const [documents, setDocuments] = useState<{ type: string; file: File | null }[]>([
    { type: "registration_certificate", file: null },
  ])

  // State for Giver Fields
  const [accountType, setAccountType] = useState<"individual" | "business" | "group">("individual")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [categories, setCategories] = useState("")
  const [locations, setLocations] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  const emailValid = email === "" || isValidEmail(email)
  const passwordValid = isPasswordValid(password)
  const passwordsMatch = confirmPassword === "" || password === confirmPassword

  const canSubmit = useMemo(() => {
    if (!role) return false
    if (!email || !isValidEmail(email)) return false
    if (!passwordValid) return false
    if (!confirmPassword || password !== confirmPassword) return false
    return true
  }, [role, email, passwordValid, confirmPassword, password])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")
    if (!isValidEmail(email)) {
      setErrorMsg("Enter a valid email address.")
      return
    }
    if (!passwordValid) {
      setErrorMsg("Password does not meet all the requirements below.")
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      return
    }
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append("fullName", role === "organization" ? contact : name)
      formData.append("email", email)
      formData.append("password", password)
      formData.append("phone", phone)
      formData.append("role", role as string)

      if (role === "organization") {
        formData.append("orgName", orgName)
        formData.append("regNum", regNum)
        formData.append("orgType", orgType)
        formData.append("address", address)
        formData.append("province", province)
        formData.append("city", city)
        formData.append("contact", contact)
        formData.append("mission", mission)
        formData.append("bankName", bankName)
        formData.append("bankAccountHolder", bankAccountHolder)
        formData.append("bankAccountNumber", bankAccountNumber)
        formData.append("bankBranchCode", bankBranchCode)
        formData.append("bankAccountType", bankAccountType)
        const attachedDocs = documents.filter(d => d.file)
        attachedDocs.forEach(d => formData.append("documentFiles", d.file as File))
        formData.append("documentTypes", JSON.stringify(attachedDocs.map(d => d.type)))
      } else {
        formData.append("accountType", accountType)
        formData.append("categories", categories)
        formData.append("locations", locations)
      }

      const response = await fetch("/api/register", {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || "Registration failed.")
      setSuccessMsg(data.message)
      const destination = data.requiresEmailConfirmation
        ? `/verify-email?email=${encodeURIComponent(email)}`
        : "/login"
      // Leave the message on screen longer when some documents did not upload.
      setTimeout(() => router.push(destination), data.documentsFailed?.length ? 9000 : 1800)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Registration failed.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex flex-col items-center py-20 px-4">
      <div className="w-full max-w-xl mb-6">
        <BackButton fallbackHref="/login" />
      </div>

      <div className="text-center mb-12">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-3 rounded-2xl shadow-lg inline-block mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Join HelpLift</h1>
      </div>

      <div className="w-full max-w-xl grid grid-cols-2 gap-4 mb-10">
        <button
          onClick={() => setRole("organization")}
          className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${role === 'organization' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'}`}
        >
          <Building className="w-8 h-8" />
          <span className="font-bold text-sm">Organization</span>
        </button>
        <button
          onClick={() => setRole("giver")}
          className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${role === 'giver' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'}`}
        >
          <Briefcase className="w-8 h-8" />
          <span className="font-bold text-sm">Giver</span>
        </button>
      </div>

      {role && (
        <div className="w-full max-w-xl mb-8 space-y-4">
          <GoogleSignInButton label="Sign up with Google" intent={role === "organization" ? "org" : "giver"} onError={setErrorMsg} />
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            {role === "organization"
              ? "Google verifies your email. You'll then add your organization's details and documents, and choose a password."
              : "Google verifies your email. You'll then add your details and choose a password."}
          </p>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            or fill in the form
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      )}

      {role && (
        <form onSubmit={handleRegister} className="w-full max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
          {errorMsg && <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700 text-sm font-semibold"><AlertCircle className="h-5 w-5 shrink-0" />{errorMsg}</div>}
          {successMsg && <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold">{successMsg}</div>}

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Fields marked <span className="text-red-500 font-bold">*</span> are required.
          </p>

          {role === 'organization' ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Organization Details</h2>
              <div>
                <FieldLabel>Organization Name</FieldLabel>
                <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} placeholder="e.g. Hope Academy Foundation" required />
              </div>
              <div>
                <FieldLabel>Registration Number</FieldLabel>
                <input value={regNum} onChange={(e) => setRegNum(e.target.value)} className={inputClass} placeholder="NPO / company registration number" required />
              </div>
              <div>
                <FieldLabel>Organization Type</FieldLabel>
                <select value={orgType} onChange={(e) => setOrgType(e.target.value)} className={inputClass}>
                  <option>School</option>
                  <option>Church</option>
                  <option>Non-Profit</option>
                  <option>Welfare Group</option>
                </select>
              </div>
              <div>
                <FieldLabel>Physical Address</FieldLabel>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="Street address" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Province</FieldLabel>
                  <input value={province} onChange={(e) => setProvince(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <FieldLabel>City</FieldLabel>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} required />
                </div>
              </div>
              <div>
                <FieldLabel>Contact Person &amp; Role</FieldLabel>
                <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} placeholder="e.g. Sarah M., Centre Director" required />
              </div>
              <div>
                <FieldLabel>Contact Email</FieldLabel>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  type="email"
                  className={inputClass}
                  placeholder="name@organization.org"
                  required
                />
                {emailTouched && !emailValid && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">Enter a valid email address.</p>
                )}
              </div>
              <div>
                <FieldLabel required={false}>Mission Statement</FieldLabel>
                <textarea value={mission} onChange={(e) => setMission(e.target.value)} className={`${inputClass} h-24`} placeholder="What does your organization do, and who does it serve?" />
              </div>

              <div className="pt-2">
                <div className="space-y-0.5 mb-3">
                  <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Banking Details <span className="text-slate-400 dark:text-slate-500 normal-case font-medium">(optional)</span>
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-justify">
                    Where donations are forwarded to you. You can also add this later from your dashboard. Attaching a bank confirmation letter or statement below (as a Proof of Banking Details) speeds up admin review.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required={false}>Bank Name</FieldLabel>
                    <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} placeholder="e.g. ABSA Bank" />
                  </div>
                  <div>
                    <FieldLabel required={false}>Account Holder Name</FieldLabel>
                    <input value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} className={inputClass} placeholder="Must match your organization's name" />
                  </div>
                  <div>
                    <FieldLabel required={false}>Account Number</FieldLabel>
                    <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={inputClass} placeholder="e.g. 4079635021" />
                  </div>
                  <div>
                    <FieldLabel required={false}>Branch Code</FieldLabel>
                    <input value={bankBranchCode} onChange={(e) => setBankBranchCode(e.target.value)} className={inputClass} placeholder="e.g. 632005" />
                  </div>
                  <div>
                    <FieldLabel required={false}>Account Type</FieldLabel>
                    <input value={bankAccountType} onChange={(e) => setBankAccountType(e.target.value)} className={inputClass} placeholder="e.g. Cheque Account" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Supporting Verification Documents <span className="text-slate-400 dark:text-slate-500 normal-case font-medium">(optional)</span>
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Recommended for quick approval</p>
                </div>

                {documents.map((doc, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={doc.type}
                      onChange={(e) => setDocuments(docs => docs.map((d, i) => i === index ? { ...d, type: e.target.value } : d))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500"
                    >
                      <option value="registration_certificate">NPO / NGO Registration Certificate</option>
                      <option value="tax_exemption">SARS Section 18A / Tax Exemption</option>
                      <option value="founding_document">Constitution / Trust Deed</option>
                      <option value="proof_of_banking">Proof of Banking Details (bank letter / statement)</option>
                      <option value="supporting_document">Other Verification Document</option>
                    </select>

                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                          {doc.file ? doc.file.name : "Select document (.pdf, .png, .jpg)"}
                        </span>
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null
                            setDocuments(docs => docs.map((d, i) => i === index ? { ...d, file } : d))
                          }}
                          className="sr-only"
                        />
                      </label>
                      {documents.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDocuments(docs => docs.filter((_, i) => i !== index))}
                          className="text-slate-400 hover:text-red-600 font-bold shrink-0 px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setDocuments(docs => [...docs, { type: "supporting_document", file: null }])}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  + Add another document
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Giver Information</h2>
              <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                {["individual", "business", "group"].map((type) => (
                  <button key={type} type="button" onClick={() => setAccountType(type as any)} className={`flex-1 py-3 rounded-full capitalize text-sm font-bold transition-all ${accountType === type ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                    {type}
                  </button>
                ))}
              </div>
              <div>
                <FieldLabel>{accountType === 'individual' ? "Full Name" : "Business/Group Name"}</FieldLabel>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <FieldLabel>Email Address</FieldLabel>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  type="email"
                  className={inputClass}
                  placeholder="name@example.com"
                  required
                />
                {emailTouched && !emailValid && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">Enter a valid email address.</p>
                )}
              </div>
              <div>
                <FieldLabel>Phone Number</FieldLabel>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <FieldLabel required={false}>Preferred Support Categories</FieldLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {NEED_CATEGORIES.map(category => {
                    const selected = categories.split(",").map(c => c.trim()).filter(Boolean)
                    return (
                      <label key={category} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.includes(category)}
                          onChange={(e) =>
                            setCategories(
                              (e.target.checked ? [...selected, category] : selected.filter(c => c !== category)).join(",")
                            )
                          }
                          className="w-4 h-4 accent-blue-600"
                        />
                        {category}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <FieldLabel required={false}>Preferred Locations</FieldLabel>
                <input value={locations} onChange={(e) => setLocations(e.target.value)} className={inputClass} placeholder="e.g. Gauteng, Cape Town" />
              </div>
            </div>
          )}

          <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Secure your account</h2>
            <div>
              <FieldLabel>Password</FieldLabel>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" className={inputClass} required />
              {confirmPassword && !passwordsMatch && (
                <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">Passwords do not match.</p>
              )}
            </div>
          </div>

          <Button type="submit" disabled={isLoading || !canSubmit} className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-full shadow-lg transition-all disabled:opacity-50">
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
            {isLoading ? "Creating account..." : "Complete Registration"}
          </Button>
        </form>
      )}

      <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
        Already have an account? <Link href="/login" className="text-blue-600 font-bold hover:underline">Sign In</Link>
      </p>
    </div>
  )
}
