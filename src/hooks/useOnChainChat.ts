"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCurrentAccount, useSuiClient, useSignPersonalMessage } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";
import { fromHex } from "@mysten/sui/utils";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

export interface OnChainMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  isMe: boolean;
  encrypted: boolean;
}

interface UseOnChainChatProps {
  chatRoomId?: string | null;
  chatAllowlistId?: string | null;
  autoRefreshInterval?: number; // milliseconds, default 5000
}

export function useOnChainChat({
  chatRoomId,
  chatAllowlistId,
  autoRefreshInterval = 5000,
}: UseOnChainChatProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  const [messages, setMessages] = useState<OnChainMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializingSession, setIsInitializingSession] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  const cachedSessionKeyRef = useRef<SessionKey | null>(null);
  const sealClientRef = useRef<SealClient | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if package ID is configured
  const isConfigured = !!PACKAGE_ID && PACKAGE_ID.length > 0;

  // Get or create Seal client lazily
  const getSealClient = useCallback(() => {
    if (!sealClientRef.current && isConfigured) {
      try {
        // Seal Protocol server object IDs (must match test-contract page)
        const SERVER_OBJECT_IDS = [
          "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
          "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
        ];

        sealClientRef.current = new SealClient({
          suiClient: client,
          serverConfigs: SERVER_OBJECT_IDS.map((id) => ({
            objectId: id,
            weight: 1,
          })),
          verifyKeyServers: false,
        });
      } catch (err) {
        console.error("[useOnChainChat] Failed to initialize SealClient:", err);
        return null;
      }
    }
    return sealClientRef.current;
  }, [isConfigured, client]);

  // Initialize session key
  const initializeSessionKey = useCallback(async (): Promise<SessionKey | null> => {
    if (!account?.address) return null;

    // Return cached if available
    if (cachedSessionKeyRef.current) {
      return cachedSessionKeyRef.current;
    }

    if (isInitializingSession) {
      // Wait for ongoing initialization
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (cachedSessionKeyRef.current || !isInitializingSession) {
            clearInterval(checkInterval);
            resolve(cachedSessionKeyRef.current);
          }
        }, 100);
      });
    }

    setIsInitializingSession(true);

    try {
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

      cachedSessionKeyRef.current = sessionKey;
      setIsInitializingSession(false);
      return sessionKey;
    } catch (err: any) {
      console.error("[useOnChainChat] Failed to create session key:", err);
      setIsInitializingSession(false);
      return null;
    }
  }, [account?.address, client, signPersonalMessage, isInitializingSession]);

  // Auto-decrypt a single message
  const autoDecryptMessage = useCallback(async (
    messageId: string,
    encryptedContent: Uint8Array,
    sessionKey: SessionKey
  ): Promise<string | null> => {
    if (!chatAllowlistId) return null;

    const sealClient = getSealClient();
    if (!sealClient) return null;

    try {
      // Parse encrypted object
      const encryptedObj = EncryptedObject.parse(encryptedContent);
      const encryptedId = encryptedObj.id;

      // Build seal_approve tx
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_policies::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(encryptedId)),
          tx.object(chatAllowlistId),
          tx.object("0x6"),
        ],
      });

      const txBytes = await tx.build({ client, onlyTransactionKind: true });

      // Fetch keys from Seal servers
      await sealClient.fetchKeys({
        ids: [encryptedId],
        txBytes,
        sessionKey,
        threshold: 2,
      });

      // Decrypt
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedContent,
        sessionKey,
        txBytes,
      });
      const decryptedText = new TextDecoder().decode(decryptedBytes);

      // Update message in state
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, content: decryptedText, encrypted: false }
          : m
      ));

      return decryptedText;
    } catch (err: any) {
      console.error(`[useOnChainChat] Failed to decrypt message ${messageId}:`, err.message);
      return null;
    }
  }, [chatAllowlistId, client, getSealClient]);

  // Load chat messages from blockchain
  const loadChatMessages = useCallback(async (showLoading = false) => {
    if (!chatRoomId || !chatAllowlistId || !account?.address || !isConfigured) {
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      // Query events directly
      const events = await client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::chat::MessageSent`
        },
        limit: 50,
        order: "descending",
      });

      // Filter messages for this chat room
      const chatMessages: OnChainMessage[] = [];

      if (events?.data && Array.isArray(events.data)) {
        for (const event of events.data) {
          if (event.parsedJson) {
            const data = event.parsedJson as any;

            // Only include messages from this chat room
            if (data.chat_id === chatRoomId) {
              chatMessages.push({
                id: data.message_id,
                content: "[Encrypted]", // Will decrypt later
                sender: data.sender,
                timestamp: new Date(parseInt(data.timestamp)).toISOString(),
                isMe: data.sender.toLowerCase() === account.address.toLowerCase(),
                encrypted: true,
              });
            }
          }
        }
      }

      // Sort by timestamp (oldest first)
      chatMessages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Update messages, preserving decrypted content
      setMessages(prev => {
        return chatMessages.map(newMsg => {
          const existing = prev.find(m => m.id === newMsg.id);
          // If message exists and was decrypted, keep decrypted content
          if (existing && !existing.encrypted) {
            return existing;
          }
          return newMsg;
        });
      });

      if (showLoading) {
        setLoading(false);
      }

      // Auto-decrypt all encrypted messages
      if (chatMessages.length > 0 && account) {
        // Initialize session key once
        const sessionKey = await initializeSessionKey();
        if (!sessionKey) {
          console.error("[useOnChainChat] Failed to initialize session key for auto-decrypt");
          return;
        }

        // Decrypt messages that haven't been decrypted yet
        const messagesToDecrypt = chatMessages.filter(msg => {
          const existing = messages.find(m => m.id === msg.id);
          return !existing || existing.encrypted;
        });

        if (messagesToDecrypt.length > 0) {
          // Fetch message objects to get encrypted content
          const messageObjects = await Promise.all(
            messagesToDecrypt.map(msg =>
              client.getObject({
                id: msg.id,
                options: { showContent: true }
              }).catch(err => {
                console.error(`Failed to fetch message ${msg.id}:`, err);
                return null;
              })
            )
          );

          // Decrypt each message
          for (let i = 0; i < messagesToDecrypt.length; i++) {
            const msg = messagesToDecrypt[i];
            const obj = messageObjects[i];

            if (obj?.data?.content && "fields" in obj.data.content) {
              const fields = obj.data.content.fields as any;
              const encryptedContentArray = fields.encrypted_content;

              if (encryptedContentArray) {
                // encrypted_content is already an array of bytes, just wrap it
                const encryptedBytes = new Uint8Array(encryptedContentArray);

                await autoDecryptMessage(msg.id, encryptedBytes, sessionKey);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error("[useOnChainChat] Failed to load messages:", err);
      setError(err.message);
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [chatRoomId, chatAllowlistId, account?.address, client, initializeSessionKey, autoDecryptMessage, isConfigured]);

  // Setup auto-refresh
  useEffect(() => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Clear session key when chat room changes
    cachedSessionKeyRef.current = null;
    setMessages([]); // Clear old messages
    setIsEnabled(false);

    // Only enable if mounted and package is configured
    if (!isMounted || !isConfigured) {
      return;
    }

    // Start auto-refresh if chat room is set
    if (chatRoomId && chatAllowlistId && account) {
      setIsEnabled(true);

      // Initial load
      loadChatMessages(true);

      // Set up interval for auto-refresh
      refreshIntervalRef.current = setInterval(() => {
        loadChatMessages(false);
      }, autoRefreshInterval);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRoomId, chatAllowlistId, account?.address, autoRefreshInterval, isConfigured, isMounted]);

  return {
    messages: messages || [], // Ensure always returns array
    loading,
    error,
    refreshMessages: () => loadChatMessages(true),
    hasOnChainChat: isMounted && isConfigured && isEnabled && !!(chatRoomId && chatAllowlistId),
  };
}
