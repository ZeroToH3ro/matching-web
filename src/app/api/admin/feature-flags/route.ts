import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getFeatureFlagService } from '@/services/featureFlagService';
import { prisma } from '@/lib/prisma';

const featureFlagService = getFeatureFlagService();

// GET /api/admin/feature-flags - Get all feature flags
export async function GET(request: NextRequest) {
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

    const flags = featureFlagService.getAllFlags();
    const statistics = featureFlagService.getStatistics();

    return NextResponse.json({
      success: true,
      flags,
      statistics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get feature flags:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get feature flags',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/feature-flags - Create or update feature flag
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { flagKey, enabled, rolloutPercentage, userSegments, conditions } = body;

    if (!flagKey) {
      return NextResponse.json(
        { error: 'flagKey is required' },
        { status: 400 }
      );
    }

    // Update the feature flag
    const success = featureFlagService.updateFlag(flagKey, {
      enabled: enabled ?? true,
      rolloutPercentage: rolloutPercentage ?? 100,
      userSegments: userSegments ?? ['all'],
      conditions: conditions ?? [],
      metadata: {
        description: body.description || `Feature flag: ${flagKey}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.name || session.user.id
      }
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update feature flag' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Feature flag '${flagKey}' updated successfully`,
      flagKey,
      updatedBy: user.name || session.user.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to update feature flag:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update feature flag',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}