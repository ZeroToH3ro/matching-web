import { NextRequest, NextResponse } from 'next/server';
import { AvatarService } from '@/services/avatarService';

const avatarService = new AvatarService();

// GET /api/avatar/health - Health check for avatar service
export async function GET(request: NextRequest) {
  try {
    const health = await avatarService.healthCheck();
    
    const isHealthy = health.storage && health.cache && health.cdn;
    const status = isHealthy ? 200 : 503;

    return NextResponse.json({
      success: isHealthy,
      timestamp: new Date().toISOString(),
      services: health,
      status: isHealthy ? 'healthy' : 'degraded'
    }, { status });

  } catch (error) {
    console.error('Avatar service health check failed:', error);
    return NextResponse.json(
      { 
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        status: 'unhealthy'
      },
      { status: 503 }
    );
  }
}