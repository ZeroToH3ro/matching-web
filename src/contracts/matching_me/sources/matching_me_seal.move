/// Seal Protocol Integration for Matching.Me
/// Single seal_approve entry function with ID-based routing
/// Identity format: [package_id]::[type_prefix][object_id][nonce]
module matching_me::seal_policies {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use std::vector;
    use sui::clock::{Self, Clock};
    use sui::vec_set::{Self, VecSet};
    use sui::bcs;
    
    use matching_me::core::{UserProfile, Match, Subscription, get_profile_owner, get_match_users, is_subscription_active, get_subscription_tier, get_match_id};
    use matching_me::chat::{ChatRoom, get_chat_participants, get_chat_id};

    // ===== Error Codes =====

    const ENoAccess: u64 = 1;
    const EInvalidId: u64 = 2;
    const EUnknownType: u64 = 3;
    const EInactive: u64 = 4;

    // ===== Type Prefixes =====
    // Used to identify allowlist type from ID structure

    const TYPE_CHAT: u8 = 0x01;
    const TYPE_SUBSCRIPTION: u8 = 0x02;
    const TYPE_MATCH: u8 = 0x03;
    const TYPE_TIMELOCK: u8 = 0x04;
    const TYPE_CUSTOM: u8 = 0x05;

    // ===== Structs =====

    /// Chat Allowlist - Controls who can decrypt chat messages
    public struct ChatAllowlist has key, store {
        id: UID,
        chat_id: ID,
        participant_a: address,
        participant_b: address,
        active: bool,
        created_at: u64,
    }

    /// Subscription Allowlist - Only active subscribers can decrypt
    public struct SubscriptionAllowlist has key, store {
        id: UID,
        creator: address,
        min_tier: u8,
        subscribers: VecSet<address>,
        active: bool,
        created_at: u64,
    }

    /// Match Allowlist - Only matched users can decrypt
    public struct MatchAllowlist has key, store {
        id: UID,
        match_id: ID,
        user_a: address,
        user_b: address,
        active: bool,
        created_at: u64,
    }

    /// Time Lock - Content decryptable after specific time
    public struct TimeLock has key, store {
        id: UID,
        unlock_time: u64,
        created_at: u64,
    }

    /// Custom Allowlist - Manually managed list
    public struct CustomAllowlist has key, store {
        id: UID,
        creator: address,
        allowed_addresses: VecSet<address>,
        active: bool,
        created_at: u64,
    }

    // ===== Events =====

    public struct AccessGranted has copy, drop {
        id_bytes: vector<u8>,
        allowlist_type: u8,
        user: address,
        timestamp: u64,
    }

    public struct AccessDenied has copy, drop {
        id_bytes: vector<u8>,
        allowlist_type: u8,
        user: address,
        reason: String,
    }

    // ===== Helper Functions =====

    /// Extract type prefix from ID
    /// ID format: [type_byte][object_id_32_bytes][nonce]
    fun extract_type(id: &vector<u8>): u8 {
        if (vector::length(id) < 1) {
            return 0
        };
        *vector::borrow(id, 0)
    }

    /// Extract object ID from ID (skip type byte)
    /// Returns bytes from position 1 to 33 (32 bytes)
    fun extract_object_id(id: &vector<u8>): vector<u8> {
        let len = vector::length(id);
        if (len < 33) { // Need at least type + 32 bytes
            return vector::empty()
        };
        
        let mut result = vector::empty<u8>();
        let mut i = 1; // Skip type byte
        while (i < 33 && i < len) {
            vector::push_back(&mut result, *vector::borrow(id, i));
            i = i + 1;
        };
        result
    }

    /// Check if haystack starts with needle (prefix check)
    fun is_prefix(needle: vector<u8>, haystack: vector<u8>): bool {
        let needle_len = vector::length(&needle);
        let haystack_len = vector::length(&haystack);
        
        if (needle_len > haystack_len) {
            return false
        };
        
        let mut i = 0;
        while (i < needle_len) {
            if (vector::borrow(&needle, i) != vector::borrow(&haystack, i)) {
                return false
            };
            i = i + 1;
        };
        true
    }

    /// Build namespace: [type_byte][object_id_bytes]
    fun build_namespace(type_byte: u8, object_id: ID): vector<u8> {
        let mut namespace = vector::empty<u8>();
        vector::push_back(&mut namespace, type_byte);

        let id_bytes = object::id_to_bytes(&object_id);
        vector::append(&mut namespace, id_bytes);

        namespace
    }

    // ===== External Approval Functions =====
    // These are called by seal_approve to check specific conditions

    /// Check if user can access chat
    public fun approve_chat(
        caller: address,
        allowlist: &ChatAllowlist
    ): bool {
        if (!allowlist.active) {
            return false
        };
        
        caller == allowlist.participant_a || caller == allowlist.participant_b
    }

    /// Check if user can access subscription content
    public fun approve_subscription(
        caller: address,
        allowlist: &SubscriptionAllowlist,
        subscription: &Subscription,
        current_time: u64
    ): bool {
        if (!allowlist.active) {
            return false
        };
        
        // Check if caller is in subscribers list
        if (!vec_set::contains(&allowlist.subscribers, &caller)) {
            return false
        };
        
        // Check subscription is active
        if (!is_subscription_active(subscription, current_time)) {
            return false
        };
        
        // Check subscription tier
        let user_tier = get_subscription_tier(subscription);
        user_tier >= allowlist.min_tier
    }

    /// Check if user can access match content
    public fun approve_match(
        caller: address,
        allowlist: &MatchAllowlist
    ): bool {
        if (!allowlist.active) {
            return false
        };
        
        caller == allowlist.user_a || caller == allowlist.user_b
    }

    /// Check if timelock has been reached
    public fun approve_timelock(
        timelock: &TimeLock,
        current_time: u64
    ): bool {
        current_time >= timelock.unlock_time
    }

    /// Check if user is in custom allowlist
    public fun approve_custom(
        caller: address,
        allowlist: &CustomAllowlist
    ): bool {
        if (!allowlist.active) {
            return false
        };
        
        vec_set::contains(&allowlist.allowed_addresses, &caller)
    }

    // ===== Main Seal Approve Entry Function =====
    // Single entry point for Seal Protocol - auto-detects allowlist type from ID prefix
    // ID format: [type_byte][object_id_bytes][nonce]

    /// Main Seal Protocol entry point for Chat allowlists
    /// For other types, pass the appropriate allowlist object
    entry fun seal_approve(
        id: vector<u8>,
        chat_allowlist: &ChatAllowlist,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let id_type = extract_type(&id);

        // Route based on type byte - only support CHAT type with ChatAllowlist parameter
        assert!(id_type == TYPE_CHAT, EInvalidId);

        // Verify namespace
        let namespace = build_namespace(TYPE_CHAT, get_chat_allowlist_id(chat_allowlist));
        assert!(is_prefix(namespace, id), EInvalidId);

        // Check approval
        assert!(approve_chat(caller, chat_allowlist), ENoAccess);
    }

    /// Seal approval for Subscription allowlists
    entry fun seal_approve_subscription(
        id: vector<u8>,
        subscription_allowlist: &SubscriptionAllowlist,
        subscription: &Subscription,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let id_type = extract_type(&id);

        assert!(id_type == TYPE_SUBSCRIPTION, EInvalidId);

        let namespace = build_namespace(TYPE_SUBSCRIPTION, get_subscription_allowlist_id(subscription_allowlist));
        assert!(is_prefix(namespace, id), EInvalidId);

        let current_time = sui::clock::timestamp_ms(clock);
        assert!(approve_subscription(caller, subscription_allowlist, subscription, current_time), ENoAccess);
    }

    /// Seal approval for Match allowlists
    entry fun seal_approve_match(
        id: vector<u8>,
        match_allowlist: &MatchAllowlist,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let id_type = extract_type(&id);

        assert!(id_type == TYPE_MATCH, EInvalidId);

        let namespace = build_namespace(TYPE_MATCH, get_match_allowlist_id(match_allowlist));
        assert!(is_prefix(namespace, id), EInvalidId);

        assert!(approve_match(caller, match_allowlist), ENoAccess);
    }

    /// Seal approval for TimeLock
    entry fun seal_approve_timelock(
        id: vector<u8>,
        timelock: &TimeLock,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let id_type = extract_type(&id);

        assert!(id_type == TYPE_TIMELOCK, EInvalidId);

        let namespace = build_namespace(TYPE_TIMELOCK, get_timelock_id(timelock));
        assert!(is_prefix(namespace, id), EInvalidId);

        let current_time = sui::clock::timestamp_ms(clock);
        assert!(approve_timelock(timelock, current_time), ENoAccess);
    }

    /// Seal approval for Custom allowlists
    entry fun seal_approve_custom(
        id: vector<u8>,
        custom_allowlist: &CustomAllowlist,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let id_type = extract_type(&id);

        assert!(id_type == TYPE_CUSTOM, EInvalidId);

        let namespace = build_namespace(TYPE_CUSTOM, get_custom_allowlist_id(custom_allowlist));
        assert!(is_prefix(namespace, id), EInvalidId);

        assert!(approve_custom(caller, custom_allowlist), ENoAccess);
    }

    // ===== Allowlist Management Functions =====

    /// Create chat allowlist
    public fun create_chat_allowlist(
        chat: &ChatRoom,
        profile: &UserProfile,
        clock: &Clock,
        ctx: &mut TxContext
    ): ChatAllowlist {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);

        let (user_a, user_b) = get_chat_participants(chat);
        assert!(sender == user_a || sender == user_b, ENoAccess);

        let allowlist = ChatAllowlist {
            id: object::new(ctx),
            chat_id: get_chat_id(chat),
            participant_a: user_a,
            participant_b: user_b,
            active: true,
            created_at: sui::clock::timestamp_ms(clock),
        };

        allowlist
    }

    /// Create subscription allowlist
    public fun create_subscription_allowlist(
        profile: &UserProfile,
        minimum_tier: u8,
        initial_subscribers: vector<address>,
        clock: &Clock,
        ctx: &mut TxContext
    ): SubscriptionAllowlist {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);

        let mut subscribers = vec_set::empty<address>();
        let mut i = 0;
        let len = vector::length(&initial_subscribers);
        while (i < len) {
            vec_set::insert(&mut subscribers, *vector::borrow(&initial_subscribers, i));
            i = i + 1;
        };

        let allowlist = SubscriptionAllowlist {
            id: object::new(ctx),
            creator: sender,
            min_tier: minimum_tier,
            subscribers,
            active: true,
            created_at: sui::clock::timestamp_ms(clock),
        };

        allowlist
    }

    /// Create match allowlist
    public fun create_match_allowlist(
        match_obj: &Match,
        profile: &UserProfile,
        clock: &Clock,
        ctx: &mut TxContext
    ): MatchAllowlist {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);

        let (user_a, user_b) = get_match_users(match_obj);
        assert!(sender == user_a || sender == user_b, ENoAccess);

        let allowlist = MatchAllowlist {
            id: object::new(ctx),
            match_id: get_match_id(match_obj),
            user_a,
            user_b,
            active: true,
            created_at: sui::clock::timestamp_ms(clock),
        };

        allowlist
    }

    /// Create time lock
    public fun create_timelock(
        unlock_time: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): TimeLock {
        let timelock = TimeLock {
            id: object::new(ctx),
            unlock_time,
            created_at: sui::clock::timestamp_ms(clock),
        };

        timelock
    }

    /// Create custom allowlist
    public fun create_custom_allowlist(
        profile: &UserProfile,
        allowed_addresses: vector<address>,
        clock: &Clock,
        ctx: &mut TxContext
    ): CustomAllowlist {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);

        let mut allowed = vec_set::empty<address>();
        let mut i = 0;
        let len = vector::length(&allowed_addresses);
        while (i < len) {
            vec_set::insert(&mut allowed, *vector::borrow(&allowed_addresses, i));
            i = i + 1;
        };

        let allowlist = CustomAllowlist {
            id: object::new(ctx),
            creator: sender,
            allowed_addresses: allowed,
            active: true,
            created_at: sui::clock::timestamp_ms(clock),
        };

        allowlist
    }

    // ===== Namespace Helper Functions =====

    /// Get namespace for ChatAllowlist with type prefix
    public fun chat_namespace(allowlist: &ChatAllowlist): vector<u8> {
        build_namespace(TYPE_CHAT, get_chat_allowlist_id(allowlist))
    }

    /// Get namespace for SubscriptionAllowlist with type prefix
    public fun subscription_namespace(allowlist: &SubscriptionAllowlist): vector<u8> {
        build_namespace(TYPE_SUBSCRIPTION, get_subscription_allowlist_id(allowlist))
    }

    /// Get namespace for MatchAllowlist with type prefix
    public fun match_namespace(allowlist: &MatchAllowlist): vector<u8> {
        build_namespace(TYPE_MATCH, get_match_allowlist_id(allowlist))
    }

    /// Get namespace for TimeLock with type prefix
    public fun timelock_namespace(timelock: &TimeLock): vector<u8> {
        build_namespace(TYPE_TIMELOCK, get_timelock_id(timelock))
    }

    /// Get namespace for CustomAllowlist with type prefix
    public fun custom_namespace(allowlist: &CustomAllowlist): vector<u8> {
        build_namespace(TYPE_CUSTOM, get_custom_allowlist_id(allowlist))
    }

    // ===== Update Functions =====

    public fun add_subscriber(
        allowlist: &mut SubscriptionAllowlist,
        profile: &UserProfile,
        new_subscriber: address,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(allowlist.creator == sender, ENoAccess);
        vec_set::insert(&mut allowlist.subscribers, new_subscriber);
    }

    public fun remove_subscriber(
        allowlist: &mut SubscriptionAllowlist,
        profile: &UserProfile,
        subscriber: address,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(allowlist.creator == sender, ENoAccess);
        vec_set::remove(&mut allowlist.subscribers, &subscriber);
    }

    public fun add_to_allowlist(
        allowlist: &mut CustomAllowlist,
        profile: &UserProfile,
        new_address: address,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(allowlist.creator == sender, ENoAccess);
        vec_set::insert(&mut allowlist.allowed_addresses, new_address);
    }

    public fun remove_from_allowlist(
        allowlist: &mut CustomAllowlist,
        profile: &UserProfile,
        address_to_remove: address,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(allowlist.creator == sender, ENoAccess);
        vec_set::remove(&mut allowlist.allowed_addresses, &address_to_remove);
    }

    public fun deactivate_chat_allowlist(
        allowlist: &mut ChatAllowlist,
        profile: &UserProfile,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(
            sender == allowlist.participant_a || sender == allowlist.participant_b,
            ENoAccess
        );
        allowlist.active = false;
    }

    public fun deactivate_custom_allowlist(
        allowlist: &mut CustomAllowlist,
        profile: &UserProfile,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(allowlist.creator == sender, ENoAccess);
        allowlist.active = false;
    }

    // ===== View Functions =====

    public fun get_type_chat(): u8 { TYPE_CHAT }
    public fun get_type_subscription(): u8 { TYPE_SUBSCRIPTION }
    public fun get_type_match(): u8 { TYPE_MATCH }
    public fun get_type_timelock(): u8 { TYPE_TIMELOCK }
    public fun get_type_custom(): u8 { TYPE_CUSTOM }

    public fun is_chat_allowlist_active(allowlist: &ChatAllowlist): bool {
        allowlist.active
    }

    public fun get_chat_allowlist_participants(allowlist: &ChatAllowlist): (address, address) {
        (allowlist.participant_a, allowlist.participant_b)
    }

    public fun get_chat_allowlist_id(allowlist: &ChatAllowlist): ID {
        object::uid_to_inner(&allowlist.id)
    }

    public fun is_subscription_allowlist_active(allowlist: &SubscriptionAllowlist): bool {
        allowlist.active
    }

    public fun get_subscription_allowlist_id(allowlist: &SubscriptionAllowlist): ID {
        object::uid_to_inner(&allowlist.id)
    }

    public fun is_match_allowlist_active(allowlist: &MatchAllowlist): bool {
        allowlist.active
    }

    public fun get_match_allowlist_id(allowlist: &MatchAllowlist): ID {
        object::uid_to_inner(&allowlist.id)
    }

    public fun get_timelock_id(timelock: &TimeLock): ID {
        object::uid_to_inner(&timelock.id)
    }

    public fun is_custom_allowlist_active(allowlist: &CustomAllowlist): bool {
        allowlist.active
    }

    public fun get_custom_allowlist_id(allowlist: &CustomAllowlist): ID {
        object::uid_to_inner(&allowlist.id)
    }

    #[test_only]
    public fun init_for_testing(_ctx: &mut TxContext) {}
}