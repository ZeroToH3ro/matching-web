"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSignPersonalMessage } from "@mysten/dapp-kit";
import ObjectChangesDisplay from "@/components/ObjectChangesDisplay";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";
import { fromHex, toHex } from "@mysten/sui/utils";
import { useWalrusClient } from "@/hooks/useWalrusClient";
import WalletProfileFinder from "@/components/blockchain/WalletProfileFinder";
import DetailedChatDebugger from "@/components/blockchain/DetailedChatDebugger";
import { getChatRoomIdByMatchId, getChatAllowlistIdByChatRoomId } from "@/lib/blockchain/contractQueries";

const PACKAGE_ID = "0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821";

// Shared object IDs from latest deployment (BcK3vZeQyPqPbrbgL7BT6AKH5vr45zWWCvTy7zSBgvmC) - AUTO CHATALLOWLIST + SHARED CHATROOM ✅
const PROFILE_REGISTRY_ID = "0x20e5393af9af450275b4adff795b34c82e9cf21d7e0130d067b9f9c90a930c02";
const MATCH_REGISTRY_ID = "0xcae785a9aa1022cf38e274c01ad3d28cf5dc42ae60e2a9814f7d72b06fdf567b";
const CHAT_REGISTRY_ID = "0x1d6554cbdd327bfcea9c8e16c511967c59a3c0c24b12270f2c2b62aec886d405";
const MESSAGE_INDEX_ID = "0x1a58570e00e9bd3b80aa5ca3ab717891e22c0fe76b72d40b675c8ae5f0a2ca86";
const USAGE_TRACKER_ID = "0xc42ca99296a4b901b8ffc7dd858fe56855d3420996503950afad76f31449c1f7";
const MATCH_CHAT_REGISTRY_ID = "0xe909c265300cec16f82a534d30ff50c64295fd563809f0beaad38c88b24e9739";
const ALLOWLIST_REGISTRY_ID = "0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399";
const MEDIA_REGISTRY_ID = "0xd860be341dddb4ce09950e1b88a5264df84db0b9443932aab44c899f95ed6f73";

export default function TestContractPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const walrusClient = useWalrusClient();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Profile test data
  const [profileData, setProfileData] = useState({
    name: "John Doe",
    bio: "Test bio",
    age: 25,
    gender: 0,
    interests: "Sports,Music,Travel",
  });

  // Match test data
  const [matchData, setMatchData] = useState({
    myProfileId: "",
    targetUserAddress: "",
    compatibilityScore: 85,
    zkProofValid: true,
  });

  // Activate match data
  const [activateMatchData, setActivateMatchData] = useState({
    matchId: "",
  });

  // Chat test data
  const [chatData, setChatData] = useState({
    matchId: "",
    myProfileId: "",
    sealPolicyId: "test-seal-policy",
    encryptedKey: "0x00",
  });

  // Message test data
  const [messageData, setMessageData] = useState({
    chatRoomId: "",
    chatAllowlistId: "", // Required for proper Seal encryption
    content: "Hello from blockchain!",
    contentHash: "0x00",
  });

  // Query messages data
  const [queryMessagesData, setQueryMessagesData] = useState({
    chatRoomId: "",
  });

  // Query single message data
  const [queryMessageData, setQueryMessageData] = useState({
    messageId: "",
  });

  // Create chat allowlist data
  const [allowlistData, setAllowlistData] = useState({
    chatRoomId: "",
    myProfileId: "",
  });

  // Decrypt message data
  const [decryptData, setDecryptData] = useState({
    messageId: "",
    chatAllowlistId: "",
  });

  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null);

  // Chat Room state
  const [chatRoomData, setChatRoomData] = useState({
    chatRoomId: "",
    chatAllowlistId: "",
  });
  const [messages, setMessages] = useState<Array<{
    id: string;
    content: string;
    sender: string;
    timestamp: string;
    isMe: boolean;
    encrypted: boolean;
  }>>([]);
  const [newMessage, setNewMessage] = useState("");

  // Session key cache for auto-decrypt
  const [cachedSessionKey, setCachedSessionKey] = useState<SessionKey | null>(null);
  const [isInitializingSession, setIsInitializingSession] = useState(false);

  // Media test data
  const [mediaData, setMediaData] = useState({
    profileId: "",
    matchId: "", // For MATCHES_ONLY content - used to create MatchAllowlist
    walrusBlobId: "",
    sealPolicyId: "", // Allowlist ID for decryption
    contentType: 0, // 0=IMAGE, 1=VIDEO
    visibilityLevel: 2, // 0=PUBLIC, 1=VERIFIED_ONLY, 2=MATCHES_ONLY
    caption: "Test media",
    tags: "test,dating",
  });

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingToWalrus, setIsUploadingToWalrus] = useState(false);

  // View media data
  const [viewMediaData, setViewMediaData] = useState({
    mediaId: "",
    viewerAddress: "",
  });

  const [mediaList, setMediaList] = useState<Array<{
    id: string;
    owner: string;
    walrusBlobId: string;
    sealPolicyId: string | null;
    contentType: number;
    visibilityLevel: number;
    caption: string;
    viewCount: number;
    canView: boolean;
  }>>([]);

  // Seal Protocol configuration
  const SERVER_OBJECT_IDS = [
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

  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  // Auto-refresh messages every 5 seconds when chat room is active
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Clear session key when chat room changes
    setCachedSessionKey(null);
    setMessages([]); // Clear old messages

    // Start auto-refresh if chat room is set
    if (chatRoomData.chatRoomId && chatRoomData.chatAllowlistId && account) {
      // Initial load
      loadChatMessages();

      // Set up interval for auto-refresh every 5 seconds
      refreshIntervalRef.current = setInterval(() => {
        loadChatMessages();
      }, 5000);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [chatRoomData.chatRoomId, chatRoomData.chatAllowlistId, account?.address]);

  const executeTransaction = async (txBlock: Transaction, description: string): Promise<any> => {
    if (!account) {
      setError("Please connect wallet first");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    return new Promise((resolve, reject) => {
      try {
        signAndExecute(
          { transaction: txBlock },
          {
            onSuccess: async (result) => {
              const txResult = await client.waitForTransaction({
                digest: result.digest,
              });

              const resultData = {
                digest: result.digest,
                status: txResult.effects?.status,
                events: txResult.events,
                objectChanges: txResult.objectChanges,
                description,
              };

              setResult(resultData);
              setLoading(false);
              resolve(resultData);
            },
            onError: (error) => {
              setError(error.message);
              setLoading(false);
              reject(error);
            },
          }
        );
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
        reject(err);
      }
    });
  };

  // 0a. Create Usage Tracker (if needed)
  const createUsageTracker = async () => {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::integration::create_usage_tracker`,
      arguments: [],
    });

    await executeTransaction(tx, "Create Usage Tracker");
  };

  // 0b. Create Message Index (if needed)
  const createMessageIndex = async () => {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::chat::create_message_index`,
      arguments: [],
    });

    await executeTransaction(tx, "Create Message Index");
  };

  // 1. Create Profile
  const createProfile = async () => {
    const tx = new Transaction();
    const interests = profileData.interests.split(",").map(s => s.trim());

    const [profile] = tx.moveCall({
      target: `${PACKAGE_ID}::core::create_profile`,
      arguments: [
        tx.object(PROFILE_REGISTRY_ID),
        tx.pure.string(profileData.name),
        tx.pure.u8(profileData.age),
        tx.pure.string(profileData.bio),
        tx.pure.vector("string", interests),
        tx.object("0x6"), // Clock
      ],
    });

    // Transfer the profile NFT to the sender
    tx.transferObjects([profile], tx.pure.address(account!.address));

    await executeTransaction(tx, "Create Profile");
  };

  // 2. Create Match Request (one-sided)
  const createMatch = async () => {
    const tx = new Transaction();

    // Function now handles transfer internally and returns match_id
    tx.moveCall({
      target: `${PACKAGE_ID}::core::create_match_request`,
      arguments: [
        tx.object(MATCH_REGISTRY_ID),
        tx.object(matchData.myProfileId),
        tx.pure.address(matchData.targetUserAddress),
        tx.pure.u64(matchData.compatibilityScore),
        tx.pure.bool(matchData.zkProofValid),
        tx.object("0x6"), // Clock
      ],
    });

    await executeTransaction(tx, "Create Match Request");
  };

  // 2b. Activate Match
  const activateMatch = async () => {
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::core::update_match_status`,
      arguments: [
        tx.object(activateMatchData.matchId),
        tx.pure.u8(1), // MATCH_STATUS_ACTIVE = 1
        tx.object("0x6"), // Clock
      ],
    });

    await executeTransaction(tx, "Activate Match");
  };

  // 3. Create Chat from Match (with error handling for existing chat)
  const createChatFromMatch = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Check if chat already exists
      console.log("🔍 Checking if chat already exists...");

      const existingChatId = await getChatRoomIdByMatchId(client, chatData.matchId);

      if (existingChatId) {
        console.log("✅ Chat already exists:", existingChatId);

        // Check for allowlist
        const existingAllowlistId = await getChatAllowlistIdByChatRoomId(client, existingChatId);

        if (existingAllowlistId) {
          setResult({
            description: "Chat Already Exists",
            chatRoomId: existingChatId,
            chatAllowlistId: existingAllowlistId,
            note: "This match already has a chat room! You can use these IDs to send messages.",
          });

          alert(`Chat already exists!\n\nChat Room ID: ${existingChatId}\nChat Allowlist ID: ${existingAllowlistId}\n\nYou can start sending messages!`);
        } else {
          setResult({
            description: "Chat Exists (Allowlist Missing)",
            chatRoomId: existingChatId,
            note: "Chat room exists but allowlist not found. Create allowlist in section 7.",
          });

          alert(`Chat exists but allowlist missing!\n\nChat Room ID: ${existingChatId}\n\nCreate allowlist in section 7 to send messages.`);
        }

        setLoading(false);
        return;
      }

      // Step 2: Chat doesn't exist, create it
      console.log("📝 Creating new chat...");

      const tx = new Transaction();

      // Convert hex string to vector<u8>
      const encryptedKeyBytes = chatData.encryptedKey.startsWith("0x")
        ? Array.from(Buffer.from(chatData.encryptedKey.slice(2), "hex"))
        : Array.from(Buffer.from(chatData.encryptedKey, "hex"));

      // Use the entry function wrapper - auto-creates shared ChatAllowlist!
      tx.moveCall({
        target: `${PACKAGE_ID}::integration::create_chat_from_match_entry`,
        arguments: [
          tx.object(USAGE_TRACKER_ID),
          tx.object(MATCH_CHAT_REGISTRY_ID),
          tx.object(CHAT_REGISTRY_ID),
          tx.object(ALLOWLIST_REGISTRY_ID),
          tx.object(chatData.myProfileId),
          tx.object(chatData.matchId),
          tx.pure.string(chatData.sealPolicyId),
          tx.pure.vector("u8", Array.from(encryptedKeyBytes)),
          tx.object("0x6"), // Clock
        ],
      });

      const result = await executeTransaction(tx, "Create Chat from Match");

      // Extract ChatAllowlist ID from events
      if (result?.events) {
        const allowlistEvent = result.events.find((e: any) =>
          e.type.includes("ChatAllowlistAutoCreated")
        );

        if (allowlistEvent && allowlistEvent.parsedJson) {
          const allowlistId = allowlistEvent.parsedJson.allowlist_id;
          console.log("✅ ChatAllowlist ID:", allowlistId);
          alert(`ChatAllowlist created!\n\nID: ${allowlistId}\n\nCopy this ID for sending messages.`);
        }
      }
    } catch (err: any) {
      // Handle specific error: EChatAlreadyExists (error code 6)
      if (err.message?.includes("MoveAbort") && err.message?.includes(", 6)")) {
        console.log("⚠️ Chat already exists, fetching...");

        try {
          const existingChatId = await getChatRoomIdByMatchId(client, chatData.matchId);
          const existingAllowlistId = existingChatId
            ? await getChatAllowlistIdByChatRoomId(client, existingChatId)
            : null;

          setResult({
            description: "Chat Already Exists (Error Caught)",
            chatRoomId: existingChatId,
            chatAllowlistId: existingAllowlistId,
            note: "Chat already exists for this match. Using existing chat room.",
          });

          if (existingChatId && existingAllowlistId) {
            alert(`Chat already exists!\n\nChat Room ID: ${existingChatId}\nChat Allowlist ID: ${existingAllowlistId}`);
          } else if (existingChatId) {
            alert(`Chat exists: ${existingChatId}\n\nBut allowlist not found. Create it in section 7.`);
          }
        } catch (fetchErr) {
          setError("Chat exists but couldn't fetch details: " + (fetchErr as Error).message);
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. Send Message (with Seal encryption)
  const sendMessage = async () => {
    if (!messageData.chatRoomId || !messageData.content || !messageData.chatAllowlistId) {
      setError("Please provide chat room ID, chat allowlist ID, and content");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get chat room to verify
      const chatRoom = await client.getObject({
        id: messageData.chatRoomId,
        options: {
          showContent: true,
        },
      });

      if (!chatRoom.data?.content || chatRoom.data.content.dataType !== "moveObject") {
        throw new Error("Invalid chat room object");
      }

      console.log("Chat room verified");

      // Step 2: Encrypt message content using Seal with proper namespace
      const contentBytes = new TextEncoder().encode(messageData.content);

      // Generate nonce for unique encryption ID
      const nonce = crypto.getRandomValues(new Uint8Array(5));

      // Build proper namespace: TYPE_CHAT (1 byte) + ChatAllowlist ID (32 bytes)
      const TYPE_CHAT = 1; // From contract
      const allowlistIdBytes = fromHex(messageData.chatAllowlistId.startsWith("0x")
        ? messageData.chatAllowlistId.slice(2)
        : messageData.chatAllowlistId);

      // Namespace = TYPE_CHAT + ChatAllowlist ID
      const namespace = new Uint8Array([TYPE_CHAT, ...allowlistIdBytes]);

      // Full encryption ID = namespace + nonce
      const encryptionId = toHex(new Uint8Array([...namespace, ...nonce]));

      console.log("Encrypting message with ID:", encryptionId);

      const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: encryptionId,
        data: contentBytes,
      });

      console.log("Encrypted message bytes:", encryptedBytes.length, "bytes");

      // Step 3: Convert hash to bytes
      const hashBytes = messageData.contentHash.startsWith("0x")
        ? Array.from(fromHex(messageData.contentHash.slice(2)))
        : Array.from(fromHex(messageData.contentHash));

      // Step 4: Send encrypted message to blockchain
      const tx = new Transaction();

      // Use send_message_entry which handles the Message object transfer internally
      tx.moveCall({
        target: `${PACKAGE_ID}::chat::send_message_entry`,
        arguments: [
          tx.object(CHAT_REGISTRY_ID),
          tx.object(MESSAGE_INDEX_ID),
          tx.object(messageData.chatRoomId),
          tx.pure.vector("u8", Array.from(encryptedBytes)), // Encrypted content
          tx.pure.vector("u8", hashBytes),
          tx.object("0x6"), // Clock
        ],
      });

      await executeTransaction(tx, "Send Message (Encrypted)");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Query Messages from Chat
  const queryMessages = async () => {
    if (!queryMessagesData.chatRoomId) {
      setError("Please provide chat room ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, get the chat room to extract the chat ID
      const chatRoom = await client.getObject({
        id: queryMessagesData.chatRoomId,
        options: {
          showContent: true,
        },
      });

      // Then query the MessageIndex to get all message IDs
      const tx = new Transaction();
      const [messageIds] = tx.moveCall({
        target: `${PACKAGE_ID}::chat::get_chat_message_ids`,
        arguments: [
          tx.object(MESSAGE_INDEX_ID),
          tx.pure.id(queryMessagesData.chatRoomId),
        ],
      });

      // Execute a devInspect to get the result without submitting transaction
      const devInspectResult = await client.devInspectTransactionBlock({
        sender: account!.address,
        transactionBlock: tx,
      });

      // Get message IDs from the result
      const messageIdsData = devInspectResult.results?.[0]?.returnValues?.[0];

      // For now, let's just show the chat room info and message count
      const messageCount = await client.getObject({
        id: MESSAGE_INDEX_ID,
        options: {
          showContent: true,
        },
      });

      setResult({
        description: "Query Messages",
        chatRoom: chatRoom.data,
        messageIndex: messageCount.data,
        note: "Use the Message Index to see all message IDs, then query individual messages",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. Query Individual Message
  const queryMessage = async () => {
    if (!queryMessageData.messageId) {
      setError("Please provide message ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const messageObj = await client.getObject({
        id: queryMessageData.messageId,
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
        },
      });

      setResult({
        description: "Query Message",
        message: messageObj.data,
        note: "The encrypted_content field contains the encrypted message. In production, you would use the Seal Protocol to decrypt this content using the chat room's seal_policy_id and your wallet's private key.",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 7. Create Chat Allowlist (Shared)
  const createChatAllowlist = async () => {
    if (!allowlistData.chatRoomId || !allowlistData.myProfileId) {
      setError("Please provide chat room ID and profile ID");
      return;
    }

    const tx = new Transaction();

    // Call create_chat_allowlist_shared - shares ChatAllowlist so both participants can access
    tx.moveCall({
      target: `${PACKAGE_ID}::seal_policies::create_chat_allowlist_shared`,
      arguments: [
        tx.object(ALLOWLIST_REGISTRY_ID),
        tx.object(allowlistData.chatRoomId),
        tx.object(allowlistData.myProfileId),
        tx.pure.option("u64", null), // No expiry
        tx.object("0x6"), // Clock
      ],
    });

    await executeTransaction(tx, "Create Chat Allowlist (Shared)");
  };

  // 8. Decrypt Message with Seal
  const decryptMessage = async () => {
    if (!decryptData.messageId || !decryptData.chatAllowlistId) {
      setError("Please provide message ID and chat allowlist ID");
      return;
    }

    setLoading(true);
    setError(null);
    setDecryptedMessage(null);

    try {
      // Step 1: Get the encrypted message object
      const messageObj = await client.getObject({
        id: decryptData.messageId,
        options: {
          showContent: true,
        },
      });

      if (!messageObj.data?.content || messageObj.data.content.dataType !== "moveObject") {
        throw new Error("Invalid message object");
      }

      const fields = messageObj.data.content.fields as any;
      const encryptedContent = fields.encrypted_content;

      console.log("Message fields:", fields);
      console.log("Encrypted content:", encryptedContent);
      console.log("Encrypted content type:", typeof encryptedContent);
      console.log("Encrypted content length:", encryptedContent?.length);

      // Step 2: Create SessionKey for authentication
      const sessionKey = await SessionKey.create({
        address: account!.address,
        packageId: PACKAGE_ID,
        ttlMin: 10,
        suiClient: client,
      });

      // Step 3: Sign personal message for authentication
      await new Promise<void>((resolve, reject) => {
        signPersonalMessage(
          {
            message: sessionKey.getPersonalMessage(),
          },
          {
            onSuccess: async (result: { signature: string }) => {
              try {
                await sessionKey.setPersonalMessageSignature(result.signature);
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            onError: (error) => {
              reject(error);
            },
          }
        );
      });

      // Step 4: Parse encrypted object to get ID
      const encryptedBytes = new Uint8Array(encryptedContent);
      const encryptedObj = EncryptedObject.parse(encryptedBytes);
      const encryptedId = encryptedObj.id;

      console.log("Encrypted object ID:", encryptedId);

      // Step 5: Build transaction for seal_approve
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::seal_policies::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(encryptedId)),
          tx.object(decryptData.chatAllowlistId),
          tx.object("0x6"), // Clock
        ],
      });

      const txBytes = await tx.build({ client, onlyTransactionKind: true });

      // Step 6: Fetch decryption keys from Seal servers
      await sealClient.fetchKeys({
        ids: [encryptedId],
        txBytes,
        sessionKey,
        threshold: 2,
      });

      console.log("Keys fetched successfully");

      // Step 7: Decrypt the message
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      // Step 8: Convert bytes to string
      const decryptedText = new TextDecoder().decode(decryptedBytes);

      setDecryptedMessage(decryptedText);
      setResult({
        description: "Decrypt Message Success",
        decryptedContent: decryptedText,
        messageId: decryptData.messageId,
        note: "Message successfully decrypted using Seal Protocol! ✅",
      });
    } catch (err: any) {
      console.error("Decryption error:", err);
      setError(`Decryption failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // Initialize session key once for auto-decrypt
  const initializeSessionKey = async (): Promise<SessionKey | null> => {
    if (cachedSessionKey) {
      return cachedSessionKey;
    }

    if (!account) {
      return null;
    }

    if (isInitializingSession) {
      // Wait for ongoing initialization
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (cachedSessionKey || !isInitializingSession) {
            clearInterval(checkInterval);
            resolve(cachedSessionKey);
          }
        }, 100);
      });
    }

    setIsInitializingSession(true);

    try {
      console.log("Creating session key...");

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

      console.log("Session key created and signed");
      setCachedSessionKey(sessionKey);
      setIsInitializingSession(false);
      return sessionKey;
    } catch (err: any) {
      console.error("Failed to create session key:", err);
      setIsInitializingSession(false);
      return null;
    }
  };

  // Auto-decrypt a single message
  const autoDecryptMessage = async (messageId: string, encryptedContent: Uint8Array, sessionKey: SessionKey) => {
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
          tx.object(chatRoomData.chatAllowlistId),
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
      console.error(`Failed to decrypt message ${messageId}:`, err.message);
      return null;
    }
  };

  // Chat Room Functions
  const loadChatMessages = async (showAlert = false) => {
    if (!chatRoomData.chatRoomId || !chatRoomData.chatAllowlistId) {
      if (showAlert) {
        setError("Please provide Chat Room ID and Chat Allowlist ID");
      }
      return;
    }

    if (showAlert) {
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
      const chatMessages: Array<{
        id: string;
        content: string;
        sender: string;
        timestamp: string;
        isMe: boolean;
        encrypted: boolean;
      }> = [];

      for (const event of events.data) {
        if (event.parsedJson) {
          const data = event.parsedJson as any;

          // Only include messages from this chat room
          if (data.chat_id === chatRoomData.chatRoomId) {
            chatMessages.push({
              id: data.message_id,
              content: "[Encrypted]", // Will decrypt later
              sender: data.sender,
              timestamp: new Date(parseInt(data.timestamp)).toISOString(),
              isMe: data.sender.toLowerCase() === account?.address.toLowerCase(),
              encrypted: true,
            });
          }
        }
      }

      // Sort by timestamp
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

      if (showAlert) {
        setLoading(false);
      }

      if (showAlert) {
        if (chatMessages.length > 0) {
          alert(`Loaded ${chatMessages.length} messages. Auto-decrypting...`);
        } else {
          alert("No messages found for this chat room.");
        }
      }

      // Auto-decrypt all encrypted messages
      if (chatMessages.length > 0 && account) {
        console.log(`Auto-decrypting ${chatMessages.length} messages...`);

        // Initialize session key once
        const sessionKey = await initializeSessionKey();
        if (!sessionKey) {
          console.error("Failed to initialize session key for auto-decrypt");
          return;
        }

        // Decrypt all messages in parallel (but limit concurrency to avoid rate limits)
        const messagesToDecrypt = chatMessages.filter(msg => {
          const existing = messages.find(m => m.id === msg.id);
          return !existing || existing.encrypted; // Only decrypt new or still-encrypted messages
        });

        for (const msg of messagesToDecrypt) {
          try {
            // Get message object to fetch encrypted content
            const messageObj = await client.getObject({
              id: msg.id,
              options: { showContent: true },
            });

            if (messageObj.data?.content && "fields" in messageObj.data.content) {
              const fields = messageObj.data.content.fields as any;
              const encryptedContent = new Uint8Array(fields.encrypted_content);

              // Decrypt in background
              autoDecryptMessage(msg.id, encryptedContent, sessionKey);
            }
          } catch (err: any) {
            console.error(`Failed to load message ${msg.id} for decryption:`, err.message);
          }
        }
      }
    } catch (err: any) {
      if (showAlert) {
        setError(err.message);
        setLoading(false);
      }
      // Silently fail on auto-refresh
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !chatRoomData.chatRoomId || !chatRoomData.chatAllowlistId) {
      setError("Please provide message content, Chat Room ID, and Chat Allowlist ID");
      return;
    }

    // Reuse existing sendMessage logic but with chat room state
    const tempMessageData = {
      chatRoomId: chatRoomData.chatRoomId,
      chatAllowlistId: chatRoomData.chatAllowlistId,
      content: newMessage,
      contentHash: "0x00",
    };

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get chat room to verify
      const chatRoom = await client.getObject({
        id: tempMessageData.chatRoomId,
        options: { showContent: true },
      });

      if (!chatRoom.data?.content || chatRoom.data.content.dataType !== "moveObject") {
        throw new Error("Invalid chat room object");
      }

      // Step 2: Encrypt message
      const contentBytes = new TextEncoder().encode(tempMessageData.content);
      const nonce = crypto.getRandomValues(new Uint8Array(5));
      const TYPE_CHAT = 1;
      const allowlistIdBytes = fromHex(
        tempMessageData.chatAllowlistId.startsWith("0x")
          ? tempMessageData.chatAllowlistId.slice(2)
          : tempMessageData.chatAllowlistId
      );
      const namespace = new Uint8Array([TYPE_CHAT, ...allowlistIdBytes]);
      const encryptionId = toHex(new Uint8Array([...namespace, ...nonce]));

      const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: encryptionId,
        data: contentBytes,
      });

      console.log("Encrypted message bytes:", encryptedBytes.length, "bytes");

      // Step 3: Convert hash to bytes
      const hashBytes = tempMessageData.contentHash.startsWith("0x")
        ? Array.from(fromHex(tempMessageData.contentHash.slice(2)))
        : Array.from(fromHex(tempMessageData.contentHash));

      // Step 4: Send message transaction
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::chat::send_message_entry`,
        arguments: [
          tx.object(CHAT_REGISTRY_ID),
          tx.object(MESSAGE_INDEX_ID),
          tx.object(tempMessageData.chatRoomId),
          tx.pure.vector("u8", Array.from(encryptedBytes)),
          tx.pure.vector("u8", hashBytes),
          tx.object("0x6"), // Clock
        ],
      });

      await executeTransaction(tx, "Send Chat Message");
      setNewMessage("");

      // Reload messages after sending
      await loadChatMessages();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Walrus publisher service
  const [walrusService, setWalrusService] = useState("publisher1");

  const getPublisherUrl = (path: string) => {
    return `/${walrusService}/v1/${path.replace(/^\/+/, '').replace(/^v1\//, '')}`;
  };

  // Helper: Get or create MatchAllowlist for a match
  const getOrCreateMatchAllowlist = async (matchId: string): Promise<string> => {
    try {
      // Check if allowlist exists for this match
      const registry = await client.getObject({
        id: ALLOWLIST_REGISTRY_ID,
        options: { showContent: true },
      });

      if (registry.data?.content && "fields" in registry.data.content) {
        const fields = registry.data.content.fields as any;
        const matchAllowlistsTableId = fields.match_allowlists.fields.id.id;

        // Try to get existing allowlist
        try {
          const dynamicField = await client.getDynamicFieldObject({
            parentId: matchAllowlistsTableId,
            name: {
              type: "0x2::object::ID",
              value: matchId,
            },
          });

          if (dynamicField.data?.content && "fields" in dynamicField.data.content) {
            const allowlistId = (dynamicField.data.content.fields as any).value;
            console.log("Found existing MatchAllowlist:", allowlistId);
            return allowlistId;
          }
        } catch {
          // Allowlist doesn't exist, need to create it
        }

        // Create new MatchAllowlist
        console.log("Creating new MatchAllowlist for match:", matchId);
        const tx = new Transaction();

        const matchAllowlist = tx.moveCall({
          target: `${PACKAGE_ID}::seal_policies::create_match_allowlist`,
          arguments: [
            tx.object(ALLOWLIST_REGISTRY_ID),
            tx.object(matchId),
            tx.object(mediaData.profileId), // Need profile for auth
            tx.pure.option("u64", null), // expires_at (none)
            tx.object("0x6"), // Clock
          ],
        });

        // Share the allowlist so both users can access it
        tx.moveCall({
          target: "0x2::transfer::public_share_object",
          typeArguments: [`${PACKAGE_ID}::seal_policies::MatchAllowlist`],
          arguments: [matchAllowlist],
        });

        const result = await executeTransaction(tx, "Create MatchAllowlist");

        const createdAllowlist = result?.objectChanges?.find(
          (change: any) => change.type === "created" && change.objectType?.includes("MatchAllowlist")
        );

        if (createdAllowlist) {
          return createdAllowlist.objectId;
        }
      }

      throw new Error("Failed to get or create MatchAllowlist");
    } catch (err: any) {
      throw new Error(`MatchAllowlist error: ${err.message}`);
    }
  };

  // 9a. Upload File to Walrus with MatchAllowlist-based encryption
  const uploadFileToWalrus = async (file: File, matchAllowlistId?: string): Promise<{ blobId: string; sealPolicyId?: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          if (!event.target?.result || !(event.target.result instanceof ArrayBuffer)) {
            throw new Error("Failed to read file");
          }

          setIsUploadingToWalrus(true);

          // Encrypt the file data
          const fileData = new Uint8Array(event.target.result);

          let encryptionId: string;
          let sealPolicyId: string | undefined;

          if (matchAllowlistId) {
            // Use MatchAllowlist-based encryption for match-only content
            const nonce = crypto.getRandomValues(new Uint8Array(5));

            // Build namespace: [TYPE_MATCH][allowlist_id_bytes][nonce]
            const TYPE_MATCH = 0x03;
            const allowlistIdBytes = fromHex(matchAllowlistId.replace("0x", ""));
            const namespace = new Uint8Array([TYPE_MATCH, ...allowlistIdBytes, ...nonce]);

            encryptionId = toHex(namespace);
            sealPolicyId = matchAllowlistId;
            console.log("Using MatchAllowlist encryption:", { matchAllowlistId, encryptionId: encryptionId.slice(0, 20) + "..." });
          } else {
            // Public/verified content - simple encryption
            const nonce = crypto.getRandomValues(new Uint8Array(5));
            encryptionId = toHex(nonce);
            console.log("Using simple encryption for public content");
          }

          console.log("Encrypting file...");
          const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
            threshold: 2,
            packageId: PACKAGE_ID,
            id: encryptionId,
            data: fileData,
          });

          console.log("Uploading to Walrus via publisher...");

          // Upload to Walrus publisher (no WAL tokens needed)
          const NUM_EPOCH = 1;
          const response = await fetch(getPublisherUrl(`blobs?epochs=${NUM_EPOCH}`), {
            method: 'PUT',
            body: encryptedBytes,
          });

          if (response.status !== 200) {
            throw new Error("Failed to upload to Walrus. Try selecting a different publisher service.");
          }

          const result = await response.json();

          let blobId: string;
          if ('alreadyCertified' in result) {
            blobId = result.alreadyCertified.blobId;
            console.log("Blob already certified:", blobId);
          } else if ('newlyCreated' in result) {
            blobId = result.newlyCreated.blobObject.blobId;
            console.log("Blob newly created:", blobId);
          } else {
            throw new Error("Unexpected Walrus response format");
          }

          setIsUploadingToWalrus(false);
          resolve({ blobId, sealPolicyId });
        } catch (err: any) {
          setIsUploadingToWalrus(false);
          reject(err);
        }
      };

      reader.onerror = () => {
        setIsUploadingToWalrus(false);
        reject(new Error("Failed to read file"));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  // 9b. Handle File Selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10 MiB)
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10 MiB");
      return;
    }

    // Auto-detect content type
    const contentType = file.type.startsWith("image/") ? 0 : file.type.startsWith("video/") ? 1 : 0;

    setSelectedFile(file);
    setMediaData(prev => ({ ...prev, contentType }));
  };

  // 9c. Upload to Walrus and Get Blob ID
  const uploadAndGetBlobId = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // For MATCHES_ONLY content, create/get MatchAllowlist first
      let matchAllowlistId: string | undefined;
      if (mediaData.visibilityLevel === 2 && mediaData.matchId) {
        console.log("Creating/getting MatchAllowlist for match:", mediaData.matchId);
        matchAllowlistId = await getOrCreateMatchAllowlist(mediaData.matchId);
        console.log("Using MatchAllowlist:", matchAllowlistId);
      }

      const { blobId, sealPolicyId } = await uploadFileToWalrus(selectedFile, matchAllowlistId);

      // Update media data with blob ID and seal policy ID
      setMediaData(prev => ({
        ...prev,
        walrusBlobId: blobId,
        sealPolicyId: sealPolicyId || "",
      }));

      alert(`✅ File uploaded to Walrus successfully!\nBlob ID: ${blobId}\n${sealPolicyId ? `Seal Policy ID: ${sealPolicyId}` : 'No seal policy (public/verified)'}`);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // 9. Upload Media
  const uploadMedia = async () => {
    if (!mediaData.profileId || !mediaData.walrusBlobId) {
      setError("Please provide Profile ID and Walrus Blob ID");
      return;
    }

    // For MATCHES_ONLY visibility, seal_policy_id is required
    if (mediaData.visibilityLevel === 2 && !mediaData.sealPolicyId) {
      setError("MATCHES_ONLY content requires a Match ID to create MatchAllowlist. Please upload file first with Match ID.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tags = mediaData.tags.split(",").map(t => t.trim());

      const tx = new Transaction();

      // Create media content - returns MediaContent object
      const mediaContent = tx.moveCall({
        target: `${PACKAGE_ID}::core::create_media_content`,
        arguments: [
          tx.object(MEDIA_REGISTRY_ID),
          tx.object(mediaData.profileId),
          tx.pure.string(mediaData.walrusBlobId),
          tx.pure.u8(mediaData.contentType),
          tx.pure.u8(mediaData.visibilityLevel),
          tx.pure.option("string", mediaData.sealPolicyId || null), // seal_policy_id (MatchAllowlist ID)
          tx.pure.string(mediaData.caption),
          tx.pure.vector("string", tags),
          tx.object("0x6"), // Clock
        ],
      });

      // Transfer MediaContent object to sender
      tx.transferObjects([mediaContent], tx.pure.address(account!.address));

      const result = await executeTransaction(tx, "Upload Media");

      // Find created media ID from object changes
      const createdMedia = result?.objectChanges?.find(
        (change: any) => change.type === "created" && change.objectType?.includes("MediaContent")
      );

      if (createdMedia) {
        alert(`Media uploaded successfully! Media ID: ${createdMedia.objectId}`);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // 10. Query User Media
  const queryUserMedia = async (userAddress: string) => {
    if (!userAddress) {
      setError("Please provide user address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user's media IDs from registry
      const registry = await client.getObject({
        id: MEDIA_REGISTRY_ID,
        options: { showContent: true },
      });

      if (!registry.data?.content || !("fields" in registry.data.content)) {
        throw new Error("Invalid media registry");
      }

      const fields = registry.data.content.fields as any;
      const userMediaTableId = fields.user_media.fields.id.id;

      // Query dynamic field for user's media
      try {
        const dynamicField = await client.getDynamicFieldObject({
          parentId: userMediaTableId,
          name: {
            type: "address",
            value: userAddress,
          },
        });

        if (dynamicField.data?.content && "fields" in dynamicField.data.content) {
          const mediaIds = (dynamicField.data.content.fields as any).value as string[];

          console.log(`Found ${mediaIds.length} media for user ${userAddress}`);

          // Fetch details for each media
          const mediaDetails = await Promise.all(
            mediaIds.map(async (mediaId) => {
              const mediaObj = await client.getObject({
                id: mediaId,
                options: { showContent: true },
              });

              if (mediaObj.data?.content && "fields" in mediaObj.data.content) {
                const mFields = mediaObj.data.content.fields as any;
                return {
                  id: mediaId,
                  owner: mFields.owner,
                  walrusBlobId: mFields.walrus_blob_id,
                  sealPolicyId: mFields.seal_policy_id || null,
                  contentType: mFields.content_type,
                  visibilityLevel: mFields.visibility_level,
                  caption: mFields.caption,
                  viewCount: mFields.view_count,
                  canView: true, // Will implement access control later
                };
              }
              return null;
            })
          );

          const validMedia = mediaDetails.filter((m) => m !== null);
          setMediaList(validMedia);
          setLoading(false);

          alert(`Loaded ${validMedia.length} media items`);
        } else {
          setMediaList([]);
          setLoading(false);
          alert("No media found for this user");
        }
      } catch (err: any) {
        if (err.message?.includes("not found")) {
          setMediaList([]);
          setLoading(false);
          alert("No media found for this user");
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // 11. Check Media Access (based on match status)
  const checkMediaAccess = async (mediaId: string, viewerAddress: string) => {
    try {
      // Get media object
      const mediaObj = await client.getObject({
        id: mediaId,
        options: { showContent: true },
      });

      if (!mediaObj.data?.content || !("fields" in mediaObj.data.content)) {
        return false;
      }

      const fields = mediaObj.data.content.fields as any;
      const owner = fields.owner;
      const visibilityLevel = fields.visibility_level;

      // PUBLIC (0) - everyone can view
      if (visibilityLevel === 0) {
        return true;
      }

      // Owner can always view
      if (owner.toLowerCase() === viewerAddress.toLowerCase()) {
        return true;
      }

      // MATCHES_ONLY (2) - need to check if there's an active match
      if (visibilityLevel === 2) {
        // Get match registry
        const matchRegistry = await client.getObject({
          id: MATCH_REGISTRY_ID,
          options: { showContent: true },
        });

        if (!matchRegistry.data?.content || !("fields" in matchRegistry.data.content)) {
          return false;
        }

        const registryFields = matchRegistry.data.content.fields as any;
        const userMatchesTableId = registryFields.user_matches.fields.id.id;

        // Check if viewer has matches
        try {
          const viewerMatches = await client.getDynamicFieldObject({
            parentId: userMatchesTableId,
            name: {
              type: "address",
              value: viewerAddress,
            },
          });

          if (viewerMatches.data?.content && "fields" in viewerMatches.data.content) {
            const matchIds = (viewerMatches.data.content.fields as any).value as string[];

            // Check each match to see if it's with the media owner
            for (const matchId of matchIds) {
              const matchObj = await client.getObject({
                id: matchId,
                options: { showContent: true },
              });

              if (matchObj.data?.content && "fields" in matchObj.data.content) {
                const matchFields = matchObj.data.content.fields as any;
                const userA = matchFields.user_a;
                const userB = matchFields.user_b;
                const status = matchFields.status;

                // Check if it's an active match (status = 1) between viewer and owner
                if (status === 1 &&
                    ((userA.toLowerCase() === viewerAddress.toLowerCase() && userB.toLowerCase() === owner.toLowerCase()) ||
                     (userB.toLowerCase() === viewerAddress.toLowerCase() && userA.toLowerCase() === owner.toLowerCase()))) {
                  return true;
                }
              }
            }
          }
        } catch (err) {
          // No matches found
          return false;
        }
      }

      return false;
    } catch (err: any) {
      console.error("Error checking media access:", err);
      return false;
    }
  };

  // 12. Decrypt Media (with Seal proof) - Similar to message decrypt
  const decryptMedia = async (mediaId: string, matchAllowlistId: string) => {
    try {
      setLoading(true);
      setError(null);

      if (!account) {
        throw new Error("Wallet not connected");
      }

      // Step 1: Get media object to get blob ID and seal_policy_id
      const mediaObj = await client.getObject({
        id: mediaId,
        options: { showContent: true },
      });

      if (!mediaObj.data?.content || !("fields" in mediaObj.data.content)) {
        throw new Error("Invalid media object");
      }

      const fields = mediaObj.data.content.fields as any;
      const walrusBlobId = fields.walrus_blob_id;
      const sealPolicyId = fields.seal_policy_id;

      console.log("Decrypting media:", { mediaId, walrusBlobId, sealPolicyId });

      if (!sealPolicyId) {
        throw new Error("Media has no seal policy - not encrypted with MatchAllowlist");
      }

      // Step 2: Get MatchAllowlist to verify access
      const allowlistObj = await client.getObject({
        id: matchAllowlistId,
        options: { showContent: true },
      });

      if (!allowlistObj.data?.content || !("fields" in allowlistObj.data.content)) {
        throw new Error("Invalid MatchAllowlist");
      }

      const allowlistFields = allowlistObj.data.content.fields as any;
      console.log("MatchAllowlist:", {
        id: matchAllowlistId,
        user_a: allowlistFields.user_a,
        user_b: allowlistFields.user_b,
        active: allowlistFields.active,
      });

      if (!allowlistFields.active) {
        throw new Error("MatchAllowlist is not active");
      }

      // Step 3: Download encrypted blob from Walrus
      console.log("Downloading encrypted blob from Walrus...");
      const aggregatorUrl = `/aggregator1/v1/blobs/${walrusBlobId}`;
      const blobResponse = await fetch(aggregatorUrl);

      if (!blobResponse.ok) {
        throw new Error(`Failed to download blob: ${blobResponse.statusText}`);
      }

      const encryptedBlob = await blobResponse.arrayBuffer();
      const encryptedBytes = new Uint8Array(encryptedBlob);
      console.log("Downloaded encrypted blob, size:", encryptedBytes.byteLength);

      // Step 4: Parse EncryptedObject to get encryption ID
      const encryptedObj = EncryptedObject.parse(encryptedBytes);
      const encryptedId = encryptedObj.id;
      console.log("Encryption ID:", encryptedId);

      // Step 5: Create or reuse SessionKey
      let sessionKey = cachedSessionKey;
      if (!sessionKey) {
        console.log("Creating new SessionKey...");
        sessionKey = await SessionKey.create({
          address: account.address,
          packageId: PACKAGE_ID,
          ttlMin: 10,
          suiClient: client,
        });

        // Sign personal message for authentication
        await new Promise<void>((resolve, reject) => {
          signPersonalMessage(
            { message: sessionKey!.getPersonalMessage() },
            {
              onSuccess: async (result: { signature: string }) => {
                try {
                  await sessionKey!.setPersonalMessageSignature(result.signature);
                  console.log("Personal message signed and signature set");
                  setCachedSessionKey(sessionKey!);
                  resolve();
                } catch (err) {
                  console.error("Failed to set signature:", err);
                  reject(err);
                }
              },
              onError: (error) => {
                console.error("Failed to sign message:", error);
                reject(error);
              },
            }
          );
        });

        console.log("SessionKey created and cached");
      } else {
        console.log("Using cached SessionKey");
      }

      // Step 6: Build transaction with seal_approve_match
      console.log("Building seal_approve_match transaction...");
      const tx = new Transaction();

      // Get encryption ID bytes - format: [TYPE_MATCH][allowlist_id][nonce]
      const encryptionIdBytes = fromHex(encryptedId);

      tx.moveCall({
        target: `${PACKAGE_ID}::seal_policies::seal_approve_match`,
        arguments: [
          tx.pure.vector("u8", Array.from(encryptionIdBytes)),
          tx.object(matchAllowlistId),
          tx.object("0x6"), // Clock
        ],
      });

      const txBytes = await tx.build({ client, onlyTransactionKind: true });
      console.log("Transaction built");

      // Step 7: Fetch decryption keys from Seal servers
      console.log("Fetching keys from Seal servers...");
      await sealClient.fetchKeys({
        ids: [encryptedId],
        txBytes,
        sessionKey,
        threshold: 2,
      });

      console.log("Keys fetched successfully");

      // Step 8: Decrypt the data
      console.log("Decrypting media...");
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      console.log("Decryption successful! Size:", decryptedBytes.byteLength);

      // Step 9: Create blob URL for preview
      const contentType = fields.content_type === 0 ? 'image/jpeg' : 'video/mp4';
      const blob = new Blob([decryptedBytes], { type: contentType });
      const url = URL.createObjectURL(blob);

      alert(`✅ Media decrypted successfully!\nYou can now view it.`);

      // Open in new tab
      window.open(url, '_blank');

      setLoading(false);
      return url;
    } catch (err: any) {
      console.error("Decrypt error:", err);
      setError(`Decrypt failed: ${err.message}`);
      setLoading(false);
      return null;
    }
  };

  // 13. Query Profile
  const queryProfile = async (profileId: string) => {
    if (!profileId) {
      setError("Please provide profile ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const object = await client.getObject({
        id: profileId,
        options: {
          showContent: true,
          showOwner: true,
        },
      });

      setResult({
        description: "Query Profile",
        data: object.data,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contract Testing Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Test all smart contract functions for the Matching.Me dating app
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>Your wallet connection and package information</CardDescription>
        </CardHeader>
        <CardContent>
          {account ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Wallet Address</p>
                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm block overflow-x-auto">
                  {account.address}
                </code>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Package ID</p>
                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm block overflow-x-auto">
                  {PACKAGE_ID}
                </code>
              </div>
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            </div>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Not Connected</AlertTitle>
              <AlertDescription>
                Please connect your Sui wallet to continue testing
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 0a. Create Usage Tracker */}
        <Card>
          <CardHeader>
            <CardTitle>0a. Create Usage Tracker 🔧</CardTitle>
            <CardDescription>Create Usage Tracker if missing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
              <AlertDescription>
                <strong>⚠️ Only run this if you get "object does not exist" error for Usage Tracker!</strong>
                <br/>This creates a new UsageTracker shared object.
              </AlertDescription>
            </Alert>
            <Button
              onClick={createUsageTracker}
              disabled={loading || !account}
              className="w-full"
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "🔧 Create Usage Tracker"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 0b. Create Message Index */}
        <Card>
          <CardHeader>
            <CardTitle>0b. Create Message Index 🔧</CardTitle>
            <CardDescription>Create Message Index if missing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
              <AlertDescription>
                <strong>⚠️ Only run this if you get "object does not exist" error for Message Index!</strong>
                <br/>This creates a new MessageIndex shared object.
              </AlertDescription>
            </Alert>
            <Button
              onClick={createMessageIndex}
              disabled={loading || !account}
              className="w-full"
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "🔧 Create Message Index"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 1. Create Profile */}
        <Card>
          <CardHeader>
            <CardTitle>1. Create Profile</CardTitle>
            <CardDescription>Create your UserProfile NFT on the blockchain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Note:</strong> Each wallet can only create one profile. If you get "EProfileAlreadyExists" error,
                use your existing Profile ID or switch to a different wallet.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-bio">Bio</Label>
              <Textarea
                id="profile-bio"
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                placeholder="Tell us about yourself"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profile-age">Age</Label>
                <Input
                  id="profile-age"
                  type="number"
                  value={profileData.age.toString()}
                  onChange={(e) => setProfileData({ ...profileData, age: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-gender">Gender</Label>
                <Input
                  id="profile-gender"
                  type="number"
                  value={profileData.gender.toString()}
                  onChange={(e) => setProfileData({ ...profileData, gender: parseInt(e.target.value) || 0 })}
                  placeholder="0=M, 1=F, 2=Other"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-interests">Interests (comma-separated)</Label>
              <Input
                id="profile-interests"
                value={profileData.interests}
                onChange={(e) => setProfileData({ ...profileData, interests: e.target.value })}
                placeholder="Sports, Music, Travel"
              />
            </div>
            <Button
              onClick={createProfile}
              disabled={loading || !account}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Profile"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 2. Create Match */}
        <Card>
          <CardHeader>
            <CardTitle>2. Create Match</CardTitle>
            <CardDescription>Create a match between two users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="match-my-profile">My Profile ID</Label>
              <Input
                id="match-my-profile"
                value={matchData.myProfileId}
                onChange={(e) => setMatchData({ ...matchData, myProfileId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-target-address">Target User Address</Label>
              <Input
                id="match-target-address"
                value={matchData.targetUserAddress}
                onChange={(e) => setMatchData({ ...matchData, targetUserAddress: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-score">Compatibility Score (0-100)</Label>
              <Input
                id="match-score"
                type="number"
                value={matchData.compatibilityScore}
                onChange={(e) => setMatchData({ ...matchData, compatibilityScore: parseInt(e.target.value) || 0 })}
                placeholder="85"
                min="0"
                max="100"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="match-zk-proof"
                checked={matchData.zkProofValid}
                onChange={(e) => setMatchData({ ...matchData, zkProofValid: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="match-zk-proof">ZK Proof Valid</Label>
            </div>
            <Button
              onClick={createMatch}
              disabled={loading || !account}
              className="w-full"
              variant="secondary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Match"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 2b. Activate Match */}
        <Card>
          <CardHeader>
            <CardTitle>2b. Activate Match</CardTitle>
            <CardDescription>Activate a pending match to enable chat creation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Important:</strong> Matches must be activated (status = 1) before creating a chat.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="activate-match-id">Match ID</Label>
              <Input
                id="activate-match-id"
                value={activateMatchData.matchId}
                onChange={(e) => setActivateMatchData({ ...activateMatchData, matchId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <Button
              onClick={activateMatch}
              disabled={loading || !account}
              className="w-full"
              variant="secondary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                "Activate Match"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 3. Create Chat from Match */}
        <Card>
          <CardHeader>
            <CardTitle>3. Create Chat from Match</CardTitle>
            <CardDescription>Create an encrypted chat room from an active match</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription>
                <strong>✨ Smart Detection:</strong> This function now automatically checks if chat already exists!
                <br/>If chat exists, it will return the existing chat room and allowlist IDs.
                <br/>If error code 6 (EChatAlreadyExists) occurs, it will fetch existing IDs automatically.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="chat-my-profile-id">My Profile ID</Label>
              <Input
                id="chat-my-profile-id"
                value={chatData.myProfileId}
                onChange={(e) => setChatData({ ...chatData, myProfileId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-match-id">Match ID</Label>
              <Input
                id="chat-match-id"
                value={chatData.matchId}
                onChange={(e) => setChatData({ ...chatData, matchId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-seal">Seal Policy ID</Label>
              <Input
                id="chat-seal"
                value={chatData.sealPolicyId}
                onChange={(e) => setChatData({ ...chatData, sealPolicyId: e.target.value })}
                placeholder="test-seal-policy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-encrypted-key">Encrypted Key (hex)</Label>
              <Input
                id="chat-encrypted-key"
                value={chatData.encryptedKey}
                onChange={(e) => setChatData({ ...chatData, encryptedKey: e.target.value })}
                placeholder="0x00"
              />
            </div>
            <Button
              onClick={createChatFromMatch}
              disabled={loading || !account}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Chat from Match"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 4. Send Message */}
        <Card>
          <CardHeader>
            <CardTitle>4. Send Message</CardTitle>
            <CardDescription>Send a message in a chat room</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="msg-chat-id">Chat Room ID</Label>
              <Input
                id="msg-chat-id"
                value={messageData.chatRoomId}
                onChange={(e) => setMessageData({ ...messageData, chatRoomId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-allowlist-id">Chat Allowlist ID (required for encryption)</Label>
              <Input
                id="msg-allowlist-id"
                value={messageData.chatAllowlistId}
                onChange={(e) => setMessageData({ ...messageData, chatAllowlistId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-content">Message Content</Label>
              <Textarea
                id="msg-content"
                value={messageData.content}
                onChange={(e) => setMessageData({ ...messageData, content: e.target.value })}
                rows={3}
                placeholder="Hello from blockchain!"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-hash">Content Hash (hex)</Label>
              <Input
                id="msg-hash"
                value={messageData.contentHash}
                onChange={(e) => setMessageData({ ...messageData, contentHash: e.target.value })}
                placeholder="0x00"
              />
            </div>
            <Button
              onClick={sendMessage}
              disabled={loading || !account}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Message"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 5. Query Messages */}
        <Card>
          <CardHeader>
            <CardTitle>5. Query Messages</CardTitle>
            <CardDescription>Read messages from a chat room</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query-messages-chat-id">Chat Room ID</Label>
              <Input
                id="query-messages-chat-id"
                value={queryMessagesData.chatRoomId}
                onChange={(e) => setQueryMessagesData({ ...queryMessagesData, chatRoomId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <Button
              onClick={queryMessages}
              disabled={loading || !account}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Querying...
                </>
              ) : (
                "Query Messages"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 6. Query Individual Message */}
        <Card>
          <CardHeader>
            <CardTitle>6. Query Individual Message</CardTitle>
            <CardDescription>Read a specific message object (encrypted)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query-message-id">Message ID</Label>
              <Input
                id="query-message-id"
                value={queryMessageData.messageId}
                onChange={(e) => setQueryMessageData({ ...queryMessageData, messageId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <Button
              onClick={queryMessage}
              disabled={loading || !account}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Querying...
                </>
              ) : (
                "Query Message"
              )}
            </Button>
            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
              💡 Message content is encrypted. To decrypt in production:
              <br />1. Get seal_policy_id from ChatRoom
              <br />2. Use Seal SDK to decrypt with your wallet
            </div>
          </CardContent>
        </Card>

        {/* 7. Create Chat Allowlist */}
        <Card>
          <CardHeader>
            <CardTitle>7. Create Chat Allowlist</CardTitle>
            <CardDescription>Create allowlist for Seal decryption</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allowlist-chat-id">Chat Room ID</Label>
              <Input
                id="allowlist-chat-id"
                value={allowlistData.chatRoomId}
                onChange={(e) => setAllowlistData({ ...allowlistData, chatRoomId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowlist-profile-id">Your Profile ID</Label>
              <Input
                id="allowlist-profile-id"
                value={allowlistData.myProfileId}
                onChange={(e) => setAllowlistData({ ...allowlistData, myProfileId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <Button
              onClick={createChatAllowlist}
              disabled={loading || !account}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Allowlist"
              )}
            </Button>
            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
              ℹ️ This creates a ChatAllowlist object that grants decryption access to chat participants.
              Save the returned object ID to use for decrypting messages.
            </div>
          </CardContent>
        </Card>

        {/* 8. Decrypt Message with Seal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>8. Decrypt Message 🔓</CardTitle>
            <CardDescription>Decrypt encrypted message using Seal Protocol</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="decrypt-message-id">Message ID</Label>
                <Input
                  id="decrypt-message-id"
                  value={decryptData.messageId}
                  onChange={(e) => setDecryptData({ ...decryptData, messageId: e.target.value })}
                  placeholder="0x..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="decrypt-allowlist-id">Chat Allowlist ID</Label>
                <Input
                  id="decrypt-allowlist-id"
                  value={decryptData.chatAllowlistId}
                  onChange={(e) => setDecryptData({ ...decryptData, chatAllowlistId: e.target.value })}
                  placeholder="0x..."
                />
              </div>
            </div>
            <Button
              onClick={decryptMessage}
              disabled={loading || !account}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Decrypting...
                </>
              ) : (
                "🔓 Decrypt Message"
              )}
            </Button>
            {decryptedMessage && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <h4 className="font-semibold text-green-900 dark:text-green-100">Decrypted Message:</h4>
                </div>
                <p className="text-green-800 dark:text-green-200 font-mono">{decryptedMessage}</p>
              </div>
            )}
            <div className="text-xs text-muted-foreground p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
              <strong>📋 How it works:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>You sign a personal message to create a SessionKey</li>
                <li>seal_approve verifies you're a chat participant</li>
                <li>Seal servers provide decryption keys (threshold: 2/2)</li>
                <li>Message is decrypted client-side with your wallet</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* 9. Query Profile */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>9. Query Profile</CardTitle>
            <CardDescription>Read profile data from the blockchain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="query-profile-id">Profile ID</Label>
                <Input
                  id="query-profile-id"
                  placeholder="0x..."
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    const input = document.getElementById("query-profile-id") as HTMLInputElement;
                    queryProfile(input.value);
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Querying...
                    </>
                  ) : (
                    "Query Profile"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Display */}
      {(result || error) && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{error ? "Error" : "Result"}</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Transaction Failed</AlertTitle>
                  <AlertDescription className="mt-2">
                    <code className="text-xs block overflow-x-auto bg-destructive/10 p-2 rounded">
                      {error}
                    </code>
                  </AlertDescription>
                </Alert>
              )}
              {result && (
                <div className="space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-900">
                      {result.description} - Success!
                    </AlertTitle>
                    <AlertDescription className="mt-3 space-y-3">
                      {result.digest && (
                        <div>
                          <p className="text-sm font-medium text-green-900 mb-1">Transaction Digest</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-green-100 px-2 py-1 rounded flex-1 overflow-x-auto">
                              {result.digest}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Explorer
                            </Button>
                          </div>
                        </div>
                      )}
                      {result.status && (
                        <div>
                          <p className="text-sm font-medium text-green-900 mb-1">Status</p>
                          <Badge variant="default" className="bg-green-600">
                            {result.status.status}
                          </Badge>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>

                  <details className="group">
                    <summary className="cursor-pointer font-medium hover:text-primary">
                      View Full Result →
                    </summary>
                    <pre className="mt-2 p-4 bg-muted rounded-lg overflow-auto max-h-96 text-xs">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Object Changes Display */}
          {result?.objectChanges && (
            <ObjectChangesDisplay objectChanges={result.objectChanges} />
          )}

          {/* Events Display */}
          {result?.events && result.events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Events Emitted</CardTitle>
                <CardDescription>Smart contract events from this transaction</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.events.map((event: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <Badge variant="secondary">
                        {event.type?.split("::").pop() || "Event"}
                      </Badge>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                        {JSON.stringify(event.parsedJson || event, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Chat Room Interface */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>💬 Chat Room</CardTitle>
          <CardDescription>Real-time chat interface with encryption</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chat Room Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="chatroom-id">Chat Room ID</Label>
              <Input
                id="chatroom-id"
                value={chatRoomData.chatRoomId}
                onChange={(e) => setChatRoomData({ ...chatRoomData, chatRoomId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatroom-allowlist-id">Chat Allowlist ID</Label>
              <Input
                id="chatroom-allowlist-id"
                value={chatRoomData.chatAllowlistId}
                onChange={(e) => setChatRoomData({ ...chatRoomData, chatAllowlistId: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="col-span-2">
              <Button onClick={() => loadChatMessages(true)} disabled={loading} variant="outline" size="sm">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load Messages
              </Button>
            </div>
          </div>

          {/* Messages Display */}
          <div className="border rounded-lg bg-background">
            <div className="h-[400px] overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No messages yet. Start chatting!</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 cursor-pointer hover:opacity-80 transition-opacity ${
                        msg.isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      onClick={async () => {
                        if (msg.encrypted && msg.content === "[Encrypted]") {
                          if (!account) {
                            setError("Please connect wallet to decrypt");
                            return;
                          }

                          try {
                            setLoading(true);
                            setError(null);

                            // Get message object
                            const messageObj = await client.getObject({
                              id: msg.id,
                              options: { showContent: true },
                            });

                            if (!messageObj.data?.content || !("fields" in messageObj.data.content)) {
                              throw new Error("Invalid message object");
                            }

                            const fields = messageObj.data.content.fields as any;
                            const encryptedContent = new Uint8Array(fields.encrypted_content);

                            // Parse encrypted object
                            const encryptedObj = EncryptedObject.parse(encryptedContent);
                            const encryptedId = encryptedObj.id;

                            console.log("Decrypting message:", msg.id);
                            console.log("Encryption ID:", encryptedId);

                            // Initialize session key
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

                            // Build seal_approve tx
                            const tx = new Transaction();
                            tx.moveCall({
                              target: `${PACKAGE_ID}::seal_policies::seal_approve`,
                              arguments: [
                                tx.pure.vector("u8", fromHex(encryptedId)),
                                tx.object(chatRoomData.chatAllowlistId),
                                tx.object("0x6"),
                              ],
                            });

                            const txBytes = await tx.build({ client, onlyTransactionKind: true });

                            console.log("Fetching decryption keys...");

                            // Fetch keys from Seal servers
                            await sealClient.fetchKeys({
                              ids: [encryptedId],
                              txBytes,
                              sessionKey,
                              threshold: 2,
                            });

                            console.log("Decrypting content...");

                            // Decrypt
                            const decryptedBytes = await sealClient.decrypt({
                              data: encryptedContent,
                              sessionKey,
                              txBytes,
                            });
                            const decryptedText = new TextDecoder().decode(decryptedBytes);

                            console.log("Decrypted:", decryptedText);

                            // Update message in state
                            setMessages(prev => prev.map(m =>
                              m.id === msg.id
                                ? { ...m, content: decryptedText, encrypted: false }
                                : m
                            ));

                            setLoading(false);
                          } catch (err: any) {
                            console.error("Decrypt error:", err);
                            setError(`Decrypt failed: ${err.message}`);
                            setLoading(false);
                          }
                        }
                      }}
                      title={msg.encrypted && msg.content === "[Encrypted]" ? "Click to decrypt" : ""}
                    >
                      <div className="text-sm break-words">{msg.content}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs opacity-70">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                        {msg.encrypted && (
                          <Badge variant="secondary" className="text-xs py-0 px-1">
                            {msg.content === "[Encrypted]" ? "🔒 Click to decrypt" : "🔓"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                disabled={!chatRoomData.chatRoomId || !chatRoomData.chatAllowlistId}
              />
              <Button
                onClick={sendChatMessage}
                disabled={loading || !newMessage.trim() || !chatRoomData.chatRoomId || !chatRoomData.chatAllowlistId}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
            ℹ️ Enter Chat Room ID and Chat Allowlist ID to start chatting. Messages are end-to-end encrypted with Seal Protocol.
          </div>
        </CardContent>
      </Card>

      {/* Media Management Card */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>📸 Media Management</CardTitle>
          <CardDescription>Upload and view media with match-based access control</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Media Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-lg">Upload Media</h3>

            {/* Step 1: Upload to Walrus */}
            <div className="space-y-3 p-3 bg-muted rounded-lg">
              <div className="font-medium text-sm">Step 1: Upload File to Walrus (No WAL tokens needed)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="walrus-publisher">Walrus Publisher</Label>
                  <select
                    id="walrus-publisher"
                    className="w-full h-10 px-3 rounded-md border bg-background"
                    value={walrusService}
                    onChange={(e) => setWalrusService(e.target.value)}
                  >
                    <option value="publisher1">walrus-testnet.walrus.space</option>
                    <option value="publisher2">staketab.org</option>
                    <option value="publisher3">redundex.com</option>
                    <option value="publisher4">nodes.guru</option>
                    <option value="publisher5">banansen.dev</option>
                    <option value="publisher6">everstake.one</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file-input">Select File</Label>
                  <Input
                    id="file-input"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                </div>
              </div>
              {selectedFile && (
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
              <Button
                onClick={uploadAndGetBlobId}
                disabled={!selectedFile || isUploadingToWalrus || loading}
                variant="secondary"
                className="w-full"
              >
                {isUploadingToWalrus ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading to Walrus...
                  </>
                ) : (
                  "Upload to Walrus"
                )}
              </Button>
              <div className="text-xs text-muted-foreground">
                Max file size: 10 MB. File will be encrypted before upload.
              </div>
            </div>

            {/* Step 1.5: Match ID for MATCHES_ONLY content */}
            {mediaData.visibilityLevel === 2 && (
              <>
                <Separator />
                <div className="space-y-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="font-medium text-sm">⚠️ MATCHES_ONLY Content - Match ID Required</div>
                  <div className="space-y-2">
                    <Label htmlFor="match-id">Match ID (for MatchAllowlist)</Label>
                    <Input
                      id="match-id"
                      placeholder="0x... (Match object ID)"
                      value={mediaData.matchId}
                      onChange={(e) => setMediaData({...mediaData, matchId: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground">
                      This creates a MatchAllowlist for encryption. Only the matched users can decrypt this media.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Create on-chain media record */}
            <Separator />

            <div className="space-y-3">
              <div className="font-medium text-sm">Step 2: Create On-Chain Media Record</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="media-profile-id">Profile ID</Label>
                  <Input
                    id="media-profile-id"
                    placeholder="0x..."
                    value={mediaData.profileId}
                    onChange={(e) => setMediaData({...mediaData, profileId: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="media-walrus-id">Walrus Blob ID (auto-filled)</Label>
                  <Input
                    id="media-walrus-id"
                    placeholder="auto-filled after upload"
                    value={mediaData.walrusBlobId}
                    onChange={(e) => setMediaData({...mediaData, walrusBlobId: e.target.value})}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seal-policy-id">Seal Policy ID (auto-filled)</Label>
                  <Input
                    id="seal-policy-id"
                    placeholder="auto-filled if MATCHES_ONLY"
                    value={mediaData.sealPolicyId}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              <div className="space-y-2">
                <Label htmlFor="media-content-type">Content Type</Label>
                <select
                  id="media-content-type"
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={mediaData.contentType}
                  onChange={(e) => setMediaData({...mediaData, contentType: parseInt(e.target.value)})}
                >
                  <option value={0}>Image</option>
                  <option value={1}>Video</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-visibility">Visibility Level</Label>
                <select
                  id="media-visibility"
                  className="w-full h-10 px-3 rounded-md border bg-background"
                  value={mediaData.visibilityLevel}
                  onChange={(e) => setMediaData({...mediaData, visibilityLevel: parseInt(e.target.value)})}
                >
                  <option value={0}>Public (Everyone)</option>
                  <option value={1}>Verified Only</option>
                  <option value={2}>Matches Only</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-caption">Caption</Label>
                <Input
                  id="media-caption"
                  placeholder="Media caption..."
                  value={mediaData.caption}
                  onChange={(e) => setMediaData({...mediaData, caption: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-tags">Tags (comma-separated)</Label>
                <Input
                  id="media-tags"
                  placeholder="tag1, tag2, tag3"
                  value={mediaData.tags}
                  onChange={(e) => setMediaData({...mediaData, tags: e.target.value})}
                />
              </div>
            </div>
            <Button onClick={uploadMedia} disabled={loading || !mediaData.walrusBlobId} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Media on Blockchain
            </Button>
            </div>
          </div>

          {/* View User Media Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-lg">View User Media</h3>
            <div className="flex gap-2">
              <Input
                placeholder="User address (0x...)"
                value={viewMediaData.viewerAddress}
                onChange={(e) => setViewMediaData({...viewMediaData, viewerAddress: e.target.value})}
              />
              <Button
                onClick={() => queryUserMedia(viewMediaData.viewerAddress)}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load Media"}
              </Button>
            </div>

            {/* Media Grid */}
            {mediaList.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {mediaList.map((media) => (
                  <div key={media.id} className="border rounded-lg overflow-hidden">
                    <div className="relative bg-muted aspect-square flex items-center justify-center">
                      {media.visibilityLevel === 2 && !media.canView ? (
                        <div className="absolute inset-0 backdrop-blur-lg bg-black/30 flex flex-col items-center justify-center">
                          <div className="text-6xl mb-2">🔒</div>
                          <div className="text-white font-semibold">Match Required</div>
                          <div className="text-white/70 text-sm">Match to view this media</div>
                        </div>
                      ) : (
                        <div className="text-4xl">
                          {media.contentType === 0 ? "🖼️" : "🎥"}
                        </div>
                      )}
                      <Badge
                        className="absolute top-2 right-2"
                        variant={media.visibilityLevel === 0 ? "secondary" : media.visibilityLevel === 1 ? "default" : "destructive"}
                      >
                        {media.visibilityLevel === 0 ? "Public" : media.visibilityLevel === 1 ? "Verified" : "Matches Only"}
                      </Badge>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="font-semibold text-sm truncate">{media.caption}</div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Blob ID: {media.walrusBlobId.slice(0, 12)}...</div>
                        <div>Views: {media.viewCount}</div>
                        <div className="truncate">Owner: {media.owner.slice(0, 8)}...{media.owner.slice(-6)}</div>
                        {media.sealPolicyId && (
                          <div className="flex items-center gap-1">
                            <span className="text-green-600 dark:text-green-400">🔒 Sealed</span>
                            <span className="truncate" title={media.sealPolicyId}>
                              {media.sealPolicyId.slice(0, 8)}...
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={async () => {
                            if (!account) {
                              alert("Please connect wallet");
                              return;
                            }
                            const hasAccess = await checkMediaAccess(media.id, account.address);
                            alert(hasAccess ? "✅ You have access to view this media" : "❌ Match required to view this media");
                          }}
                        >
                          Check Access
                        </Button>

                        {media.sealPolicyId && (
                          <Button
                            size="sm"
                            variant="default"
                            className="flex-1"
                            onClick={async () => {
                              if (!account) {
                                alert("Please connect wallet");
                                return;
                              }
                              if (!media.sealPolicyId) {
                                alert("This media has no seal policy");
                                return;
                              }
                              await decryptMedia(media.id, media.sealPolicyId);
                            }}
                          >
                            🔓 Decrypt
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mediaList.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No media loaded. Enter a user address and click "Load Media" to view their media.
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
            ℹ️ Media with "Matches Only" visibility can only be viewed by users who have an active match with the owner.
          </div>
        </CardContent>
      </Card>

      {/* Detailed Chat Debugger - NEW! */}
      <Card className="lg:col-span-2 border-2 border-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🐛 Detailed Debug (Use this if not finding chat/allowlist)
            <Badge variant="destructive">Debug Tool</Badge>
          </CardTitle>
          <CardDescription>
            Step-by-step debugging to find exactly where the problem is
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetailedChatDebugger />
        </CardContent>
      </Card>

      {/* Wallet Profile Finder - NEW! */}
      <Card className="lg:col-span-2 border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Wallet Profile Finder
            <Badge variant="default">New!</Badge>
          </CardTitle>
          <CardDescription>
            Automatically find Profile ID, Match ID, Chat Room ID, and Allowlist ID from wallet addresses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WalletProfileFinder />
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Flow Instructions</CardTitle>
          <CardDescription>Follow these steps to test the complete contract flow</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Connect your Sui wallet (top right corner)</li>
            <li><strong>Create Profile</strong> - Fill in your profile details and create</li>
            <li>Copy the Profile Object ID from the transaction result</li>
            <li><strong>Create Match</strong> - Use your Profile ID and target user's wallet address</li>
            <li><strong>Activate Match</strong> - Copy Match ID and set status to Active (1)</li>
            <li><strong>Create Chat from Match</strong> - ChatAllowlist will be auto-created! Copy Chat Room ID</li>
            <li><strong>Get ChatAllowlist ID</strong> - Use script: <code>npx tsx scripts/get-chat-allowlist.ts &lt;CHAT_ROOM_ID&gt;</code></li>
            <li><strong>Use Chat Room</strong> - Enter Chat Room ID and ChatAllowlist ID in the Chat Room section</li>
            <li><strong>Load Messages</strong> - Click "Load Messages" to see all messages</li>
            <li><strong>Send Messages</strong> - Type and send encrypted messages</li>
            <li><strong>Decrypt Messages</strong> - Click on encrypted messages to decrypt them</li>
          </ol>
          <Separator className="my-4" />
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
            <p className="font-semibold text-blue-900 dark:text-blue-100">💬 Chat Room Features:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>Load and display all messages from a chat room</li>
              <li>Send end-to-end encrypted messages using Seal Protocol</li>
              <li>Click on encrypted messages to decrypt them inline</li>
              <li>Both participants can send and decrypt messages (shared ChatRoom)</li>
              <li>Auto-created ChatAllowlist grants decryption access</li>
            </ul>
          </div>
          <Separator className="my-4" />
          <div className="space-y-3">
            <p className="font-medium">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Ensure you have SUI tokens for gas fees</li>
              <li>Object IDs are found in transaction results under "objectChanges"</li>
              <li>Save Object IDs after each step for subsequent operations</li>
              <li>Check the Sui Explorer for detailed transaction information</li>
              <li>Chat and messaging features require shared object ID configuration</li>
            </ul>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" asChild>
                <a href="https://faucet.sui.io/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Get Testnet Tokens
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://suiscan.xyz/testnet/object/${PACKAGE_ID}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  View Package
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
