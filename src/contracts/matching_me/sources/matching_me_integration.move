/// Integration module connecting Chat with Core Matching.Me features
module matching_me::integration {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use std::vector;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    
    use matching_me::core::{
        UserProfile, Match, Subscription, MediaContent, DigitalGift,
        get_profile_owner, get_match_users, is_subscription_active,
        get_subscription_tier, get_match_id, get_gift_id, get_media_id
    };
    use matching_me::chat::{
        ChatRoom, Message, ChatRegistry, MessageIndex,
        create_chat, send_message, get_chat_participants, get_chat_id, get_message_id
    };

    // ===== Error Codes =====

    const ENotMatched: u64 = 1;
    const ENoActiveSubscription: u64 = 2;
    const ESubscriptionTierTooLow: u64 = 3;
    const EMaxChatsReached: u64 = 4;
    const EMessageLimitReached: u64 = 5;

    // ===== Constants =====

    const TIER_FREE: u8 = 0;
    const TIER_BASIC: u8 = 1;
    const TIER_PREMIUM: u8 = 2;
    const TIER_PLATINUM: u8 = 3;

    // Message limits per tier per day
    const FREE_DAILY_MESSAGES: u64 = 50;
    const BASIC_DAILY_MESSAGES: u64 = 200;
    const PREMIUM_DAILY_MESSAGES: u64 = 1000;
    const PLATINUM_DAILY_MESSAGES: u64 = 999999; // Unlimited

    // Chat limits per tier
    const FREE_MAX_ACTIVE_CHATS: u64 = 5;
    const BASIC_MAX_ACTIVE_CHATS: u64 = 20;
    const PREMIUM_MAX_ACTIVE_CHATS: u64 = 100;
    const PLATINUM_MAX_ACTIVE_CHATS: u64 = 999999; // Unlimited

    // ===== Structs =====

    /// Usage tracking for rate limiting
    public struct UsageTracker has key {
        id: UID,
        user_usage: Table<address, DailyUsage>,
    }

    public struct DailyUsage has store {
        date: u64,  // Day timestamp (midnight UTC)
        messages_sent: u64,
        active_chats: u64,
    }

    /// Integration metadata linking Match with Chat
    public struct MatchChatLink has key {
        id: UID,
        match_id: ID,
        chat_id: ID,
        created_at: u64,
    }

    /// Gift Message - special message type with embedded gift
    public struct GiftMessage has key, store {
        id: UID,
        message_id: ID,
        gift_id: ID,
        unwrapped: bool,
        unwrapped_at: Option<u64>,
    }

    /// Media Message - special message type with media content
    public struct MediaMessage has key, store {
        id: UID,
        message_id: ID,
        media_id: ID,
        views: u64,
    }

    /// Ice Breaker - Suggested conversation starters based on match compatibility
    public struct IceBreaker has copy, drop, store {
        category: String,  // "shared_interest", "fun_fact", "question"
        content: String,
        compatibility_boost: u64,
    }

    /// Conversation Analytics
    public struct ConversationStats has store {
        total_messages: u64,
        avg_response_time_ms: u64,
        last_active: u64,
        conversation_score: u64,  // 0-100 based on engagement
    }

    // ===== Events =====

    public struct ChatCreatedFromMatch has copy, drop {
        match_id: ID,
        chat_id: ID,
        user_a: address,
        user_b: address,
        timestamp: u64,
    }

    public struct GiftSentInChat has copy, drop {
        gift_id: ID,
        message_id: ID,
        chat_id: ID,
        from: address,
        to: address,
        timestamp: u64,
    }

    public struct MediaSharedInChat has copy, drop {
        media_id: ID,
        message_id: ID,
        chat_id: ID,
        from: address,
        to: address,
        timestamp: u64,
    }

    public struct IceBreakerUsed has copy, drop {
        chat_id: ID,
        user: address,
        category: String,
        timestamp: u64,
    }

    public struct ConversationMilestone has copy, drop {
        chat_id: ID,
        milestone: String,  // "first_message", "100_messages", "1_week", etc.
        timestamp: u64,
    }

    // ===== Helper Functions =====

    /// Get current day timestamp (midnight UTC)
    fun get_day_timestamp(current_time: u64): u64 {
        (current_time / 86400000) * 86400000  // Round down to day
    }

    /// Get or create daily usage
    fun get_or_create_usage(
        tracker: &mut UsageTracker,
        user: address,
        current_time: u64,
        ctx: &mut TxContext
    ): &mut DailyUsage {
        let day = get_day_timestamp(current_time);
        
        if (!table::contains(&tracker.user_usage, user)) {
            table::add(&mut tracker.user_usage, user, DailyUsage {
                date: day,
                messages_sent: 0,
                active_chats: 0,
            });
        };

        let usage = table::borrow_mut(&mut tracker.user_usage, user);
        
        // Reset if new day
        if (usage.date != day) {
            usage.date = day;
            usage.messages_sent = 0;
        };

        usage
    }

    /// Check if user can send message based on tier
    fun can_send_message(
        usage: &DailyUsage,
        subscription_ref: &Option<Subscription>,
        current_time: u64
    ): bool {
        let tier = if (option::is_some(subscription_ref)) {
            let sub = option::borrow(subscription_ref);
            if (is_subscription_active(sub, current_time)) {
                get_subscription_tier(sub)
            } else {
                TIER_FREE
            }
        } else {
            TIER_FREE
        };

        let limit = if (tier == TIER_PLATINUM) {
            PLATINUM_DAILY_MESSAGES
        } else if (tier == TIER_PREMIUM) {
            PREMIUM_DAILY_MESSAGES
        } else if (tier == TIER_BASIC) {
            BASIC_DAILY_MESSAGES
        } else {
            FREE_DAILY_MESSAGES
        };

        usage.messages_sent < limit
    }

    /// Check if user can create new chat
    fun can_create_chat(
        usage: &DailyUsage,
        subscription_ref: &Option<Subscription>,
        current_time: u64
    ): bool {
        let tier = if (option::is_some(subscription_ref)) {
            let sub = option::borrow(subscription_ref);
            if (is_subscription_active(sub, current_time)) {
                get_subscription_tier(sub)
            } else {
                TIER_FREE
            }
        } else {
            TIER_FREE
        };

        let limit = if (tier == TIER_PLATINUM) {
            PLATINUM_MAX_ACTIVE_CHATS
        } else if (tier == TIER_PREMIUM) {
            PREMIUM_MAX_ACTIVE_CHATS
        } else if (tier == TIER_BASIC) {
            BASIC_MAX_ACTIVE_CHATS
        } else {
            FREE_MAX_ACTIVE_CHATS
        };

        usage.active_chats < limit
    }

    // ===== Public Functions =====

    /// Create chat from match with subscription check
    public fun create_chat_from_match(
        tracker: &mut UsageTracker,
        chat_registry: &mut ChatRegistry,
        profile: &UserProfile,
        match_obj: &Match,
        subscription: &Option<Subscription>,
        seal_policy_id: String,
        encrypted_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ): (ChatRoom, MatchChatLink) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        assert!(get_profile_owner(profile) == sender, ENotMatched);

        // Verify match participants
        let (user_a, user_b) = get_match_users(match_obj);
        assert!(user_a == sender || user_b == sender, ENotMatched);

        let other_user = if (user_a == sender) { user_b } else { user_a };

        // Check subscription limits and update usage separately
        let match_id = get_match_id(match_obj);
        {
            let usage = get_or_create_usage(tracker, sender, current_time, ctx);
            assert!(can_create_chat(usage, subscription, current_time), EMaxChatsReached);
        };

        // Create chat
        let chat = create_chat(
            chat_registry,
            profile,
            other_user,
            seal_policy_id,
            encrypted_key,
            option::some(match_id),
            clock,
            ctx
        );

        // Update usage after chat creation
        let usage = get_or_create_usage(tracker, sender, current_time, ctx);
        usage.active_chats = usage.active_chats + 1;

        // Create link
        let link_uid = object::new(ctx);
        let chat_id = get_chat_id(&chat);
        let link = MatchChatLink {
            id: link_uid,
            match_id,
            chat_id,
            created_at: current_time,
        };

        event::emit(ChatCreatedFromMatch {
            match_id,
            chat_id,
            user_a,
            user_b,
            timestamp: current_time,
        });

        (chat, link)
    }

    /// Send message with subscription rate limiting
    public fun send_message_with_limits(
        tracker: &mut UsageTracker,
        chat_registry: &mut ChatRegistry,
        message_index: &mut MessageIndex,
        chat: &mut ChatRoom,
        profile: &UserProfile,
        subscription: &Option<Subscription>,
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
        let current_time = clock::timestamp_ms(clock);

        assert!(get_profile_owner(profile) == sender, ENoActiveSubscription);

        // Check rate limits
        {
            let usage = get_or_create_usage(tracker, sender, current_time, ctx);
            assert!(can_send_message(usage, subscription, current_time), EMessageLimitReached);
        };

        // Send message
        let message = send_message(
            chat_registry,
            message_index,
            chat,
            content_type,
            encrypted_content,
            content_hash,
            media_blob_id,
            thumbnail_blob_id,
            reply_to,
            expires_at,
            clock,
            ctx
        );

        // Update usage after sending message
        let usage = get_or_create_usage(tracker, sender, current_time, ctx);
        usage.messages_sent = usage.messages_sent + 1;

        message
    }

    /// Send gift as a message
    public fun send_gift_message(
        tracker: &mut UsageTracker,
        chat_registry: &mut ChatRegistry,
        message_index: &mut MessageIndex,
        chat: &mut ChatRoom,
        profile: &UserProfile,
        gift: DigitalGift,
        subscription: &Option<Subscription>,
        gift_message_text: String,
        _seal_policy_id: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Message, GiftMessage) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // Create encrypted content with gift metadata
        let encrypted_content = *string::as_bytes(&gift_message_text);
        let content_hash = vector::empty<u8>(); // Should be computed off-chain

        // Send message
        let message = send_message_with_limits(
            tracker,
            chat_registry,
            message_index,
            chat,
            profile,
            subscription,
            4,  // MSG_TYPE_GIFT
            encrypted_content,
            content_hash,
            option::none(),
            option::none(),
            option::none(),
            option::none(),
            clock,
            ctx
        );

        let gift_id = get_gift_id(&gift);
        let message_id = get_message_id(&message);

        // Create gift message link
        let gift_msg_uid = object::new(ctx);
        let gift_message = GiftMessage {
            id: gift_msg_uid,
            message_id,
            gift_id,
            unwrapped: false,
            unwrapped_at: option::none(),
        };

        // Transfer gift to recipient
        let (_, recipient) = get_chat_participants(chat);
        transfer::public_transfer(gift, recipient);

        let chat_id = get_chat_id(chat);
        event::emit(GiftSentInChat {
            gift_id,
            message_id,
            chat_id,
            from: sender,
            to: recipient,
            timestamp: current_time,
        });

        (message, gift_message)
    }

    /// Share media content in chat
    public fun share_media_in_chat(
        tracker: &mut UsageTracker,
        chat_registry: &mut ChatRegistry,
        message_index: &mut MessageIndex,
        chat: &mut ChatRoom,
        profile: &UserProfile,
        media: &MediaContent,
        subscription: &Option<Subscription>,
        caption: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Message, MediaMessage) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // Get media metadata
        let walrus_id = matching_me::core::get_media_walrus_id(media);
        let content_type = matching_me::core::get_media_content_type(media);

        // Create encrypted content
        let encrypted_content = *string::as_bytes(&caption);
        let content_hash = vector::empty<u8>();

        // Send message with media
        let message = send_message_with_limits(
            tracker,
            chat_registry,
            message_index,
            chat,
            profile,
            subscription,
            content_type,
            encrypted_content,
            content_hash,
            option::some(walrus_id),
            option::none(),
            option::none(),
            option::none(),
            clock,
            ctx
        );

        let message_id = get_message_id(&message);
        let media_id = get_media_id(media);

        // Create media message link
        let media_msg_uid = object::new(ctx);
        let media_message = MediaMessage {
            id: media_msg_uid,
            message_id,
            media_id,
            views: 0,
        };

        let (_, recipient) = get_chat_participants(chat);

        let chat_id = get_chat_id(chat);
        event::emit(MediaSharedInChat {
            media_id,
            message_id,
            chat_id,
            from: sender,
            to: recipient,
            timestamp: current_time,
        });

        (message, media_message)
    }

    /// Generate ice breakers based on match compatibility
    public fun generate_ice_breakers(
        match_obj: &Match,
        profile_a: &UserProfile,
        profile_b: &UserProfile
    ): vector<IceBreaker> {
        let mut ice_breakers = vector::empty<IceBreaker>();

        // Get shared interests
        let interests_a = matching_me::core::get_profile_interests(profile_a);
        let interests_b = matching_me::core::get_profile_interests(profile_b);

        // Find common interests (simplified - should use better algorithm)
        let len_a = vector::length(interests_a);
        let len_b = vector::length(interests_b);
        let mut i = 0;
        let mut shared_count = 0;

        while (i < len_a && shared_count < 3) {
            let interest_a = vector::borrow(interests_a, i);
            let mut j = 0;
            while (j < len_b) {
                let interest_b = vector::borrow(interests_b, j);
                if (interest_a == interest_b) {
                    // Create ice breaker for shared interest
                    let mut content = string::utf8(b"I see we both enjoy ");
                    string::append(&mut content, *interest_a);
                    string::append(&mut content, string::utf8(b"! What got you into it?"));
                    
                    vector::push_back(&mut ice_breakers, IceBreaker {
                        category: string::utf8(b"shared_interest"),
                        content,
                        compatibility_boost: 10,
                    });
                    shared_count = shared_count + 1;
                    break
                };
                j = j + 1;
            };
            i = i + 1;
        };

        // Add generic fun questions if not enough shared interests
        if (vector::length(&ice_breakers) < 3) {
            vector::push_back(&mut ice_breakers, IceBreaker {
                category: string::utf8(b"fun_fact"),
                content: string::utf8(b"What's the most spontaneous thing you've ever done?"),
                compatibility_boost: 5,
            });
        };

        if (vector::length(&ice_breakers) < 3) {
            vector::push_back(&mut ice_breakers, IceBreaker {
                category: string::utf8(b"question"),
                content: string::utf8(b"If you could travel anywhere right now, where would you go?"),
                compatibility_boost: 5,
            });
        };

        ice_breakers
    }

    /// Use an ice breaker
    public fun use_ice_breaker(
        chat: &ChatRoom,
        ice_breaker: IceBreaker,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let (user_a, user_b) = get_chat_participants(chat);
        assert!(sender == user_a || sender == user_b, ENotMatched);

        let chat_id = get_chat_id(chat);
        event::emit(IceBreakerUsed {
            chat_id,
            user: sender,
            category: ice_breaker.category,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Unwrap gift message
    public fun unwrap_gift(
        gift_message: &mut GiftMessage,
        clock: &Clock
    ) {
        assert!(!gift_message.unwrapped, ENotMatched);
        
        gift_message.unwrapped = true;
        gift_message.unwrapped_at = option::some(clock::timestamp_ms(clock));
    }

    /// Increment media views
    public fun view_media_message(
        media_message: &mut MediaMessage
    ) {
        media_message.views = media_message.views + 1;
    }

    // ===== View Functions =====

    public fun get_user_daily_messages_sent(
        tracker: &UsageTracker,
        user: address,
        current_time: u64
    ): u64 {
        let day = get_day_timestamp(current_time);
        if (table::contains(&tracker.user_usage, user)) {
            let usage = table::borrow(&tracker.user_usage, user);
            if (usage.date == day) {
                return usage.messages_sent
            };
        };
        0
    }

    public fun get_user_active_chats(
        tracker: &UsageTracker,
        user: address
    ): u64 {
        if (table::contains(&tracker.user_usage, user)) {
            let usage = table::borrow(&tracker.user_usage, user);
            usage.active_chats
        } else {
            0
        }
    }

    public fun get_remaining_messages(
        tracker: &UsageTracker,
        user: address,
        subscription: &Option<Subscription>,
        current_time: u64
    ): u64 {
        let usage = if (table::contains(&tracker.user_usage, user)) {
            table::borrow(&tracker.user_usage, user)
        } else {
            // Return default for new users
            let tier = if (option::is_some(subscription)) {
                let sub = option::borrow(subscription);
                get_subscription_tier(sub)
            } else {
                TIER_FREE
            };

            let limit = if (tier == TIER_PLATINUM) {
                return PLATINUM_DAILY_MESSAGES
            } else if (tier == TIER_PREMIUM) {
                PREMIUM_DAILY_MESSAGES
            } else if (tier == TIER_BASIC) {
                BASIC_DAILY_MESSAGES
            } else {
                FREE_DAILY_MESSAGES
            };

            return limit
        };

        let tier = if (option::is_some(subscription)) {
            let sub = option::borrow(subscription);
            if (is_subscription_active(sub, current_time)) {
                get_subscription_tier(sub)
            } else {
                TIER_FREE
            }
        } else {
            TIER_FREE
        };

        let limit = if (tier == TIER_PLATINUM) {
            PLATINUM_DAILY_MESSAGES
        } else if (tier == TIER_PREMIUM) {
            PREMIUM_DAILY_MESSAGES
        } else if (tier == TIER_BASIC) {
            BASIC_DAILY_MESSAGES
        } else {
            FREE_DAILY_MESSAGES
        };

        if (limit > usage.messages_sent) {
            limit - usage.messages_sent
        } else {
            0
        }
    }

    public fun get_match_chat_link_ids(link: &MatchChatLink): (ID, ID) {
        (link.match_id, link.chat_id)
    }

    public fun is_gift_unwrapped(gift_message: &GiftMessage): bool {
        gift_message.unwrapped
    }

    public fun get_gift_unwrapped_at(gift_message: &GiftMessage): Option<u64> {
        gift_message.unwrapped_at
    }

    public fun get_media_message_views(media_message: &MediaMessage): u64 {
        media_message.views
    }

    public fun get_ice_breaker_content(ice_breaker: &IceBreaker): String {
        ice_breaker.content
    }

    public fun get_ice_breaker_category(ice_breaker: &IceBreaker): String {
        ice_breaker.category
    }

    // ===== Initialize =====

    fun init(ctx: &mut TxContext) {
        transfer::share_object(UsageTracker {
            id: object::new(ctx),
            user_usage: table::new(ctx),
        });
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}