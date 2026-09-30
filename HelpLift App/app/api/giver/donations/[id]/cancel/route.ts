import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Lets a giver mark their own still-pending donation as unsuccessful - e.g.
// PayFast bounced them back without ever completing the checkout (their ITN
// webhook never fires in that case, so the donation would otherwise sit as
// "pending" forever), or they simply changed their mind before an admin
// looked at it. Only ever downgrades their own donation to "unsuccessful";
// it can't be used to approve or alter anything.
//
// prevent_donation_tamper() blocks a giver's own authenticated client from
// changing `status` at all (see 20260914001900_donations.sql /
// 20260923000100_donation_org_assignment_on_claim.sql) - the same rule that
// stops them faking a "successful" donation. So this route verifies
// ownership with the giver's session, then performs the actual update with
// the service-role client, the same way the PayFast ITN webhook does.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { id } = await context.params
    const { data: donation } = await supabase.from("donations").select("id, giver_id, donor_profile_id, status").eq("id", id).single()
    if (!donation) return NextResponse.json({ message: "Donation not found." }, { status: 404 })

    // Either a giver's own donation (need/gift pledge - identified by
    // giver_id), or a "Support The Platform" donation (identified by
    // donor_profile_id instead, since an organization has no givers row -
    // see 20260926000400_platform_donations.sql).
    let owns = false
    if (donation.giver_id) {
      const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
      owns = !!giver && donation.giver_id === giver.id
    } else if (donation.donor_profile_id) {
      owns = donation.donor_profile_id === user.id
    }
    if (!owns) return NextResponse.json({ message: "Donation not found." }, { status: 404 })
    if (donation.status !== "pending") {
      return NextResponse.json({ message: "This donation has already been reviewed and can no longer be cancelled." }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("donations")
      .update({ status: "unsuccessful", admin_notes: "Cancelled by the donor before payment was completed." })
      .eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Donor donation cancel error:", error)
    return NextResponse.json({ message: "Could not cancel this donation." }, { status: 503 })
  }
}
