import type { SupabaseClient, User } from "@supabase/supabase-js"

// A brand-new Google account is created by the database as a giver, because it
// can't know what the person meant to register as. This sets the account type
// they actually chose (giver or organization), swapping the giver/organization
// record the database made, and remembers that the choice was made so the
// "Finish signing up" page doesn't ask again.
//
// Uses the service role: it changes profiles.role, which people can't change
// for themselves (see 20260920001100_google_org_signup.sql). Only call this for
// a Google sign-up whose registration is not yet complete.
//
// Returns an error message, or null on success.
export async function setSignupRole(
  admin: SupabaseClient,
  user: User,
  profile: { role: string; full_name: string | null },
  role: "giver" | "organization"
): Promise<string | null> {
  if (profile.role !== role) {
    const { error } = await admin.from("profiles").update({ role }).eq("id", user.id)
    if (error) return error.message

    if (role === "organization") {
      await admin.from("givers").delete().eq("profile_id", user.id)
      const { data: existing } = await admin.from("organizations").select("id").eq("profile_id", user.id).maybeSingle()
      if (!existing) {
        const { error: insertError } = await admin.from("organizations").insert({
          profile_id: user.id,
          name: profile.full_name || user.email || "New organization",
          type: "Other",
          contact_email: user.email,
        })
        if (insertError) return insertError.message
      }
    } else {
      await admin.from("organizations").delete().eq("profile_id", user.id)
      const { data: existing } = await admin.from("givers").select("id").eq("profile_id", user.id).maybeSingle()
      if (!existing) {
        const { error: insertError } = await admin.from("givers").insert({
          profile_id: user.id,
          name: profile.full_name || user.email || "New giver",
          email: user.email,
          account_type: "individual",
        })
        if (insertError) return insertError.message
      }
    }
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, signup_role_chosen: true },
  })
  return metadataError ? metadataError.message : null
}
