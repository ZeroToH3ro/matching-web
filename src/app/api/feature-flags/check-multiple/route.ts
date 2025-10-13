import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlagService } from '@/services/featureFlagService';
import { prisma } from '@/lib/prisma';

const featureFlagService = getFeatureFlagService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flagKeys, userId } = body;

    if (!flagKeys || !Array.isArray(flagKeys) || !userId) {
      return NextResponse.json(
        { error: 'flagKeys (array) and userId are required' },
        { status: 400 }
      );
    }

    if (flagKeys.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 feature flags can be checked at once' },
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
        betaUser: false // TODO: Get from user preferences
      }
    };

    // Check all feature flags in parallel
    const flagChecks = await Promise.allSettled(
      flagKeys.map(async (flagKey: string) => {
        const isEnabled = await featureFlagService.isEnabled(flagKey, userContext);
        return { flagKey, isEnabled };
      })
    );

    // Process results
    const flags: { [key: string]: boolean } = {};
    const errors: { [key: string]: string } = {};

    flagChecks.forEach((result, index) => {
      const flagKey = flagKeys[index];
      
      if (result.status === 'fulfilled') {
        flags[result.value.flagKey] = result.value.isEnabled;
      } else {
        flags[flagKey] = false; // Default to false on error
        errors[flagKey] = result.reason?.message || 'Unknown error';
      }
    });

    return NextResponse.json({
      success: true,
      flags,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      userId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Multiple feature flags check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check feature flags',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}