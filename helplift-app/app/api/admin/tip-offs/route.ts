import { NextResponse } from "next/server"
import { fileUrl } from "@/lib/file-links"
import { requireAdmin } from "@/lib/require-admin"

// Tip-offs for the admin Inquiries tab, newest first, each evidence file with
// a permanent link (lib/file-links.ts) that signs a fresh URL when opened.
export async function GET() {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error

    const { data, error } = await auth.supabase
      .from("tip_offs")
      .select("id, created_at, organization_id, organization_name, category, details, occurred_at_text, contact_email, attachments, status, admin_notes, updated_at")
      .order("created_at", { ascending: false })
      .limit(300)
    if (error) return NextResponse.json({ message: error.message, tipOffs: [] }, { status: 400 })
    const tipOffs = await Promise.all((data || []).map(async tipOff => {
      const files = Array.isArray(tipOff.attachments) ? tipOff.attachments : []
      const attachments = await Promise.all(files.map(async (file: any) => {
        const signed = { signedUrl: fileUrl("tip-off-evidence", file.path) }
        return { name: file.name, type: file.type, size: file.size, url: signed?.signedUrl || null }
      }))
      return { ...tipOff, attachments }
    }))
    return NextResponse.json({ tipOffs })
  } catch (error) {
    console.error("Admin tip-offs error:", error)
    return NextResponse.json({ message: "Tip-offs are unavailable.", tipOffs: [] }, { status: 503 })
  }
}
