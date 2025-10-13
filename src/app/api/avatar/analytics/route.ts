import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAvatarAnalyticsService } from '@/services/avatarAnalyticsService';

const analyticsService = getAvatarAnalyticsService();

// GET /api/avatar/analytics - Get avatar analytics data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const metric = searchParams.get('metric') || 'overview';

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let data: any = {};

    switch (metric) {
      case 'uploads':
        data = await analyticsService.getUploadSuccessRate(start, end, userId || undefined);
        break;

      case 'access':
        data = await analyticsService.getAccessPatterns(start, end, userId || undefined);
        break;

      case 'errors':
        data = await analyticsService.getErrorRates(start, end);
        break;

      case 'engagement':
        data = await analyticsService.getUserEngagement(start, end, userId || undefined);
        break;

      case 'overview':
      default:
        // Get overview data combining multiple metrics
        const [uploads, access, errors, engagement] = await Promise.all([
          analyticsService.getUploadSuccessRate(start, end, userId || undefined),
          analyticsService.getAccessPatterns(start, end, userId || undefined),
          analyticsService.getErrorRates(start, end),
          analyticsService.getUserEngagement(start, end, userId || undefined)
        ]);

        data = {
          uploads,
          access,
          errors,
          engagement,
          summary: {
            totalUploads: uploads.totalUploads,
            totalAccesses: access.totalAccesses,
            uploadSuccessRate: uploads.successRate,
            cacheHitRate: access.cacheHitRate,
            uploadErrorRate: errors.uploadErrorRate,
            accessErrorRate: errors.accessErrorRate,
            activeUsers: engagement.activeUsers
          }
        };
        break;
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        metric,
        userId
      }
    });

  } catch (error) {
    console.error('Failed to get analytics data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/avatar/analytics/cleanup - Clean up old analytics data
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only allow admin users to cleanup analytics (you may want to add role checking)
    const result = await analyticsService.cleanupOldMetrics();
    
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Analytics cleanup completed successfully'
    });

  } catch (error) {
    console.error('Failed to cleanup analytics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}