module matching_me::chat {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use std::vector;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use sui::vec_map::{Self, VecMap};
    use matching_me::core::{UserProfile, Match};

    // ===== Error Codes =====

    const EUnauthorized: u64 = 1;
    const EChatNotFound: u64 = 2;
    const EMessageNotFound: u64 = 3;
    const ENotChatParticipant: u64 = 4;
    const EChatAlreadyExists: u64 = 5;
    const EInvalidMessageContent: u64 = 6;
    const EBlockedUser: u64 = 7;
    const EChatExpired: u64 = 8;
    const EInvalidReaction: u64 = 9;
    const EMessageAlreadyDeleted: u64 = 10;
    const EEncryptionRequired: u64 = 11;

    // ===== Constants =====

    const MAX_MESSAGE_LENGTH: u64 = 10000;
    const MAX_PARTICIPANTS: u64 = 2; // Direct messaging only
    const MESSAGE_EXPIRY_MS: u64 = 2592000000; // 30 days

    // Message Types
    const MSG_TYPE_TEXT: u8 = 0;
    const MSG_TYPE_IMAGE: u8 = 1;
    const MSG_TYPE_VIDEO: u8 = 2;
    const MSG_TYPE_AUDIO: u8 = 3;
    const MSG_TYPE_GIFT: u8 = 4;
    const MSG_TYPE_LOCATION: u8 = 5;

    // Chat Status
    const CHAT_STATUS_ACTIVE: u8 = 0;
    const CHAT_STATUS_ARCHIVED: u8 = 1;
    const CHAT_STATUS_BLOCKED: u8 = 2;
    const CHAT_STATUS_DELETED: u8 = 3;

    // Read Status
    const READ_STATUS_SENT: u8 = 0;
    const READ_STATUS_DELIVERED: u8 = 1;
    const READ_STATUS_READ: u8 = 2;

    // ===== Structs =====

    /// Chat Room between two users (encrypted with Seal)
    public struct ChatRoom has key {
        id: UID,
        participant_a: address,
        participant_b: address,
        
        // Seal Protocol Integration
        seal_policy_id: String,  // Seal access policy
        encrypted_key: vector<u8>,  // Encrypted symmetric key
        
        // Match Integration
        match_id: Option<ID>,  // Link to Match object
        
        // Chat Metadata
        created_at: u64,
        last_message_at: u64,
        status: u8,
        
        // Message Management
        total_messages: u64,
        unread_count_a: u64,  // Unread for participant_a
        unread_count_b: u64,  // Unread for participant_b
        
        // Settings
        muted_by: vector<address>,
        typing_indicator_enabled: bool,
        read_receipts_enabled: bool,
        
        // Moderation
        blocked_by: vector<address>,
        reported_count: u64,
    }

    /// Individual Message (stored separately for scalability)
    public struct Message has key, store {
        id: UID,
        chat_id: ID,
        sender: address,
        recipient: address,
        
        // Content (encrypted)
        content_type: u8,
        encrypted_content: vector<u8>,  // Encrypted with Seal
        content_hash: vector<u8>,  // SHA-256 hash for integrity
        
        // Media Reference (Walrus)
        media_blob_id: Option<String>,
        thumbnail_blob_id: Option<String>,
        
        // Metadata
        sent_at: u64,
        delivered_at: Option<u64>,
        read_at: Option<u64>,
        read_status: u8,
        
        // Features
        reply_to: Option<ID>,  // Reply to another message
        forwarded_from: Option<ID>,  // Forwarded message
        edited: bool,
        edited_at: Option<u64>,
        deleted: bool,
        deleted_at: Option<u64>,
        
        // Reactions
        reactions: VecMap<address, String>,  // user -> emoji
        
        // Expiry (disappearing messages)
        expires_at: Option<u64>,
    }

    /// Global Chat Registry for efficient querying
    public struct ChatRegistry has key {
        id: UID,
        user_chats: Table<address, vector<ID>>,  // User's chat room IDs
        total_chats: u64,
        total_messages: u64,
    }

    /// Message Index for pagination and search
    public struct MessageIndex has key {
        id: UID,
        chat_messages: Table<ID, vector<ID>>,  // Chat ID -> Message IDs
    }

    /// Typing Indicator (ephemeral state)
    public struct TypingIndicator has copy, drop, store {
        user: address,
        chat_id: ID,
        timestamp: u64,
    }

    /// Read Receipt
    public struct ReadReceipt has copy, drop, store {
        message_id: ID,
        reader: address,
        read_at: u64,
    }

    /// Encryption Metadata
    public struct EncryptionMeta has store, copy, drop {
        algorithm: String,  // "AES-256-GCM"
        key_version: u64,
        nonce: vector<u8>,
    }

    // ===== Events =====

    public struct ChatCreated has copy, drop {
        chat_id: ID,
        participant_a: address,
        participant_b: address,
        match_id: Option<ID>,
        seal_policy_id: String,
        timestamp: u64,
    }

    public struct MessageSent has copy, drop {
        message_id: ID,
        chat_id: ID,
        sender: address,
        recipient: address,
        content_type: u8,
        timestamp: u64,
        has_media: bool,
    }

    public struct MessageDelivered has copy, drop {
        message_id: ID,
        chat_id: ID,
        delivered_at: u64,
    }

    public struct MessageRead has copy, drop {
        message_id: ID,
        chat_id: ID,
        reader: address,
        read_at: u64,
    }

    public struct MessageEdited has copy, drop {
        message_id: ID,
        chat_id: ID,
        editor: address,
        edited_at: u64,
    }

    public struct MessageDeleted has copy, drop {
        message_id: ID,
        chat_id: ID,
        deleted_by: address,
        deleted_at: u64,
    }

    public struct ReactionAdded has copy, drop {
        message_id: ID,
        chat_id: ID,
        user: address,
        reaction: String,
        timestamp: u64,
    }

    public struct ChatBlocked has copy, drop {
        chat_id: ID,
        blocked_by: address,
        timestamp: u64,
    }

    public struct ChatUnblocked has copy, drop {
        chat_id: ID,
        unblocked_by: address,
        timestamp: u64,
    }

    public struct TypingStarted has copy, drop {
        chat_id: ID,
        user: address,
        timestamp: u64,
    }

    public struct TypingStopped has copy, drop {
        chat_id: ID,
        user: address,
        timestamp: u64,
    }

    // ===== Helper Functions =====

    /// Check if user is participant in chat
    fun is_participant(chat: &ChatRoom, user: address): bool {
        chat.participant_a == user || chat.participant_b == user
    }

    /// Check if user has blocked the chat
    fun is_blocked_by(chat: &ChatRoom, user: address): bool {
        vector::contains(&chat.blocked_by, &user)
    }

    /// Check if user has muted the chat
    fun is_muted_by(chat: &ChatRoom, user: address): bool {
        vector::contains(&chat.muted_by, &user)
    }

    /// Get the other participant
    fun get_other_participant(chat: &ChatRoom, user: address): address {
        if (chat.participant_a == user) {
            chat.participant_b
        } else {
            chat.participant_a
        }
    }

    /// Add chat to user's chat list
    fun add_chat_to_registry(
        registry: &mut ChatRegistry,
        user_a: address,
        user_b: address,
        chat_id: ID
    ) {
        // Add to participant A
        if (!table::contains(&registry.user_chats, user_a)) {
            table::add(&mut registry.user_chats, user_a, vector::empty());
        };
        let chats_a = table::borrow_mut(&mut registry.user_chats, user_a);
        vector::push_back(chats_a, chat_id);

        // Add to participant B
        if (!table::contains(&registry.user_chats, user_b)) {
            table::add(&mut registry.user_chats, user_b, vector::empty());
        };
        let chats_b = table::borrow_mut(&mut registry.user_chats, user_b);
        vector::push_back(chats_b, chat_id);

        registry.total_chats = registry.total_chats + 1;
    }

    /// Add message to index
    fun add_message_to_index(
        index: &mut MessageIndex,
        chat_id: ID,
        message_id: ID
    ) {
        if (!table::contains(&index.chat_messages, chat_id)) {
            table::add(&mut index.chat_messages, chat_id, vector::empty());
        };
        let messages = table::borrow_mut(&mut index.chat_messages, chat_id);
        vector::push_back(messages, message_id);
    }

    // ===== Public Functions =====

    /// Create a new chat room with Seal encryption
    public fun create_chat(
        registry: &mut ChatRegistry,
        profile_a: &UserProfile,
        participant_b: address,
        seal_policy_id: String,
        encrypted_key: vector<u8>,
        match_id: Option<ID>,
        clock: &Clock,
        ctx: &mut TxContext
    ): ChatRoom {
        let sender = tx_context::sender(ctx);
        assert!(matching_me::core::get_profile_owner(profile_a) == sender, EUnauthorized);
        assert!(sender != participant_b, EUnauthorized);

        let current_time = clock::timestamp_ms(clock);
        let chat_uid = object::new(ctx);
        let chat_id = object::uid_to_inner(&chat_uid);

        let chat = ChatRoom {
            id: chat_uid,
            participant_a: sender,
            participant_b,
            seal_policy_id,
            encrypted_key,
            match_id,
            created_at: current_time,
            last_message_at: current_time,
            status: CHAT_STATUS_ACTIVE,
            total_messages: 0,
            unread_count_a: 0,
            unread_count_b: 0,
            muted_by: vector::empty(),
            typing_indicator_enabled: true,
            read_receipts_enabled: true,
            blocked_by: vector::empty(),
            reported_count: 0,
        };

        add_chat_to_registry(registry, sender, participant_b, chat_id);

        event::emit(ChatCreated {
            chat_id,
            participant_a: sender,
            participant_b,
            match_id,
            seal_policy_id,
            timestamp: current_time,
        });

        chat
    }

    /// Send an encrypted message
    public fun send_message(
        registry: &mut ChatRegistry,
        index: &mut MessageIndex,
        chat: &mut ChatRoom,
        content_type: u8,
        encrypted_content: vector<u8>,
        content_hash: vector<u8>,
        media_blob_id: Option<String>,
        thumbnail_blob_id: Option<String>,
        reply_to: Option<ID>,
        expires_at: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ): Message {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);
        assert!(chat.status == CHAT_STATUS_ACTIVE, EChatExpired);
        assert!(!is_blocked_by(chat, sender), EBlockedUser);
        assert!(vector::length(&encrypted_content) <= MAX_MESSAGE_LENGTH, EInvalidMessageContent);

        let recipient = get_other_participant(chat, sender);
        let current_time = clock::timestamp_ms(clock);
        
        let message_uid = object::new(ctx);
        let message_id = object::uid_to_inner(&message_uid);

        let message = Message {
            id: message_uid,
            chat_id: object::uid_to_inner(&chat.id),
            sender,
            recipient,
            content_type,
            encrypted_content,
            content_hash,
            media_blob_id,
            thumbnail_blob_id,
            sent_at: current_time,
            delivered_at: option::none(),
            read_at: option::none(),
            read_status: READ_STATUS_SENT,
            reply_to,
            forwarded_from: option::none(),
            edited: false,
            edited_at: option::none(),
            deleted: false,
            deleted_at: option::none(),
            reactions: vec_map::empty(),
            expires_at,
        };

        // Update chat metadata
        chat.last_message_at = current_time;
        chat.total_messages = chat.total_messages + 1;
        
        // Increment unread count for recipient
        if (recipient == chat.participant_a) {
            chat.unread_count_a = chat.unread_count_a + 1;
        } else {
            chat.unread_count_b = chat.unread_count_b + 1;
        };

        // Update registries
        add_message_to_index(index, object::uid_to_inner(&chat.id), message_id);
        registry.total_messages = registry.total_messages + 1;

        event::emit(MessageSent {
            message_id,
            chat_id: object::uid_to_inner(&chat.id),
            sender,
            recipient,
            content_type,
            timestamp: current_time,
            has_media: option::is_some(&media_blob_id),
        });

        message
    }

    /// Mark message as delivered
    public fun mark_delivered(
        message: &mut Message,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(message.recipient == sender, EUnauthorized);
        assert!(option::is_none(&message.delivered_at), EUnauthorized);

        let current_time = clock::timestamp_ms(clock);
        message.delivered_at = option::some(current_time);
        message.read_status = READ_STATUS_DELIVERED;

        event::emit(MessageDelivered {
            message_id: object::uid_to_inner(&message.id),
            chat_id: message.chat_id,
            delivered_at: current_time,
        });
    }

    /// Mark message as read
    public fun mark_read(
        chat: &mut ChatRoom,
        message: &mut Message,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(message.recipient == sender, EUnauthorized);
        assert!(option::is_none(&message.read_at), EUnauthorized);
        assert!(chat.read_receipts_enabled, EUnauthorized);

        let current_time = clock::timestamp_ms(clock);
        message.read_at = option::some(current_time);
        message.read_status = READ_STATUS_READ;

        // Decrement unread count
        if (sender == chat.participant_a) {
            if (chat.unread_count_a > 0) {
                chat.unread_count_a = chat.unread_count_a - 1;
            };
        } else {
            if (chat.unread_count_b > 0) {
                chat.unread_count_b = chat.unread_count_b - 1;
            };
        };

        event::emit(MessageRead {
            message_id: object::uid_to_inner(&message.id),
            chat_id: message.chat_id,
            reader: sender,
            read_at: current_time,
        });
    }

    /// Edit a message (only text messages)
    public fun edit_message(
        message: &mut Message,
        new_encrypted_content: vector<u8>,
        new_content_hash: vector<u8>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(message.sender == sender, EUnauthorized);
        assert!(!message.deleted, EMessageAlreadyDeleted);
        assert!(message.content_type == MSG_TYPE_TEXT, EInvalidMessageContent);
        assert!(vector::length(&new_encrypted_content) <= MAX_MESSAGE_LENGTH, EInvalidMessageContent);

        let current_time = clock::timestamp_ms(clock);
        message.encrypted_content = new_encrypted_content;
        message.content_hash = new_content_hash;
        message.edited = true;
        message.edited_at = option::some(current_time);

        event::emit(MessageEdited {
            message_id: object::uid_to_inner(&message.id),
            chat_id: message.chat_id,
            editor: sender,
            edited_at: current_time,
        });
    }

    /// Delete a message (soft delete)
    public fun delete_message(
        message: &mut Message,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(message.sender == sender, EUnauthorized);
        assert!(!message.deleted, EMessageAlreadyDeleted);

        let current_time = clock::timestamp_ms(clock);
        message.deleted = true;
        message.deleted_at = option::some(current_time);
        
        // Clear encrypted content
        message.encrypted_content = vector::empty();

        event::emit(MessageDeleted {
            message_id: object::uid_to_inner(&message.id),
            chat_id: message.chat_id,
            deleted_by: sender,
            deleted_at: current_time,
        });
    }

    /// Add reaction to message
    public fun add_reaction(
        message: &mut Message,
        reaction: String,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(
            message.sender == sender || message.recipient == sender,
            ENotChatParticipant
        );
        assert!(!message.deleted, EMessageAlreadyDeleted);

        // Remove existing reaction if any
        if (vec_map::contains(&message.reactions, &sender)) {
            let (_, _) = vec_map::remove(&mut message.reactions, &sender);
        };

        // Add new reaction
        vec_map::insert(&mut message.reactions, sender, reaction);

        event::emit(ReactionAdded {
            message_id: object::uid_to_inner(&message.id),
            chat_id: message.chat_id,
            user: sender,
            reaction,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Remove reaction from message
    public fun remove_reaction(
        message: &mut Message,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(vec_map::contains(&message.reactions, &sender), EInvalidReaction);
        
        let (_, _) = vec_map::remove(&mut message.reactions, &sender);
    }

    /// Block chat
    public fun block_chat(
        chat: &mut ChatRoom,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);
        assert!(!is_blocked_by(chat, sender), EBlockedUser);

        vector::push_back(&mut chat.blocked_by, sender);
        chat.status = CHAT_STATUS_BLOCKED;

        event::emit(ChatBlocked {
            chat_id: object::uid_to_inner(&chat.id),
            blocked_by: sender,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Unblock chat
    public fun unblock_chat(
        chat: &mut ChatRoom,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);
        assert!(is_blocked_by(chat, sender), EUnauthorized);

        let (exists, index) = vector::index_of(&chat.blocked_by, &sender);
        if (exists) {
            vector::remove(&mut chat.blocked_by, index);
        };

        if (vector::is_empty(&chat.blocked_by)) {
            chat.status = CHAT_STATUS_ACTIVE;
        };

        event::emit(ChatUnblocked {
            chat_id: object::uid_to_inner(&chat.id),
            unblocked_by: sender,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Mute chat
    public fun mute_chat(
        chat: &mut ChatRoom,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);
        assert!(!is_muted_by(chat, sender), EUnauthorized);

        vector::push_back(&mut chat.muted_by, sender);
    }

    /// Unmute chat
    public fun unmute_chat(
        chat: &mut ChatRoom,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);

        let (exists, index) = vector::index_of(&chat.muted_by, &sender);
        if (exists) {
            vector::remove(&mut chat.muted_by, index);
        };
    }

    /// Archive chat
    public fun archive_chat(
        chat: &mut ChatRoom,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);
        
        chat.status = CHAT_STATUS_ARCHIVED;
    }

    /// Unarchive chat
    public fun unarchive_chat(
        chat: &mut ChatRoom,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);
        
        chat.status = CHAT_STATUS_ACTIVE;
    }

    /// Start typing indicator
    public fun start_typing(
        chat: &ChatRoom,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);
        assert!(chat.typing_indicator_enabled, EUnauthorized);

        event::emit(TypingStarted {
            chat_id: object::uid_to_inner(&chat.id),
            user: sender,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Stop typing indicator
    public fun stop_typing(
        chat: &ChatRoom,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);

        event::emit(TypingStopped {
            chat_id: object::uid_to_inner(&chat.id),
            user: sender,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Update chat settings
    public fun update_chat_settings(
        chat: &mut ChatRoom,
        typing_indicator: Option<bool>,
        read_receipts: Option<bool>,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(is_participant(chat, sender), ENotChatParticipant);

        if (option::is_some(&typing_indicator)) {
            chat.typing_indicator_enabled = option::destroy_some(typing_indicator);
        };

        if (option::is_some(&read_receipts)) {
            chat.read_receipts_enabled = option::destroy_some(read_receipts);
        };
    }

    // ===== View Functions =====

    // Chat Views
    public fun get_chat_participants(chat: &ChatRoom): (address, address) {
        (chat.participant_a, chat.participant_b)
    }

    public fun get_chat_seal_policy(chat: &ChatRoom): String {
        chat.seal_policy_id
    }

    public fun get_chat_encrypted_key(chat: &ChatRoom): &vector<u8> {
        &chat.encrypted_key
    }

    public fun get_chat_match_id(chat: &ChatRoom): Option<ID> {
        chat.match_id
    }

    public fun get_chat_status(chat: &ChatRoom): u8 {
        chat.status
    }

    public fun get_chat_created_at(chat: &ChatRoom): u64 {
        chat.created_at
    }

    public fun get_chat_last_message_at(chat: &ChatRoom): u64 {
        chat.last_message_at
    }

    public fun get_chat_total_messages(chat: &ChatRoom): u64 {
        chat.total_messages
    }

    public fun get_unread_count(chat: &ChatRoom, user: address): u64 {
        if (user == chat.participant_a) {
            chat.unread_count_a
        } else {
            chat.unread_count_b
        }
    }

    public fun is_chat_muted(chat: &ChatRoom, user: address): bool {
        is_muted_by(chat, user)
    }

    public fun is_chat_blocked(chat: &ChatRoom, user: address): bool {
        is_blocked_by(chat, user)
    }

    public fun is_chat_active(chat: &ChatRoom): bool {
        chat.status == CHAT_STATUS_ACTIVE
    }

    public fun get_chat_id(chat: &ChatRoom): ID {
        object::uid_to_inner(&chat.id)
    }

    public fun get_message_id(message: &Message): ID {
        object::uid_to_inner(&message.id)
    }

    public fun has_typing_indicator(chat: &ChatRoom): bool {
        chat.typing_indicator_enabled
    }

    public fun has_read_receipts(chat: &ChatRoom): bool {
        chat.read_receipts_enabled
    }

    // Message Views
    public fun get_message_sender(message: &Message): address {
        message.sender
    }

    public fun get_message_recipient(message: &Message): address {
        message.recipient
    }

    public fun get_message_content_type(message: &Message): u8 {
        message.content_type
    }

    public fun get_message_encrypted_content(message: &Message): &vector<u8> {
        &message.encrypted_content
    }

    public fun get_message_content_hash(message: &Message): &vector<u8> {
        &message.content_hash
    }

    public fun get_message_media_blob_id(message: &Message): Option<String> {
        message.media_blob_id
    }

    public fun get_message_sent_at(message: &Message): u64 {
        message.sent_at
    }

    public fun get_message_read_status(message: &Message): u8 {
        message.read_status
    }

    public fun get_message_read_at(message: &Message): Option<u64> {
        message.read_at
    }

    public fun is_message_edited(message: &Message): bool {
        message.edited
    }

    public fun is_message_deleted(message: &Message): bool {
        message.deleted
    }

    public fun get_message_reply_to(message: &Message): Option<ID> {
        message.reply_to
    }

    public fun get_message_reactions(message: &Message): &VecMap<address, String> {
        &message.reactions
    }

    public fun get_message_reaction_count(message: &Message): u64 {
        vec_map::size(&message.reactions)
    }

    public fun has_user_reacted(message: &Message, user: address): bool {
        vec_map::contains(&message.reactions, &user)
    }

    public fun is_message_expired(message: &Message, current_time: u64): bool {
        if (option::is_some(&message.expires_at)) {
            let expires = *option::borrow(&message.expires_at);
            current_time > expires
        } else {
            false
        }
    }

    // Registry Views
    public fun get_total_chats(registry: &ChatRegistry): u64 {
        registry.total_chats
    }

    public fun get_total_messages(registry: &ChatRegistry): u64 {
        registry.total_messages
    }

    public fun get_user_chat_ids(registry: &ChatRegistry, user: address): &vector<ID> {
        table::borrow(&registry.user_chats, user)
    }

    public fun get_user_chat_count(registry: &ChatRegistry, user: address): u64 {
        if (table::contains(&registry.user_chats, user)) {
            vector::length(table::borrow(&registry.user_chats, user))
        } else {
            0
        }
    }

    public fun get_chat_message_ids(index: &MessageIndex, chat_id: ID): &vector<ID> {
        table::borrow(&index.chat_messages, chat_id)
    }

    public fun get_chat_message_count(index: &MessageIndex, chat_id: ID): u64 {
        if (table::contains(&index.chat_messages, chat_id)) {
            vector::length(table::borrow(&index.chat_messages, chat_id))
        } else {
            0
        }
    }

    // ===== Admin Functions =====

    public struct AdminCap has key { id: UID }

    /// Report chat (admin moderation)
    public fun report_chat(
        chat: &mut ChatRoom,
        _admin_cap: &AdminCap,
    ) {
        chat.reported_count = chat.reported_count + 1;
    }

    /// Delete chat (admin only)
    public fun admin_delete_chat(
        chat: &mut ChatRoom,
        _admin_cap: &AdminCap,
    ) {
        chat.status = CHAT_STATUS_DELETED;
    }

    /// Transfer chat room to recipient (for use in other modules)
    public(package) fun transfer_chat_room(chat: ChatRoom, recipient: address) {
        transfer::transfer(chat, recipient);
    }

    /// Share chat room so both participants can access it (for use in other modules)
    public(package) fun share_chat_room(chat: ChatRoom) {
        transfer::share_object(chat);
    }

    /// Entry function wrapper for send_message (basic text message)
    public entry fun send_message_entry(
        registry: &mut ChatRegistry,
        index: &mut MessageIndex,
        chat: &mut ChatRoom,
        encrypted_content: vector<u8>,
        content_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let message = send_message(
            registry,
            index,
            chat,
            0, // content_type: 0 = text
            encrypted_content,
            content_hash,
            option::none<String>(), // media_blob_id
            option::none<String>(), // thumbnail_blob_id
            option::none<ID>(), // reply_to
            option::none<u64>(), // expires_at
            clock,
            ctx
        );

        let sender = tx_context::sender(ctx);
        transfer::transfer(message, sender);
    }

    /// Initialize module
    fun init(ctx: &mut TxContext) {
        transfer::transfer(
            AdminCap { id: object::new(ctx) },
            tx_context::sender(ctx)
        );

        transfer::share_object(ChatRegistry {
            id: object::new(ctx),
            user_chats: table::new(ctx),
            total_chats: 0,
            total_messages: 0,
        });

        transfer::share_object(MessageIndex {
            id: object::new(ctx),
            chat_messages: table::new(ctx),
        });
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    /// Create MessageIndex for testing/recovery
    public entry fun create_message_index(ctx: &mut TxContext) {
        transfer::share_object(MessageIndex {
            id: object::new(ctx),
            chat_messages: table::new(ctx),
        });
    }
}