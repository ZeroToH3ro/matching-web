# 🔧 Troubleshooting: "Could not find messaging IDs"

## Vấn đề
Khi sử dụng `getMessagingIds()` hoặc `findChatInfoBetweenUsers()`, nhận lỗi:
```
Could not find messaging IDs. Make sure you have a match and chat with this user.
```

## ✅ Quick Fix - Chạy script debug

**Bước 1: Chạy debug script**
```bash
npx tsx scripts/debug-chat-connection.ts <YOUR_WALLET> <OTHER_WALLET>
```

Script này sẽ tự động check:
1. ✓ Profile của bạn
2. ✓ Profile của người kia
3. ✓ Match giữa 2 người
4. ✓ Match status (phải ACTIVE = 1)
5. ✓ Chat room
6. ✓ Chat allowlist

**Bước 2: Xem kết quả**

Script sẽ báo chính xác bước nào bị thiếu, ví dụ:

### Case 1: Thiếu Profile
```
❌ ERROR: You don't have a profile!
   → Create a profile in /test-contract first
```

**Fix:** Tạo profile trong `/test-contract` → Section "1. Create Profile"

### Case 2: Thiếu Match
```
❌ ERROR: No match found between you and the other user!
   → Create a match in /test-contract first
```

**Fix:** Tạo match trong `/test-contract` → Section "2. Create Match"

### Case 3: Match chưa active
```
⚠️  WARNING: Match is not active!
   → Activate the match (set status = 1) before creating chat
```

**Fix:** Activate match trong `/test-contract` → Section "2b. Activate Match"

### Case 4: Chưa có Chat Room
```
❌ ERROR: Chat room not found!
   → Create a chat room from the match in /test-contract
```

**Fix:** Tạo chat room trong `/test-contract` → Section "3. Create Chat from Match"

### Case 5: Thiếu Chat Allowlist
```
⚠️  WARNING: Chat allowlist not found in events!
   → You may need to create it manually
```

**Fix:**
- Thường auto-create khi tạo chat
- Nếu không có, dùng section "7. Create Chat Allowlist" trong `/test-contract`

## 📊 Các Scripts Debug Khác

### List tất cả chats của bạn
```bash
npx tsx scripts/list-user-chats.ts <YOUR_WALLET>
```

Kết quả:
```
✅ Found 2 chat room(s)

Chat #1
────────────────────────────────────────────────────────────────────────────────
Chat Room ID: 0x1234...
Participant A: 0xabc...
Participant B: 0xdef...
Other User: 0xdef...
Match ID: 0x5678...
ChatAllowlist ID: 0x9abc...
Total Messages: 5
```

### Tìm chat từ Match ID
```bash
npx tsx scripts/find-chatroom-from-match.ts <MATCH_ID>
```

Kết quả:
```
✅ FOUND ChatRoom!
Chat Room ID: 0x1234...
Participant A: 0xabc...
Participant B: 0xdef...
✅ ChatAllowlist ID: 0x9abc...
```

## 🎯 Complete Workflow để Fix

```bash
# 1. Debug để xem thiếu gì
npx tsx scripts/debug-chat-connection.ts 0xYOUR_WALLET 0xOTHER_WALLET

# 2. Nếu thiếu profile → Tạo profile
# Go to /test-contract → Create Profile

# 3. Nếu thiếu match → Tạo match
# Go to /test-contract → Create Match
# Copy Match ID từ transaction result

# 4. Activate match
# Go to /test-contract → Activate Match
# Paste Match ID, click Activate

# 5. Tạo chat room
# Go to /test-contract → Create Chat from Match
# Paste Profile ID và Match ID, click Create

# 6. Verify bằng script
npx tsx scripts/debug-chat-connection.ts 0xYOUR_WALLET 0xOTHER_WALLET

# Should see:
# ✅ ALL CHECKS PASSED - You should be able to send messages!
```

## 🐛 UI Debug Tool

Ngoài scripts, bạn cũng có thể dùng UI tool:

1. Mở `/test-contract`
2. Scroll xuống section **"🐛 Detailed Debug"** (border đỏ)
3. Nhập wallet address của người kia
4. Click "Start Debug"
5. Xem từng bước check

Tool này sẽ hiển thị:
- ✅ Steps thành công (màu xanh)
- ❌ Steps thất bại (màu đỏ)
- ⚠️ Warnings (màu vàng)

## 📝 Manual Check Checklist

Nếu không dùng scripts, check manually:

### 1. Check Profile
```typescript
// Your profile
const myProfile = await getProfileIdByAddress(client, myWallet);
console.log("My Profile:", myProfile); // Should not be null

// Other user's profile
const otherProfile = await getProfileIdByAddress(client, otherWallet);
console.log("Other Profile:", otherProfile); // Should not be null
```

### 2. Check Match
```typescript
const matchId = await getMatchIdBetweenUsers(client, myWallet, otherWallet);
console.log("Match ID:", matchId); // Should not be null

if (matchId) {
  const matchInfo = await getMatchInfo(client, matchId);
  console.log("Match Status:", matchInfo.status); // Should be 1 (ACTIVE)
}
```

### 3. Check Chat Room
```typescript
const chatRoomId = await getChatRoomIdByMatchId(client, matchId);
console.log("Chat Room ID:", chatRoomId); // Should not be null
```

### 4. Check Allowlist
```typescript
const allowlistId = await getChatAllowlistIdByChatRoomId(client, chatRoomId);
console.log("Allowlist ID:", allowlistId); // Should not be null
```

## 🔍 Common Issues và Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| No Profile | `getProfileIdByAddress()` returns null | Create profile in /test-contract |
| No Match | `getMatchIdBetweenUsers()` returns null | Create match between 2 users |
| Match not active | Match status ≠ 1 | Activate match (set status = 1) |
| No Chat Room | `getChatRoomIdByMatchId()` returns null | Create chat from match |
| No Allowlist | `getChatAllowlistIdByChatRoomId()` returns null | Should auto-create, or create manually |
| Wrong wallet | All checks fail | Verify wallet addresses are correct |

## 💡 Tips

1. **Check trong /test-contract**: Có sẵn UI để test từng bước
2. **Use scripts**: Scripts nhanh hơn và chính xác hơn
3. **Check events**: Nếu scripts không tìm thấy, có thể object được tạo lâu rồi (events có limit 50-100)
4. **Check transaction**: Mỗi khi tạo object, save transaction digest để check sau

## 🔗 Related Files

- Query functions: `/src/lib/blockchain/contractQueries.ts`
- UI Finder: `/src/components/blockchain/WalletProfileFinder.tsx`
- UI Debugger: `/src/components/blockchain/DetailedChatDebugger.tsx`
- Test page: `/src/app/test-contract/page.tsx`
- Debug scripts: `/scripts/debug-chat-connection.ts`

## 📞 Need More Help?

Nếu vẫn không work sau khi:
1. Chạy debug script
2. Follow tất cả suggestions
3. Verify từng bước

→ Check console logs trong browser/terminal để xem error message chi tiết
→ Verify contract deployment IDs trong `/src/lib/blockchain/contractQueries.ts`
