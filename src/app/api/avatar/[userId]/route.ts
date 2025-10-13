import { getAuthUserId } from "@/app/actions/authActions";
import { AvatarService } from "@/services/avatarService";
import { getAvatarCdnService } from "@/services/avatarCdnService";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId: targetUserId } = params;
    const viewerUserId = await getAuthUserId();

    if (!targetUserId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get avatar using service
    const avatarService = new AvatarService();
    const cdnService = getAvatarCdnService();
    const result = await avatarService.getAvatarForUser(targetUserId, viewerUserId);

    // Set appropriate cache headers using CDN service
    const headers = new Headers();
    const isPublic = result.type === 'public' || result.type === 'placeholder';
    const cacheHeaders = cdnService.getCacheHeaders(isPublic);
    
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    // Add security headers for private avatars
    if (result.type === 'private' && result.isEncrypted) {
      headers.set('X-Frame-Options', 'DENY');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        type: result.type,
        isEncrypted: result.isEncrypted,
        hasAccess: result.hasAccess,
        error: result.error
      }
    }, { headers });

  } catch (error) {
    console.error("[API] Avatar access error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get avatar",
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