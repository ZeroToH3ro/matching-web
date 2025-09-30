import CardInnerWrapper from "@/components/CardInnerWrapper";
import React from "react";
import ChatForm from "./ChatForm";
import { getMessageThread } from "@/app/actions/messageActions";
import { getAuthUserId } from "@/app/actions/authActions";
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

  return (
    <CardInnerWrapper
      header="Chat"
      body={
        <MessageList
          initialMessages={messages}
          currentUserId={userId}
          chatId={chatId}
        />
      }
      footer={<ChatForm />}
    />
  );
}
