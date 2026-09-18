import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId, action } = await req.json();

    if (!userId) {
      return NextResponse.json({ success: false, message: "Missing User ID" }, { status: 400 });
    }

    // Mocking security check
    const isUserValid = true; 

    if (!isUserValid) {
      return NextResponse.json({ success: false, message: "Security settings not found" }, { status: 404 });
    }

    if (action === "revoke-all") {
      return NextResponse.json({ success: true, message: "All other sessions revoked (Test Mode)" });
    }

    return NextResponse.json({ success: true, message: "Session revoked (Test Mode)" });
  } catch (err: any) {
    console.error("Revoke Error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}