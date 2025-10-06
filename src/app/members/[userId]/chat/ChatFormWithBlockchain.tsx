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
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

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

  // Send message on-chain
  const sendOnChainMessage = async (messageText: string) => {
    if (!chatRoomId || !chatAllowlistId || !account?.address) {
      throw new Error("On-chain chat not available");
    }

    setIsSendingOnChain(true);

    try {
      // 1. Create session key for Seal encryption
      console.log("[ChatForm] Creating session key...");
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

      console.log("[ChatForm] Session key signed");

      // 2. Encrypt message content with Seal
      const sealClient = new SealClient({
        network: "testnet",
        packageId: PACKAGE_ID,
      });

      const messageBytes = new TextEncoder().encode(messageText);
      const encrypted = await sealClient.encrypt({
        data: messageBytes,
        sessionKey,
      });

      console.log("[ChatForm] Message encrypted");

      // 3. Build transaction to send message on-chain
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::chat::send_message`,
        arguments: [
          tx.object(chatRoomId),
          tx.pure.vector("u8", Array.from(encrypted)),
          tx.object("0x6"), // Clock
        ],
      });

      // 4. Execute transaction
      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: async (result) => {
              console.log("[ChatForm] Message sent on-chain:", result.digest);
              toast.success("Message sent on blockchain!");
              resolve();
            },
            onError: (error) => {
              console.error("[ChatForm] Failed to send on-chain message:", error);
              toast.error("Failed to send encrypted message");
              reject(error);
            },
          }
        );
      });
    } catch (error: any) {
      console.error("[ChatForm] Error sending on-chain message:", error);
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
