import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagService } from '@/services/featureFlagService';
import { prisma } from '@/lib/prisma';

const featureFlagService = getFeatureFlagService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flagKey, userId } = body;

    if (!flagKey || !userId) {
      return NextResponse.json(
        { error: 'flagKey and userId are required' },
        { status: 400 }
      );
    }

    // Get user context from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        member: {
          select: {
            created: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build user context
    const userContext = {
      userId: user.id,
      email: user.email || undefined,
      role: user.role,
      subscription: 'standard', // TODO: Get from subscription system
      registrationDate: user.member?.created || new Date(),
      customAttributes: {
        // Add any custom attributes here
        betaUser: false // TODO: Get from user preferences
      }
    };

    // Check feature flag
    const isEnabled = await featureFlagService.isEnabled(flagKey, userContext);

    return NextResponse.json({
      success: true,
      enabled: isEnabled,
      flagKey,
      userId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Feature flag check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check feature flag',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flagKey = searchParams.get('flagKey');
    const userId = searchParams.get('userId');

    if (!flagKey || !userId) {
      return NextResponse.json(
        { error: 'flagKey and userId are required' },
        { status: 400 }
      );
    }

    // Get user context from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        member: {
          select: {
            created: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build user context
    const userContext = {
      userId: user.id,
      email: user.email || undefined,
      role: user.role,
      subscription: 'standard',
      registrationDate: user.member?.created || new Date(),
      customAttributes: {
        betaUser: false
      }
    };

    // Check feature flag
    const isEnabled = await featureFlagService.isEnabled(flagKey, userContext);

    return NextResponse.json({
      success: true,
      enabled: isEnabled,
      flagKey,
      userId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Feature flag check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check feature flag',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}