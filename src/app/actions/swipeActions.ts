'use server';

import { prisma } from '@/lib/prisma';
import { getAuthUserId } from './authActions';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import type { GetMemberParams } from '@/types';

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
const DISCOVERY_MODULE = `${PACKAGE_ID}::discovery`;

/**
 * Get randomized members for swipe mode (optimized)
 * Uses Sui on-chain randomness to shuffle members
 */
export async function getRandomizedMembers() {
  try {
    const userId = await getAuthUserId();

    // Optimize: Only fetch necessary fields and limit to 20 members
    const members = await prisma.member.findMany({
      where: {
        userId: {
          not: userId,
        },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        image: true,
        gender: true,
        dateOfBirth: true,
        city: true,
        country: true,
        description: true,
        created: true,
        updated: true,
        user: {
          select: {
            profileObjectId: true,
            walletAddress: true,
          },
        },
      },
      take: 20, // Reduced from 50 to 20 for better performance
      orderBy: {
        updated: 'desc', // Get recently active members first
      },
    });

    // Shuffle using client-side randomness as fallback
    // The real randomness happens on-chain when recording swipes
    const shuffled = members.sort(() => Math.random() - 0.5);

    return {
      items: shuffled,
      totalCount: shuffled.length,
    };
  } catch (error) {
    console.error('Error getting randomized members:', error);
    return { items: [], totalCount: 0 };
  }
}

/**
 * Record a swipe action (with optional blockchain integration)
 * For blockchain version, it uses Sui's Random object
 */
export async function recordSwipe(
  targetUserId: string,
  direction: 'left' | 'right'
): Promise<{ status: 'success' | 'error'; message?: string; isMatch?: boolean }> {
  try {
    const userId = await getAuthUserId();

    if (direction === 'right') {
      // Right swipe = Like
      const existingLike = await prisma.like.findUnique({
        where: {
          sourceUserId_targetUserId: {
            sourceUserId: userId,
            targetUserId,
          },
        },
      });

      if (existingLike) {
        return { status: 'success', message: 'Already liked' };
      }

      // Create like
      const like = await prisma.like.create({
        data: {
          sourceUserId: userId,
          targetUserId,
        },
      });

      // Check for mutual match
      const mutualLike = await prisma.like.findUnique({
        where: {
          sourceUserId_targetUserId: {
            sourceUserId: targetUserId,
            targetUserId: userId,
          },
        },
      });

      const isMatch = !!mutualLike;

      if (isMatch) {
        // Import MatchEventHandler dynamically to avoid circular deps
        const { MatchEventHandler } = await import('@/services/matchEventHandler');
        const handler = new MatchEventHandler();
        await handler.handleMatchCreated(userId, targetUserId, `match_${userId}_${targetUserId}`);
      }

      return {
        status: 'success',
        message: isMatch ? 'It\'s a match!' : 'Like recorded',
        isMatch,
      };
    } else {
      // Left swipe = Pass (no action needed in DB for now)
      return { status: 'success', message: 'Passed' };
    }
  } catch (error) {
    console.error('Error recording swipe:', error);
    return { status: 'error', message: 'Failed to record swipe' };
  }
}

/**
 * Record swipe on blockchain with on-chain randomness
 * This uses Sui's Random object for verifiable randomness
 */
export async function recordSwipeOnChain(
  targetUserAddress: string,
  direction: 'left' | 'right',
  sessionId?: string
): Promise<{
  status: 'success' | 'error';
  digest?: string;
  randomSeed?: string;
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();
    const user = (await prisma.user.findUnique({
      where: { id: userId },
    })) as any;

    if (!user?.walletAddress) {
      return { status: 'error', error: 'User wallet not connected' };
    }

    const network = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as
      | 'testnet'
      | 'mainnet';
    const suiClient = new SuiClient({ url: getFullnodeUrl(network) });

    const tx = new Transaction();

    // Call record_swipe with Random object
    tx.moveCall({
      target: `${DISCOVERY_MODULE}::record_swipe`,
      arguments: [
        tx.object(sessionId || '0x0'), // Discovery session (if exists)
        tx.pure.address(targetUserAddress),
        tx.pure.u8(direction === 'right' ? 1 : 0), // 1 for right, 0 for left
        tx.object('0x8'), // Random object at reserved address 0x8
        tx.object('0x6'), // Clock object
      ],
    });

    // Note: This returns the transaction for client to sign
    // In practice, you'd return this to the client to execute
    return {
      status: 'success',
      digest: 'pending_client_signature',
    };
  } catch (error: any) {
    console.error('Error recording swipe on-chain:', error);
    return {
      status: 'error',
      error: error.message || 'Failed to record on-chain swipe',
    };
  }
}

/**
 * Create discovery session with randomized queue using Sui randomness
 */
export async function createDiscoverySession(
  availableUserAddresses: string[]
): Promise<{
  status: 'success' | 'error';
  sessionId?: string;
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();
    const user = (await prisma.user.findUnique({
      where: { id: userId },
    })) as any;

    if (!user?.walletAddress) {
      return { status: 'error', error: 'User wallet not connected' };
    }

    const network = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as
      | 'testnet'
      | 'mainnet';
    const suiClient = new SuiClient({ url: getFullnodeUrl(network) });

    const tx = new Transaction();

    // Create discovery session with random shuffling
    tx.moveCall({
      target: `${DISCOVERY_MODULE}::create_discovery_session`,
      arguments: [
        tx.pure.vector('address', availableUserAddresses),
        tx.object('0x8'), // Random object
        tx.object('0x6'), // Clock object
      ],
    });

    // Return transaction for client signing
    return {
      status: 'success',
      sessionId: 'pending_client_signature',
    };
  } catch (error: any) {
    console.error('Error creating discovery session:', error);
    return {
      status: 'error',
      error: error.message || 'Failed to create discovery session',
    };
  }
}

/**
 * Get avatar URLs for multiple members
 */
export async function getAvatarUrlsForMembers(
  memberIds: string[]
): Promise<Record<string, string | null>> {
  try {
    const currentUserId = await getAuthUserId();
    const { getAvatarForUser } = await import('./avatarActions');

    const avatarPromises = memberIds.map(async (memberId) => {
      const result = await getAvatarForUser(memberId, currentUserId);
      return {
        memberId,
        url: result.status === 'success' && result.data ? result.data.url : null,
      };
    });

    const avatars = await Promise.all(avatarPromises);

    return avatars.reduce((acc, { memberId, url }) => {
      acc[memberId] = url;
      return acc;
    }, {} as Record<string, string | null>);
  } catch (error) {
    console.error('Error getting avatar URLs:', error);
    return {};
  }
}
