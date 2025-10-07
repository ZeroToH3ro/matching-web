"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { toast } from "react-toastify";
import { Loader2, MessageSquare, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { markMatchActive, saveChatOnChain } from "@/app/actions/matchOnChainActions";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";
const USAGE_TRACKER_ID = process.env.NEXT_PUBLIC_USAGE_TRACKER_ID || "0xc42ca99296a4b901b8ffc7dd858fe56855d3420996503950afad76f31449c1f7";
const MATCH_CHAT_REGISTRY_ID = process.env.NEXT_PUBLIC_MATCH_CHAT_REGISTRY_ID || "0xe909c265300cec16f82a534d30ff50c64295fd563809f0beaad38c88b24e9739";
const ALLOWLIST_REGISTRY_ID = process.env.NEXT_PUBLIC_ALLOWLIST_REGISTRY_ID || "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399";

interface Props {
  matchId: string;
  myProfileObjectId: string;
  partnerName: string;
  onChatCreated?: (chatRoomId: string) => void;
}

export default function MatchActions({
  matchId,
  myProfileObjectId,
  partnerName,
  onChatCreated,
}: Props) {
  const router = useRouter();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isActivating, setIsActivating] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [chatCreated, setChatCreated] = useState(false);

  const handleActivateMatch = async () => {
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsActivating(true);

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::core::update_match_status`,
        arguments: [
          tx.object(matchId),
          tx.pure.u8(1), // MATCH_STATUS_ACTIVE = 1
          tx.object("0x6"), // Clock
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            await markMatchActive({
              matchId,
              digest: result.digest,
            });

            toast.success("Match activated!");
            router.refresh();
          },
          onError: (error) => {
            console.error("Failed to activate match:", error);
            toast.error("Failed to activate match");
          },
        }
      );
    } catch (error: any) {
      console.error("Error activating match:", error);
      toast.error(error.message || "Failed to activate match");
    } finally {
      setIsActivating(false);
    }
  };

  const handleCreateChat = async () => {
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsCreatingChat(true);

    try {
      const tx = new Transaction();

      // Dummy encrypted key for now
      const encryptedKey = "0x00";
      const encryptedKeyBytes = [0];

      // Create chat from match using integration function
      tx.moveCall({
        target: `${PACKAGE_ID}::integration::create_chat_from_match_entry`,
        arguments: [
          tx.object(USAGE_TRACKER_ID),
          tx.object(MATCH_CHAT_REGISTRY_ID),
          tx.object(ALLOWLIST_REGISTRY_ID),
          tx.object(matchId),
          tx.object(myProfileObjectId),
          tx.pure.string("seal-policy-id"), // Placeholder
          tx.pure.vector("u8", encryptedKeyBytes),
          tx.object("0x6"), // Clock
        ],
      });

      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            try {
              const txResult = await client.waitForTransaction({
                digest: result.digest,
              });

              // Extract chat room and allowlist IDs
              const createdObjects = txResult.objectChanges?.filter(
                (change: any) => change.type === "created"
              ) || [];

              const chatRoomObj = createdObjects.find(
                (obj: any) => obj.objectType?.includes("::chat::ChatRoom")
              );
              const allowlistObj = createdObjects.find(
                (obj: any) => obj.objectType?.includes("::allowlist::MatchAllowlist")
              );

              if (!chatRoomObj || !allowlistObj) {
                throw new Error("Chat room or allowlist not found");
              }

              const chatRoomId = (chatRoomObj as any).objectId;
              const chatAllowlistId = (allowlistObj as any).objectId;

              // Save to database
              await saveChatOnChain({
                matchId,
                chatRoomId,
                chatAllowlistId,
                digest: result.digest,
              });

              setChatCreated(true);
              toast.success(`Chat created with ${partnerName}!`);

              if (onChatCreated) {
                onChatCreated(chatRoomId);
              }

              router.push(`/messages`);
            } catch (error: any) {
              console.error("Error processing chat creation:", error);
              toast.error("Chat created but failed to save: " + error.message);
            }
          },
          onError: (error) => {
            console.error("Failed to create chat:", error);
            toast.error("Failed to create chat");
          },
        }
      );
    } catch (error: any) {
      console.error("Error creating chat:", error);
      toast.error(error.message || "Failed to create chat");
    } finally {
      setIsCreatingChat(false);
    }
  };

  return (
    <Card className="border-2 border-gradient-to-r from-pink-500 to-purple-600">
      <CardHeader>
        <CardTitle className="text-lg">
          🎉 It's a Match with {partnerName}!
        </CardTitle>
        <CardDescription>
          You both liked each other. Activate your match to start chatting.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          onClick={handleActivateMatch}
          disabled={isActivating}
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
        >
          {isActivating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Activating...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Activate Match
            </>
          )}
        </Button>

        <Button
          onClick={handleCreateChat}
          disabled={isCreatingChat || chatCreated}
          variant="outline"
        >
          {isCreatingChat ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Chat...
            </>
          ) : chatCreated ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              Chat Created
            </>
          ) : (
            <>
              <MessageSquare className="mr-2 h-4 w-4" />
              Create Chat Room
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
