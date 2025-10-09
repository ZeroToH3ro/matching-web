/**
 * Helper functions for chat operations
 */

import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import {
  getChatRoomIdByMatchId,
  getChatAllowlistIdByChatRoomId,
  getMatchInfo,
} from "./contractQueries";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
const USAGE_TRACKER_ID = process.env.NEXT_PUBLIC_USAGE_TRACKER_ID || "";
const MATCH_CHAT_REGISTRY_ID = process.env.NEXT_PUBLIC_MATCH_CHAT_REGISTRY_ID || "";
const CHAT_REGISTRY_ID = process.env.NEXT_PUBLIC_CHAT_REGISTRY_ID || "";
const ALLOWLIST_REGISTRY_ID = process.env.NEXT_PUBLIC_ALLOWLIST_REGISTRY_ID || "";

export interface ChatSetupResult {
  chatRoomId: string;
  chatAllowlistId: string | null;
  isNewChat: boolean;
  needsAllowlist: boolean;
}

/**
 * Get or create chat room from match
 * This function checks if chat already exists before trying to create
 */
export async function getOrCreateChatFromMatch(
  client: SuiClient,
  matchId: string,
  profileId: string,
  sealPolicyId: string = "default-policy",
  encryptedKey: Uint8Array = new Uint8Array([0])
): Promise<ChatSetupResult | null> {
  try {
    console.log("🔍 Checking if chat already exists for match:", matchId);

    // Step 1: Check if chat room already exists
    const existingChatRoomId = await getChatRoomIdByMatchId(client, matchId);

    if (existingChatRoomId) {
      console.log("✅ Chat room already exists:", existingChatRoomId);

      // Check if allowlist exists
      const allowlistId = await getChatAllowlistIdByChatRoomId(
        client,
        existingChatRoomId
      );

      if (allowlistId) {
        console.log("✅ Chat allowlist found:", allowlistId);
        return {
          chatRoomId: existingChatRoomId,
          chatAllowlistId: allowlistId,
          isNewChat: false,
          needsAllowlist: false,
        };
      } else {
        console.log("⚠️ Chat exists but allowlist not found");
        return {
          chatRoomId: existingChatRoomId,
          chatAllowlistId: null,
          isNewChat: false,
          needsAllowlist: true,
        };
      }
    }

    // Step 2: Verify match is active before creating
    const matchInfo = await getMatchInfo(client, matchId);
    if (!matchInfo) {
      throw new Error("Match not found");
    }

    if (matchInfo.status !== 1) {
      throw new Error(
        `Match is not active (status=${matchInfo.status}). Activate it first.`
      );
    }

    console.log("📝 Chat doesn't exist yet. Need to create it.");
    return null; // Caller should create the chat
  } catch (error) {
    console.error("Error checking/creating chat:", error);
    throw error;
  }
}

/**
 * Build transaction to create chat from match
 * Use this after confirming chat doesn't exist
 */
export function buildCreateChatTransaction(
  matchId: string,
  profileId: string,
  sealPolicyId: string,
  encryptedKey: Uint8Array
): Transaction {
  const tx = new Transaction();

  // Convert encrypted key to proper format
  const encryptedKeyArray = Array.from(encryptedKey);

  tx.moveCall({
    target: `${PACKAGE_ID}::integration::create_chat_from_match_entry`,
    arguments: [
      tx.object(USAGE_TRACKER_ID),
      tx.object(MATCH_CHAT_REGISTRY_ID),
      tx.object(CHAT_REGISTRY_ID),
      tx.object(ALLOWLIST_REGISTRY_ID),
      tx.object(profileId),
      tx.object(matchId),
      tx.pure.string(sealPolicyId),
      tx.pure.vector("u8", encryptedKeyArray),
      tx.object("0x6"), // Clock
    ],
  });

  return tx;
}

/**
 * Build transaction to create chat allowlist
 * Use this if chat exists but allowlist is missing
 */
export function buildCreateAllowlistTransaction(
  chatRoomId: string,
  profileId: string
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::seal_policies::create_chat_allowlist_shared`,
    arguments: [
      tx.object(ALLOWLIST_REGISTRY_ID),
      tx.object(chatRoomId),
      tx.object(profileId),
      tx.pure.option("u64", null), // No expiry
      tx.object("0x6"), // Clock
    ],
  });

  return tx;
}

/**
 * High-level helper: Setup chat for a match
 * Handles all cases: existing chat, new chat, missing allowlist
 */
export async function setupChatForMatch(
  client: SuiClient,
  matchId: string,
  profileId: string,
  sealPolicyId: string = "default-policy",
  encryptedKey: Uint8Array = new Uint8Array([0])
): Promise<{
  chatRoomId: string;
  chatAllowlistId: string | null;
  needsTransaction: boolean;
  transaction?: Transaction;
  action: "none" | "create_chat" | "create_allowlist";
}> {
  // Check existing chat
  const result = await getOrCreateChatFromMatch(
    client,
    matchId,
    profileId,
    sealPolicyId,
    encryptedKey
  );

  // Case 1: Chat and allowlist both exist
  if (result && result.chatAllowlistId) {
    return {
      chatRoomId: result.chatRoomId,
      chatAllowlistId: result.chatAllowlistId,
      needsTransaction: false,
      action: "none",
    };
  }

  // Case 2: Chat exists but allowlist missing
  if (result && result.needsAllowlist) {
    return {
      chatRoomId: result.chatRoomId,
      chatAllowlistId: null,
      needsTransaction: true,
      transaction: buildCreateAllowlistTransaction(result.chatRoomId, profileId),
      action: "create_allowlist",
    };
  }

  // Case 3: Need to create chat
  return {
    chatRoomId: "",
    chatAllowlistId: null,
    needsTransaction: true,
    transaction: buildCreateChatTransaction(
      matchId,
      profileId,
      sealPolicyId,
      encryptedKey
    ),
    action: "create_chat",
  };
}

/**
 * Error handler for chat creation
 */
export function parseChatCreationError(error: any): string {
  const errorMsg = error.message || error.toString();

  // Error code 6 in integration module = EChatAlreadyExists
  if (errorMsg.includes("MoveAbort") && errorMsg.includes(", 6)")) {
    return "Chat already exists for this match. Fetching existing chat...";
  }

  // Error code 7 = EInactiveMatch
  if (errorMsg.includes("MoveAbort") && errorMsg.includes(", 7)")) {
    return "Match is not active. Please activate the match first.";
  }

  // Error code 1 = ENotMatched
  if (errorMsg.includes("MoveAbort") && errorMsg.includes(", 1)")) {
    return "You are not a participant in this match.";
  }

  return errorMsg;
}
