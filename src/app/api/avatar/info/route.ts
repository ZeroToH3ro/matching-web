import { getAuthUserId } from "@/app/actions/authActions";
import { prisma } from "@/lib/prisma";
import { parseAvatarSettings } from "@/lib/utils/avatarUtils";
import { getStorageManager } from "@/lib/storage";
import { getAvatarAnalyticsService } from "@/services/avatarAnalyticsService";
import { NextResponse } from "next/server";

const analyticsService = getAvatarAnalyticsService();

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user avatar data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        publicAvatarBlobId: true,
        privateAvatarBlobId: true,
        avatarSealPolicyId: true,
        avatarUploadedAt: true,
        avatarSettings: true
      } as any
    }) as any;

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Parse settings
    const settings = parseAvatarSettings(user.avatarSettings);

    // Get URLs from storage if blob IDs exist
    let publicUrl: string | undefined;
    let privateUrl: string | undefined;

    if (user.publicAvatarBlobId) {
      try {
        const storageManager = getStorageManager();
        publicUrl = storageManager.getUrl(user.publicAvatarBlobId);
      } catch (error) {
        console.warn('Failed to get public avatar URL:', error);
      }
    }

    if (user.privateAvatarBlobId) {
      try {
        const storageManager = getStorageManager();
        privateUrl = storageManager.getUrl(user.privateAvatarBlobId);
      } catch (error) {
        console.warn('Failed to get private avatar URL:', error);
      }
    }

    // Get encryption info if available
    let encryptionInfo = null;
    if (user.avatarSealPolicyId) {
      try {
        const { AvatarEncryptionService } = await import("@/services/avatarEncryptionService");
        const encryptionService = new AvatarEncryptionService();
        encryptionInfo = await encryptionService.getEncryptionInfo(user.avatarSealPolicyId);
      } catch (error) {
        console.warn('Failed to get encryption info:', error);
      }
    }

    // Get usage statistics for the user
    let stats = null;
    const hasAvatar = !!(user.publicAvatarBlobId || user.privateAvatarBlobId);
    
    if (hasAvatar) {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1); // Last month

        const [accessPatterns, engagement] = await Promise.all([
          analyticsService.getAccessPatterns(startDate, endDate, userId),
          analyticsService.getUserEngagement(startDate, endDate, userId)
        ]);

        stats = {
          totalViews: accessPatterns.totalAccesses,
          uniqueViewers: accessPatterns.topViewers.length,
          lastViewed: accessPatterns.totalAccesses > 0 ? endDate.toISOString() : undefined,
          uploadDate: user.avatarUploadedAt?.toISOString(),
          fileSize: undefined, // Would need to store this during upload
          format: 'JPEG' // Default format
        };
      } catch (error) {
        console.warn('Failed to get avatar stats:', error);
      }
    }

    return NextResponse.json({
      success: true,
      hasAvatar,
      settings,
      stats,
      data: {
        hasAvatar,
        publicUrl,
        privateUrl,
        settings,
        uploadedAt: user.avatarUploadedAt,
        encryption: encryptionInfo ? {
          active: encryptionInfo.active,
          allowedUsers: encryptionInfo.allowedUsers,
          createdAt: encryptionInfo.createdAt,
          lastAccessed: encryptionInfo.lastAccessed,
          settings: encryptionInfo.settings
        } : null
      }
    });

  } catch (error) {
    console.error("[API] Get avatar info error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get avatar info",
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}