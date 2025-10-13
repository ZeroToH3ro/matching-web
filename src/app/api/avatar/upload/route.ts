import { getAuthUserId } from "@/app/actions/authActions";
import { AvatarService } from "@/services/avatarService";
import { avatarUploadSchema } from "@/lib/schemas/AvatarSchema";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Get current user
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('avatar') as File;
    const settingsJson = formData.get('settings') as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate the upload
    const validation = avatarUploadSchema.safeParse({
      file,
      settings: settingsJson ? JSON.parse(settingsJson) : undefined
    });

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid upload data",
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    // Parse settings
    const settings = settingsJson ? JSON.parse(settingsJson) : undefined;

    // Upload avatar using service
    const avatarService = new AvatarService();
    const result = await avatarService.uploadAvatar(file, userId, settings);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("[API] Avatar upload error:", error);
    return NextResponse.json(
      { 
        error: "Avatar upload failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}