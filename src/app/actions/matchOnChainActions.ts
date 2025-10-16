'use server';

import { prisma } from '@/lib/prisma';
import { getAuthUserId } from './authActions';
import { MatchEventHandler } from '@/services/matchEventHandler';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import {
  getMatchIdBetweenUsers,
  getChatRoomIdByMatchId,
  getChatAllowlistIdByChatRoomId
} from '@/lib/blockchain/contractQueries';
import { isEvmAddress } from '@/lib/walletUtils';

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

    const matchEventHandler = new MatchEventHandler();

    if (!existingLike) {
      // Create like in database
      await prisma.like.create({
        data: {
          sourceUserId: userId,
          targetUserId: targetUser.id,
        },
      });

      // Check for mutual match and handle avatar access
      await matchEventHandler.detectAndHandleMutualMatch(userId, targetUser.id);
    }

    // Store match metadata and handle avatar access
    await matchEventHandler.handleMatchCreated(userId, targetUser.id, input.matchId);

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

    // For now, we'll assume the match is already handled by the like system
    console.log(`[MatchOnChain] Match ${input.matchId} marked as active`);

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

    const user = (await prisma.user.findUnique({
      where: { id: currentUserId },
    })) as any;

    return user?.profileObjectId || null;
  } catch (error) {
    console.error('Error getting profile object ID:', error);
    return null;
  }
}

/**
 * Get chat room details for a conversation between two users
 * Queries the Sui blockchain ChatRegistry directly to find the chat room
 * @param currentUserId - Current user's database ID
 * @param targetWalletAddress - Target user's wallet address (from URL)
 */
export async function getChatRoomByParticipants(
  currentUserId: string,
  targetWalletAddress: string
): Promise<{ chatRoomId: string; chatAllowlistId: string } | null> {
  try {
    // First, try to get from database cache
    const cachedChatRoom = await (prisma as any).chatRoom?.findFirst?.({
      where: {
        OR: [
          { participant1: currentUserId, participant2: targetWalletAddress },
          { participant1: targetWalletAddress, participant2: currentUserId },
        ],
      },
      select: {
        chatRoomId: true,
        chatAllowlistId: true,
      },
    });

    if (cachedChatRoom) {
      return cachedChatRoom;
    }

    // Get current user's wallet address from database
    const currentUser = (await prisma.user.findUnique({
      where: { id: currentUserId },
    })) as any;

    const currentWalletAddress = currentUser?.walletAddress;
    if (!currentWalletAddress) return null;

    // EVM wallets don't have on-chain chat rooms - return null to fallback to off-chain
    if (isEvmAddress(currentUserId) || isEvmAddress(targetWalletAddress)) {
      console.log('[getChatRoomByParticipants] EVM wallet detected - skipping on-chain chat lookup');
      return null;
    }

    // Query blockchain using wallet addresses
    const network = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet';
    const suiClient = new SuiClient({ url: getFullnodeUrl(network) });

    // Find match between users
    const matchId = await getMatchIdBetweenUsers(suiClient, currentWalletAddress, targetWalletAddress);
    if (!matchId) return null;

    // Find chat room from match
    const chatRoomId = await getChatRoomIdByMatchId(suiClient, matchId);
    if (!chatRoomId) return null;

    // Find chat allowlist
    const chatAllowlistId = await getChatAllowlistIdByChatRoomId(suiClient, chatRoomId);
    if (!chatAllowlistId) return null;

    // Cache in database for future lookups
    await (prisma as any).chatRoom?.upsert?.({
      where: {
        chatRoomId,
      },
      update: {
        chatAllowlistId,
      },
      create: {
        chatRoomId,
        chatAllowlistId,
        participant1: currentUserId,
        participant2: targetWalletAddress,
      },
    });

    return { chatRoomId, chatAllowlistId };
  } catch (error) {
    console.error('[getChatRoomByParticipants] Error:', error);
    return null;
  }
}
