import { NextResponse } from "next/server";

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { userId, themeMode, languagePref } = body;

    // 1. Validation
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    // 2. Return Success
    return NextResponse.json({
      success: true,
      message: "Theme preference updated (Test Mode)",
      settings: {
        user_id: userId,
        theme_mode: themeMode,
        language_pref: languagePref || 'en'
      }
    });

  } catch (err) {
    console.error("Settings update error:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}