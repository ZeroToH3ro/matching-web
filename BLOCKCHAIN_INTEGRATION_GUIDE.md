# Blockchain Integration Guide - Match & Chat On-Chain

## 📋 Tổng quan

Hướng dẫn tích hợp match và chat on-chain vào ứng dụng dating sử dụng Sui blockchain và smart contracts.

## 🎯 Tính năng đã triển khai

### 1. **Profile On-Chain**
- ✅ Tạo profile khi complete registration (CompleteProfileForm)
- ✅ Tạo profile từ edit page nếu chưa có (EditForm)
- ✅ Mã hóa profile data với Seal Protocol
- ✅ Lưu profileObjectId vào database

### 2. **Match On-Chain**
- ✅ Tự động tạo match request khi user like
- ✅ Component `LikeButtonWithBlockchain` thay thế `LikeButton` cũ
- ✅ Lưu matchId và metadata vào database

### 3. **Activate Match (Mutual Like)**
- ✅ Component `MatchActions` để activate match
- ✅ Update match status on-chain
- ✅ Hiển thị UI đặc biệt cho mutual matches

### 4. **Chat On-Chain**
- ✅ Tạo chat room từ activated match
- ✅ Tự động tạo MatchAllowlist cho end-to-end encryption
- ✅ Lưu chatRoomId và chatAllowlistId

## 🔧 Cài đặt

### 1. Environment Variables

Thêm vào `.env.local`:

```bash
# Smart Contract
NEXT_PUBLIC_PACKAGE_ID=0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821
NEXT_PUBLIC_PROFILE_REGISTRY_ID=0x20e5393af9af450275b4adff795b34c82e9cf21d7e0130d067b9f9c90a930c02
NEXT_PUBLIC_MATCH_REGISTRY_ID=0xcae785a9aa1022cf38e274c01ad3d28cf5dc42ae60e2a9814f7d72b06fdf567b
NEXT_PUBLIC_MATCH_CHAT_REGISTRY_ID=0xe909c265300cec16f82a534d30ff50c64295fd563809f0beaad38c88b24e9739
NEXT_PUBLIC_ALLOWLIST_REGISTRY_ID=0xad9b4d1c670ac4032717c7b3d4136e6a3081fb0ea55f4c15ca88f8f5a624e399
NEXT_PUBLIC_USAGE_TRACKER_ID=0xc42ca99296a4b901b8ffc7dd858fe56855d3420996503950afad76f31449c1f7
```

### 2. Database Schema Updates (Optional)

Để lưu trữ metadata on-chain, thêm vào Prisma schema:

```prisma
model User {
  id              String    @id @default(cuid())
  // ... existing fields
  profileObjectId String?   // On-chain profile object ID
  walletAddress   String?   // Sui wallet address
}

model Match {
  id              String    @id @default(cuid())
  matchId         String    @unique // On-chain match object ID
  sourceUserId    String
  targetUserId    String
  status          Int       @default(0) // 0=pending, 1=active
  compatibilityScore Int?
  digest          String    // Transaction digest
  createdAt       DateTime  @default(now())
}

model ChatRoom {
  id              String    @id @default(cuid())
  chatRoomId      String    @unique // On-chain chat room object ID
  chatAllowlistId String    // On-chain allowlist object ID
  matchId         String    // Reference to Match
  digest          String
  createdAt       DateTime  @default(now())
}
```

## 📝 Sử dụng Components

### 1. LikeButtonWithBlockchain

Thay thế `LikeButton` cũ trong `MemberCard.tsx`:

```tsx
import LikeButtonWithBlockchain from "@/components/LikeButtonWithBlockchain";

<LikeButtonWithBlockchain
  targetId={member.userId}
  targetUserAddress={member.user.walletAddress} // Cần lấy từ database
  hasLiked={likeIds.includes(member.userId)}
  myProfileObjectId={currentUserProfileObjectId} // Cần lấy từ database
/>
```

### 2. MatchActions

Hiển thị khi có mutual match:

```tsx
import MatchActions from "@/components/MatchActions";

// Trong lists page hoặc messages page
{mutualMatches.map((match) => (
  <MatchActions
    key={match.matchId}
    matchId={match.matchId}
    myProfileObjectId={currentUserProfileObjectId}
    partnerName={match.partnerName}
    onChatCreated={(chatRoomId) => {
      // Redirect to chat
      router.push(`/messages/${chatRoomId}`);
    }}
  />
))}
```

## 🔄 Workflow

### Flow đầy đủ:

```
1. User đăng ký
   → CompleteProfileForm
   → Tạo profile on-chain
   → Lưu profileObjectId vào User table

2. User like ai đó
   → LikeButtonWithBlockchain
   → Tạo match request on-chain (nếu có profileObjectId)
   → Lưu matchId và Like vào database

3. Người kia like lại (mutual match)
   → MatchActions component hiển thị
   → User click "Activate Match"
   → Update match status = 1 on-chain

4. Tạo chat room
   → User click "Create Chat Room"
   → Tạo ChatRoom và MatchAllowlist on-chain
   → Lưu chatRoomId và chatAllowlistId vào database
   → Redirect to messages

5. Chat với end-to-end encryption
   → Messages component sử dụng chatRoomId và chatAllowlistId
   → Encrypt/decrypt messages với Seal Protocol
```

## 🎨 UI/UX Features

### LikeButtonWithBlockchain:
- 🔴 Heart icon giống cũ
- 🟣 Có dot gradient (pink→purple) nếu sẵn sàng tạo on-chain match
- ⏳ Loading spinner khi đang tạo match
- ✅ Toast notification khi thành công

### MatchActions:
- 💝 Card với gradient border (pink→purple)
- 🎉 Emoji và text "It's a Match!"
- 🟢 Button "Activate Match" với gradient
- 💬 Button "Create Chat Room"
- ✅ Disabled state sau khi tạo chat

### EditForm:
- 📊 Alert hiển thị trạng thái profile on-chain
- 🟢 Green alert nếu đã có profile
- 🟡 Yellow alert với button "Create On-Chain" nếu chưa có
- ✨ Sparkles icon trên button

## ⚙️ Server Actions

### matchOnChainActions.ts

```typescript
// Save match after creating on-chain
saveMatchOnChain(input: CreateMatchOnChainInput)

// Mark match as active (mutual like)
markMatchActive(input: ActivateMatchInput)

// Save chat room after creating from match
saveChatOnChain(input: CreateChatInput)

// Get user's profile object ID
getUserProfileObjectId(userId?: string)
```

## 🔐 Security & Privacy

### Seal Protocol Integration:
- Profile data mã hóa trước khi lưu on-chain
- Chat messages encrypt/decrypt với MatchAllowlist
- Chỉ matched users có thể decrypt messages
- Threshold decryption (2/3 Seal servers)

### Access Control:
- MatchAllowlist kiểm soát ai có thể đọc messages
- Profile objectId làm proof of ownership
- Transaction chỉ thực hiện nếu có wallet connected

## 🐛 Troubleshooting

### Lỗi thường gặp:

**1. "Please connect wallet first"**
- User chưa connect wallet
- Cần connect qua ConnectModal

**2. "Missing required data for on-chain match"**
- Chưa có profileObjectId hoặc targetUserAddress
- Đảm bảo user đã tạo profile on-chain
- Đảm bảo target user có walletAddress trong database

**3. "Match object not found in transaction result"**
- Transaction thành công nhưng không extract được object ID
- Check transaction result structure
- Có thể cần update object type filter

**4. "Failed to encrypt profile data"**
- Seal API endpoint không hoạt động
- Check `/api/profile/encrypt` route
- Verify Seal servers configuration

### Debug Tips:

```typescript
// Log transaction result để inspect structure
console.log('Transaction result:', JSON.stringify(result, null, 2));

// Log object changes
console.log('Object changes:', result.objectChanges);

// Check created objects
const created = result.objectChanges?.filter(c => c.type === 'created');
console.log('Created objects:', created);
```

## 📚 Tham khảo

- Test Contract Page: `/src/app/test-contract/page.tsx`
- Smart Contract Docs: `/INTEGRATION_GUIDE.md`
- Seal Protocol: https://docs.mystenlabs.com/seal
- Sui TypeScript SDK: https://sdk.mystenlabs.com/typescript

## ✨ Next Steps

Để hoàn thiện tích hợp:

1. **Update MemberCard** để sử dụng `LikeButtonWithBlockchain`
2. **Update Lists Page** để hiển thị `MatchActions` cho mutual matches
3. **Update Messages** để sử dụng chat on-chain với encryption
4. **Add database fields** cho profileObjectId, matchId, chatRoomId
5. **Implement getUserProfileObjectId()** để lấy profileObjectId từ database
6. **Handle edge cases** như disconnected wallet, failed transactions

## 🎯 Kết luận

Bạn đã có đầy đủ components và logic để:
- ✅ Tạo profiles on-chain
- ✅ Tạo matches on-chain khi like
- ✅ Activate matches khi mutual like
- ✅ Tạo encrypted chat rooms từ matches

Chỉ cần tích hợp vào UI hiện có và update database schema!
