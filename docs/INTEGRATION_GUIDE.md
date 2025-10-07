# Hướng Dẫn Tích Hợp Smart Contract vào Ứng Dụng Hẹn Hò

## Tổng Quan

Tài liệu này hướng dẫn chi tiết cách tích hợp các tính năng blockchain (UserProfile, Match, Chat, Media) từ smart contract Sui vào ứng dụng hẹn hò hiện có.

## Mục Lục

1. [Kiến Trúc Hệ Thống](#kiến-trúc-hệ-thống)
2. [Setup Môi Trường](#setup-môi-trường)
3. [User Profile Integration](#user-profile-integration)
4. [Match System Integration](#match-system-integration)
5. [Chat System Integration](#chat-system-integration)
6. [Media System Integration](#media-system-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Kiến Trúc Hệ Thống

### Database Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │   PostgreSQL    │              │   Sui Blockchain│       │
│  │   (NextAuth)    │              │   (Smart Contract)      │
│  │                 │              │                 │       │
│  │ • User          │              │ • UserProfile   │       │
│  │ • Member        │◄────sync────►│ • Match         │       │
│  │ • Photo         │              │ • ChatRoom      │       │
│  │ • Like          │              │ • Message       │       │
│  │ • Message       │              │ • MediaContent  │       │
│  └─────────────────┘              └─────────────────┘       │
│         │                                  │                 │
│         └──────────────┬───────────────────┘                 │
│                        │                                     │
│                ┌───────▼────────┐                           │
│                │  Sync Service  │                           │
│                │ (Server Actions)│                          │
│                └────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **PostgreSQL (Existing)**: Authentication, basic profile data, caching
2. **Sui Blockchain (New)**: On-chain profiles, matches, encrypted chat/media
3. **Sync Service**: Bidirectional sync between DB and blockchain
4. **Seal Protocol**: End-to-end encryption for messages and media
5. **Walrus**: Decentralized media storage

---

## Setup Môi Trường

### 1. Cài Đặt Dependencies

```bash
npm install @mysten/dapp-kit @mysten/sui @mysten/seal
```

### 2. Environment Variables

Thêm vào `.env.local`:

```bash
# Sui Network
NEXT_PUBLIC_SUI_NETWORK=testnet

# Smart Contract IDs (từ deployment)
NEXT_PUBLIC_MATCHING_ME_PACKAGE_ID=0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821
NEXT_PUBLIC_PROFILE_REGISTRY_ID=0x20e5393af9af450275b4adff795b34c82e9cf21d7e0130d067b9f9c90a930c02
NEXT_PUBLIC_MATCH_REGISTRY_ID=0xcae785a9aa1022cf38e274c01ad3d28cf5dc42ae60e2a9814f7d72b06fdf567b
NEXT_PUBLIC_CHAT_REGISTRY_ID=0x1d6554cbdd327bfcea9c8e16c511967c59a3c0c24b12270f2c2b62aec886d405
NEXT_PUBLIC_MEDIA_REGISTRY_ID=0xd860be341dddb4ce09950e1b88a5264df84db0b9443932aab44c899f95ed6f73
NEXT_PUBLIC_ALLOWLIST_REGISTRY_ID=0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399

# Seal Protocol (Server IDs từ testnet)
NEXT_PUBLIC_SEAL_SERVER_1=0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75
NEXT_PUBLIC_SEAL_SERVER_2=0x2ddb0992174e13b5a84c5229c7a1b53db28ac3751b2f3fd4e0a48e6411527c27
NEXT_PUBLIC_SEAL_SERVER_3=0x7e1836f7785e0f90f005bfc38e8f4dfb6b1dfec14c20c6f0f1c47935bc09b94b
```

### 3. Sui Client Provider Setup

Tạo `/src/providers/SuiProvider.tsx`:

```typescript
"use client";

import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@mysten/dapp-kit/dist/index.css";

const queryClient = new QueryClient();
const networks = {
  testnet: { url: getFullnodeUrl("testnet") },
};

export function SuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
```

Wrap app trong `/src/app/layout.tsx`:

```typescript
import { SuiProvider } from "@/providers/SuiProvider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SuiProvider>
          <SessionProvider>{children}</SessionProvider>
        </SuiProvider>
      </body>
    </html>
  );
}
```

---

## User Profile Integration

### 1. Database Schema (Existing)

```prisma
model User {
  id               String    @id @default(cuid())
  email            String    @unique
  emailVerified    DateTime?
  profileComplete  Boolean   @default(false)
  suiAddress       String?   @unique  // NEW: Link to blockchain
  blockchainProfileId String? @unique // NEW: On-chain profile object ID

  member           Member?
}

model Member {
  id               String   @id @default(cuid())
  userId           String   @unique
  name             String
  gender           String
  dateOfBirth      DateTime
  description      String
  city             String
  country          String

  user             User     @relation(fields: [userId], references: [id])
}
```

### 2. Create On-Chain Profile

Tạo `/src/lib/blockchain/profile.ts`:

```typescript
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";

const PACKAGE_ID = process.env.NEXT_PUBLIC_MATCHING_ME_PACKAGE_ID!;
const PROFILE_REGISTRY_ID = process.env.NEXT_PUBLIC_PROFILE_REGISTRY_ID!;

export interface CreateProfileParams {
  name: string;
  age: number;
  gender: string; // "male" | "female" | "other"
  bio: string;
  interests: string[];
  location: string;
}

export async function createBlockchainProfile(
  params: CreateProfileParams,
  signAndExecute: any
) {
  const tx = new Transaction();

  // Convert gender string to u8
  const genderMap = { male: 0, female: 1, other: 2 };
  const genderCode = genderMap[params.gender as keyof typeof genderMap] ?? 2;

  const profile = tx.moveCall({
    target: `${PACKAGE_ID}::core::create_profile`,
    arguments: [
      tx.object(PROFILE_REGISTRY_ID),
      tx.pure.string(params.name),
      tx.pure.u8(params.age),
      tx.pure.u8(genderCode),
      tx.pure.string(params.bio),
      tx.pure.vector("string", params.interests),
      tx.pure.string(params.location),
      tx.object("0x6"), // Clock
    ],
  });

  tx.transferObjects([profile], tx.pure.address(await signAndExecute.account.address));

  const result = await signAndExecute.mutateAsync({ transaction: tx });

  // Extract profile ID from object changes
  const createdProfile = result.objectChanges?.find(
    (change: any) =>
      change.type === "created" && change.objectType?.includes("UserProfile")
  );

  return {
    profileId: createdProfile?.objectId,
    digest: result.digest,
  };
}
```

### 3. Server Action for Profile Sync

Tạo `/src/app/actions/profileActions.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ActionResult } from "@/types";

export async function syncBlockchainProfile(
  suiAddress: string,
  blockchainProfileId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { status: "error", error: "Unauthorized" };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        suiAddress,
        blockchainProfileId,
      },
    });

    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", error: "Failed to sync profile" };
  }
}
```

### 4. Complete Profile Form Integration

Trong `/src/app/(auth)/complete-profile/CompleteProfileForm.tsx`:

```typescript
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { createBlockchainProfile } from "@/lib/blockchain/profile";
import { syncBlockchainProfile } from "@/app/actions/profileActions";

export default function CompleteProfileForm() {
  const account = useCurrentAccount();
  const signAndExecute = useSignAndExecuteTransaction();

  const handleSubmit = async (data: FormData) => {
    try {
      // 1. Create on-chain profile
      const { profileId } = await createBlockchainProfile(
        {
          name: data.name,
          age: calculateAge(data.dateOfBirth),
          gender: data.gender,
          bio: data.description,
          interests: [],
          location: `${data.city}, ${data.country}`,
        },
        signAndExecute
      );

      // 2. Sync to database
      await syncBlockchainProfile(account!.address, profileId!);

      // 3. Update member in database (existing flow)
      await updateMemberProfile(data);

      router.push("/members");
    } catch (error) {
      console.error("Profile creation failed:", error);
    }
  };

  return (/* ... existing form ... */);
}
```

---

## Match System Integration

### 1. Create Match Hook

Tạo `/src/hooks/useMatchContract.ts`:

```typescript
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";

const PACKAGE_ID = process.env.NEXT_PUBLIC_MATCHING_ME_PACKAGE_ID!;
const MATCH_REGISTRY_ID = process.env.NEXT_PUBLIC_MATCH_REGISTRY_ID!;

export function useMatchContract() {
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Create match when both users like each other
  const createMatch = async (
    myProfileId: string,
    targetProfileId: string,
    myUserId: string,
    targetUserId: string
  ) => {
    const tx = new Transaction();

    const match = tx.moveCall({
      target: `${PACKAGE_ID}::core::create_match`,
      arguments: [
        tx.object(MATCH_REGISTRY_ID),
        tx.object(myProfileId),
        tx.object(targetProfileId),
        tx.pure.string(myUserId),
        tx.pure.string(targetUserId),
        tx.object("0x6"), // Clock
      ],
    });

    // Match is shared object - both users can access
    tx.moveCall({
      target: "0x2::transfer::public_share_object",
      typeArguments: [`${PACKAGE_ID}::core::Match`],
      arguments: [match],
    });

    const result = await signAndExecute({ transaction: tx });

    const createdMatch = result.objectChanges?.find(
      (change: any) => change.type === "created" && change.objectType?.includes("Match")
    );

    return createdMatch?.objectId;
  };

  // Check if match exists
  const checkMatchExists = async (userAddress: string, targetAddress: string) => {
    const registry = await client.getObject({
      id: MATCH_REGISTRY_ID,
      options: { showContent: true },
    });

    if (!registry.data?.content || !("fields" in registry.data.content)) {
      return null;
    }

    const fields = registry.data.content.fields as any;
    const userMatchesTableId = fields.user_matches.fields.id.id;

    try {
      const userMatches = await client.getDynamicFieldObject({
        parentId: userMatchesTableId,
        name: { type: "address", value: userAddress },
      });

      if (userMatches.data?.content && "fields" in userMatches.data.content) {
        const matchIds = (userMatches.data.content.fields as any).value as string[];

        for (const matchId of matchIds) {
          const matchObj = await client.getObject({
            id: matchId,
            options: { showContent: true },
          });

          if (matchObj.data?.content && "fields" in matchObj.data.content) {
            const mFields = matchObj.data.content.fields as any;
            if (
              (mFields.user_a === userAddress && mFields.user_b === targetAddress) ||
              (mFields.user_b === userAddress && mFields.user_a === targetAddress)
            ) {
              return matchId;
            }
          }
        }
      }
    } catch {
      return null;
    }

    return null;
  };

  return { createMatch, checkMatchExists };
}
```

### 2. Like System Integration

Trong `/src/app/actions/likeActions.ts`:

```typescript
import { useMatchContract } from "@/hooks/useMatchContract";

export async function createLikeAction(
  targetUserId: string
): Promise<ActionResult<Member>> {
  try {
    const session = await auth();
    const userId = session?.user.id;

    // 1. Create like in database (existing)
    await prisma.like.create({
      data: { sourceUserId: userId, targetUserId },
    });

    // 2. Check if mutual like (existing)
    const mutualLike = await prisma.like.findFirst({
      where: {
        sourceUserId: targetUserId,
        targetUserId: userId,
      },
    });

    // 3. If mutual like, create on-chain match
    if (mutualLike) {
      const sourceUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { blockchainProfileId: true, suiAddress: true },
      });

      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { blockchainProfileId: true, suiAddress: true },
      });

      if (sourceUser?.blockchainProfileId && targetUser?.blockchainProfileId) {
        // Create match on blockchain (will be called from client)
        // Store match intent in database for client to process
        await prisma.matchIntent.create({
          data: {
            userAId: userId,
            userBId: targetUserId,
            profileAId: sourceUser.blockchainProfileId,
            profileBId: targetUser.blockchainProfileId,
            status: "pending",
          },
        });
      }
    }

    return { status: "success", data: await getMemberByUserId(targetUserId) };
  } catch (error) {
    return { status: "error", error: "Failed to create like" };
  }
}
```

### 3. Match Intent Processor (Client-side)

Tạo `/src/components/MatchIntentProcessor.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useMatchContract } from "@/hooks/useMatchContract";
import { useCurrentAccount } from "@mysten/dapp-kit";

export function MatchIntentProcessor() {
  const account = useCurrentAccount();
  const { createMatch } = useMatchContract();

  useEffect(() => {
    if (!account) return;

    const processMatchIntents = async () => {
      // Fetch pending match intents for current user
      const response = await fetch("/api/match-intents/pending");
      const intents = await response.json();

      for (const intent of intents) {
        try {
          const matchId = await createMatch(
            intent.profileAId,
            intent.profileBId,
            intent.userAId,
            intent.userBId
          );

          // Update intent status
          await fetch(`/api/match-intents/${intent.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "completed", matchId }),
          });
        } catch (error) {
          console.error("Failed to create match:", error);
        }
      }
    };

    processMatchIntents();
    const interval = setInterval(processMatchIntents, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [account]);

  return null;
}
```

---

## Chat System Integration

### 1. Chat Hook with Encryption

Tạo `/src/hooks/useChatContract.ts`:

```typescript
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";
import { toHex } from "@mysten/sui/utils";

const PACKAGE_ID = process.env.NEXT_PUBLIC_MATCHING_ME_PACKAGE_ID!;
const CHAT_REGISTRY_ID = process.env.NEXT_PUBLIC_CHAT_REGISTRY_ID!;
const ALLOWLIST_REGISTRY_ID = process.env.NEXT_PUBLIC_ALLOWLIST_REGISTRY_ID!;

export function useChatContract() {
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const sealClient = new SealClient({
    packageId: PACKAGE_ID,
    serverObjectIds: [
      process.env.NEXT_PUBLIC_SEAL_SERVER_1!,
      process.env.NEXT_PUBLIC_SEAL_SERVER_2!,
      process.env.NEXT_PUBLIC_SEAL_SERVER_3!,
    ],
    suiClient: client,
    verifyKeyServers: false,
  });

  // Create chat room and allowlist
  const createChatRoom = async (matchId: string, myProfileId: string) => {
    const tx = new Transaction();

    // Create chat room (returns shared object)
    tx.moveCall({
      target: `${PACKAGE_ID}::chat::create_chat_room_with_allowlist`,
      arguments: [
        tx.object(CHAT_REGISTRY_ID),
        tx.object(ALLOWLIST_REGISTRY_ID),
        tx.object(matchId),
        tx.object(myProfileId),
        tx.pure.option("u64", null), // No expiry
        tx.object("0x6"), // Clock
      ],
    });

    const result = await signAndExecute({ transaction: tx });

    const createdChat = result.objectChanges?.find(
      (change: any) => change.type === "created" && change.objectType?.includes("ChatRoom")
    );

    const createdAllowlist = result.objectChanges?.find(
      (change: any) =>
        change.type === "created" && change.objectType?.includes("ChatAllowlist")
    );

    return {
      chatRoomId: createdChat?.objectId,
      allowlistId: createdAllowlist?.objectId,
    };
  };

  // Send encrypted message
  const sendMessage = async (
    chatRoomId: string,
    allowlistId: string,
    messageText: string,
    sessionKey: SessionKey
  ) => {
    // 1. Encrypt message
    const nonce = crypto.getRandomValues(new Uint8Array(5));
    const encryptionId = toHex(nonce);

    const { encryptedObject } = await sealClient.encrypt({
      threshold: 2,
      packageId: PACKAGE_ID,
      id: encryptionId,
      data: new TextEncoder().encode(messageText),
    });

    // 2. Build transaction
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::chat::send_message`,
      arguments: [
        tx.object(chatRoomId),
        tx.pure.vector("u8", Array.from(encryptedObject)),
        tx.object("0x6"), // Clock
      ],
    });

    const result = await signAndExecute({ transaction: tx });
    return result.digest;
  };

  // Decrypt message
  const decryptMessage = async (
    encryptedContent: Uint8Array,
    allowlistId: string,
    sessionKey: SessionKey,
    signPersonalMessage: any
  ) => {
    // Parse encrypted object
    const encryptedObj = EncryptedObject.parse(encryptedContent);
    const encryptedId = encryptedObj.id;

    // Build seal_approve transaction
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::seal_policies::seal_approve`,
      arguments: [
        tx.pure.vector("u8", fromHex(encryptedId)),
        tx.object(allowlistId),
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

    return new TextDecoder().decode(decryptedBytes);
  };

  return { createChatRoom, sendMessage, decryptMessage };
}
```

### 2. Chat Component Integration

Trong `/src/app/messages/[chatId]/ChatInterface.tsx`:

```typescript
"use client";

import { useChatContract } from "@/hooks/useChatContract";
import { SessionKey } from "@mysten/seal";
import { useState, useEffect } from "react";

export function ChatInterface({ chatRoomId, allowlistId }: Props) {
  const { sendMessage, decryptMessage } = useChatContract();
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Initialize session key on mount
  useEffect(() => {
    const initSessionKey = async () => {
      const key = await SessionKey.create({
        address: account.address,
        packageId: PACKAGE_ID,
        ttlMin: 10,
        suiClient: client,
      });

      await new Promise<void>((resolve, reject) => {
        signPersonalMessage(
          { message: key.getPersonalMessage() },
          {
            onSuccess: async (result: { signature: string }) => {
              await key.setPersonalMessageSignature(result.signature);
              setSessionKey(key);
              resolve();
            },
            onError: reject,
          }
        );
      });
    };

    initSessionKey();
  }, []);

  // Send message handler
  const handleSendMessage = async (text: string) => {
    if (!sessionKey) return;

    await sendMessage(chatRoomId, allowlistId, text, sessionKey);
    // Reload messages...
  };

  // Auto-decrypt messages
  useEffect(() => {
    if (!sessionKey || !messages.length) return;

    messages.forEach(async (msg) => {
      if (msg.encrypted) {
        const decrypted = await decryptMessage(
          msg.encryptedContent,
          allowlistId,
          sessionKey,
          signPersonalMessage
        );
        // Update message in state...
      }
    });
  }, [messages, sessionKey]);

  return (
    <div>
      {/* Chat UI */}
      <MessageList messages={messages} />
      <MessageInput onSend={handleSendMessage} />
    </div>
  );
}
```

---

## Media System Integration

### 1. Media Upload with Encryption

Tạo `/src/hooks/useMediaContract.ts`:

```typescript
import { Transaction } from "@mysten/sui/transactions";
import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";
import { toHex, fromHex } from "@mysten/sui/utils";

const PACKAGE_ID = process.env.NEXT_PUBLIC_MATCHING_ME_PACKAGE_ID!;
const MEDIA_REGISTRY_ID = process.env.NEXT_PUBLIC_MEDIA_REGISTRY_ID!;
const ALLOWLIST_REGISTRY_ID = process.env.NEXT_PUBLIC_ALLOWLIST_REGISTRY_ID!;

export function useMediaContract() {
  const client = useSuiClient();
  const sealClient = new SealClient(/* ... config ... */);

  // Upload media with match-based encryption
  const uploadMedia = async (
    file: File,
    profileId: string,
    matchId: string,
    visibilityLevel: number, // 0=PUBLIC, 1=VERIFIED, 2=MATCHES_ONLY
    caption: string
  ) => {
    const fileData = await file.arrayBuffer();

    let matchAllowlistId: string | undefined;
    let encryptedBlob: Uint8Array;

    if (visibilityLevel === 2 && matchId) {
      // 1. Get/Create MatchAllowlist
      matchAllowlistId = await getOrCreateMatchAllowlist(matchId, profileId);

      // 2. Encrypt with MatchAllowlist namespace
      const TYPE_MATCH = 0x03;
      const allowlistIdBytes = fromHex(matchAllowlistId.replace("0x", ""));
      const nonce = crypto.getRandomValues(new Uint8Array(5));
      const namespace = new Uint8Array([TYPE_MATCH, ...allowlistIdBytes, ...nonce]);
      const encryptionId = toHex(namespace);

      const { encryptedObject } = await sealClient.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: encryptionId,
        data: new Uint8Array(fileData),
      });

      encryptedBlob = encryptedObject;
    } else {
      // Simple encryption for public/verified
      const nonce = crypto.getRandomValues(new Uint8Array(5));
      const { encryptedObject } = await sealClient.encrypt({
        threshold: 2,
        packageId: PACKAGE_ID,
        id: toHex(nonce),
        data: new Uint8Array(fileData),
      });

      encryptedBlob = encryptedObject;
    }

    // 3. Upload to Walrus via proxy
    const walrusResponse = await fetch("/publisher1/v1/blobs?epochs=1", {
      method: "PUT",
      body: encryptedBlob,
    });

    const walrusResult = await walrusResponse.json();
    const blobId =
      walrusResult.alreadyCertified?.blobId || walrusResult.newlyCreated?.blobObject.blobId;

    // 4. Create MediaContent on-chain
    const tx = new Transaction();

    const mediaContent = tx.moveCall({
      target: `${PACKAGE_ID}::core::create_media_content`,
      arguments: [
        tx.object(MEDIA_REGISTRY_ID),
        tx.object(profileId),
        tx.pure.string(blobId),
        tx.pure.u8(file.type.startsWith("image/") ? 0 : 1), // content_type
        tx.pure.u8(visibilityLevel),
        tx.pure.option("string", matchAllowlistId || null), // seal_policy_id
        tx.pure.string(caption),
        tx.pure.vector("string", []), // tags
        tx.object("0x6"), // Clock
      ],
    });

    tx.transferObjects([mediaContent], tx.pure.address(account.address));

    const result = await signAndExecute({ transaction: tx });

    const createdMedia = result.objectChanges?.find(
      (change: any) => change.type === "created" && change.objectType?.includes("MediaContent")
    );

    return createdMedia?.objectId;
  };

  // Decrypt and display media
  const decryptMedia = async (
    mediaId: string,
    matchAllowlistId: string,
    sessionKey: SessionKey
  ) => {
    // 1. Get media object
    const mediaObj = await client.getObject({
      id: mediaId,
      options: { showContent: true },
    });

    const fields = mediaObj.data.content.fields as any;
    const walrusBlobId = fields.walrus_blob_id;

    // 2. Download encrypted blob from Walrus
    const blobResponse = await fetch(`/aggregator1/v1/blobs/${walrusBlobId}`);
    const encryptedBlob = await blobResponse.arrayBuffer();
    const encryptedBytes = new Uint8Array(encryptedBlob);

    // 3. Parse EncryptedObject
    const encryptedObj = EncryptedObject.parse(encryptedBytes);
    const encryptedId = encryptedObj.id;

    // 4. Build seal_approve_match transaction
    const tx = new Transaction();
    const encryptionIdBytes = fromHex(encryptedId);

    tx.moveCall({
      target: `${PACKAGE_ID}::seal_policies::seal_approve_match`,
      arguments: [
        tx.pure.vector("u8", Array.from(encryptionIdBytes)),
        tx.object(matchAllowlistId),
        tx.object("0x6"),
      ],
    });

    const txBytes = await tx.build({ client, onlyTransactionKind: true });

    // 5. Fetch keys and decrypt
    await sealClient.fetchKeys({
      ids: [encryptedId],
      txBytes,
      sessionKey,
      threshold: 2,
    });

    const decryptedBytes = await sealClient.decrypt({
      data: encryptedBytes,
      sessionKey,
      txBytes,
    });

    // 6. Create blob URL
    const contentType = fields.content_type === 0 ? "image/jpeg" : "video/mp4";
    const blob = new Blob([decryptedBytes], { type: contentType });
    return URL.createObjectURL(blob);
  };

  return { uploadMedia, decryptMedia };
}
```

### 2. Profile Media Gallery

Trong `/src/app/members/[userId]/MediaGallery.tsx`:

```typescript
"use client";

import { useMediaContract } from "@/hooks/useMediaContract";
import { SessionKey } from "@mysten/seal";

export function MediaGallery({ userId, matchId }: Props) {
  const { uploadMedia, decryptMedia } = useMediaContract();
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);

  const handleUpload = async (file: File) => {
    const mediaId = await uploadMedia(
      file,
      myProfileId,
      matchId,
      2, // MATCHES_ONLY
      "Private photo"
    );

    // Refresh gallery...
  };

  const handleViewMedia = async (mediaItem: MediaItem) => {
    if (!sessionKey || !mediaItem.sealPolicyId) return;

    const url = await decryptMedia(mediaItem.id, mediaItem.sealPolicyId, sessionKey);

    // Display in modal or new window
    window.open(url, "_blank");
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {media.map((item) => (
        <div key={item.id} className="relative">
          {item.visibilityLevel === 2 && (
            <div className="absolute inset-0 backdrop-blur">
              <Lock className="text-white" />
            </div>
          )}
          <button onClick={() => handleViewMedia(item)}>View</button>
        </div>
      ))}

      <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files[0])} />
    </div>
  );
}
```

---

## Best Practices

### 1. Error Handling

```typescript
try {
  const result = await createBlockchainProfile(data, signAndExecute);
} catch (error: any) {
  if (error.message?.includes("InsufficientGas")) {
    toast.error("Not enough SUI for gas. Please get testnet SUI from faucet.");
  } else if (error.message?.includes("UserRejectedRequest")) {
    toast.error("Transaction cancelled");
  } else {
    toast.error("Blockchain error: " + error.message);
  }
}
```

### 2. Session Key Management

```typescript
// Cache session key per chat
const sessionKeyCache = new Map<string, SessionKey>();

export function useSessionKey(chatId: string) {
  const [key, setKey] = useState<SessionKey | null>(() => sessionKeyCache.get(chatId) || null);

  useEffect(() => {
    if (key) {
      sessionKeyCache.set(chatId, key);
    }
  }, [key, chatId]);

  return { sessionKey: key, setSessionKey: setKey };
}
```

### 3. Wallet Connection Check

```typescript
export function useRequireWallet() {
  const account = useCurrentAccount();
  const router = useRouter();

  useEffect(() => {
    if (!account) {
      toast.error("Please connect your Sui wallet");
      router.push("/connect-wallet");
    }
  }, [account]);

  return account;
}
```

### 4. Transaction Cost Estimation

```typescript
export async function estimateGasCost(tx: Transaction, client: SuiClient) {
  const dryRunResult = await client.dryRunTransactionBlock({
    transactionBlock: await tx.build({ client }),
  });

  const gasCost = dryRunResult.effects.gasUsed;
  return {
    computationCost: gasCost.computationCost,
    storageCost: gasCost.storageCost,
    total: BigInt(gasCost.computationCost) + BigInt(gasCost.storageCost),
  };
}
```

### 5. Retry Logic

```typescript
async function executeWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === maxRetries - 1) throw error;
      if (error.message?.includes("RPC")) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

---

## Troubleshooting

### Vấn Đề Thường Gặp

#### 1. "InsufficientGas" Error

**Nguyên nhân**: Ví không đủ SUI để trả gas fee

**Giải pháp**:
```bash
# Get testnet SUI from faucet
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
--header 'Content-Type: application/json' \
--data-raw '{"FixedAmountRequest":{"recipient":"YOUR_ADDRESS"}}'
```

#### 2. "MoveAbort" với seal_policies

**Nguyên nhân**: Encryption ID không đúng format hoặc allowlist không tồn tại

**Giải pháp**:
- Kiểm tra encryption ID có format đúng: `[TYPE_BYTE][ALLOWLIST_ID][NONCE]`
- Verify allowlist object tồn tại và active

#### 3. Seal Decrypt Failed

**Nguyên nhân**: SessionKey chưa được sign đúng cách

**Giải pháp**:
```typescript
// Đảm bảo call setPersonalMessageSignature
await sessionKey.setPersonalMessageSignature(signature);
```

#### 4. Walrus Upload Failed

**Nguyên nhân**: Publisher server không available

**Giải pháp**:
- Thử publisher khác trong danh sách
- Check network connectivity
- Verify file size < 10 MiB

### Debug Tips

```typescript
// Enable verbose logging
localStorage.setItem("DEBUG", "sui:*,seal:*");

// Log transaction details
console.log("TX Digest:", result.digest);
console.log("Object Changes:", result.objectChanges);
console.log("Gas Used:", result.effects.gasUsed);

// Check blockchain state
const obj = await client.getObject({ id: objectId, options: { showContent: true } });
console.log("Object Fields:", obj.data.content.fields);
```

---

## Deployment Checklist

- [ ] Update environment variables với mainnet contract IDs
- [ ] Test wallet connection flow
- [ ] Test profile creation end-to-end
- [ ] Test match creation with mutual likes
- [ ] Test encrypted chat messages
- [ ] Test media upload and decrypt
- [ ] Setup monitoring for failed transactions
- [ ] Document gas cost estimates
- [ ] Create user guide for wallet setup
- [ ] Setup fallback for blockchain unavailable

---

## API Reference

Xem chi tiết tại:
- Smart Contract API: `/src/contracts/matching_me/`
- Test Implementation: `/src/app/test-contract/page.tsx`
- Seal Protocol Docs: https://docs.sui.io/guides/developer/cryptography/seal
- Walrus Docs: https://docs.walrus.site/

---

## Support

Nếu gặp vấn đề:
1. Check console logs và transaction digest
2. Verify contract IDs trong environment variables
3. Test với `/test-contract` page trước
4. Review implementation guide này
5. Check Sui Explorer: https://suiscan.xyz/testnet

---

**Version**: 1.0
**Last Updated**: 2025-10-05
**Maintainer**: Development Team
