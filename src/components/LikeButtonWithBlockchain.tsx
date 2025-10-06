"use client";

import { toggleLikeMember } from "@/app/actions/likeActions";
import { saveMatchOnChain } from "@/app/actions/matchOnChainActions";
import { isContractConfigured } from "@/configs/matchingMeContract";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { Loader2 } from "lucide-react";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";
const MATCH_REGISTRY_ID = process.env.NEXT_PUBLIC_MATCH_REGISTRY_ID || "0xcae785a9aa1022cf38e274c01ad3d28cf5dc42ae60e2a9814f7d72b06fdf567b";

interface Props {
  targetId: string;
  targetUserAddress?: string; // Wallet address for on-chain match
  hasLiked: boolean;
  myProfileObjectId?: string;
}

export default function LikeButtonWithBlockchain({
  targetId,
  targetUserAddress,
  hasLiked,
  myProfileObjectId,
}: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const contractEnabled = isContractConfigured();
  const canCreateOnChainMatch = contractEnabled && account?.address && myProfileObjectId && targetUserAddress;

  const toggleLike = async () => {
    setIsLoading(true);

    try {
      console.log("[LikeButton] Toggle like:", {
        targetId,
        hasLiked,
        canCreateOnChainMatch,
        myProfileObjectId,
        targetUserAddress,
      });

      // If liking and can create on-chain match
      if (!hasLiked && canCreateOnChainMatch) {
        console.log("[LikeButton] Creating like and checking mutual match...");

        // First, create like in database to check for mutual match
        await toggleLikeMember(targetId, hasLiked);
        console.log("[LikeButton] Like created in DB");

        // Check if this creates a mutual match
        const isMutualMatch = await checkMutualMatch(targetId);
        console.log("[LikeButton] Mutual match check result:", isMutualMatch);

        if (isMutualMatch) {
          console.log("[LikeButton] Mutual match detected! Creating on-chain match...");
          // Create Match on-chain (both users liked each other)
          await createOnChainMatch();
        } else {
          console.log("[LikeButton] Not mutual match yet, waiting for other user to like back");
        }
      } else {
        console.log("[LikeButton] Just updating database (unliking or no blockchain)");
        // Just update database (unliking or no blockchain)
        await toggleLikeMember(targetId, hasLiked);
      }

      router.refresh();
    } catch (error: any) {
      console.error("[LikeButton] Error toggling like:", error);
      toast.error(error.message || "Failed to update like");
    } finally {
      setIsLoading(false);
    }
  };

  const checkMutualMatch = async (targetUserId: string): Promise<boolean> => {
    try {
      // Check if target user has also liked current user
      const response = await fetch('/api/check-mutual-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });

      const data = await response.json();
      return data.isMutualMatch || false;
    } catch (error) {
      console.error("Error checking mutual match:", error);
      return false;
    }
  };

  const createOnChainMatch = async () => {
    if (!account?.address || !myProfileObjectId || !targetUserAddress) {
      throw new Error("Missing required data for on-chain match");
    }

    console.log("[LikeButton] Creating mutual match on-chain");
    toast.info("Creating match on blockchain...");

    try {
      // Step 1: Create match request
      const matchId = await createMatchRequest();
      console.log("[LikeButton] Match created:", matchId);

      // Step 2: Activate match (set status = 1)
      await activateMatch(matchId);
      console.log("[LikeButton] Match activated");

      // Step 3: Create chat room from match
      await createChatFromMatch(matchId);
      console.log("[LikeButton] Chat room created");

      // Step 4: Save to database
      await saveMatchOnChain({
        matchId,
        myProfileObjectId: myProfileObjectId!,
        targetUserAddress: targetUserAddress!,
        compatibilityScore: 95,
        digest: "", // Will be updated with actual digest
      });

      toast.success("🎉 It's a match! Chat room created!");
    } catch (error: any) {
      console.error("[LikeButton] Error creating match:", error);
      throw error;
    }
  };

  const createMatchRequest = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::core::create_match_request`,
        arguments: [
          tx.object(MATCH_REGISTRY_ID),
          tx.object(myProfileObjectId!),
          tx.pure.address(targetUserAddress!),
          tx.pure.u64(95),
          tx.pure.bool(true),
          tx.object("0x6"),
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            try {
              const txResult = await client.waitForTransaction({
                digest: result.digest,
                options: { showObjectChanges: true },
              });

              const matchObject = txResult.objectChanges?.find(
                (change: any) => change.type === "created" && change.objectType?.includes("::core::Match")
              );

              if (!matchObject || !("objectId" in matchObject)) {
                throw new Error("Match object not found");
              }

              resolve(matchObject.objectId);
            } catch (error) {
              reject(error);
            }
          },
          onError: reject,
        }
      );
    });
  };

  const activateMatch = async (matchId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::core::update_match_status`,
        arguments: [
          tx.object(matchId),
          tx.pure.u8(1), // MATCH_STATUS_ACTIVE = 1
          tx.object("0x6"),
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: () => resolve(),
          onError: reject,
        }
      );
    });
  };

  const createChatFromMatch = async (matchId: string): Promise<void> => {
    const CHAT_REGISTRY_ID = process.env.NEXT_PUBLIC_CHAT_REGISTRY_ID || "0x1d6554cbdd327bfcea9c8e16c511967c59a3c0c24b12270f2c2b62aec886d405";
    const ALLOWLIST_REGISTRY_ID = process.env.NEXT_PUBLIC_ALLOWLIST_REGISTRY_ID || "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399";

    return new Promise((resolve, reject) => {
      const tx = new Transaction();

      // Create chat room
      tx.moveCall({
        target: `${PACKAGE_ID}::chat::create_chat_from_match`,
        arguments: [
          tx.object(CHAT_REGISTRY_ID),
          tx.object(ALLOWLIST_REGISTRY_ID),
          tx.object(matchId),
          tx.object(myProfileObjectId!),
          tx.object("0x6"),
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: () => resolve(),
          onError: reject,
        }
      );
    });
  };

  return (
    <div
      onClick={toggleLike}
      className="relative hover:opacity-80 transition cursor-pointer"
    >
      {isLoading ? (
        <Loader2 size={24} className="animate-spin text-rose-500" />
      ) : (
        <>
          <AiOutlineHeart
            size={28}
            className="fill-white absolute -top-[2px] -right-[2px]"
          />
          <AiFillHeart
            size={24}
            className={hasLiked ? "fill-rose-500" : "fill-neutral-500/70"}
          />
          {canCreateOnChainMatch && !hasLiked && (
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full animate-pulse" />
          )}
        </>
      )}
    </div>
  );
}
