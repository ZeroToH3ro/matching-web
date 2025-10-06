# Blockchain Queries Guide

Hướng dẫn cách tìm Profile ID, Match ID, Chat Room ID và Allowlist ID từ wallet address.

## 📋 Tổng quan

Module `contractQueries.ts` cung cấp các hàm utility để query thông tin từ smart contract, giúp bạn dễ dàng tìm các ID cần thiết để:

- Gửi tin nhắn
- Giải mã tin nhắn
- Truy cập media được mã hóa
- Kiểm tra match giữa 2 users

## 🚀 Cách sử dụng

### 1. Import các functions

```typescript
import {
  getProfileIdByAddress,
  getMatchIdBetweenUsers,
  getChatRoomIdByMatchId,
  getChatAllowlistIdByChatRoomId,
  findChatInfoBetweenUsers,
  getMessagingIds,
} from "@/lib/blockchain/contractQueries";
import { useSuiClient } from "@mysten/dapp-kit";
```

### 2. Tìm Profile ID từ wallet address

```typescript
const client = useSuiClient();
const myWallet = "0x1234..."; // Wallet address của bạn

// Cách 1: Chỉ lấy Profile ID
const profileId = await getProfileIdByAddress(client, myWallet);
console.log("My Profile ID:", profileId);

// Cách 2: Lấy thông tin profile đầy đủ
const profileInfo = await getProfileInfo(client, profileId);
console.log("Profile Info:", {
  displayName: profileInfo.displayName,
  age: profileInfo.age,
  matchCount: profileInfo.matchCount,
});
```

### 3. Tìm Match ID giữa 2 wallets

```typescript
const myWallet = "0x1234...";
const otherWallet = "0x5678...";

const matchId = await getMatchIdBetweenUsers(client, myWallet, otherWallet);

if (matchId) {
  console.log("Match found:", matchId);

  // Lấy thông tin match
  const matchInfo = await getMatchInfo(client, matchId);
  console.log("Match Info:", {
    compatibilityScore: matchInfo.compatibilityScore,
    status: matchInfo.status, // 0=Pending, 1=Active, 2=Expired, 3=Blocked
  });
} else {
  console.log("No match found between these users");
}
```

### 4. Tìm Chat Room ID từ Match ID

```typescript
const chatRoomId = await getChatRoomIdByMatchId(client, matchId);

if (chatRoomId) {
  console.log("Chat Room ID:", chatRoomId);

  // Lấy thông tin chat room
  const chatInfo = await getChatRoomInfo(client, chatRoomId);
  console.log("Chat Info:", {
    participants: [chatInfo.participantA, chatInfo.participantB],
    totalMessages: chatInfo.totalMessages,
    sealPolicyId: chatInfo.sealPolicyId,
  });
}
```

### 5. Tìm Chat Allowlist ID từ Chat Room ID

```typescript
const chatAllowlistId = await getChatAllowlistIdByChatRoomId(
  client,
  chatRoomId
);

if (chatAllowlistId) {
  console.log("Chat Allowlist ID:", chatAllowlistId);
  // Dùng ID này để encrypt/decrypt messages
}
```

### 6. 🎯 Tìm tất cả thông tin cùng lúc (RECOMMENDED)

```typescript
const myWallet = "0x1234...";
const otherWallet = "0x5678...";

// Tìm tất cả thông tin trong 1 lần gọi
const chatInfo = await findChatInfoBetweenUsers(
  client,
  myWallet,
  otherWallet
);

if (chatInfo) {
  console.log("Complete Chat Info:", {
    myProfileId: chatInfo.myProfileId,
    otherProfileId: chatInfo.otherProfileId,
    matchId: chatInfo.matchId,
    chatRoomId: chatInfo.chatRoomId,
    chatAllowlistId: chatInfo.chatAllowlistId,
    matchInfo: chatInfo.matchInfo,
    chatRoomInfo: chatInfo.chatRoomInfo,
  });

  // Bạn đã có tất cả IDs cần thiết để gửi/nhận tin nhắn!
}
```

### 7. 🔥 Simplified version - Chỉ lấy IDs cần thiết cho messaging

```typescript
// Cách nhanh nhất - chỉ lấy 3 IDs cần thiết
const messagingIds = await getMessagingIds(client, myWallet, otherWallet);

if (messagingIds) {
  const { profileId, chatRoomId, chatAllowlistId } = messagingIds;

  // Sử dụng ngay để gửi tin nhắn
  await sendEncryptedMessage(chatRoomId, chatAllowlistId, "Hello!");
}
```

## 💬 Example: Gửi tin nhắn mã hóa

```typescript
import { Transaction } from "@mysten/sui/transactions";
import { SealClient } from "@mysten/seal";
import { toHex, fromHex } from "@mysten/sui/utils";

async function sendEncryptedMessage(
  chatRoomId: string,
  chatAllowlistId: string,
  messageContent: string
) {
  // 1. Lấy messaging IDs
  const ids = await getMessagingIds(client, myWallet, otherWallet);
  if (!ids) {
    throw new Error("Chat not found");
  }

  // 2. Encrypt message với Seal Protocol
  const TYPE_CHAT = 1;
  const allowlistIdBytes = fromHex(
    chatAllowlistId.startsWith("0x")
      ? chatAllowlistId.slice(2)
      : chatAllowlistId
  );
  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const namespace = new Uint8Array([TYPE_CHAT, ...allowlistIdBytes]);
  const encryptionId = toHex(new Uint8Array([...namespace, ...nonce]));

  const sealClient = new SealClient({
    suiClient: client,
    serverConfigs: SERVER_CONFIGS,
  });

  const { encryptedObject } = await sealClient.encrypt({
    threshold: 2,
    packageId: PACKAGE_ID,
    id: encryptionId,
    data: new TextEncoder().encode(messageContent),
  });

  // 3. Gửi lên blockchain
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::chat::send_message_entry`,
    arguments: [
      tx.object(CHAT_REGISTRY_ID),
      tx.object(MESSAGE_INDEX_ID),
      tx.object(ids.chatRoomId),
      tx.pure.vector("u8", Array.from(encryptedObject)),
      tx.pure.vector("u8", [0]), // content_hash
      tx.object("0x6"), // Clock
    ],
  });

  await signAndExecute({ transaction: tx });
}
```

## 🔓 Example: Giải mã tin nhắn

```typescript
import { SessionKey, EncryptedObject } from "@mysten/seal";

async function decryptMessage(messageId: string, chatAllowlistId: string) {
  // 1. Lấy message object
  const messageObj = await client.getObject({
    id: messageId,
    options: { showContent: true },
  });

  const fields = messageObj.data.content.fields as any;
  const encryptedContent = new Uint8Array(fields.encrypted_content);

  // 2. Parse encrypted object
  const encryptedObj = EncryptedObject.parse(encryptedContent);
  const encryptedId = encryptedObj.id;

  // 3. Tạo SessionKey
  const sessionKey = await SessionKey.create({
    address: account.address,
    packageId: PACKAGE_ID,
    ttlMin: 10,
    suiClient: client,
  });

  // 4. Sign personal message
  await signPersonalMessage({
    message: sessionKey.getPersonalMessage(),
  });

  // 5. Build seal_approve transaction
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_policies::seal_approve`,
    arguments: [
      tx.pure.vector("u8", fromHex(encryptedId)),
      tx.object(chatAllowlistId),
      tx.object("0x6"), // Clock
    ],
  });

  const txBytes = await tx.build({ client, onlyTransactionKind: true });

  // 6. Fetch keys
  await sealClient.fetchKeys({
    ids: [encryptedId],
    txBytes,
    sessionKey,
    threshold: 2,
  });

  // 7. Decrypt
  const decryptedBytes = await sealClient.decrypt({
    data: encryptedContent,
    sessionKey,
    txBytes,
  });

  return new TextDecoder().decode(decryptedBytes);
}
```

## 📊 Cấu trúc dữ liệu

### ProfileInfo

```typescript
interface ProfileInfo {
  profileId: string;
  owner: string;
  displayName: string;
  age: number;
  bio: string;
  interests: string[];
  matchCount: number;
}
```

### MatchInfo

```typescript
interface MatchInfo {
  matchId: string;
  userA: string;
  userB: string;
  compatibilityScore: number;
  status: number; // 0=Pending, 1=Active, 2=Expired, 3=Blocked
  createdAt: string;
}
```

### ChatRoomInfo

```typescript
interface ChatRoomInfo {
  chatRoomId: string;
  participantA: string;
  participantB: string;
  sealPolicyId: string;
  matchId?: string;
  totalMessages: number;
  lastMessageAt: string;
}
```

### ChatAllowlistInfo

```typescript
interface ChatAllowlistInfo {
  allowlistId: string;
  chatId: string;
  participantA: string;
  participantB: string;
  active: boolean;
}
```

## 🛠️ Test trong UI

Đã có component `WalletProfileFinder` trong trang `/test-contract` để test các functions này:

1. Connect wallet
2. Click "Find My Profile ID" để tìm profile của bạn
3. Nhập wallet address của người khác
4. Click "Find All Info" để tìm tất cả IDs

## ⚠️ Lưu ý

1. **Profile phải tồn tại**: User phải đã tạo profile trước khi query
2. **Match phải active**: Match status phải = 1 (Active) để có thể tạo chat
3. **ChatAllowlist**: Được tự động tạo khi create chat from match
4. **Dynamic Fields**: Một số data được lưu trong Sui dynamic fields, cần query riêng

## 🔗 Links

- Test Page: `/test-contract`
- Contract Queries: `/src/lib/blockchain/contractQueries.ts`
- WalletProfileFinder Component: `/src/components/blockchain/WalletProfileFinder.tsx`

## 🐛 Troubleshooting

### Profile not found

```typescript
// Kiểm tra user đã tạo profile chưa
const profileId = await getProfileIdByAddress(client, walletAddress);
if (!profileId) {
  console.log("User needs to create a profile first");
  // Redirect to create profile page
}
```

### No match found

```typescript
// Kiểm tra có match giữa 2 users không
const matchId = await getMatchIdBetweenUsers(client, userA, userB);
if (!matchId) {
  console.log("Users need to match first");
  // Show match request button
}
```

### Chat room not found

```typescript
// Kiểm tra đã tạo chat chưa
const chatRoomId = await getChatRoomIdByMatchId(client, matchId);
if (!chatRoomId) {
  console.log("Chat room needs to be created from match");
  // Show create chat button
}
```

### Allowlist not found

```typescript
// Allowlist được auto-create khi tạo chat
// Nếu không có, có thể tạo manual
const allowlistId = await getChatAllowlistIdByChatRoomId(client, chatRoomId);
if (!allowlistId) {
  console.log("Need to create ChatAllowlist");
  // Call create_chat_allowlist_shared
}
```

## 📝 Best Practices

1. **Cache IDs**: Lưu các IDs vào localStorage để tránh query lại
2. **Error handling**: Luôn check null trước khi sử dụng IDs
3. **Loading states**: Hiển thị loading khi query
4. **Retry logic**: Implement retry cho network errors
5. **Use simplified functions**: Dùng `getMessagingIds()` cho trường hợp đơn giản

## 🎯 Quick Reference

| Task                    | Function                        | Returns             |
| ----------------------- | ------------------------------- | ------------------- |
| Tìm Profile ID          | `getProfileIdByAddress()`       | `string \| null`    |
| Tìm Match giữa 2 users  | `getMatchIdBetweenUsers()`      | `string \| null`    |
| Tìm Chat từ Match       | `getChatRoomIdByMatchId()`      | `string \| null`    |
| Tìm Allowlist từ Chat   | `getChatAllowlistIdByChatRoom` | `string \| null`    |
| Tìm tất cả thông tin    | `findChatInfoBetweenUsers()`    | `object \| null`    |
| Chỉ lấy IDs cho message | `getMessagingIds()`             | `{...IDs} \| null` |
