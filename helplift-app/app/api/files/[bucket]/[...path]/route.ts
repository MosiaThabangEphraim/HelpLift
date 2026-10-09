import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PRIVATE_FILE_BUCKETS } from "@/lib/file-links"

// Opens a private file (lib/file-links.ts). The link itself never expires:
// each click signs a fresh URL valid for two minutes and redirects to it.
// Signing uses the visitor's own session, so the bucket's storage policies
// decide access exactly as before - someone who couldn't read the file
// directly can't open it through here either.
export async function GET(_request: Request, context: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await context.params
  if (!(PRIVATE_FILE_BUCKETS as readonly string[]).includes(bucket)) {
    return NextResponse.json({ message: "File not found." }, { status: 404 })
  }
  const objectPath = (path || []).map(segment => decodeURIComponent(segment)).join("/")
  if (!objectPath || objectPath.includes("..")) return NextResponse.json({ message: "File not found." }, { status: 404 })

  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 120)
  if (error || !data?.signedUrl) {
    const { data: { user } } = await supabase.auth.getUser()
    return NextResponse.json(
      { message: user ? "You don't have access to this file, or it no longer exists." : "Sign in to open this file." },
      { status: user ? 403 : 401 },
    )
  }
  const response = NextResponse.redirect(data.signedUrl)
  response.headers.set("Cache-Control", "no-store")
  return response
}
