# 🔍 Tìm Profile ID, Match ID, Chat Room ID và Allowlist ID từ Wallet Address

## 🎯 Giải pháp đã hoàn thành

Tôi đã tạo một hệ thống hoàn chỉnh để tự động tìm tất cả các IDs cần thiết chỉ từ 2 wallet addresses:

### ✅ Files đã tạo

1. **`/src/lib/blockchain/contractQueries.ts`** (500+ lines)
   - Tất cả functions để query blockchain
   - Type definitions đầy đủ
   - Error handling

2. **`/src/components/blockchain/WalletProfileFinder.tsx`** (300+ lines)
   - UI component để test các functions
   - Hiển thị kết quả trực quan
   - Copy to clipboard

3. **`/docs/BLOCKCHAIN_QUERIES_GUIDE.md`**
   - Hướng dẫn chi tiết cách sử dụng
   - Code examples
   - Troubleshooting guide

### 🚀 Cách sử dụng nhanh

#### Option 1: Sử dụng UI (Đơn giản nhất)

1. Mở `/test-contract` page
2. Scroll xuống phần "🔍 Wallet Profile Finder"
3. Connect wallet
4. Click "Find My Profile ID"
5. Nhập wallet address của người bạn muốn chat
6. Click "Get Messaging IDs Only"
7. ✅ Nhận được: `profileId`, `chatRoomId`, `chatAllowlistId`

#### Option 2: Sử dụng trong code (Recommended)

```typescript
import { getMessagingIds } from "@/lib/blockchain/contractQueries";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";

function MyComponent() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  const handleFindChat = async (otherWallet: string) => {
    const ids = await getMessagingIds(
      client,
      account.address,
      otherWallet
    );

    if (ids) {
      // Có thể gửi tin nhắn ngay!
      console.log("Profile ID:", ids.profileId);
      console.log("Chat Room ID:", ids.chatRoomId);
      console.log("Chat Allowlist ID:", ids.chatAllowlistId);

      // Gửi tin nhắn
      await sendMessage(
        ids.chatRoomId,
        ids.chatAllowlistId,
        "Hello!"
      );
    }
  };

  return <button onClick={() => handleFindChat("0x...")}>
    Find Chat & Send Message
  </button>;
}
```

#### Option 3: Lấy tất cả thông tin chi tiết

```typescript
import { findChatInfoBetweenUsers } from "@/lib/blockchain/contractQueries";

const info = await findChatInfoBetweenUsers(
  client,
  myWallet,
  otherWallet
);

// Trả về tất cả:
// - myProfileId
// - otherProfileId
// - matchId
// - chatRoomId
// - chatAllowlistId
// - matchInfo (compatibility score, status, etc.)
// - chatRoomInfo (participants, messages count, etc.)
```

### 📋 Available Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `getProfileIdByAddress()` | Tìm Profile ID từ wallet | `string \| null` |
| `getProfileInfo()` | Lấy thông tin profile đầy đủ | `ProfileInfo \| null` |
| `getMatchIdBetweenUsers()` | Tìm Match ID giữa 2 users | `string \| null` |
| `getMatchInfo()` | Lấy thông tin match | `MatchInfo \| null` |
| `getChatRoomIdByMatchId()` | Tìm Chat Room từ Match | `string \| null` |
| `getChatRoomInfo()` | Lấy thông tin chat room | `ChatRoomInfo \| null` |
| `getChatAllowlistIdByChatRoomId()` | Tìm Allowlist từ Chat Room | `string \| null` |
| `getChatAllowlistInfo()` | Lấy thông tin allowlist | `ChatAllowlistInfo \| null` |
| **`findChatInfoBetweenUsers()`** | **Tìm TẤT CẢ thông tin** | `object \| null` |
| **`getMessagingIds()`** | **Chỉ lấy 3 IDs cần thiết** | `{...IDs} \| null` |

### 🎨 UI Component Features

WalletProfileFinder component có sẵn:

- ✅ Tìm Profile ID của bạn
- ✅ Tìm Profile ID của người khác
- ✅ Tìm Match ID giữa 2 người
- ✅ Tìm Chat Room ID
- ✅ Tìm Chat Allowlist ID
- ✅ Hiển thị thông tin chi tiết (tên, tuổi, compatibility score, etc.)
- ✅ Copy to clipboard cho tất cả IDs
- ✅ Code example hiển thị ngay trong UI

### 🔄 Workflow hoàn chỉnh

```
Wallet A + Wallet B
     ↓
[getMessagingIds()]
     ↓
- Profile ID
- Chat Room ID
- Chat Allowlist ID
     ↓
[sendEncryptedMessage()]
     ↓
✅ Message sent!
```

### 💡 Use Cases

1. **Chat Component**
```typescript
// Trong ChatComponent.tsx
const ids = await getMessagingIds(client, myWallet, otherWallet);
if (ids) {
  // Setup chat
  setChatRoomId(ids.chatRoomId);
  setAllowlistId(ids.chatAllowlistId);
}
```

2. **Profile Page**
```typescript
// Hiển thị nút "Send Message"
const profileId = await getProfileIdByAddress(client, userWallet);
const matchId = await getMatchIdBetweenUsers(client, myWallet, userWallet);

if (matchId) {
  // Show "Send Message" button
  <button onClick={() => navigateToChat(matchId)}>
    💬 Send Message
  </button>
}
```

3. **Match List**
```typescript
// Hiển thị tất cả matches với option chat
const matches = await getMatchIdsByAddress(client, myWallet);
for (const matchId of matches) {
  const chatRoomId = await getChatRoomIdByMatchId(client, matchId);
  // Render match with chat button
}
```

### 🔧 Technical Details

**Cách hoạt động:**

1. **Profile Lookup**: Query `ProfileRegistry` table để tìm profile ID
2. **Match Lookup**: Query owned `Match` objects và check participants
3. **Chat Room Lookup**: Query `MatchChatRegistry` dynamic field
4. **Allowlist Lookup**: Query `AllowlistRegistry` dynamic field

**Optimizations:**

- ✅ O(1) lookups với Sui Tables
- ✅ Dynamic field access cho nested data
- ✅ Parallel queries khi có thể
- ✅ Caching trong UI component

### 📚 Documentation

Xem hướng dẫn chi tiết tại: `/docs/BLOCKCHAIN_QUERIES_GUIDE.md`

### 🧪 Testing

#### Option 1: UI Testing
1. Mở page: `http://localhost:3000/test-contract`
2. Scroll xuống "🔍 Wallet Profile Finder"
3. Test với 2 wallets đã match và có chat

#### Option 2: Debug Scripts (Recommended khi gặp lỗi)

**1. Debug toàn bộ connection (Recommended đầu tiên):**
```bash
npx tsx scripts/debug-chat-connection.ts <MY_WALLET> <OTHER_WALLET>
```
Script này sẽ check:
- ✓ Profile của cả 2 users
- ✓ Match giữa 2 users
- ✓ Match status (phải = 1 ACTIVE)
- ✓ Chat room existence
- ✓ Chat allowlist existence
- ✓ Message count

**2. List tất cả chats của một user:**
```bash
npx tsx scripts/list-user-chats.ts <WALLET_ADDRESS>
```
Hiển thị:
- Tất cả chat rooms
- Participants trong mỗi chat
- Message count
- ChatAllowlist IDs

**3. Tìm chat room từ match ID:**
```bash
npx tsx scripts/find-chatroom-from-match.ts <MATCH_ID>
```
Tìm chat room và allowlist từ match ID cụ thể

**Example workflow khi gặp lỗi:**
```bash
# 1. Debug xem thiếu gì
npx tsx scripts/debug-chat-connection.ts 0xabc... 0xdef...

# 2. Nếu không tìm thấy chat, list tất cả chats
npx tsx scripts/list-user-chats.ts 0xabc...

# 3. Nếu có match ID, tìm chat từ match
npx tsx scripts/find-chatroom-from-match.ts 0x123...
```

### ⚠️ Requirements

- User phải đã create profile
- Phải có match active (status = 1) giữa 2 users
- Chat room phải đã được tạo từ match
- ChatAllowlist được auto-create khi tạo chat

### 🎉 Summary

Bây giờ bạn có thể:

1. ✅ Tìm Profile ID từ wallet address
2. ✅ Tìm Match ID giữa 2 wallets
3. ✅ Tìm Chat Room ID từ Match
4. ✅ Tìm Chat Allowlist ID từ Chat Room
5. ✅ Lấy tất cả thông tin chi tiết
6. ✅ Sử dụng trong UI với component có sẵn
7. ✅ Sử dụng trong code với type-safe functions

**Không cần phải manual copy/paste IDs nữa!** 🎊
