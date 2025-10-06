'use server';

import { prisma } from '@/lib/prisma';
import { getAuthUserId } from './authActions';

export interface CreateMatchOnChainInput {
  matchId: string;
  myProfileObjectId: string;
  targetUserAddress: string;
  compatibilityScore: number;
  digest: string;
}

export interface ActivateMatchInput {
  matchId: string;
  digest: string;
}

export interface CreateChatInput {
  matchId: string;
  chatRoomId: string;
  chatAllowlistId: string;
  digest: string;
}

export type MatchOnChainResult =
  | { status: 'success'; matchId: string }
  | { status: 'error'; error: string };

export type ChatOnChainResult =
  | { status: 'success'; chatRoomId: string; chatAllowlistId: string }
  | { status: 'error'; error: string };

/**
 * Save match information to database after creating on-chain
 */
export async function saveMatchOnChain(
  input: CreateMatchOnChainInput
): Promise<MatchOnChainResult> {
  try {
    const userId = await getAuthUserId();

    // Find target user by wallet address
    const targetUser = await prisma.user.findFirst({
      where: {
        id: input.targetUserAddress, // Assuming user.id is wallet address
      },
    });

    if (!targetUser) {
      return { status: 'error', error: 'Target user not found' };
    }

    // Check if like already exists in database
    const existingLike = await prisma.like.findUnique({
      where: {
        sourceUserId_targetUserId: {
          sourceUserId: userId,
          targetUserId: targetUser.id,
        },
      },
    });

    if (!existingLike) {
      // Create like in database
      await prisma.like.create({
        data: {
          sourceUserId: userId,
          targetUserId: targetUser.id,
        },
      });
    }

    // Store match metadata (you may need to create a new table for this)
    // For now, we'll just return success

    return {
      status: 'success',
      matchId: input.matchId,
    };
  } catch (error: any) {
    console.error('Error saving match on-chain:', error);
    return {
      status: 'error',
      error: error.message || 'Failed to save match',
    };
  }
}

/**
 * Update match status when activated (mutual like)
 */
export async function markMatchActive(
  input: ActivateMatchInput
): Promise<MatchOnChainResult> {
  try {
    // Update match status in database if needed
    // This is a placeholder - you may want to create a Match table

    return {
      status: 'success',
      matchId: input.matchId,
    };
  } catch (error: any) {
    console.error('Error marking match active:', error);
    return {
      status: 'error',
      error: error.message || 'Failed to activate match',
    };
  }
}

/**
 * Save chat room information after creating from match
 */
export async function saveChatOnChain(
  input: CreateChatInput
): Promise<ChatOnChainResult> {
  try {
    // Store chat room metadata
    // You may want to create a ChatRoom table to store:
    // - chatRoomId (on-chain object ID)
    // - chatAllowlistId (on-chain allowlist ID)
    // - matchId (reference to match)
    // - created timestamp

    return {
      status: 'success',
      chatRoomId: input.chatRoomId,
      chatAllowlistId: input.chatAllowlistId,
    };
  } catch (error: any) {
    console.error('Error saving chat on-chain:', error);
    return {
      status: 'error',
      error: error.message || 'Failed to save chat',
    };
  }
}

/**
 * Check if user has on-chain profile
 */
export async function getUserProfileObjectId(
  userId?: string
): Promise<string | null> {
  try {
    const currentUserId = userId || (await getAuthUserId());

    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { profileObjectId: true },
    });

    return user?.profileObjectId || null;
  } catch (error) {
    console.error('Error getting profile object ID:', error);
    return null;
  }
}

/**
 * Get chat room details for a conversation between two users
 */
export async function getChatRoomByParticipants(
  userId1: string,
  userId2: string
): Promise<{ chatRoomId: string; chatAllowlistId: string } | null> {
  try {
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        OR: [
          { participant1: userId1, participant2: userId2 },
          { participant1: userId2, participant2: userId1 },
        ],
      },
      select: {
        chatRoomId: true,
        chatAllowlistId: true,
      },
    });

    return chatRoom;
  } catch (error) {
    console.error('Error getting chat room:', error);
    return null;
  }
}
