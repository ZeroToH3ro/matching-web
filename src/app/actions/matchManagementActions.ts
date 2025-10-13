'use server';

import { prisma } from '@/lib/prisma';
import { getAuthUserId } from './authActions';
import { MatchEventHandler } from '@/services/matchEventHandler';
import { pusherServer } from '@/lib/pusher';

export interface MatchActionResult {
  status: 'success' | 'error';
  message?: string;
  error?: string;
}

/**
 * Blocks a user and revokes avatar access
 */
export async function blockUser(targetUserId: string): Promise<MatchActionResult> {
  try {
    const userId = await getAuthUserId();
    const matchEventHandler = new MatchEventHandler();

    // Update match status to blocked
    await prisma.like.updateMany({
      where: {
        OR: [
          { sourceUserId: userId, targetUserId: targetUserId },
          { sourceUserId: targetUserId, targetUserId: userId }
        ]
      },
      data: { matchStatus: 3 } // 3 = blocked
    });

    // Handle avatar access revocation
    await matchEventHandler.handleMatchBlocked(userId, targetUserId);

    // Send notification to blocked user (optional)
    await pusherServer.trigger(`private-${targetUserId}`, 'match:blocked', {
      userId: userId,
      message: 'A user has blocked you'
    });

    return {
      status: 'success',
      message: 'User blocked successfully'
    };

  } catch (error) {
    console.error('Failed to block user:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to block user'
    };
  }
}

/**
 * Unblocks a user and potentially restores avatar access
 */
export async function unblockUser(targetUserId: string): Promise<MatchActionResult> {
  try {
    const userId = await getAuthUserId();
    const matchEventHandler = new MatchEventHandler();

    // Check if there are mutual likes
    const mutualLikes = await prisma.like.findMany({
      where: {
        OR: [
          { sourceUserId: userId, targetUserId: targetUserId },
          { sourceUserId: targetUserId, targetUserId: userId }
        ]
      }
    });

    if (mutualLikes.length === 2) {
      // Restore match status
      await prisma.like.updateMany({
        where: {
          OR: [
            { sourceUserId: userId, targetUserId: targetUserId },
            { sourceUserId: targetUserId, targetUserId: userId }
          ]
        },
        data: { matchStatus: 1 } // 1 = active match
      });

      // Restore avatar access
      await matchEventHandler.handleMatchCreated(userId, targetUserId);

      return {
        status: 'success',
        message: 'User unblocked and match restored'
      };
    } else {
      // Just remove the block status
      await prisma.like.updateMany({
        where: {
          OR: [
            { sourceUserId: userId, targetUserId: targetUserId },
            { sourceUserId: targetUserId, targetUserId: userId }
          ]
        },
        data: { matchStatus: 0 } // 0 = pending
      });

      return {
        status: 'success',
        message: 'User unblocked'
      };
    }

  } catch (error) {
    console.error('Failed to unblock user:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to unblock user'
    };
  }
}

/**
 * Removes a match completely (unlike both directions)
 */
export async function removeMatch(targetUserId: string): Promise<MatchActionResult> {
  try {
    const userId = await getAuthUserId();
    const matchEventHandler = new MatchEventHandler();

    // Handle avatar access revocation first
    await matchEventHandler.handleMatchDeleted(userId, targetUserId);

    // Send notification
    await pusherServer.trigger(`private-${targetUserId}`, 'match:removed', {
      userId: userId,
      message: 'A match has been removed'
    });

    return {
      status: 'success',
      message: 'Match removed successfully'
    };

  } catch (error) {
    console.error('Failed to remove match:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to remove match'
    };
  }
}

/**
 * Gets match status between current user and target user
 */
export async function getMatchStatus(targetUserId: string): Promise<{
  status: 'success' | 'error';
  data?: {
    isMatch: boolean;
    matchStatus: number;
    canSeeAvatar: boolean;
  };
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();

    // Get like relationships
    const likes = await prisma.like.findMany({
      where: {
        OR: [
          { sourceUserId: userId, targetUserId: targetUserId },
          { sourceUserId: targetUserId, targetUserId: userId }
        ]
      }
    });

    const isMatch = likes.length === 2 && likes.every(like => like.matchStatus === 1);
    const matchStatus = likes.length > 0 ? likes[0].matchStatus : 0;
    const canSeeAvatar = isMatch && matchStatus === 1;

    return {
      status: 'success',
      data: {
        isMatch,
        matchStatus,
        canSeeAvatar
      }
    };

  } catch (error) {
    console.error('Failed to get match status:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to get match status'
    };
  }
}

/**
 * Repairs avatar access for all existing matches (admin/migration function)
 */
export async function repairAllMatches(): Promise<MatchActionResult> {
  try {
    const matchEventHandler = new MatchEventHandler();
    const result = await matchEventHandler.repairExistingMatches();

    return {
      status: 'success',
      message: `Repair completed: ${result.processed} matches processed, ${result.errors} errors`
    };

  } catch (error) {
    console.error('Failed to repair matches:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to repair matches'
    };
  }
}