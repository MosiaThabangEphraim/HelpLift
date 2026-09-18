import { NextResponse } from "next/server";

// --- GET USER PROFILE + SETTINGS + LOGIN HISTORY ---
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, message: "User ID is required" }, { status: 400 });
    }

    // Mock Response
    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: "Test User",
        email: "test@example.com",
        phoneNumber: "0123456789",
        university: "North-West University",
        gender: "Prefer not to say",
        bursary: "None",
        preferredArea: "Student Housing",
        profilePic: null,
        coverPic: null,
        isFollowing: false,
        followers: 0,
        following: 0,
        joinDate: new Date().toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
        notificationPreferences: { email_notifications: true, push_notifications: true },
        securitySettings: { two_factor: false },
        loginHistory: [{ id: "1", device_name: "Test Browser", location: "Localhost", login_time: new Date().toISOString(), is_revoked: false }],
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// --- UPDATE USER PROFILE + SETTINGS ---
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    console.log("Mock Update Payload:", body);

    return NextResponse.json({
      success: true,
      message: "Profile updated (Test Mode)",
      user: { id: body.id, ...body }
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// --- FOLLOW / UNFOLLOW ---
export async function POST(req: Request) {
  try {
    const { followerId, followingId } = await req.json();

    if (!followerId || !followingId) {
      return NextResponse.json({ success: false, message: "Missing IDs" }, { status: 400 });
    }

    // Toggle logic simulation
    return NextResponse.json({ 
        success: true, 
        action: "toggled", 
        message: "Follow state toggled (Test Mode)" 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}