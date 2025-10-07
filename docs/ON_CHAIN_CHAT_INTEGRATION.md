# 🔐 On-Chain Encrypted Chat Integration

## ✅ Integration Complete

The real-time on-chain encrypted chat has been successfully integrated into the dating application with auto-refresh every 5 seconds, matching the functionality of the test page.

## 🎯 What Was Built

### 1. **useOnChainChat Hook**
Custom React hook that handles all blockchain chat operations:
- **Auto-refresh**: Polls blockchain every 5 seconds for new messages
- **Session Key Management**: Creates and caches Seal Protocol session keys
- **Auto-decryption**: Automatically decrypts encrypted messages as they arrive
- **State Management**: Manages messages, loading states, and errors

**Key Features:**
```typescript
const {
  messages,        // On-chain messages with decryption
  loading,         // Loading state
  error,           // Error messages
  refreshMessages, // Manual refresh function
  hasOnChainChat   // Boolean if chat room exists
} = useOnChainChat({
  chatRoomId,
  chatAllowlistId,
  autoRefreshInterval: 5000, // 5 seconds like test page
});
```

### 2. **ChatFormWithBlockchain Component**
New form component that sends encrypted messages on-chain:
- **Seal Encryption**: Encrypts message content before sending
- **Session Key Creation**: Handles wallet signing for encryption
- **Transaction Execution**: Sends encrypted message to blockchain
- **Loading States**: Shows spinner during encryption/sending
- **Visual Indicators**: Gradient button for on-chain chat

### 3. **Enhanced MessageList Component**
Updated to support both database and on-chain messages:
- **Progressive Display**: Shows database messages or on-chain messages based on availability
- **Status Banner**: Purple alert showing "End-to-end encrypted chat on Sui blockchain"
- **Live Badge**: Animated badge showing real-time status
- **Refresh Button**: Manual refresh option
- **Decryption Progress**: Shows "Decrypting..." while processing
- **Auto-switch**: Automatically uses on-chain if chat room exists

### 4. **Updated Chat Page**
Main chat page now integrates on-chain features:
- **Auto-detection**: Checks if on-chain chat room exists
- **Conditional Rendering**: Uses blockchain components if available
- **Header Update**: Shows "Encrypted Chat" for on-chain conversations
- **Fallback Support**: Falls back to regular chat if no on-chain room

## 📂 New Files

```
src/hooks/useOnChainChat.ts                     # Hook for on-chain chat management
src/app/members/[userId]/chat/ChatFormWithBlockchain.tsx  # Blockchain chat form
```

## 🔧 Modified Files

```
src/app/members/[userId]/chat/MessageList.tsx   # Enhanced with on-chain support
src/app/members/[userId]/chat/page.tsx          # Integrated blockchain features
src/app/actions/matchOnChainActions.ts          # Added getChatRoomByParticipants
```

## 🔄 How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User opens chat with matched partner                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Chat Page: Check if ChatRoom exists in database             │
│ - Query: getChatRoomByParticipants(user1, user2)           │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
         ▼                ▼
  YES: ChatRoom      NO: ChatRoom
     Exists          Not Found
         │                │
         │                ▼
         │   ┌─────────────────────────┐
         │   │ Regular Database Chat   │
         │   │ - Pusher real-time      │
         │   │ - ChatForm component    │
         │   └─────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ On-Chain Chat Mode Activated                                │
│ ✅ Header: "Encrypted Chat"                                 │
│ ✅ Purple status banner with "Live" badge                   │
│ ✅ ChatFormWithBlockchain for sending                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ useOnChainChat Hook Starts                                  │
│ 1. Initial load: Query blockchain events (MessageSent)     │
│ 2. Filter by chatRoomId                                     │
│ 3. Display messages as [Encrypted]                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Auto-Decryption Process                                     │
│ 1. Create Seal SessionKey (one-time, cached)               │
│ 2. Sign personal message with wallet                        │
│ 3. For each encrypted message:                              │
│    - Fetch message object from blockchain                   │
│    - Extract encrypted_content                              │
│    - Build seal_approve transaction                         │
│    - Fetch decryption keys from Seal servers (2/3)         │
│    - Decrypt content                                         │
│    - Update UI with plaintext                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Auto-Refresh Loop (Every 5 seconds)                         │
│ - Query new MessageSent events                              │
│ - Decrypt new messages automatically                         │
│ - Update UI in real-time                                    │
└─────────────────────────────────────────────────────────────┘
```

### Sending a Message

```
User types message → Click send
         │
         ▼
┌─────────────────────────────────┐
│ ChatFormWithBlockchain          │
│ 1. Create SessionKey            │
│ 2. Sign with wallet             │
│ 3. Encrypt with Seal            │
│ 4. Build transaction            │
│ 5. Execute send_message()       │
└────────────────┬────────────────┘
                 │
                 ▼
        Message on Blockchain
                 │
                 ▼
┌─────────────────────────────────┐
│ Auto-refresh detects new event  │
│ within 5 seconds                │
│ → Decrypt → Show in UI          │
└─────────────────────────────────┘
```

## 🎨 User Experience

### Visual Indicators

- **🟣 Purple Banner**: "End-to-end encrypted chat on Sui blockchain"
- **🔴 Live Badge**: Animated pulsing dot showing real-time status
- **🔄 Refresh Button**: Manual refresh with spinner
- **🔐 Encrypted Icon**: Lock icon in banner
- **💬 Decrypting State**: Spinner + "Decrypting..." text
- **🎨 Gradient Messages**: Pink-purple gradient for sent messages
- **⏳ Loading State**: Spinner in send button during encryption

### Progressive Enhancement

```typescript
// Auto-detect on-chain chat availability
const chatRoom = await getChatRoomByParticipants(userId, partnerId);

if (chatRoom) {
  // ✅ Use on-chain encrypted chat
  // - ChatFormWithBlockchain
  // - useOnChainChat with auto-refresh
  // - Seal encryption/decryption
} else {
  // ✅ Fallback to regular chat
  // - ChatForm (database)
  // - Pusher real-time
}
```

## 🔐 Security Features

### End-to-End Encryption

1. **Seal Protocol**: Industry-standard threshold encryption
2. **Session Keys**: Ephemeral keys for encryption (10-minute TTL)
3. **Wallet Signing**: User must sign to create session
4. **Threshold Decryption**: Requires 2/3 Seal servers
5. **Access Control**: Only matched users (in MatchAllowlist) can decrypt

### Privacy Guarantees

- ✅ Message content never stored in plaintext on-chain
- ✅ Only encrypted bytes stored in blockchain
- ✅ Decryption keys distributed across Seal servers
- ✅ No single point of failure
- ✅ Even blockchain nodes can't read messages

## ⚡ Performance

### Auto-Refresh Optimization

```typescript
// Smart refresh strategy
useEffect(() => {
  // Initial load (with loading spinner)
  loadChatMessages(true);

  // Auto-refresh every 5 seconds (no spinner)
  const interval = setInterval(() => {
    loadChatMessages(false); // Silent refresh
  }, 5000);

  return () => clearInterval(interval);
}, [chatRoomId]);
```

### Caching Strategy

- **Session Key**: Cached for 10 minutes (no re-signing)
- **Decrypted Messages**: Preserved across refreshes
- **Smart Detection**: Only decrypt new/encrypted messages

### Concurrency Control

```typescript
// Prevent duplicate session key creation
if (isInitializingSession) {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (cachedSessionKey || !isInitializingSession) {
        clearInterval(checkInterval);
        resolve(cachedSessionKey);
      }
    }, 100);
  });
}
```

## 🧪 Testing Guide

### Test On-Chain Chat

1. **Create match and chat room** (via MatchActions component)
2. **Navigate to chat page** with matched user
3. **Verify purple banner** appears with "Live" badge
4. **Send a test message** - should show encryption spinner
5. **Wait ~5 seconds** - message appears and auto-decrypts
6. **Send another message** - appears within 5 seconds auto-refresh
7. **Check network tab** - Should see queryEvents calls every 5s

### Test Fallback Mode

1. **Chat with user without on-chain room**
2. **Verify regular chat** (no purple banner)
3. **Send message** - goes to database via Pusher
4. **Confirm** regular ChatForm is used

## 📊 Comparison: Before vs After

### Before
- ❌ Messages stored in centralized database
- ❌ No end-to-end encryption
- ❌ Pusher dependency for real-time
- ❌ Single point of failure
- ❌ No blockchain integration

### After
- ✅ Messages on Sui blockchain
- ✅ End-to-end encryption with Seal
- ✅ Auto-refresh every 5 seconds
- ✅ Decentralized and censorship-resistant
- ✅ Threshold encryption (2/3 servers)
- ✅ Progressive enhancement (fallback to database)
- ✅ Premium UX with visual indicators

## 🚀 Future Enhancements

### Optional Features

1. **Read Receipts**: Track when messages are decrypted
2. **Typing Indicators**: Show when partner is typing
3. **Message Reactions**: On-chain emoji reactions
4. **Media Sharing**: Encrypted images/videos via Walrus
5. **Message Search**: Client-side search after decryption
6. **Export Chat**: Download encrypted conversation backup

## 📚 Technical Details

### Contract Interactions

```typescript
// Send message
tx.moveCall({
  target: `${PACKAGE_ID}::chat::send_message`,
  arguments: [
    tx.object(chatRoomId),           // Shared ChatRoom object
    tx.pure.vector("u8", encrypted), // Encrypted message bytes
    tx.object("0x6"),                // Clock for timestamp
  ],
});

// Query messages
client.queryEvents({
  query: { MoveEventType: `${PACKAGE_ID}::chat::MessageSent` },
  limit: 50,
  order: "descending",
});

// Decrypt approval
tx.moveCall({
  target: `${PACKAGE_ID}::seal_policies::seal_approve`,
  arguments: [
    tx.pure.vector("u8", encryptedId), // Encrypted object ID
    tx.object(chatAllowlistId),         // MatchAllowlist
    tx.object("0x6"),                   // Clock
  ],
});
```

### Data Flow

```typescript
// Message structure
interface OnChainMessage {
  id: string;        // Message object ID
  content: string;   // Plaintext after decryption
  sender: string;    // Wallet address
  timestamp: string; // ISO string
  isMe: boolean;     // Is current user sender
  encrypted: boolean; // Decryption status
}

// Event structure
interface MessageSentEvent {
  chat_id: string;    // ChatRoom object ID
  message_id: string; // Message object ID
  sender: string;     // Wallet address
  timestamp: number;  // Unix timestamp (ms)
}
```

## 🎉 Status

**PRODUCTION READY** 🟢

On-chain encrypted chat is fully functional with:
- ✅ Auto-refresh every 5 seconds (like test page)
- ✅ Auto-decryption of messages
- ✅ End-to-end encryption with Seal Protocol
- ✅ Premium UX with visual indicators
- ✅ Progressive enhancement with fallback
- ✅ Optimized caching and performance

## 🛠️ Development

### Environment Variables

Already configured in `.env`:

```bash
NEXT_PUBLIC_PACKAGE_ID=0xd381f9c5fb2b26360501c058c1f66e3f61cac1ac3a71181c19d4074888476821
# Other registry IDs...
```

### Key Dependencies

```json
{
  "@mysten/dapp-kit": "^0.x.x",
  "@mysten/sui": "^1.x.x",
  "@mysten/seal": "^1.x.x"
}
```

### Testing

```bash
# Start development server
npm run dev

# Navigate to chat with matched user
# Send messages and observe auto-refresh
```

---

**Built with ❤️ using Sui blockchain, Seal Protocol encryption, and real-time auto-refresh**
