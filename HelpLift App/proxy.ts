import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

type UserRole = "giver" | "organization" | "admin"

const roleHome: Record<UserRole, string> = {
  giver: "/givers-dashboard",
  organization: "/organisation-dashboard",
  admin: "/admin-dashboard",
}

const protectedRoutes: { prefix: string; roles?: UserRole[] }[] = [
  { prefix: "/givers-dashboard", roles: ["giver"] },
  { prefix: "/organisation-dashboard", roles: ["organization"] },
  { prefix: "/admin-dashboard", roles: ["admin"] },
  { prefix: "/profile" },
  { prefix: "/suspended" },
  { prefix: "/pending-verification" },
]

// Every non-"approved" state — an org waiting on its first review, waiting on
// a resubmission, or turned down — is gated the same way until an admin acts.
async function isUnverifiedOrganization(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
) {
  const { data: org } = await supabase
    .from("organizations")
    .select("verification_status")
    .eq("profile_id", userId)
    .single()
  return !!org && org.verification_status !== "approved"
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const matchedRoute = protectedRoutes.find((route) => pathname.startsWith(route.prefix))

  if (matchedRoute && !user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && matchedRoute) {
    const { data: profile } = await supabase.from("profiles").select("role, suspended").eq("id", user.id).single()
    const role = profile?.role as UserRole | undefined
    if (!role) return NextResponse.redirect(new URL("/login", request.url))
    if (profile?.suspended && pathname !== "/suspended") {
      return NextResponse.redirect(new URL("/suspended", request.url))
    }
    if (matchedRoute.roles && !matchedRoute.roles.includes(role)) {
      return NextResponse.redirect(new URL(roleHome[role], request.url))
    }
    if (
      role === "organization" &&
      !profile?.suspended &&
      pathname.startsWith("/organisation-dashboard") &&
      (await isUnverifiedOrganization(supabase, user.id))
    ) {
      return NextResponse.redirect(new URL("/pending-verification", request.url))
    }
  }

  if (user && pathname === "/suspended") {
    const { data: profile } = await supabase.from("profiles").select("role, suspended").eq("id", user.id).single()
    const role = profile?.role as UserRole | undefined
    if (role && !profile?.suspended) return NextResponse.redirect(new URL(roleHome[role], request.url))
  }

  if (user && pathname === "/pending-verification") {
    const { data: profile } = await supabase.from("profiles").select("role, suspended").eq("id", user.id).single()
    const role = profile?.role as UserRole | undefined
    if (role !== "organization") return NextResponse.redirect(new URL(role ? roleHome[role] : "/login", request.url))
    if (profile?.suspended) return NextResponse.redirect(new URL("/suspended", request.url))
    if (!(await isUnverifiedOrganization(supabase, user.id))) {
      return NextResponse.redirect(new URL(roleHome.organization, request.url))
    }
  }

  // A suspended or not-yet-approved user is left alone here (not bounced to
  // /suspended or /pending-verification) — they're still logged in as that
  // gated account, but /login and /register need to stay reachable so they
  // can sign into a different account or register a new one instead of
  // being stuck. Only a fully-cleared user gets redirected to their home.
  if (user && ["/login", "/register"].includes(pathname)) {
    const { data: profile } = await supabase.from("profiles").select("role, suspended").eq("id", user.id).single()
    const role = profile?.role as UserRole | undefined
    if (role && !profile?.suspended) {
      const stillGated = role === "organization" && (await isUnverifiedOrganization(supabase, user.id))
      if (!stillGated) return NextResponse.redirect(new URL(roleHome[role], request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/givers-dashboard/:path*", "/organisation-dashboard/:path*", "/admin-dashboard/:path*", "/profile/:path*", "/suspended", "/pending-verification", "/login", "/register"],
}
