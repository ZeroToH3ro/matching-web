import CardInnerWrapper from "@/components/CardInnerWrapper";
import React from "react";
import ChatForm from "./ChatForm";
import ChatFormWithBlockchain from "./ChatFormWithBlockchain";
import { getMessageThread } from "@/app/actions/messageActions";
import { getAuthUserId } from "@/app/actions/authActions";
import { getChatRoomByParticipants } from "@/app/actions/matchOnChainActions";
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
  const chatRoom = await getChatRoomByParticipants(userId, params.userId);

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
        />
      }
      footer={
        chatRoom ? (
          <ChatFormWithBlockchain
            chatRoomId={chatRoom.chatRoomId}
            chatAllowlistId={chatRoom.chatAllowlistId}
          />
        ) : (
          <ChatForm />
        )
      }
    />
  );
}
