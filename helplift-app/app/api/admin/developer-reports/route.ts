import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/require-admin"

// Developer reports for the admin Dev reports tab, newest first, each proof
// file with a short-lived (1 hour) signed link from the private bucket.
export async function GET() {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error

    const { data, error } = await auth.supabase
      .from("developer_reports")
      .select("id, created_at, report_type, title, description, steps_to_reproduce, page_url, severity, contact_email, user_agent, attachments, status, admin_notes, updated_at")
      .order("created_at", { ascending: false })
      .limit(300)
    if (error) return NextResponse.json({ message: error.message, reports: [] }, { status: 400 })

    const storage = createAdminClient().storage.from("developer-reports")
    const reports = await Promise.all((data || []).map(async report => {
      const files = Array.isArray(report.attachments) ? report.attachments : []
      const attachments = await Promise.all(files.map(async (file: any) => {
        const { data: signed } = await storage.createSignedUrl(file.path, 3600)
        return { name: file.name, type: file.type, size: file.size, url: signed?.signedUrl || null }
      }))
      return { ...report, attachments }
    }))
    return NextResponse.json({ reports })
  } catch (error) {
    console.error("Admin developer reports error:", error)
    return NextResponse.json({ message: "Developer reports are unavailable.", reports: [] }, { status: 503 })
  }
}
