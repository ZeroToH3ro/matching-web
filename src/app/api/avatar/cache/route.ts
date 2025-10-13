import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { AvatarService } from '@/services/avatarService';

const avatarService = new AvatarService();

// GET /api/avatar/cache - Get cache statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only allow admin users to view cache stats (you may want to add role checking)
    const stats = await avatarService.getPerformanceStats();
    
    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get cache statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/avatar/cache - Clear avatar cache
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only allow admin users to clear cache (you may want to add role checking)
    await avatarService.clearCache();
    
    return NextResponse.json({
      success: true,
      message: 'Avatar cache cleared successfully'
    });

  } catch (error) {
    console.error('Failed to clear cache:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/avatar/cache/preload - Preload avatars for a list of users
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds array is required' },
        { status: 400 }
      );
    }

    if (userIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 users can be preloaded at once' },
        { status: 400 }
      );
    }

    await avatarService.preloadAvatars(userIds, session.user.id);
    
    return NextResponse.json({
      success: true,
      message: `Preloaded avatars for ${userIds.length} users`
    });

  } catch (error) {
    console.error('Failed to preload avatars:', error);
    return NextResponse.json(
      { 
        error: 'Failed to preload avatars',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}