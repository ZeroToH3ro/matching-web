# 🧪 Smart Contract Testing Guide

## Quick Start

### 1. Access Test Page

```bash
npm run dev
```

Mở trình duyệt tại: **http://localhost:3000/test-contract**

### 2. Connect Wallet

1. Cài đặt [Sui Wallet Extension](https://chrome.google.com/webstore/detail/sui-wallet)
2. Tạo hoặc import wallet
3. Chuyển sang **Testnet** network
4. Click "Connect Wallet" trên app

### 3. Get Test Tokens

```bash
# Option 1: CLI
sui client faucet

# Option 2: Web
# Visit: https://faucet.sui.io/
```

---

## 📦 Package Information

- **Package ID**: `0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1`
- **Network**: Sui Testnet
- **Explorer**: https://suiscan.xyz/testnet/object/0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1

---

## 🔧 Get Shared Object IDs

### Method 1: From Deploy Transaction

```bash
npm run contract:get-objects <DEPLOY_TX_DIGEST>
```

### Method 2: CLI Search

```bash
# Example: Find UsageTracker
sui client objects --filter "StructType==0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1::integration::UsageTracker"
```

### Method 3: Interactive Helper

```bash
npm run contract:test-flow
# Choose option: "2. Get shared object IDs"
```

### Required Shared Objects

Cần update các IDs này trong `/src/app/test-contract/page.tsx`:

```typescript
// Core Registries
const PROFILE_REGISTRY_ID = "0x...";
const MATCH_REGISTRY_ID = "0x...";

// Chat System
const CHAT_REGISTRY_ID = "0x...";
const MESSAGE_INDEX_ID = "0x...";

// Integration
const USAGE_TRACKER_ID = "0x...";
const MATCH_CHAT_REGISTRY_ID = "0x...";

// Seal Protocol
const ALLOWLIST_REGISTRY_ID = "0x...";
```

---

## 🚀 Testing Flow

### Step 1: Create Profile

**Mục đích**: Tạo UserProfile NFT trên blockchain

**Input Example**:
```
Name: Alice
Bio: Tech enthusiast
Age: 25
Gender: 1 (Female)
Interests: Travel, Music, Coding
```

**Expected Output**:
- ✅ Transaction success
- 📦 Profile Object ID: `0xabc123...`
- 📝 Event: `ProfileCreated`

**Action**: Lưu Profile Object ID

---

### Step 2: Create Match

**Mục đích**: Tạo match giữa 2 users

**Input Example**:
```
Profile ID: 0xabc123... (from Step 1)
Target Address: 0xdef456... (Bob's address)
ZK Proof: 0x00 (mock for testing)
```

**Expected Output**:
- ✅ Transaction success
- 📦 Match Object ID: `0x111222...`
- 📝 Event: `MatchCreated` with compatibility score

**Action**: Lưu Match Object ID

---

### Step 3: Create Chat Room

**Prerequisites**:
⚠️ Cần update shared object IDs trước

**Input Example**:
```
Match ID: 0x111222... (from Step 2)
Seal Policy ID: test-seal-policy
Encrypted Key: 0x00
```

**Expected Output**:
- ✅ Transaction success
- 📦 ChatRoom Object ID: `0x333444...`
- 📦 ChatAllowlist Object ID: `0xaaa111...` ⚠️ **Quan trọng: Cần lưu ID này để encrypt message!**
- 📦 MatchChatLink Object ID: `0x555666...`
- 📝 Event: `ChatCreatedFromMatch`

**Features**:
- ✅ Validates match is active
- ✅ Prevents duplicate chat creation
- ✅ Checks subscription limits
- ✅ Increments active chat count for both users
- 🔐 Creates ChatAllowlist for Seal Protocol encryption

**Action**: Lưu **ChatRoom Object ID** và **ChatAllowlist Object ID**

---

### Step 4: Send Message

**Prerequisites**:
⚠️ Cần update shared object IDs trước

**Input Example**:
```
Chat Room ID: 0x333444... (from Step 3)
Chat Allowlist ID: 0xaaa111... (from Step 3) ⚠️ **BẮT BUỘC để encrypt đúng!**
Message Content: Hello from blockchain!
Content Hash: 0x00
```

**Expected Output**:
- ✅ Transaction success
- 📦 Message Object ID: `0x777888...`
- 📝 Event: `MessageSent`

**Features**:
- 🔐 E2E encryption using Seal Protocol with proper namespace (TYPE_CHAT + ChatAllowlist ID)
- ✅ Rate limiting theo subscription tier
- ✅ Support reply, media, expiring messages

**Important Notes**:
- 🚨 **Chat Allowlist ID is REQUIRED** for message encryption
- 🔐 Encryption namespace = TYPE_CHAT (1 byte) + ChatAllowlist ID (32 bytes) + nonce (5 bytes)
- ✅ Only participants in the ChatAllowlist can decrypt messages
- ❌ Using wrong ChatAllowlist ID will make messages undecryptable

---

### Step 5: Query Data

**Query Profile**:
```typescript
// Input Profile ID
Profile ID: 0xabc123...

// Output
{
  name: "Alice",
  bio: "Tech enthusiast",
  age: 25,
  gender: 1,
  interests: ["Travel", "Music", "Coding"],
  matchCount: 1,
  createdAt: 1234567890
}
```

---

## 🎯 Advanced Testing

### Rate Limiting Test

```typescript
// Free tier: 50 messages/day, 5 chats
// Test: Try to send 51 messages → Should fail with EMessageLimitReached

// Test: Try to create 6 chats → Should fail with EMaxChatsReached
```

### Match Validation Test

```typescript
// Test 1: Try to create chat without match → Should fail with ENotMatched
// Test 2: Try to create duplicate chat → Should fail with EChatAlreadyExists
// Test 3: Create chat with inactive match → Should fail with EInactiveMatch
```

### Seal Protocol Test

```typescript
// Test 1: Create ChatAllowlist for encrypted messages
// ChatAllowlist is automatically created when creating a chat from match
// It includes both match participants

// Test 2: Send encrypted message with ChatAllowlist ID
// Encryption namespace = TYPE_CHAT (1 byte) + ChatAllowlist ID (32 bytes) + nonce
const TYPE_CHAT = 1;
const allowlistIdBytes = fromHex(chatAllowlistId.slice(2));
const namespace = new Uint8Array([TYPE_CHAT, ...allowlistIdBytes]);
const encryptionId = toHex(new Uint8Array([...namespace, ...nonce]));

// Test 3: Only participants can decrypt
// Try to decrypt with wallet that is NOT in allowlist → Should fail
// Try to decrypt with participant wallet → Should succeed

// Test 4: Wrong ChatAllowlist ID
// Send message with wrong/missing ChatAllowlist ID → Can be sent but CANNOT be decrypted
```

---

## 📊 Monitoring & Debugging

### View Transaction on Explorer

```
https://suiscan.xyz/testnet/tx/<TX_DIGEST>
```

### Check Object Changes

UI tự động hiển thị:
- ✅ Created objects (green)
- ⚠️ Mutated objects (yellow)
- ❌ Deleted objects (red)
- 🔄 Transferred objects (blue)

### View Events

UI hiển thị tất cả events được emit:
- ProfileCreated
- MatchCreated
- ChatCreatedFromMatch
- MessageSent
- AllowlistCreated
- etc.

### Check Gas Usage

```bash
sui client gas
```

### View All Owned Objects

```bash
sui client objects
```

---

## 🛠 NPM Scripts

```bash
# Development
npm run dev                    # Start dev server

# Contract Management
npm run contract:build         # Build Move contracts
npm run contract:test          # Run Move tests
npm run contract:get-objects   # Get shared object IDs
npm run contract:test-flow     # Interactive CLI testing

# Database
npx prisma generate           # Generate Prisma client
npx prisma studio             # Open database GUI
```

---

## 🐛 Troubleshooting

### Error: "Shared object not found"

**Cause**: Shared object IDs chưa được update

**Fix**:
1. Get shared object IDs: `npm run contract:get-objects <DEPLOY_TX>`
2. Update IDs trong `/src/app/test-contract/page.tsx`

### Error: "Insufficient gas"

**Cause**: Không đủ SUI tokens

**Fix**:
```bash
sui client faucet
# Or visit: https://faucet.sui.io/
```

### Error: "Module not found"

**Cause**: Package ID sai hoặc module chưa deploy

**Fix**: Verify package ID trên Sui Explorer

### Error: "Type mismatch"

**Cause**: Object type không đúng

**Fix**: Kiểm tra lại object ID và type trong transaction

### Transaction Stuck

**Fix**:
1. Check wallet notification
2. Tăng gas budget nếu cần
3. Check network status

---

## 📚 Documentation

- [Test Page README](./src/app/test-contract/README.md)
- [Contract Improvements](./src/contracts/matching_me/readme.md)
- [Sui Documentation](https://docs.sui.io/)
- [Seal Protocol Docs](https://docs.mysten.com/seal)

---

## 🎓 Learning Resources

### Video Tutorials
- [Sui Move Basics](https://docs.sui.io/guides/developer/first-app)
- [Building dApps on Sui](https://docs.sui.io/guides/developer/app-examples)

### Code Examples
- Profile Creation: `src/app/test-contract/page.tsx:createProfile()`
- Match Creation: `src/app/test-contract/page.tsx:createMatch()`
- Chat Creation: `src/app/test-contract/page.tsx:createChat()`
- Message Sending: `src/app/test-contract/page.tsx:sendMessage()`

### Contract Code
- Core: `src/contracts/matching_me/sources/matching_me.move`
- Chat: `src/contracts/matching_me/sources/matching_me_chat.move`
- Seal: `src/contracts/matching_me/sources/matching_me_seal.move`
- Integration: `src/contracts/matching_me/sources/matching_me_integration.move`

---

## 🚦 Testing Checklist

- [ ] Wallet connected and funded
- [ ] Shared object IDs updated in code
- [ ] Can create profile
- [ ] Can create match
- [ ] Can create chat from match
- [ ] Can send messages
- [ ] Can query profile data
- [ ] Transaction appears on explorer
- [ ] Events are emitted correctly
- [ ] Object changes display correctly
- [ ] Rate limiting works
- [ ] Match validation works

---

## 💡 Tips

1. **Save Object IDs**: Copy tất cả Object IDs sau mỗi transaction
2. **Use Explorer**: Verify data trên Sui Explorer
3. **Check Events**: Events giúp debug contract behavior
4. **Test Incrementally**: Test từng step trước khi chạy full flow
5. **Monitor Gas**: Keep track of gas usage
6. **Use Testnet**: Luôn test trên testnet trước mainnet
7. **Read Errors**: Error messages thường rất chi tiết

---

## 🤝 Support

- GitHub Issues: Report bugs và feature requests
- Discord: Join Sui developer community
- Documentation: Read contract docs và code comments

Happy Testing! 🎉
