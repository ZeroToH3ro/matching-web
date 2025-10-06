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
      // If liking and can create on-chain match, do blockchain transaction
      if (!hasLiked && canCreateOnChainMatch) {
        await createOnChainMatch();
      }

      // Always update database
      await toggleLikeMember(targetId, hasLiked);

      router.refresh();
    } catch (error: any) {
      console.error("Error toggling like:", error);
      toast.error(error.message || "Failed to update like");
    } finally {
      setIsLoading(false);
    }
  };

  const createOnChainMatch = async () => {
    if (!account?.address || !myProfileObjectId || !targetUserAddress) {
      throw new Error("Missing required data for on-chain match");
    }

    return new Promise<void>((resolve, reject) => {
      const tx = new Transaction();

      // Create match request on-chain
      tx.moveCall({
        target: `${PACKAGE_ID}::core::create_match_request`,
        arguments: [
          tx.object(MATCH_REGISTRY_ID),
          tx.object(myProfileObjectId),
          tx.pure.address(targetUserAddress),
          tx.pure.u64(85), // Default compatibility score
          tx.pure.bool(true), // ZK proof valid (placeholder)
          tx.object("0x6"), // Clock
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            try {
              // Wait for transaction to be indexed
              const txResult = await client.waitForTransaction({
                digest: result.digest,
              });

              // Extract match ID from created objects
              const createdObjects = txResult.objectChanges?.filter(
                (change: any) => change.type === "created"
              ) || [];

              const matchObject = createdObjects.find(
                (obj: any) => obj.objectType?.includes("::core::Match")
              );

              if (!matchObject) {
                throw new Error("Match object not found in transaction result");
              }

              // Save to database
              await saveMatchOnChain({
                matchId: (matchObject as any).objectId,
                myProfileObjectId: myProfileObjectId!,
                targetUserAddress: targetUserAddress!,
                compatibilityScore: 85,
                digest: result.digest,
              });

              toast.success("Match created on blockchain!");
              resolve();
            } catch (error: any) {
              console.error("Error processing match result:", error);
              reject(error);
            }
          },
          onError: (error) => {
            console.error("Transaction failed:", error);
            reject(error);
          },
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
