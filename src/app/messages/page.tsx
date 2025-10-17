import React from "react";
import MessageSidebar from "./MessageSidebar";
import { getMessagesByContainer } from "../actions/messageActions";
import MessageTable from "./MessageTable";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { container: string };
}) {
  const { messages, nextCursor } =
    await getMessagesByContainer(
      searchParams.container
    );

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-5 h-[80vh] mt-10">
      <div className="md:col-span-2">
        <MessageSidebar />
      </div>
      <div className="flex-1 md:col-span-10">
        <MessageTable
          initialMessages={messages}
          nextCursor={nextCursor}
        />
      </div>
    </div>
  );
}
