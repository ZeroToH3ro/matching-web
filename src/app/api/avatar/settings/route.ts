import { getAuthUserId } from "@/app/actions/authActions";
import { prisma } from "@/lib/prisma";
import { avatarUpdateSettingsSchema } from "@/lib/schemas/AvatarSchema";
import { parseAvatarSettings, serializeAvatarSettings } from "@/lib/utils/avatarUtils";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get current avatar settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarSettings: true,
        avatarUploadedAt: true,
        publicAvatarBlobId: true,
        privateAvatarBlobId: true,
        avatarSealPolicyId: true
      } as any
    }) as any;

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const settings = parseAvatarSettings(user.avatarSettings);

    return NextResponse.json({
      success: true,
      data: {
        settings,
        hasAvatar: !!(user.publicAvatarBlobId || user.privateAvatarBlobId),
        uploadedAt: user.avatarUploadedAt,
        hasSealPolicy: !!user.avatarSealPolicyId
      }
    });

  } catch (error) {
    console.error("[API] Get avatar settings error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get avatar settings",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Validate settings
    const validation = avatarUpdateSettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid settings",
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    // Get current user avatar data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        avatarSettings: true, 
        avatarSealPolicyId: true,
        publicAvatarBlobId: true,
        privateAvatarBlobId: true
      } as any
    }) as any;

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user has an avatar to configure
    if (!user.publicAvatarBlobId && !user.privateAvatarBlobId) {
      return NextResponse.json(
        { error: "No avatar found. Please upload an avatar first." },
        { status: 400 }
      );
    }

    // Parse current settings and merge with updates
    const currentSettings = parseAvatarSettings(user.avatarSettings);
    const updatedSettings = { ...currentSettings, ...validation.data };

    // Update in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        avatarSettings: serializeAvatarSettings(updatedSettings)
      } as any
    });

    // If there's a Seal policy, update it as well
    if (user.avatarSealPolicyId && (validation.data.visibility || validation.data.expiryDays)) {
      // TODO: Update Seal policy settings when SDK supports it
      console.log('Avatar policy settings update needed for:', user.avatarSealPolicyId);
    }

    return NextResponse.json({
      success: true,
      data: {
        settings: updatedSettings
      }
    });

  } catch (error) {
    console.error("[API] Update avatar settings error:", error);
    return NextResponse.json(
      { 
        error: "Failed to update avatar settings",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Delete avatar using service
    const { AvatarService } = await import("@/services/avatarService");
    const avatarService = new AvatarService();
    await avatarService.deleteAvatar(userId);

    return NextResponse.json({
      success: true,
      message: "Avatar deleted successfully"
    });

  } catch (error) {
    console.error("[API] Delete avatar error:", error);
    return NextResponse.json(
      { 
        error: "Failed to delete avatar",
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
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}