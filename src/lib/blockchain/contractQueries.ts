/**
 * Blockchain Contract Query Utilities
 * Helper functions to find Profile ID, Match ID, Chat Room ID, and Allowlist ID
 */

import { SuiClient } from "@mysten/sui/client";

// Contract configuration
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
const PROFILE_REGISTRY_ID = "0x20e5393af9af450275b4adff795b34c82e9cf21d7e0130d067b9f9c90a930c02";
const MATCH_REGISTRY_ID = process.env.NEXT_PUBLIC_MATCH_CHAT_REGISTRY_ID || "";
const CHAT_REGISTRY_ID = "0x1d6554cbdd327bfcea9c8e16c511967c59a3c0c24b12270f2c2b62aec886d405";
const ALLOWLIST_REGISTRY_ID = "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399";
const MATCH_CHAT_REGISTRY_ID = "0xe909c265300cec16f82a534d30ff50c64295fd563809f0beaad38c88b24e9739";
const MESSAGE_INDEX_ID = "0x1a58570e00e9bd3b80aa5ca3ab717891e22c0fe76b72d40b675c8ae5f0a2ca86";

// Export for use in other modules
export const CONTRACT_IDS = {
  PACKAGE_ID,
  PROFILE_REGISTRY_ID,
  MATCH_REGISTRY_ID,
  CHAT_REGISTRY_ID,
  ALLOWLIST_REGISTRY_ID,
  MATCH_CHAT_REGISTRY_ID,
  MESSAGE_INDEX_ID,
};

export interface ProfileInfo {
  profileId: string;
  owner: string;
  displayName: string;
  age: number;
  bio: string;
  interests: string[];
  matchCount: number;
}

export interface MatchInfo {
  matchId: string;
  userA: string;
  userB: string;
  compatibilityScore: number;
  status: number;
  createdAt: string;
}

export interface ChatRoomInfo {
  chatRoomId: string;
  participantA: string;
  participantB: string;
  sealPolicyId: string;
  matchId?: string;
  totalMessages: number;
  lastMessageAt: string;
}

export interface ChatAllowlistInfo {
  allowlistId: string;
  chatId: string;
  participantA: string;
  participantB: string;
  active: boolean;
}

/**
 * Find Profile ID from wallet address
 * Uses ProfileRegistry to lookup profile by owner address
 */
export async function getProfileIdByAddress(
  client: SuiClient,
  walletAddress: string
): Promise<string | null> {
  try {
    // Get ProfileRegistry object
    const registry = await client.getObject({
      id: PROFILE_REGISTRY_ID,
      options: {
        showContent: true,
      },
    });

    if (!registry.data?.content || registry.data.content.dataType !== "moveObject") {
      throw new Error("Invalid registry object");
    }

    const fields = registry.data.content.fields as any;
    const profilesTable = fields.profiles;

    // Get all owned objects by the wallet to find UserProfile NFT
    const ownedObjects = await client.getOwnedObjects({
      owner: walletAddress,
      filter: {
        StructType: `${PACKAGE_ID}::core::UserProfile`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (ownedObjects.data.length > 0) {
      const profileObject = ownedObjects.data[0];
      return profileObject.data?.objectId || null;
    }

    return null;
  } catch (error) {
    console.error("Error getting profile ID:", error);
    return null;
  }
}

/**
 * Get full profile information
 */
export async function getProfileInfo(
  client: SuiClient,
  profileId: string
): Promise<ProfileInfo | null> {
  try {
    const profileObj = await client.getObject({
      id: profileId,
      options: {
        showContent: true,
      },
    });

    if (!profileObj.data?.content || profileObj.data.content.dataType !== "moveObject") {
      return null;
    }

    const fields = profileObj.data.content.fields as any;

    return {
      profileId,
      owner: fields.owner,
      displayName: fields.display_name,
      age: fields.age,
      bio: fields.bio,
      interests: fields.interests || [],
      matchCount: parseInt(fields.match_count || "0"),
    };
  } catch (error) {
    console.error("Error getting profile info:", error);
    return null;
  }
}

/**
 * Find all Match IDs for a wallet address
 * Returns matches where user is either user_a or user_b
 */
export async function getMatchIdsByAddress(
  client: SuiClient,
  walletAddress: string
): Promise<string[]> {
  try {
    // Get all Match objects owned by the wallet
    const ownedMatches = await client.getOwnedObjects({
      owner: walletAddress,
      filter: {
        StructType: `${PACKAGE_ID}::core::Match`,
      },
      options: {
        showContent: true,
      },
    });

    return ownedMatches.data
      .map((obj) => obj.data?.objectId)
      .filter((id): id is string => id !== undefined);
  } catch (error) {
    console.error("Error getting match IDs:", error);
    return [];
  }
}

/**
 * Find Match ID between two specific wallet addresses
 */
export async function getMatchIdBetweenUsers(
  client: SuiClient,
  userAAddress: string,
  userBAddress: string
): Promise<string | null> {
  try {
    // Get matches for userA
    const userAMatches = await getMatchIdsByAddress(client, userAAddress);

    // Check each match to see if it involves userB
    for (const matchId of userAMatches) {
      const matchInfo = await getMatchInfo(client, matchId);

      if (matchInfo) {
        const involvesUserB =
          (matchInfo.userA === userAAddress && matchInfo.userB === userBAddress) ||
          (matchInfo.userA === userBAddress && matchInfo.userB === userAAddress);

        if (involvesUserB) {
          return matchId;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding match between users:", error);
    return null;
  }
}

/**
 * Get full match information
 */
export async function getMatchInfo(
  client: SuiClient,
  matchId: string
): Promise<MatchInfo | null> {
  try {
    const matchObj = await client.getObject({
      id: matchId,
      options: {
        showContent: true,
      },
    });

    if (!matchObj.data?.content || matchObj.data.content.dataType !== "moveObject") {
      return null;
    }

    const fields = matchObj.data.content.fields as any;

    return {
      matchId,
      userA: fields.user_a,
      userB: fields.user_b,
      compatibilityScore: parseInt(fields.compatibility_score || "0"),
      status: parseInt(fields.status || "0"),
      createdAt: fields.created_at,
    };
  } catch (error) {
    console.error("Error getting match info:", error);
    return null;
  }
}

/**
 * Find Chat Room ID from Match ID
 * Uses multiple methods: MatchChatRegistry → ChatCreated events → owned objects
 */
export async function getChatRoomIdByMatchId(
  client: SuiClient,
  matchId: string
): Promise<string | null> {
  try {
    // Method 1: Try MatchChatRegistry lookup
    try {
      const registry = await client.getObject({
        id: MATCH_CHAT_REGISTRY_ID,
        options: {
          showContent: true,
        },
      });

      if (registry.data?.content && registry.data.content.dataType === "moveObject") {
        const fields = registry.data.content.fields as any;
        const matchChatsTable = fields.match_chats?.fields?.id?.id;

        if (matchChatsTable) {
          const dynamicField = await client.getDynamicFieldObject({
            parentId: matchChatsTable,
            name: {
              type: "0x2::object::ID",
              value: matchId,
            },
          });

          if (dynamicField.data?.content && dynamicField.data.content.dataType === "moveObject") {
            const chatRoomId = (dynamicField.data.content.fields as any).value;
            console.log("Found chat room in registry:", chatRoomId);
            return chatRoomId;
          }
        }
      }
    } catch (err) {
      console.log("Chat room not found in MatchChatRegistry, trying events...");
    }

    // Method 2: Search via ChatCreated events (most reliable)
    try {
      const events = await client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::chat::ChatCreated`,
        },
        limit: 100,
        order: "descending",
      });

      for (const event of events.data) {
        const parsedJson = event.parsedJson as any;
        if (parsedJson.match_id === matchId) {
          console.log("Found chat room via events:", parsedJson.chat_id);
          return parsedJson.chat_id;
        }
      }
    } catch (err) {
      console.error("Error querying events:", err);
    }

    console.log("Chat room not found for match:", matchId);
    return null;
  } catch (error) {
    console.error("Error getting chat room ID by match:", error);
    return null;
  }
}

/**
 * Find all Chat Room IDs for a wallet address
 */
export async function getChatRoomIdsByAddress(
  client: SuiClient,
  walletAddress: string
): Promise<string[]> {
  try {
    // Option 1: Get owned ChatRoom objects (if user owns them)
    const ownedChatRooms = await client.getOwnedObjects({
      owner: walletAddress,
      filter: {
        StructType: `${PACKAGE_ID}::chat::ChatRoom`,
      },
      options: {
        showContent: true,
      },
    });

    const ownedRoomIds = ownedChatRooms.data
      .map((obj) => obj.data?.objectId)
      .filter((id): id is string => id !== undefined);

    // Option 2: Query shared ChatRoom objects where user is participant
    // This requires querying the ChatRegistry
    const registry = await client.getObject({
      id: CHAT_REGISTRY_ID,
      options: {
        showContent: true,
      },
    });

    if (!registry.data?.content || registry.data.content.dataType !== "moveObject") {
      return ownedRoomIds;
    }

    const fields = registry.data.content.fields as any;
    const userChatsTable = fields.user_chats?.fields?.id?.id;

    if (!userChatsTable) {
      return ownedRoomIds;
    }

    // Query dynamic field for user's chats
    try {
      const dynamicField = await client.getDynamicFieldObject({
        parentId: userChatsTable,
        name: {
          type: "address",
          value: walletAddress,
        },
      });

      if (dynamicField.data?.content && dynamicField.data.content.dataType === "moveObject") {
        const chatIds = (dynamicField.data.content.fields as any).value || [];
        return [...new Set([...ownedRoomIds, ...chatIds])]; // Combine and deduplicate
      }
    } catch (err) {
      // User may not have any chats in the registry yet
      console.log("No chats found in registry for user");
    }

    return ownedRoomIds;
  } catch (error) {
    console.error("Error getting chat room IDs:", error);
    return [];
  }
}

/**
 * Get full chat room information
 */
export async function getChatRoomInfo(
  client: SuiClient,
  chatRoomId: string
): Promise<ChatRoomInfo | null> {
  try {
    const chatObj = await client.getObject({
      id: chatRoomId,
      options: {
        showContent: true,
      },
    });

    if (!chatObj.data?.content || chatObj.data.content.dataType !== "moveObject") {
      return null;
    }

    const fields = chatObj.data.content.fields as any;

    return {
      chatRoomId,
      participantA: fields.participant_a,
      participantB: fields.participant_b,
      sealPolicyId: fields.seal_policy_id,
      matchId: fields.match_id,
      totalMessages: parseInt(fields.total_messages || "0"),
      lastMessageAt: fields.last_message_at,
    };
  } catch (error) {
    console.error("Error getting chat room info:", error);
    return null;
  }
}

/**
 * Find Chat Allowlist ID from Chat Room ID
 * Uses AllowlistRegistry to lookup allowlist by chat ID
 */
export async function getChatAllowlistIdByChatRoomId(
  client: SuiClient,
  chatRoomId: string
): Promise<string | null> {
  try {
    // Get AllowlistRegistry object
    const registry = await client.getObject({
      id: ALLOWLIST_REGISTRY_ID,
      options: {
        showContent: true,
      },
    });

    if (!registry.data?.content || registry.data.content.dataType !== "moveObject") {
      throw new Error("Invalid allowlist registry object");
    }

    const fields = registry.data.content.fields as any;
    const chatAllowlistsTable = fields.chat_allowlists?.fields?.id?.id;

    if (!chatAllowlistsTable) {
      return null;
    }

    // Query the table for this chat_id
    const dynamicField = await client.getDynamicFieldObject({
      parentId: chatAllowlistsTable,
      name: {
        type: "0x2::object::ID",
        value: chatRoomId,
      },
    });

    if (dynamicField.data?.content && dynamicField.data.content.dataType === "moveObject") {
      const allowlistId = (dynamicField.data.content.fields as any).value;
      return allowlistId;
    }

    return null;
  } catch (error) {
    console.error("Error getting chat allowlist ID:", error);
    return null;
  }
}

/**
 * Get full chat allowlist information
 */
export async function getChatAllowlistInfo(
  client: SuiClient,
  allowlistId: string
): Promise<ChatAllowlistInfo | null> {
  try {
    const allowlistObj = await client.getObject({
      id: allowlistId,
      options: {
        showContent: true,
      },
    });

    if (!allowlistObj.data?.content || allowlistObj.data.content.dataType !== "moveObject") {
      return null;
    }

    const fields = allowlistObj.data.content.fields as any;

    return {
      allowlistId,
      chatId: fields.chat_id,
      participantA: fields.participant_a,
      participantB: fields.participant_b,
      active: fields.active,
    };
  } catch (error) {
    console.error("Error getting chat allowlist info:", error);
    return null;
  }
}

/**
 * Complete flow: Find all chat info between two users
 * This is the main helper function you'll use
 */
export async function findChatInfoBetweenUsers(
  client: SuiClient,
  myWalletAddress: string,
  otherWalletAddress: string
): Promise<{
  myProfileId: string | null;
  otherProfileId: string | null;
  matchId: string | null;
  chatRoomId: string | null;
  chatAllowlistId: string | null;
  matchInfo: MatchInfo | null;
  chatRoomInfo: ChatRoomInfo | null;
} | null> {
  try {
    // Step 1: Get profile IDs
    const myProfileId = await getProfileIdByAddress(client, myWalletAddress);
    const otherProfileId = await getProfileIdByAddress(client, otherWalletAddress);

    if (!myProfileId) {
      console.error("Your profile not found");
      return null;
    }

    // Step 2: Find match between users
    const matchId = await getMatchIdBetweenUsers(client, myWalletAddress, otherWalletAddress);

    if (!matchId) {
      console.log("No match found between these users");
      return {
        myProfileId,
        otherProfileId,
        matchId: null,
        chatRoomId: null,
        chatAllowlistId: null,
        matchInfo: null,
        chatRoomInfo: null,
      };
    }

    // Step 3: Get match info
    const matchInfo = await getMatchInfo(client, matchId);

    // Step 4: Find chat room from match
    const chatRoomId = await getChatRoomIdByMatchId(client, matchId);

    if (!chatRoomId) {
      console.log("No chat room found for this match");
      return {
        myProfileId,
        otherProfileId,
        matchId,
        chatRoomId: null,
        chatAllowlistId: null,
        matchInfo,
        chatRoomInfo: null,
      };
    }

    // Step 5: Get chat room info
    const chatRoomInfo = await getChatRoomInfo(client, chatRoomId);

    // Step 6: Find chat allowlist
    const chatAllowlistId = await getChatAllowlistIdByChatRoomId(client, chatRoomId);

    return {
      myProfileId,
      otherProfileId,
      matchId,
      chatRoomId,
      chatAllowlistId,
      matchInfo,
      chatRoomInfo,
    };
  } catch (error) {
    console.error("Error finding chat info between users:", error);
    return null;
  }
}

/**
 * Simplified version: Just get the IDs you need for messaging
 */
export async function getMessagingIds(
  client: SuiClient,
  myWalletAddress: string,
  otherWalletAddress: string
): Promise<{
  profileId: string;
  chatRoomId: string;
  chatAllowlistId: string;
} | null> {
  const info = await findChatInfoBetweenUsers(client, myWalletAddress, otherWalletAddress);

  if (!info?.myProfileId || !info?.chatRoomId || !info?.chatAllowlistId) {
    return null;
  }

  return {
    profileId: info.myProfileId,
    chatRoomId: info.chatRoomId,
    chatAllowlistId: info.chatAllowlistId,
  };
}
