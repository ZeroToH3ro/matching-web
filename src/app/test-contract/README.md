# Contract Testing Dashboard

## Overview

Trang test này cho phép bạn kiểm tra toàn bộ luồng hoạt động của smart contract Matching.Me trên Sui blockchain.

## Package Information

- **Package ID**: `0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1`
- **Network**: Sui Testnet
- **Modules**: `core`, `chat`, `seal_policies`, `integration`

## Prerequisites

1. **Sui Wallet**: Cài đặt [Sui Wallet Extension](https://chrome.google.com/webstore/detail/sui-wallet)
2. **Testnet Tokens**: Get free SUI from [Sui Testnet Faucet](https://faucet.sui.io/)
3. **Connection**: Connect wallet trên app

## Testing Flow

### 1. Create Profile (Tạo hồ sơ người dùng)

**Mục đích**: Tạo profile NFT cho user với thông tin cá nhân

**Input**:
- Name: Tên người dùng
- Bio: Giới thiệu ngắn
- Age: Tuổi (số nguyên)
- Gender: Giới tính (0=Male, 1=Female, 2=Other)
- Interests: Sở thích (cách nhau bởi dấu phẩy)

**Output**:
- Profile Object ID (UserProfile NFT)
- Transaction Digest

**Action**: Lưu lại Profile Object ID để sử dụng cho các bước tiếp theo

---

### 2. Create Match (Tạo kết nối giữa 2 user)

**Mục đích**: Tạo match giữa 2 users dựa trên thuật toán matching và ZK proof

**Input**:
- Profile ID: ID của profile bạn vừa tạo
- Target Address: Địa chỉ wallet của user muốn match
- ZK Proof: Zero-knowledge proof (để test dùng `0x00`)

**Output**:
- Match Object ID
- MatchCreated event với compatibility score

**Action**: Lưu lại Match Object ID để tạo chat room

---

### 3. Create Chat from Match (Tạo phòng chat từ match)

**Mục đích**: Tạo chat room E2E encrypted cho 2 users đã match

**Input**:
- Match ID: ID của match vừa tạo
- Seal Policy ID: ID của Seal Protocol policy (test: `test-seal-policy`)
- Encrypted Key: Key mã hóa cho E2E encryption (test: `0x00`)

**Prerequisites**:
⚠️ Cần cập nhật các shared object IDs trong code:
```typescript
// Cần thay thế:
"USAGE_TRACKER_ID"       // UsageTracker shared object
"MATCH_CHAT_REGISTRY_ID" // MatchChatRegistry shared object
"CHAT_REGISTRY_ID"       // ChatRegistry shared object
```

**Lấy Shared Object IDs**:
1. Sau khi deploy contract, shared objects được tạo trong transaction
2. Check transaction khi deploy để lấy object IDs
3. Hoặc query theo type:
   ```bash
   sui client objects --filter ObjectType=<PACKAGE_ID>::integration::UsageTracker
   ```

**Output**:
- ChatRoom Object ID
- MatchChatLink Object ID
- ChatCreatedFromMatch event

**Action**: Lưu lại ChatRoom ID để gửi tin nhắn

---

### 4. Send Message (Gửi tin nhắn)

**Mục đích**: Gửi tin nhắn mã hóa trong chat room

**Input**:
- Chat Room ID: ID của chat room
- Message Content: Nội dung tin nhắn (sẽ được mã hóa)
- Content Type: Loại nội dung (0=Text, 1=Image, 2=Video, 3=Audio, 4=Gift)

**Prerequisites**:
⚠️ Cần cập nhật shared object IDs:
```typescript
"CHAT_REGISTRY_ID"   // ChatRegistry
"MESSAGE_INDEX_ID"   // MessageIndex
```

**Output**:
- Message Object ID
- MessageSent event với sender và timestamp

**Features**:
- ✅ E2E encryption với content hash verification
- ✅ Rate limiting theo subscription tier
- ✅ Support reply, expiring messages
- ✅ Support media (Walrus blob IDs)

---

### 5. Query Profile (Truy vấn thông tin profile)

**Mục đích**: Đọc dữ liệu profile từ blockchain

**Input**:
- Profile ID: ID của profile muốn query

**Output**:
- Full profile data (name, bio, age, gender, interests)
- Owner address
- Match count
- Created timestamp

---

## Advanced Features

### Subscription System

Contract hỗ trợ 4 subscription tiers:

```typescript
TIER_FREE = 0      // 50 messages/day, 5 chats
TIER_BASIC = 1     // 200 messages/day, 20 chats
TIER_PREMIUM = 2   // 1000 messages/day, 100 chats
TIER_PLATINUM = 3  // Unlimited
```

### Seal Protocol Integration

- **ChatAllowlist**: Chỉ participants mới decrypt được messages
- **MatchAllowlist**: Chỉ matched users mới access được shared content
- **SubscriptionAllowlist**: Premium content cho subscribers
- **TimeLock**: Time-based content reveal
- **CustomAllowlist**: Manual whitelist management

### Rate Limiting

- Daily message limits theo tier
- Active chat limits
- Auto-reset hàng ngày (UTC midnight)
- Separate tracking cho daily usage và total active chats

---

## Troubleshooting

### Error: "Shared object not found"

**Giải pháp**: Cần cập nhật shared object IDs trong code sau khi deploy

```typescript
// File: src/app/test-contract/page.tsx
// Tìm và thay thế:
"USAGE_TRACKER_ID"       → Actual shared object ID
"MATCH_CHAT_REGISTRY_ID" → Actual shared object ID
"CHAT_REGISTRY_ID"       → Actual shared object ID
"MESSAGE_INDEX_ID"       → Actual shared object ID
```

### Error: "Insufficient gas"

**Giải pháp**: Request more SUI tokens từ faucet

### Error: "Invalid proof"

**Giải pháp**: Đối với test, dùng mock proof `0x00`. Production cần real ZK proof.

### Error: "Chat already exists for match"

**Giải pháp**: Mỗi match chỉ tạo được 1 chat room. Sử dụng chat room đã tồn tại.

---

## Getting Shared Object IDs

Sau khi deploy contract lần đầu, các shared objects được tạo tự động trong `init()` function:

### Method 1: From Deploy Transaction

```bash
# Check deploy transaction
sui client transaction-block <DEPLOY_TX_DIGEST>

# Look for "created" objects with type:
- <PACKAGE_ID>::integration::UsageTracker
- <PACKAGE_ID>::integration::MatchChatRegistry
- <PACKAGE_ID>::chat::ChatRegistry
- <PACKAGE_ID>::chat::MessageIndex
- <PACKAGE_ID>::seal_policies::AllowlistRegistry
- <PACKAGE_ID>::core::ProfileRegistry
- <PACKAGE_ID>::core::MatchRegistry
```

### Method 2: Query by Type

```bash
# Query UsageTracker
sui client objects --filter ObjectType=0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1::integration::UsageTracker

# Query ChatRegistry
sui client objects --filter ObjectType=0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1::chat::ChatRegistry

# Repeat for other registries...
```

### Method 3: From Sui Explorer

1. Go to [Sui Explorer](https://suiscan.xyz/testnet)
2. Search for package ID
3. Look at "Created Objects" in deploy transaction
4. Find objects with type ending in `Registry`, `Tracker`, `Index`

---

## Example Test Scenario

### Complete Flow Test

```typescript
// 1. Alice creates profile
Profile ID: 0xabc123...
Owner: 0x456def...

// 2. Bob creates profile
Profile ID: 0xdef456...
Owner: 0x789ghi...

// 3. Alice matches with Bob
Match ID: 0x111222...
Users: Alice (0x456def...) ↔ Bob (0x789ghi...)

// 4. Alice creates chat from match
Chat Room ID: 0x333444...
Participants: Alice ↔ Bob

// 5. Alice sends message
Message ID: 0x555666...
Content: "Hello from blockchain!"
Sender: Alice

// 6. Bob sends reply
Message ID: 0x777888...
Content: "Hi Alice!"
Sender: Bob
```

---

## UI Features

### Object Changes Display
- ✅ Automatic parsing of transaction object changes
- ✅ Color-coded by change type (created/mutated/deleted)
- ✅ Copy object IDs with one click
- ✅ Shows object types and ownership

### Events Display
- ✅ All emitted events with parsed JSON
- ✅ Event type highlighting
- ✅ Structured event data view

### Transaction Explorer Link
- ✅ Direct link to Sui Explorer for each transaction
- ✅ View full transaction details on-chain

---

## Next Steps

1. **Get Shared Object IDs** from deploy transaction
2. **Update code** với actual IDs
3. **Test complete flow** từ profile → match → chat → message
4. **Monitor events** để verify contract behavior
5. **Check Explorer** để verify on-chain data

## Links

- [Sui Explorer - Testnet](https://suiscan.xyz/testnet)
- [Sui Faucet](https://faucet.sui.io/)
- [Sui Docs](https://docs.sui.io/)
- [Package ID](https://suiscan.xyz/testnet/object/0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1)
