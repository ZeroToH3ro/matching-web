import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFeatureFlagService } from '@/services/featureFlagService';
import { prisma } from '@/lib/prisma';

const featureFlagService = getFeatureFlagService();

// POST /api/admin/feature-flags/[flagKey]/rollout - Update rollout configuration
export async function POST(
  request: NextRequest,
  { params }: { params: { flagKey: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { flagKey } = params;
    const body = await request.json();
    const { strategy, percentage, segments, conditions, enabledUsers, disabledUsers } = body;

    if (!strategy) {
      return NextResponse.json(
        { error: 'Rollout strategy is required' },
        { status: 400 }
      );
    }

    const validStrategies = ['percentage', 'user_segments', 'conditional', 'hybrid'];
    if (!validStrategies.includes(strategy)) {
      return NextResponse.json(
        { error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate percentage for percentage-based strategies
    if ((strategy === 'percentage' || strategy === 'hybrid') && 
        (percentage === undefined || percentage < 0 || percentage > 100)) {
      return NextResponse.json(
        { error: 'Percentage must be between 0 and 100' },
        { status: 400 }
      );
    }

    const rolloutConfig = {
      strategy,
      percentage: percentage ?? 100,
      segments: segments ?? ['all'],
      conditions: conditions ?? [],
      enabledUsers: enabledUsers ?? [],
      disabledUsers: disabledUsers ?? []
    };

    const success = featureFlagService.updateRollout(flagKey, rolloutConfig);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update rollout configuration' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Rollout configuration for '${flagKey}' updated successfully`,
      flagKey,
      rolloutConfig,
      updatedBy: user.name || session.user.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to update rollout configuration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update rollout configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/admin/feature-flags/[flagKey]/rollout - Get rollout configuration
export async function GET(
  request: NextRequest,
  { params }: { params: { flagKey: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { flagKey } = params;
    const rolloutConfig = featureFlagService.getRolloutConfig(flagKey);

    if (!rolloutConfig) {
      return NextResponse.json(
        { error: 'Rollout configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      flagKey,
      rolloutConfig,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get rollout configuration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get rollout configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}