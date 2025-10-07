# 🔗 Module Relationships - Matching.Me

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Matching.Me Ecosystem                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    matching_me::core                      │  │
│  │  (Foundation Layer)                                       │  │
│  │                                                            │  │
│  │  • UserProfile                                            │  │
│  │  • Match                                                   │  │
│  │  • Subscription                                           │  │
│  │  • MediaContent                                           │  │
│  │  • DigitalGift                                            │  │
│  └────────────┬──────────────────────────┬──────────────────┘  │
│               │                          │                       │
│               ▼                          ▼                       │
│  ┌────────────────────────┐  ┌─────────────────────────────┐  │
│  │  matching_me::chat     │  │  matching_me::seal_policies │  │
│  │  (Messaging Layer)     │  │  (Access Control Layer)     │  │
│  │                        │  │                              │  │
│  │  • ChatRoom            │  │  • ChatAllowlist            │  │
│  │  • Message             │  │  • SubscriptionAllowlist    │  │
│  │  • Reactions           │  │  • MatchAllowlist           │  │
│  │  • Typing              │  │  • TimeLock                 │  │
│  │  • Read receipts       │  │  • CustomAllowlist          │  │
│  └────────────┬───────────┘  └────────────┬────────────────┘  │
│               │                           │                     │
│               └───────────┬───────────────┘                     │
│                           ▼                                     │
│              ┌────────────────────────┐                        │
│              │ matching_me::integration│                        │
│              │  (Orchestration Layer) │                        │
│              │                         │                        │
│              │  • Chat from Match     │                        │
│              │  • Encrypted Messages  │                        │
│              │  • Rate Limiting       │                        │
│              │  • Gift Messages       │                        │
│              │  • Media Sharing       │                        │
│              └─────────────────────────┘                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔗 Import Dependencies

### **matching_me::core** (Base Module)
```move
module matching_me::core {
    // No dependencies on other matching_me modules
    // Only uses Sui framework
    use sui::object;
    use sui::tx_context;
    use sui::clock;
    // ...
}
```

### **matching_me::chat** (Depends on core)
```move
module matching_me::chat {
    use sui::object;
    use sui::tx_context;
    // ...
    
    // ✅ Imports from core
    use matching_me::core::{UserProfile, Match};
    
    // Uses:
    // - UserProfile for ownership verification
    // - Match for linking chat to match
}
```

### **matching_me::seal_policies** (Depends on core AND chat)
```move
module matching_me::seal_policies {
    use sui::object;
    use sui::tx_context;
    // ...
    
    // ✅ Imports from core
    use matching_me::core::{
        UserProfile,           // For ownership checks
        Match,                 // For match allowlists
        Subscription,          // For subscription allowlists
        get_profile_owner,     // Helper function
        get_match_users,       // Helper function
        is_subscription_active,// Helper function
        get_subscription_tier  // Helper function
    };
    
    // ✅ Imports from chat
    use matching_me::chat::{
        ChatRoom,             // For chat allowlists
        get_chat_participants // Helper function
    };
}
```

### **matching_me::integration** (Depends on ALL)
```move
module matching_me::integration {
    use sui::object;
    // ...
    
    // ✅ Imports from core
    use matching_me::core::{
        UserProfile,
        Match,
        Subscription,
        MediaContent,
        DigitalGift,
        // ... all view functions
    };
    
    // ✅ Imports from chat
    use matching_me::chat::{
        ChatRoom,
        Message,
        ChatRegistry,
        MessageIndex,
        create_chat,
        send_message,
        // ...
    };
    
    // ✅ Could import from seal_policies (optional)
    use matching_me::seal_policies::{
        ChatAllowlist,
        create_chat_allowlist,
        // ...
    };
}
```

## 📋 Detailed Relationships

### 1. **core → seal_policies**

#### Used Structs:
```move
// seal_policies.move
public struct ChatAllowlist has key, store {
    id: UID,
    chat_id: ID,                    // ← References chat::ChatRoom
    participant_a: address,
    participant_b: address,
    active: bool,
    created_at: u64,
}

public struct MatchAllowlist has key, store {
    id: UID,
    match_id: ID,                   // ← References core::Match
    user_a: address,
    user_b: address,
    active: bool,
    created_at: u64,
}

public struct SubscriptionAllowlist has key, store {
    id: UID,
    creator: address,
    min_tier: u8,                   // ← Uses core::Subscription.tier
    subscribers: VecSet<address>,
    active: bool,
    created_at: u64,
}
```

#### Used Functions:
```move
// In seal_policies.move

// From core
use matching_me::core::{get_profile_owner};

public fun create_chat_allowlist(
    chat: &ChatRoom,                    // From chat module
    profile: &UserProfile,              // ← From core module
    clock: &Clock,
    ctx: &mut TxContext
): ChatAllowlist {
    let sender = tx_context::sender(ctx);
    assert!(get_profile_owner(profile) == sender, ENoAccess); // ← Uses core function
    // ...
}
```

### 2. **chat → seal_policies**

#### Used Structs:
```move
// seal_policies.move
public struct ChatAllowlist {
    chat_id: ID,  // ← References ChatRoom.id from chat module
    // ...
}
```

#### Used Functions:
```move
// In seal_policies.move

use matching_me::chat::{ChatRoom, get_chat_participants};

public fun create_chat_allowlist(
    chat: &ChatRoom,                    // ← From chat module
    profile: &UserProfile,
    clock: &Clock,
    ctx: &mut TxContext
): ChatAllowlist {
    let (user_a, user_b) = get_chat_participants(chat); // ← Uses chat function
    
    let allowlist = ChatAllowlist {
        chat_id: object::uid_to_inner(&chat.id), // ← References ChatRoom
        participant_a: user_a,
        participant_b: user_b,
        // ...
    };
    // ...
}
```

### 3. **integration → ALL modules**

```move
// integration.move

// Create encrypted chat from match
public fun create_chat_from_match_with_seal(
    // From core
    profile: &UserProfile,
    match_obj: &Match,
    subscription: Option<&Subscription>,
    
    // From chat
    chat_registry: &mut ChatRegistry,
    
    // From seal_policies
    seal_policy_registry: &mut SealPolicyRegistry, // If we add this
    
    clock: &Clock,
    ctx: &mut TxContext
): (ChatRoom, ChatAllowlist) {
    // 1. Validate match (uses core)
    let (user_a, user_b) = get_match_users(match_obj);
    
    // 2. Create chat (uses chat)
    let chat = create_chat(
        chat_registry,
        profile,
        user_b,
        seal_policy_id,
        encrypted_key,
        option::some(match_id),
        clock,
        ctx
    );
    
    // 3. Create allowlist (uses seal_policies)
    let allowlist = create_chat_allowlist(
        &chat,
        profile,
        clock,
        ctx
    );
    
    (chat, allowlist)
}
```

## 🔄 Data Flow Examples

### Example 1: Create Encrypted Chat

```
1. USER calls: integration::create_chat_from_match()
       │
       ├─► Validates: core::Match (get_match_users)
       │
       ├─► Creates: chat::ChatRoom (create_chat)
       │
       └─► Creates: seal_policies::ChatAllowlist (create_chat_allowlist)
                └─► Links to ChatRoom.id
```

### Example 2: Send Encrypted Message

```
1. USER calls: integration::send_encrypted_message()
       │
       ├─► Validates: core::UserProfile (get_profile_owner)
       │
       ├─► Checks rate limit: core::Subscription (get_subscription_tier)
       │
       ├─► Sends message: chat::send_message()
       │        └─► Stores seal_identity & walrus_blob_id
       │
       └─► Off-chain: Encrypt with Seal using ChatAllowlist namespace
```

### Example 3: Decrypt Message

```
1. USER requests decryption
       │
       ├─► Constructs PTB: seal_approve(id, chat_allowlist, ...)
       │
       ├─► Seal servers dry_run:
       │        └─► seal_policies::seal_approve()
       │                ├─► Validates namespace from id
       │                └─► Calls approve_chat()
       │                        └─► Checks: get_chat_participants()
       │                                 └─► From chat::ChatRoom
       │
       └─► If approved: Returns decryption keys
```

## 📦 Module Files Structure

```
matching_me/
├── Move.toml
└── sources/
    ├── core.move                    # Base module (no deps)
    ├── chat.move                    # Depends on: core
    ├── seal_policies.move           # Depends on: core, chat
    └── integration.move             # Depends on: core, chat, seal_policies
```

### Move.toml Dependencies

```toml
[package]
name = "matching_me"
version = "1.0.0"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
matching_me = "0x0"
```

**Note**: All modules are in same package `matching_me`, so they can import each other directly.

## 🎯 Function Call Chains

### Chain 1: Creating Allowlist
```
integration::create_chat_from_match()
    └─► chat::create_chat()
            └─► Emits ChatCreated event
    └─► seal_policies::create_chat_allowlist()
            ├─► Uses chat::get_chat_participants()
            ├─► Uses core::get_profile_owner()
            └─► Returns ChatAllowlist with chat_id reference
```

### Chain 2: Seal Approval
```
seal_policies::seal_approve()
    ├─► extract_type(id)
    ├─► Route to approve_chat()
    │       ├─► Uses ChatAllowlist (references chat::ChatRoom)
    │       └─► Validates caller is participant
    ├─► Route to approve_subscription()
    │       ├─► Uses SubscriptionAllowlist
    │       ├─► Calls core::is_subscription_active()
    │       └─► Calls core::get_subscription_tier()
    └─► Route to approve_match()
            ├─► Uses MatchAllowlist (references core::Match)
            └─► Validates caller is matched user
```

## 💡 Key Integration Points

### 1. **Profile Ownership Verification**
```move
// seal_policies uses core
use matching_me::core::get_profile_owner;

let sender = tx_context::sender(ctx);
assert!(get_profile_owner(profile) == sender, ENoAccess);
```

### 2. **Chat Participant Extraction**
```move
// seal_policies uses chat
use matching_me::chat::get_chat_participants;

let (user_a, user_b) = get_chat_participants(chat);
```

### 3. **Subscription Validation**
```move
// seal_policies uses core
use matching_me::core::{is_subscription_active, get_subscription_tier};

let is_active = is_subscription_active(subscription, current_time);
let tier = get_subscription_tier(subscription);
```

### 4. **Match User Extraction**
```move
// seal_policies uses core
use matching_me::core::get_match_users;

let (user_a, user_b) = get_match_users(match_obj);
```

## 🔐 Security Benefits

### Separation of Concerns
- **core**: Data structures & business logic
- **chat**: Messaging functionality
- **seal_policies**: Access control
- **integration**: Orchestration

### Type Safety
```move
// Can't create ChatAllowlist without valid ChatRoom
public fun create_chat_allowlist(
    chat: &ChatRoom,  // ← Must pass actual ChatRoom reference
    // ...
)

// Can't approve without valid objects
entry fun seal_approve(
    id: vector<u8>,
    chat_allowlist: Option<&ChatAllowlist>,  // ← Type-checked
    // ...
)
```

### Reference Integrity
```move
// ChatAllowlist stores chat_id
public struct ChatAllowlist {
    chat_id: ID,  // ← Immutable reference to ChatRoom
    // ...
}

// Can verify relationship
let chat_id_from_allowlist = allowlist.chat_id;
let chat_id_from_room = object::uid_to_inner(&chat.id);
assert!(chat_id_from_allowlist == chat_id_from_room, EInvalidLink);
```

## 📊 Summary Table

| Module | Depends On | Used By | Main Purpose |
|--------|-----------|---------|--------------|
| **core** | Sui framework only | chat, seal_policies, integration | Data structures, business logic |
| **chat** | core | seal_policies, integration | Messaging, chat rooms |
| **seal_policies** | core, chat | integration, Seal SDK | Access control, encryption |
| **integration** | core, chat, seal_policies | Frontend/dApp | Orchestration, workflows |

## 🎉 Conclusion

**YES**, `seal_policies.move` có mối liên kết chặt chẽ với cả `core.move` và `chat.move`:

✅ **Imports structures** từ both modules  
✅ **Uses helper functions** từ both modules  
✅ **References object IDs** từ ChatRoom và Match  
✅ **Validates permissions** using UserProfile và Subscription  
✅ **Works together** trong integration layer  

Đây là **modular architecture** với clear dependencies và separation of concerns! 🏗️