"use client";

import { createMessage } from "@/app/actions/messageActions";
import {
  type MessageSchema,
  messageSchema,
} from "@/lib/schemas/MessageSchema";
import { handleFormServerErrors } from "@/lib/util";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@nextui-org/react";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { HiPaperAirplane } from "react-icons/hi2";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSignPersonalMessage } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SealClient, SessionKey } from "@mysten/seal";
import { fromHex, toHex } from "@mysten/sui/utils";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import { CONTRACT_IDS } from "@/lib/blockchain/contractQueries";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;

type Props = {
  chatRoomId?: string | null;
  chatAllowlistId?: string | null;
};

export default function ChatFormWithBlockchain({ chatRoomId, chatAllowlistId }: Props) {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  const [isSendingOnChain, setIsSendingOnChain] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting, isValid, errors },
  } = useForm<MessageSchema>({
    resolver: zodResolver(messageSchema),
  });

  const hasOnChainChat = !!(chatRoomId && chatAllowlistId && account?.address);

  // Send message on-chain with proper Seal encryption
  const sendOnChainMessage = async (messageText: string) => {
    if (!chatRoomId || !chatAllowlistId || !account?.address) {
      throw new Error("On-chain chat not available");
    }

    setIsSendingOnChain(true);

    try {
      // 1. Create session key for Seal encryption
      const sessionKey = await SessionKey.create({
        address: account.address,
        packageId: PACKAGE_ID,
        ttlMin: 10,
        suiClient: client,
      });

      // Sign personal message
      await new Promise<void>((resolve, reject) => {
        signPersonalMessage(
          { message: sessionKey.getPersonalMessage() },
          {
            onSuccess: async (result: { signature: string }) => {
              try {
                await sessionKey.setPersonalMessageSignature(result.signature);
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onError: reject,
          }
        );
      });

      // 2. Encrypt message with proper namespace
      // Seal Protocol server object IDs from environment
      const SERVER_OBJECT_IDS = process.env.NEXT_PUBLIC_SEAL_SERVER_IDS
        ? process.env.NEXT_PUBLIC_SEAL_SERVER_IDS.split(',').map(id => id.trim())
        : [
            "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
            "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
          ];

      const sealClient = new SealClient({
        suiClient: client,
        serverConfigs: SERVER_OBJECT_IDS.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: false,
      });

      const contentBytes = new TextEncoder().encode(messageText);

      // Generate nonce for unique encryption ID
      const nonce = crypto.getRandomValues(new Uint8Array(5));

      // Build proper namespace: TYPE_CHAT (1 byte) + ChatAllowlist ID (32 bytes)
      const TYPE_CHAT = 1;
      const allowlistIdBytes = fromHex(chatAllowlistId.startsWith("0x")
        ? chatAllowlistId.slice(2)
        : chatAllowlistId);

      // Namespace = TYPE_CHAT + ChatAllowlist ID
      const namespace = new Uint8Array([TYPE_CHAT, ...allowlistIdBytes]);

      // Full encryption ID = namespace + nonce
      const encryptionId = toHex(new Uint8Array([...namespace, ...nonce]));

      const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: encryptionId,
        data: contentBytes,
      });

      // 3. Get chat room object to find registry IDs
      console.log("[ChatForm] Sending to ChatRoom ID:", chatRoomId);
      console.log("[ChatForm] Using Package ID:", PACKAGE_ID);
      console.log("[ChatForm] Registry IDs:", CONTRACT_IDS);

      const chatRoomObj = await client.getObject({
        id: chatRoomId,
        options: { showContent: true, showType: true },
      });

      if (!chatRoomObj.data?.content || chatRoomObj.data.content.dataType !== "moveObject") {
        throw new Error("Invalid chat room object");
      }

      console.log("[ChatForm] ChatRoom type:", chatRoomObj.data.type);
      console.log("[ChatForm] ChatRoom content:", chatRoomObj.data.content);

      // 4. Build and execute transaction
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::chat::send_message_entry`,
        arguments: [
          tx.object(CONTRACT_IDS.CHAT_REGISTRY_ID),
          tx.object(CONTRACT_IDS.MESSAGE_INDEX_ID),
          tx.object(chatRoomId),
          tx.pure.vector("u8", Array.from(encryptedBytes)),
          tx.pure.vector("u8", [0]), // content_hash (empty for now)
          tx.object("0x6"), // Clock
        ],
      });

      // Execute transaction
      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: async () => {
              toast.success("Encrypted message sent on blockchain! 🔒");
              resolve();
            },
            onError: (error) => {
              console.error("[ChatForm] Transaction error:", error);
              toast.error("Failed to send encrypted message");
              reject(error);
            },
          }
        );
      });
    } catch (error: any) {
      console.error("[ChatForm] Error during send:", error);
      toast.error(error.message || "Failed to send message");
      throw error;
    } finally {
      setIsSendingOnChain(false);
    }
  };

  const onSubmit = async (data: MessageSchema) => {
    if (hasOnChainChat) {
      // Send on-chain
      try {
        await sendOnChainMessage(data.text);
        reset();
      } catch (error) {
        // Error already handled in sendOnChainMessage
      }
    } else {
      // Send to database (fallback)
      const result = await createMessage(params.userId, data);
      if (result.status === "error") {
        handleFormServerErrors(result, setError);
      } else {
        reset();
        router.refresh();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="flex items-center gap-2">
        <Input
          fullWidth
          placeholder={hasOnChainChat ? "Type encrypted message..." : "Type a message"}
          variant="faded"
          {...register("text")}
          isInvalid={!!errors.text}
          errorMessage={errors.text?.message}
          isDisabled={isSendingOnChain}
        />
        <Button
          type="submit"
          isIconOnly
          color={hasOnChainChat ? "secondary" : "default"}
          radius="full"
          isLoading={isSubmitting || isSendingOnChain}
          isDisabled={!isValid || isSubmitting || isSendingOnChain}
          className={hasOnChainChat ? "bg-gradient-to-r from-pink-500 to-purple-600" : ""}
        >
          {isSendingOnChain ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <HiPaperAirplane size={18} />
          )}
        </Button>
      </div>
      <div className="flex flex-col">
        {errors.root?.serverError && (
          <p className="text-danger text-sm">
            {errors.root.serverError.message}
          </p>
        )}
      </div>
    </form>
  );
}
