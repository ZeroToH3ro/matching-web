# 🔍 Hướng dẫn Debug Chat khi không tìm thấy Chat Room / Allowlist

## ⚡ Quick Start

### Bước 1: Chạy debug script
```bash
npx tsx scripts/debug-chat-connection.ts <YOUR_WALLET> <OTHER_WALLET>
```

### Bước 2: Đọc kết quả
Script sẽ tự động kiểm tra **TẤT CẢ** các bước và báo chính xác thiếu gì.

### Bước 3: Follow suggestions
Script sẽ chỉ cách fix, ví dụ:
```
❌ ERROR: You don't have a profile!
   → Create a profile in /test-contract first
```

## 🎯 3 Cách để tìm Chat IDs

### 1️⃣ Dùng Code (Production)
```typescript
import { getMessagingIds } from "@/lib/blockchain/contractQueries";

// Chỉ cần 1 dòng code
const ids = await getMessagingIds(client, myWallet, otherWallet);

if (ids) {
  // ✅ Có ngay 3 IDs!
  const { profileId, chatRoomId, chatAllowlistId } = ids;

  // Gửi tin nhắn ngay
  await sendMessage(chatRoomId, chatAllowlistId, "Hello!");
} else {
  // ❌ Thiếu gì đó
  // Chạy debug script để xem
}
```

### 2️⃣ Dùng UI Tool (Testing)
1. Mở `http://localhost:3000/test-contract`
2. Scroll xuống phần có border **đỏ**: "🐛 Detailed Debug"
3. Nhập wallet address của người kia
4. Click "Start Debug"
5. Xem kết quả từng bước

Hoặc dùng phần **xanh**: "🔍 Wallet Profile Finder"
- Nhanh hơn nhưng ít detail

### 3️⃣ Dùng Scripts (Debugging)

**Script 1: Debug toàn bộ** (Recommended)
```bash
npx tsx scripts/debug-chat-connection.ts 0xYOUR... 0xOTHER...
```
→ Check tất cả: Profile, Match, Chat, Allowlist

**Script 2: List tất cả chats**
```bash
npx tsx scripts/list-user-chats.ts 0xYOUR...
```
→ Xem tất cả chat rooms bạn có

**Script 3: Tìm chat từ match**
```bash
npx tsx scripts/find-chatroom-from-match.ts 0xMATCH_ID...
```
→ Nếu biết Match ID

## 🐛 Common Errors & Solutions

### Error 1: "Your profile not found"
```bash
# Check
npx tsx scripts/debug-chat-connection.ts 0xYOUR... 0xOTHER...
# Output: ❌ ERROR: You don't have a profile!

# Fix
1. Go to /test-contract
2. Section "1. Create Profile"
3. Fill form & click "Create Profile"
4. Copy Profile ID from result
```

### Error 2: "No match found"
```bash
# Check
npx tsx scripts/debug-chat-connection.ts 0xYOUR... 0xOTHER...
# Output: ❌ ERROR: No match found between you and the other user!

# Fix
1. Go to /test-contract
2. Section "2. Create Match"
3. Enter your Profile ID + other user's wallet
4. Click "Create Match"
5. Copy Match ID from result
```

### Error 3: "Match is not active"
```bash
# Check
npx tsx scripts/debug-chat-connection.ts 0xYOUR... 0xOTHER...
# Output: ⚠️ WARNING: Match is not active! (status = 0)

# Fix
1. Go to /test-contract
2. Section "2b. Activate Match"
3. Paste Match ID
4. Click "Activate Match"
```

### Error 4: "Chat room not found"
```bash
# Check
npx tsx scripts/debug-chat-connection.ts 0xYOUR... 0xOTHER...
# Output: ❌ ERROR: Chat room not found!

# Fix
1. Go to /test-contract
2. Section "3. Create Chat from Match"
3. Enter Profile ID + Match ID
4. Click "Create Chat from Match"
5. Copy Chat Room ID from result
6. ChatAllowlist should be auto-created!
```

### Error 5: "Chat allowlist not found"
```bash
# Check
npx tsx scripts/debug-chat-connection.ts 0xYOUR... 0xOTHER...
# Output: ⚠️ WARNING: Chat allowlist not found!

# Fix
1. Should be auto-created with chat
2. If not, go to /test-contract
3. Section "7. Create Chat Allowlist"
4. Enter Chat Room ID + Profile ID
5. Click "Create Allowlist"
```

## 📊 Example Debug Output

### ✅ Success Case
```
🔍 DEBUGGING CHAT CONNECTION
═══════════════════════════════════════════════════════════════════════
My Wallet: 0xabc...
Other Wallet: 0xdef...
═══════════════════════════════════════════════════════════════════════

📝 STEP 1: Checking Your Profile
────────────────────────────────────────────────────────────────────────
✅ Your profile found:
   Profile ID: 0x123...
   Name: John Doe
   Age: 25

📝 STEP 2: Checking Other User's Profile
────────────────────────────────────────────────────────────────────────
✅ Other user's profile found:
   Profile ID: 0x456...
   Name: Jane Smith
   Age: 23

🤝 STEP 3: Checking Matches
────────────────────────────────────────────────────────────────────────
Found 1 match(es) owned by you
✅ Active match found! Match ID: 0x789...

💬 STEP 4: Checking Chat Room
────────────────────────────────────────────────────────────────────────
✅ Chat room found!
   Chat Room ID: 0xabc...
   Participant A: 0xabc...
   Participant B: 0xdef...

🔐 STEP 5: Checking Chat Allowlist
────────────────────────────────────────────────────────────────────────
✅ Chat allowlist found!
   Allowlist ID: 0xfff...

═══════════════════════════════════════════════════════════════════════
📋 SUMMARY
═══════════════════════════════════════════════════════════════════════
✅ ALL CHECKS PASSED - You should be able to send messages!
```

### ❌ Error Case
```
🔍 DEBUGGING CHAT CONNECTION
═══════════════════════════════════════════════════════════════════════

📝 STEP 1: Checking Your Profile
────────────────────────────────────────────────────────────────────────
✅ Your profile found: 0x123...

📝 STEP 2: Checking Other User's Profile
────────────────────────────────────────────────────────────────────────
✅ Other user's profile found: 0x456...

🤝 STEP 3: Checking Matches
────────────────────────────────────────────────────────────────────────
Found 1 match(es) owned by you

  Match ID: 0x789...
    User A: 0xabc...
    User B: 0xdef...
    Status: 0 (NOT ACTIVE ❌)
    ⭐ THIS IS YOUR MATCH!

⚠️ WARNING: Match is not active!
   → Activate the match (set status = 1) before creating chat

═══════════════════════════════════════════════════════════════════════
📋 SUMMARY
═══════════════════════════════════════════════════════════════════════
❌ ISSUES FOUND - Follow the suggestions above to fix them

🔧 Quick Fix Steps:
1. Make sure both users have created profiles ✅
2. Create a match between the two users ✅
3. Activate the match (set status = 1) ❌ ← DO THIS
4. Create a chat room from the active match
5. Verify the chat allowlist was created
```

## 🎯 Complete Fix Workflow

```bash
# 1. Run debug
npx tsx scripts/debug-chat-connection.ts 0xMY... 0xOTHER...

# 2. If missing profile
# → Go to /test-contract → Create Profile

# 3. If missing match
# → Go to /test-contract → Create Match

# 4. If match not active
# → Go to /test-contract → Activate Match

# 5. If missing chat
# → Go to /test-contract → Create Chat from Match

# 6. Verify
npx tsx scripts/debug-chat-connection.ts 0xMY... 0xOTHER...
# Should see: ✅ ALL CHECKS PASSED
```

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `/src/lib/blockchain/contractQueries.ts` | Query functions |
| `/src/components/blockchain/WalletProfileFinder.tsx` | UI finder tool |
| `/src/components/blockchain/DetailedChatDebugger.tsx` | UI debug tool |
| `/scripts/debug-chat-connection.ts` | Main debug script |
| `/scripts/list-user-chats.ts` | List all chats |
| `/scripts/find-chatroom-from-match.ts` | Find chat by match |
| `TROUBLESHOOTING_CHAT.md` | Detailed troubleshooting |
| `BLOCKCHAIN_QUERIES_GUIDE.md` | Complete usage guide |

## 💡 Tips

1. **Always run debug script first** - Nó sẽ chỉ chính xác thiếu gì
2. **Use UI tool for visual feedback** - Dễ hiểu hơn với màu sắc
3. **Scripts cho automation** - Integrate vào CI/CD
4. **Check transaction digests** - Để verify on-chain
5. **Cache IDs** - Để tránh query lại nhiều lần

## 🚨 If Nothing Works

1. Verify contract deployment IDs trong `/src/lib/blockchain/contractQueries.ts`
2. Check Sui testnet status: https://status.sui.io/
3. Verify wallet has SUI tokens for gas
4. Check console logs for detailed errors
5. Try with different wallet pair

## 🎉 Success Criteria

Khi tất cả hoạt động:
- ✅ Debug script shows "ALL CHECKS PASSED"
- ✅ `getMessagingIds()` returns non-null
- ✅ Can send encrypted messages
- ✅ Can decrypt received messages

Happy debugging! 🐛→✨
