import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";

const PACKAGE_ID = "0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1";

export interface UserProfile {
  id: string;
  name: string;
  bio: string;
  age: number;
  gender: number;
  interests: string[];
  owner: string;
  matchCount: number;
  createdAt: number;
}

export interface Match {
  id: string;
  userA: string;
  userB: string;
  status: number;
  createdAt: number;
  zkProofValid: boolean;
}

export interface ChatRoom {
  id: string;
  participantA: string;
  participantB: string;
  messageCount: number;
  createdAt: number;
  matchId?: string;
}

export interface Message {
  id: string;
  sender: string;
  contentType: number;
  encryptedContent: string;
  timestamp: number;
  isRead: boolean;
}

export function useContractQuery() {
  const client = useSuiClient();

  // Query user profile
  const useProfile = (profileId: string | undefined) => {
    return useQuery({
      queryKey: ["profile", profileId],
      queryFn: async () => {
        if (!profileId) return null;

        const object = await client.getObject({
          id: profileId,
          options: {
            showContent: true,
            showOwner: true,
            showType: true,
          },
        });

        if (object.data?.content?.dataType !== "moveObject") {
          throw new Error("Invalid object type");
        }

        const fields = (object.data.content as any).fields;

        return {
          id: object.data.objectId,
          name: fields.name,
          bio: fields.bio,
          age: fields.age,
          gender: fields.gender,
          interests: fields.interests || [],
          owner: object.data.owner as string,
          matchCount: fields.match_count || 0,
          createdAt: fields.created_at,
        } as UserProfile;
      },
      enabled: !!profileId,
    });
  };

  // Query match
  const useMatch = (matchId: string | undefined) => {
    return useQuery({
      queryKey: ["match", matchId],
      queryFn: async () => {
        if (!matchId) return null;

        const object = await client.getObject({
          id: matchId,
          options: {
            showContent: true,
          },
        });

        if (object.data?.content?.dataType !== "moveObject") {
          throw new Error("Invalid object type");
        }

        const fields = (object.data.content as any).fields;

        return {
          id: object.data.objectId,
          userA: fields.user_a,
          userB: fields.user_b,
          status: fields.status,
          createdAt: fields.created_at,
          zkProofValid: fields.zk_proof_valid || false,
        } as Match;
      },
      enabled: !!matchId,
    });
  };

  // Query chat room
  const useChatRoom = (chatRoomId: string | undefined) => {
    return useQuery({
      queryKey: ["chatRoom", chatRoomId],
      queryFn: async () => {
        if (!chatRoomId) return null;

        const object = await client.getObject({
          id: chatRoomId,
          options: {
            showContent: true,
          },
        });

        if (object.data?.content?.dataType !== "moveObject") {
          throw new Error("Invalid object type");
        }

        const fields = (object.data.content as any).fields;

        return {
          id: object.data.objectId,
          participantA: fields.participant_a,
          participantB: fields.participant_b,
          messageCount: fields.message_count || 0,
          createdAt: fields.created_at,
          matchId: fields.match_id,
        } as ChatRoom;
      },
      enabled: !!chatRoomId,
    });
  };

  // Query owned objects by type
  const useOwnedObjects = (address: string | undefined, type: string) => {
    return useQuery({
      queryKey: ["ownedObjects", address, type],
      queryFn: async () => {
        if (!address) return [];

        const objects = await client.getOwnedObjects({
          owner: address,
          filter: {
            StructType: `${PACKAGE_ID}::core::${type}`,
          },
          options: {
            showContent: true,
            showType: true,
          },
        });

        return objects.data;
      },
      enabled: !!address,
    });
  };

  // Query transaction effects
  const useTransaction = (digest: string | undefined) => {
    return useQuery({
      queryKey: ["transaction", digest],
      queryFn: async () => {
        if (!digest) return null;

        const tx = await client.getTransactionBlock({
          digest,
          options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
            showBalanceChanges: true,
          },
        });

        return tx;
      },
      enabled: !!digest,
    });
  };

  // Query events
  const useEvents = (eventType: string) => {
    return useQuery({
      queryKey: ["events", eventType],
      queryFn: async () => {
        const events = await client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::${eventType}`,
          },
          limit: 50,
          order: "descending",
        });

        return events.data;
      },
    });
  };

  // Query dynamic fields (for registries)
  const useDynamicFields = (parentId: string | undefined) => {
    return useQuery({
      queryKey: ["dynamicFields", parentId],
      queryFn: async () => {
        if (!parentId) return [];

        const fields = await client.getDynamicFields({
          parentId,
        });

        return fields.data;
      },
      enabled: !!parentId,
    });
  };

  return {
    useProfile,
    useMatch,
    useChatRoom,
    useOwnedObjects,
    useTransaction,
    useEvents,
    useDynamicFields,
    packageId: PACKAGE_ID,
  };
}
