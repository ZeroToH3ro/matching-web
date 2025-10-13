import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/app/actions/authActions';
import { AvatarService } from '@/services/avatarService';
import { getAvatarCdnService } from '@/services/avatarCdnService';

export async function GET(
  request: NextRequest,
  { params }: { 
    params: { 
      userId: string;
      size: string;
      format: string;
    } 
  }
) {
  try {
    const { userId: targetUserId, size, format } = params;
    
    // Validate parameters
    if (!targetUserId || !size || !format) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Validate size parameter
    const validSizes = ['sm', 'md', 'lg', 'xl', 'original'];
    if (!validSizes.includes(size)) {
      return NextResponse.json(
        { error: `Invalid size. Must be one of: ${validSizes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate format parameter
    const validFormats = ['webp', 'jpeg', 'png'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    const viewerUserId = await getAuthUserId().catch(() => undefined);

    // Get avatar data
    const avatarService = new AvatarService();
    const result = await avatarService.getAvatarForUser(targetUserId, viewerUserId);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    // Get CDN service for cache headers
    const cdnService = getAvatarCdnService();
    const isPublic = result.type === 'public' || result.type === 'placeholder';

    // For now, redirect to the main avatar URL
    // In a full implementation, this would serve the specific size/format variant
    const optimizedUrl = cdnService.getCdnUrl(
      result.url.split('/').pop() || '', // Extract blob ID from URL
      { 
        format: format as any, 
        size: size as any,
        quality: format === 'webp' ? 85 : 90
      }
    );

    // Set appropriate cache headers
    const headers = new Headers();
    const cacheHeaders = cdnService.getCacheHeaders(isPublic);
    
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    // Add format-specific headers
    headers.set('Content-Type', `image/${format}`);
    headers.set('X-Avatar-Size', size);
    headers.set('X-Avatar-Format', format);
    headers.set('X-Avatar-Type', result.type);

    // Return the optimized URL
    return NextResponse.json({
      success: true,
      data: {
        url: optimizedUrl,
        size,
        format,
        type: result.type,
        isEncrypted: result.isEncrypted,
        hasAccess: result.hasAccess
      }
    }, { headers });

  } catch (error) {
    console.error('[API] Optimized avatar access error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get optimized avatar',
        message: error instanceof Error ? error.message : 'Unknown error'
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    },
  });
}