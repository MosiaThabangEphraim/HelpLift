"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, AlertTriangle, XCircle, LogOut, Mail, UploadCloud, FileText, Loader2, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MessageComposeDialog } from "@/components/message-compose-dialog"

type OrgDocument = { id: string; file_name: string; document_type: string; created_at: string }

const STATUS_COPY: Record<string, { icon: typeof Clock; title: string; body: string; tone: string }> = {
  pending: {
    icon: Clock,
    title: "Verification Pending",
    body: "Your organization is awaiting review by a HelpLift administrator. You'll be able to publish needs and receive donations as soon as it's approved.",
    tone: "bg-amber-600",
  },
  more_info_requested: {
    icon: AlertTriangle,
    title: "Additional Information Needed",
    body: "An administrator needs more information before your organization can be approved.",
    tone: "bg-amber-600",
  },
  rejected: {
    icon: XCircle,
    title: "Verification Rejected",
    body: "Your organization's verification was not approved. Message an administrator if you'd like to provide more information or ask for another review.",
    tone: "bg-red-600",
  },
}

// Mirrors /suspended: the only page a not-yet-approved organization can reach
// (proxy.ts redirects every other org route here). Unlike suspension, they
// can still submit documents and get moved forward — just not touch the rest
// of the platform while pending.
export default function PendingVerificationPage() {
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [documents, setDocuments] = useState<OrgDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedDocType, setSelectedDocType] = useState("supporting_document")
  const [isUploading, setIsUploading] = useState(false)
  const [isResubmitting, setIsResubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const [isMessagingAdmin, setIsMessagingAdmin] = useState(false)
  const [sentToAdmin, setSentToAdmin] = useState(false)

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: org } = await supabase
      .from("organizations")
      .select("verification_status, verification_notes")
      .eq("profile_id", user.id)
      .single()
    setStatus(org?.verification_status || "pending")
    setNotes(org?.verification_notes || null)

    const documentsResponse = await fetch("/api/organization/documents")
    if (documentsResponse.ok) setDocuments((await documentsResponse.json()).documents || [])
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const handleResubmit = async () => {
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

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </main>
    )
  }

  const copy = STATUS_COPY[status || "pending"] || STATUS_COPY.pending
  const StatusIcon = copy.icon

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 px-4 py-16 md:py-24">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <section className="text-center space-y-3">
          <div className={`inline-flex rounded-2xl ${copy.tone} p-4 text-white mx-auto`}>
            <StatusIcon className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.title}</h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">{copy.body}</p>
          {status !== "rejected" && (
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 max-w-md mx-auto">
              Keep an eye on your email — we'll notify you there as soon as your organization is approved, or if an administrator needs anything else from you.
            </p>
          )}
          {notes && (
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 rounded-xl p-3 mt-2 text-left max-w-md mx-auto">
              <span className="font-bold">Note from admin: </span>{notes}
            </p>
          )}
        </section>

        {(error || message) && (
          <div className={`flex items-center gap-2 rounded-2xl border p-4 text-sm font-semibold ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}>
            {error ? <XCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
            {error || message}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Submit a document</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Upload registration or tax evidence for admin review. Maximum 10 MB.</p>
          </div>
          <form onSubmit={uploadDocument} className="space-y-4">
            <div>
              <Label htmlFor="pending-doc-type">Document type</Label>
              <select
                id="pending-doc-type"
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="registration_certificate">NPO / NGO Registration Certificate</option>
                <option value="tax_exemption">SARS Section 18A / Tax Exemption</option>
                <option value="founding_document">Constitution / Trust Deed</option>
                <option value="proof_of_banking">Proof of Banking Details (bank letter / statement)</option>
                <option value="supporting_document">Other Verification Document</option>
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 dark:border-[#2C3E63] p-5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-500">
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
            <button disabled={isUploading || selectedFiles.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {selectedFiles.length > 1 ? `Upload ${selectedFiles.length} documents` : "Upload document"}
            </button>
          </form>

          {documents.length > 0 && (
            <div className="space-y-2 pt-2">
              {documents.map(document => (
                <div key={document.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-[#233350] p-3">
                  <span className="flex items-center gap-2.5 text-sm font-semibold truncate">
                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="truncate">{document.file_name}</span>
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 capitalize">{document.document_type.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          )}

          {status === "more_info_requested" && (
            <button
              onClick={handleResubmit}
              disabled={isResubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 text-sm font-bold disabled:opacity-50"
            >
              {isResubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Resubmit for Review
            </button>
          )}
        </section>

        <section className="text-center space-y-4">
          {sentToAdmin ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Message sent — an administrator will get back to you.
            </p>
          ) : (
            <Button onClick={() => setIsMessagingAdmin(true)} variant="outline" className="w-full max-w-md mx-auto">
              <Mail className="w-4 h-4 mr-1.5" /> Message Admin
            </Button>
          )}

          <button onClick={logout} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mx-auto">
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </section>
      </div>

      <MessageComposeDialog
        open={isMessagingAdmin}
        onOpenChange={setIsMessagingAdmin}
        recipientLabel="Admin"
        target="admin"
        onSent={() => setSentToAdmin(true)}
      />
    </main>
  )
}
