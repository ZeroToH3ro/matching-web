"use client";

import type { MessageDto } from "@/types";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import MessageBox from "./MessageBox";
import { pusherClient } from "@/lib/pusher";
import { formatShortDateTime } from "@/lib/util";
import useMessageStore from "@/hooks/useMessageStore";
import { useOnChainChat } from "@/hooks/useOnChainChat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  initialMessages: {
    messages: MessageDto[];
    readCount: number;
  };
  currentUserId: string;
  chatId: string;
  chatRoomId?: string | null;
  chatAllowlistId?: string | null;
};

export default function MessageList({
  initialMessages,
  currentUserId,
  chatId,
  chatRoomId,
  chatAllowlistId,
}: Props) {
  const [dbMessages, setDbMessages] = useState(
    initialMessages.messages
  );

  const setReadCount = useRef(false);

  const { updateUnreadCount } = useMessageStore(
    (state) => ({
      updateUnreadCount: state.updateUnreadCount,
    })
  );

  // On-chain chat integration - only enable if chat room exists
  const shouldUseOnChain = !!(chatRoomId && chatAllowlistId);

  const {
    messages: onChainMessages = [],
    loading: onChainLoading,
    error: onChainError,
    refreshMessages,
    hasOnChainChat,
  } = useOnChainChat({
    chatRoomId: shouldUseOnChain ? chatRoomId : null,
    chatAllowlistId: shouldUseOnChain ? chatAllowlistId : null,
    autoRefreshInterval: 5000, // Refresh every 5 seconds
  });

  useEffect(() => {
    if (!setReadCount.current) {
      updateUnreadCount(
        -initialMessages.readCount
      );
      setReadCount.current = true;
    }
  }, [
    initialMessages.readCount,
    updateUnreadCount,
  ]);

  const handleNewMessage = useCallback(
    (message: MessageDto) => {
      setDbMessages((prevState) => {
        return [...prevState, message];
      });
    },
    []
  );

  const handleReadMessages = useCallback(
    (messageIds: string[]) => {
      setDbMessages((prevState) =>
        prevState.map((message) =>
          messageIds.includes(message.id)
            ? {
                ...message,
                dateRead: formatShortDateTime(
                  new Date()
                ),
              }
            : message
        )
      );
    },
    []
  );

  // Pusher for real-time database messages
  useEffect(() => {
    const channel =
      pusherClient.subscribe(chatId);
    channel.bind("message:new", handleNewMessage);
    channel.bind(
      "messages:read",
      handleReadMessages
    );

    return () => {
      channel.unsubscribe();
      channel.unbind(
        "message:new",
        handleNewMessage
      );
      channel.unbind(
        "messages:read",
        handleReadMessages
      );
    };
  }, [chatId, handleNewMessage, handleReadMessages]);

  // Use on-chain messages if available, otherwise use database messages
  const displayMessages = hasOnChainChat ? onChainMessages : dbMessages;

  return (
    <div className="space-y-4">
      {/* On-Chain Status Banner */}
      {hasOnChainChat && (
        <Alert className="border-purple-500 bg-purple-50">
          <Lock className="h-4 w-4 text-purple-600" />
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center gap-2">
              <AlertDescription className="text-purple-900">
                End-to-end encrypted chat on Sui blockchain
              </AlertDescription>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mr-1 animate-pulse" />
                Live
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshMessages()}
              disabled={onChainLoading}
              className="h-8"
            >
              {onChainLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Alert>
      )}

      {/* Error Display */}
      {onChainError && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load encrypted messages: {onChainError}
          </AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <div className="space-y-2">
        {displayMessages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {onChainLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading encrypted messages...</span>
              </div>
            ) : (
              "No messages to display"
            )}
          </div>
        ) : (
          <>
            {hasOnChainChat ? (
              // On-chain messages
              onChainMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-lg ${
                      message.isMe
                        ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm break-words">
                      {message.encrypted ? (
                        <span className="flex items-center gap-1 text-xs opacity-70">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Decrypting...
                        </span>
                      ) : (
                        message.content
                      )}
                    </p>
                    <p className={`text-xs mt-1 ${message.isMe ? "text-white/70" : "text-muted-foreground"}`}>
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              // Database messages
              dbMessages.map((message) => (
                <MessageBox
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
