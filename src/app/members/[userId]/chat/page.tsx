import CardInnerWrapper from "@/components/CardInnerWrapper";
import React from "react";
import ChatForm from "./ChatForm";
import ChatFormWithBlockchain from "./ChatFormWithBlockchain";
import { getMessageThread } from "@/app/actions/messageActions";
import { getAuthUserId } from "@/app/actions/authActions";
import { getChatRoomByParticipants } from "@/app/actions/matchOnChainActions";
import { getMemberByUserId } from "@/app/actions/memberActions";
import { createChatId } from "@/lib/util";
import dynamic from "next/dynamic";

const MessageList = dynamic(() => import("./MessageList"), {
  ssr: false,
  loading: () => <div className="text-center p-4">Loading messages...</div>
});

export default async function ChatPage({
  params,
}: {
  params: { userId: string };
}) {
  const messages = await getMessageThread(
    params.userId
  );
  const userId = await getAuthUserId();

  const chatId = createChatId(
    userId,
    params.userId
  );

  // Check if on-chain chat room exists
  // params.userId is the target user's wallet address
  const chatRoom = await getChatRoomByParticipants(userId, params.userId);

  // Get recipient member info for gift feature
  const recipientMember = await getMemberByUserId(params.userId);

  return (
    <CardInnerWrapper
      header={chatRoom ? "Encrypted Chat" : "Chat"}
      body={
        <MessageList
          initialMessages={messages}
          currentUserId={userId}
          chatId={chatId}
          chatRoomId={chatRoom?.chatRoomId}
          chatAllowlistId={chatRoom?.chatAllowlistId}
          recipientId={params.userId}
        />
      }
      footer={
        chatRoom ? (
          <ChatFormWithBlockchain
            chatRoomId={chatRoom.chatRoomId}
            chatAllowlistId={chatRoom.chatAllowlistId}
            recipientAddress={params.userId}
            recipientName={recipientMember?.name || undefined}
          />
        ) : (
          <ChatForm />
        )
      }
    />
  );
}
