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
    use sui::table::{Self, Table};
    
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

    /// Global Registry for all allowlists
    public struct AllowlistRegistry has key {
        id: UID,
        chat_allowlists: Table<ID, ID>,        // chat_id -> allowlist_id
        subscription_allowlists: Table<address, vector<ID>>,  // creator -> allowlist_ids
        match_allowlists: Table<ID, ID>,       // match_id -> allowlist_id
        custom_allowlists: Table<address, vector<ID>>,  // creator -> allowlist_ids
        timelocks: Table<ID, ID>,              // content_id -> timelock_id
        total_allowlists: u64,
    }

    /// Chat Allowlist - Controls who can decrypt chat messages
    public struct ChatAllowlist has key, store {
        id: UID,
        chat_id: ID,
        participant_a: address,
        participant_b: address,
        active: bool,
        created_at: u64,
        expires_at: Option<u64>,
    }

    /// Subscription Allowlist - Only active subscribers can decrypt
    public struct SubscriptionAllowlist has key, store {
        id: UID,
        creator: address,
        min_tier: u8,
        subscribers: VecSet<address>,
        active: bool,
        created_at: u64,
        expires_at: Option<u64>,
        max_subscribers: Option<u64>,
    }

    /// Match Allowlist - Only matched users can decrypt
    public struct MatchAllowlist has key, store {
        id: UID,
        match_id: ID,
        user_a: address,
        user_b: address,
        active: bool,
        created_at: u64,
        expires_at: Option<u64>,
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
        expires_at: Option<u64>,
        max_addresses: Option<u64>,
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

    public struct AllowlistCreated has copy, drop {
        allowlist_id: ID,
        allowlist_type: u8,
        creator: address,
        timestamp: u64,
    }

    public struct AllowlistExpired has copy, drop {
        allowlist_id: ID,
        allowlist_type: u8,
        timestamp: u64,
    }

    public struct AllowlistDeactivated has copy, drop {
        allowlist_id: ID,
        allowlist_type: u8,
        deactivated_by: address,
        timestamp: u64,
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
        allowlist: &ChatAllowlist,
        current_time: u64
    ): bool {
        if (!allowlist.active) {
            return false
        };

        // Check expiry
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            if (current_time > expires) {
                return false
            };
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

        // Check allowlist expiry
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            if (current_time > expires) {
                return false
            };
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
        allowlist: &MatchAllowlist,
        current_time: u64
    ): bool {
        if (!allowlist.active) {
            return false
        };

        // Check expiry
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            if (current_time > expires) {
                return false
            };
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
        allowlist: &CustomAllowlist,
        current_time: u64
    ): bool {
        if (!allowlist.active) {
            return false
        };

        // Check expiry
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            if (current_time > expires) {
                return false
            };
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
        clock: &Clock,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let id_type = extract_type(&id);
        let current_time = sui::clock::timestamp_ms(clock);

        // Route based on type byte - only support CHAT type with ChatAllowlist parameter
        assert!(id_type == TYPE_CHAT, EInvalidId);

        // Verify namespace
        let namespace = build_namespace(TYPE_CHAT, get_chat_allowlist_id(chat_allowlist));
        assert!(is_prefix(namespace, id), EInvalidId);

        // Check approval
        assert!(approve_chat(caller, chat_allowlist, current_time), ENoAccess);

        event::emit(AccessGranted {
            id_bytes: id,
            allowlist_type: TYPE_CHAT,
            user: caller,
            timestamp: current_time,
        });
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
        clock: &Clock,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let id_type = extract_type(&id);
        let current_time = sui::clock::timestamp_ms(clock);

        assert!(id_type == TYPE_MATCH, EInvalidId);

        let namespace = build_namespace(TYPE_MATCH, get_match_allowlist_id(match_allowlist));
        assert!(is_prefix(namespace, id), EInvalidId);

        assert!(approve_match(caller, match_allowlist, current_time), ENoAccess);

        event::emit(AccessGranted {
            id_bytes: id,
            allowlist_type: TYPE_MATCH,
            user: caller,
            timestamp: current_time,
        });
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
        clock: &Clock,
        ctx: &TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let id_type = extract_type(&id);
        let current_time = sui::clock::timestamp_ms(clock);

        assert!(id_type == TYPE_CUSTOM, EInvalidId);

        let namespace = build_namespace(TYPE_CUSTOM, get_custom_allowlist_id(custom_allowlist));
        assert!(is_prefix(namespace, id), EInvalidId);

        assert!(approve_custom(caller, custom_allowlist, current_time), ENoAccess);

        event::emit(AccessGranted {
            id_bytes: id,
            allowlist_type: TYPE_CUSTOM,
            user: caller,
            timestamp: current_time,
        });
    }

    // ===== Allowlist Management Functions =====

    /// Create chat allowlist
    public fun create_chat_allowlist(
        registry: &mut AllowlistRegistry,
        chat: &ChatRoom,
        profile: &UserProfile,
        expires_at: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ): ChatAllowlist {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);

        let (user_a, user_b) = get_chat_participants(chat);
        assert!(sender == user_a || sender == user_b, ENoAccess);

        let chat_id = get_chat_id(chat);

        // Check if allowlist already exists for this chat
        assert!(!table::contains(&registry.chat_allowlists, chat_id), ENoAccess);

        let current_time = sui::clock::timestamp_ms(clock);
        let allowlist_uid = object::new(ctx);
        let allowlist_id = object::uid_to_inner(&allowlist_uid);

        let allowlist = ChatAllowlist {
            id: allowlist_uid,
            chat_id,
            participant_a: user_a,
            participant_b: user_b,
            active: true,
            created_at: current_time,
            expires_at,
        };

        // Add to registry
        table::add(&mut registry.chat_allowlists, chat_id, allowlist_id);
        registry.total_allowlists = registry.total_allowlists + 1;

        event::emit(AllowlistCreated {
            allowlist_id,
            allowlist_type: TYPE_CHAT,
            creator: sender,
            timestamp: current_time,
        });

        allowlist
    }

    /// Entry function to create and share ChatAllowlist (so both participants can access it)
    public entry fun create_chat_allowlist_shared(
        registry: &mut AllowlistRegistry,
        chat: &ChatRoom,
        profile: &UserProfile,
        expires_at: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let allowlist = create_chat_allowlist(registry, chat, profile, expires_at, clock, ctx);
        transfer::share_object(allowlist);
    }

    /// Create subscription allowlist
    public fun create_subscription_allowlist(
        registry: &mut AllowlistRegistry,
        profile: &UserProfile,
        minimum_tier: u8,
        initial_subscribers: vector<address>,
        max_subscribers: Option<u64>,
        expires_at: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ): SubscriptionAllowlist {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);

        let mut subscribers = vec_set::empty<address>();
        let mut i = 0;
        let len = vector::length(&initial_subscribers);

        // Check max_subscribers limit
        if (option::is_some(&max_subscribers)) {
            let max = *option::borrow(&max_subscribers);
            assert!(len <= max, ENoAccess);
        };

        while (i < len) {
            vec_set::insert(&mut subscribers, *vector::borrow(&initial_subscribers, i));
            i = i + 1;
        };

        let current_time = sui::clock::timestamp_ms(clock);
        let allowlist_uid = object::new(ctx);
        let allowlist_id = object::uid_to_inner(&allowlist_uid);

        let allowlist = SubscriptionAllowlist {
            id: allowlist_uid,
            creator: sender,
            min_tier: minimum_tier,
            subscribers,
            active: true,
            created_at: current_time,
            expires_at,
            max_subscribers,
        };

        // Add to registry
        if (!table::contains(&registry.subscription_allowlists, sender)) {
            table::add(&mut registry.subscription_allowlists, sender, vector::empty());
        };
        let allowlist_ids = table::borrow_mut(&mut registry.subscription_allowlists, sender);
        vector::push_back(allowlist_ids, allowlist_id);
        registry.total_allowlists = registry.total_allowlists + 1;

        event::emit(AllowlistCreated {
            allowlist_id,
            allowlist_type: TYPE_SUBSCRIPTION,
            creator: sender,
            timestamp: current_time,
        });

        allowlist
    }

    /// Create match allowlist
    public fun create_match_allowlist(
        registry: &mut AllowlistRegistry,
        match_obj: &Match,
        profile: &UserProfile,
        expires_at: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ): MatchAllowlist {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);

        let (user_a, user_b) = get_match_users(match_obj);
        assert!(sender == user_a || sender == user_b, ENoAccess);

        let match_id = get_match_id(match_obj);

        // Check if allowlist already exists for this match
        assert!(!table::contains(&registry.match_allowlists, match_id), ENoAccess);

        let current_time = sui::clock::timestamp_ms(clock);
        let allowlist_uid = object::new(ctx);
        let allowlist_id = object::uid_to_inner(&allowlist_uid);

        let allowlist = MatchAllowlist {
            id: allowlist_uid,
            match_id,
            user_a,
            user_b,
            active: true,
            created_at: current_time,
            expires_at,
        };

        // Add to registry
        table::add(&mut registry.match_allowlists, match_id, allowlist_id);
        registry.total_allowlists = registry.total_allowlists + 1;

        event::emit(AllowlistCreated {
            allowlist_id,
            allowlist_type: TYPE_MATCH,
            creator: sender,
            timestamp: current_time,
        });

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
        registry: &mut AllowlistRegistry,
        profile: &UserProfile,
        allowed_addresses: vector<address>,
        max_addresses: Option<u64>,
        expires_at: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ): CustomAllowlist {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);

        let len = vector::length(&allowed_addresses);

        // Check max_addresses limit
        if (option::is_some(&max_addresses)) {
            let max = *option::borrow(&max_addresses);
            assert!(len <= max, ENoAccess);
        };

        let mut allowed = vec_set::empty<address>();
        let mut i = 0;
        while (i < len) {
            vec_set::insert(&mut allowed, *vector::borrow(&allowed_addresses, i));
            i = i + 1;
        };

        let current_time = sui::clock::timestamp_ms(clock);
        let allowlist_uid = object::new(ctx);
        let allowlist_id = object::uid_to_inner(&allowlist_uid);

        let allowlist = CustomAllowlist {
            id: allowlist_uid,
            creator: sender,
            allowed_addresses: allowed,
            active: true,
            created_at: current_time,
            expires_at,
            max_addresses,
        };

        // Add to registry
        if (!table::contains(&registry.custom_allowlists, sender)) {
            table::add(&mut registry.custom_allowlists, sender, vector::empty());
        };
        let allowlist_ids = table::borrow_mut(&mut registry.custom_allowlists, sender);
        vector::push_back(allowlist_ids, allowlist_id);
        registry.total_allowlists = registry.total_allowlists + 1;

        event::emit(AllowlistCreated {
            allowlist_id,
            allowlist_type: TYPE_CUSTOM,
            creator: sender,
            timestamp: current_time,
        });

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

        // Check max_subscribers limit
        if (option::is_some(&allowlist.max_subscribers)) {
            let max = *option::borrow(&allowlist.max_subscribers);
            let current_size = vec_set::length(&allowlist.subscribers);
            assert!(current_size < max, ENoAccess);
        };

        vec_set::insert(&mut allowlist.subscribers, new_subscriber);
    }

    /// Batch add subscribers
    public fun batch_add_subscribers(
        allowlist: &mut SubscriptionAllowlist,
        profile: &UserProfile,
        new_subscribers: vector<address>,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(allowlist.creator == sender, ENoAccess);

        let len = vector::length(&new_subscribers);

        // Check max_subscribers limit
        if (option::is_some(&allowlist.max_subscribers)) {
            let max = *option::borrow(&allowlist.max_subscribers);
            let current_size = vec_set::length(&allowlist.subscribers);
            assert!(current_size + len <= max, ENoAccess);
        };

        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(&new_subscribers, i);
            if (!vec_set::contains(&allowlist.subscribers, &addr)) {
                vec_set::insert(&mut allowlist.subscribers, addr);
            };
            i = i + 1;
        };
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

        // Check max_addresses limit
        if (option::is_some(&allowlist.max_addresses)) {
            let max = *option::borrow(&allowlist.max_addresses);
            let current_size = vec_set::length(&allowlist.allowed_addresses);
            assert!(current_size < max, ENoAccess);
        };

        vec_set::insert(&mut allowlist.allowed_addresses, new_address);
    }

    /// Batch add to custom allowlist
    public fun batch_add_to_allowlist(
        allowlist: &mut CustomAllowlist,
        profile: &UserProfile,
        new_addresses: vector<address>,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(allowlist.creator == sender, ENoAccess);

        let len = vector::length(&new_addresses);

        // Check max_addresses limit
        if (option::is_some(&allowlist.max_addresses)) {
            let max = *option::borrow(&allowlist.max_addresses);
            let current_size = vec_set::length(&allowlist.allowed_addresses);
            assert!(current_size + len <= max, ENoAccess);
        };

        let mut i = 0;
        while (i < len) {
            let addr = *vector::borrow(&new_addresses, i);
            if (!vec_set::contains(&allowlist.allowed_addresses, &addr)) {
                vec_set::insert(&mut allowlist.allowed_addresses, addr);
            };
            i = i + 1;
        };
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
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(
            sender == allowlist.participant_a || sender == allowlist.participant_b,
            ENoAccess
        );
        allowlist.active = false;

        event::emit(AllowlistDeactivated {
            allowlist_id: object::uid_to_inner(&allowlist.id),
            allowlist_type: TYPE_CHAT,
            deactivated_by: sender,
            timestamp: sui::clock::timestamp_ms(clock),
        });
    }

    public fun deactivate_custom_allowlist(
        allowlist: &mut CustomAllowlist,
        profile: &UserProfile,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_profile_owner(profile) == sender, ENoAccess);
        assert!(allowlist.creator == sender, ENoAccess);
        allowlist.active = false;

        event::emit(AllowlistDeactivated {
            allowlist_id: object::uid_to_inner(&allowlist.id),
            allowlist_type: TYPE_CUSTOM,
            deactivated_by: sender,
            timestamp: sui::clock::timestamp_ms(clock),
        });
    }

    /// Cleanup expired allowlists (admin or automated job)
    public fun cleanup_expired_chat_allowlist(
        allowlist: &mut ChatAllowlist,
        clock: &Clock
    ): bool {
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            let current_time = sui::clock::timestamp_ms(clock);
            if (current_time > expires) {
                allowlist.active = false;
                event::emit(AllowlistExpired {
                    allowlist_id: object::uid_to_inner(&allowlist.id),
                    allowlist_type: TYPE_CHAT,
                    timestamp: current_time,
                });
                return true
            };
        };
        false
    }

    public fun cleanup_expired_subscription_allowlist(
        allowlist: &mut SubscriptionAllowlist,
        clock: &Clock
    ): bool {
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            let current_time = sui::clock::timestamp_ms(clock);
            if (current_time > expires) {
                allowlist.active = false;
                event::emit(AllowlistExpired {
                    allowlist_id: object::uid_to_inner(&allowlist.id),
                    allowlist_type: TYPE_SUBSCRIPTION,
                    timestamp: current_time,
                });
                return true
            };
        };
        false
    }

    public fun cleanup_expired_match_allowlist(
        allowlist: &mut MatchAllowlist,
        clock: &Clock
    ): bool {
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            let current_time = sui::clock::timestamp_ms(clock);
            if (current_time > expires) {
                allowlist.active = false;
                event::emit(AllowlistExpired {
                    allowlist_id: object::uid_to_inner(&allowlist.id),
                    allowlist_type: TYPE_MATCH,
                    timestamp: current_time,
                });
                return true
            };
        };
        false
    }

    public fun cleanup_expired_custom_allowlist(
        allowlist: &mut CustomAllowlist,
        clock: &Clock
    ): bool {
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            let current_time = sui::clock::timestamp_ms(clock);
            if (current_time > expires) {
                allowlist.active = false;
                event::emit(AllowlistExpired {
                    allowlist_id: object::uid_to_inner(&allowlist.id),
                    allowlist_type: TYPE_CUSTOM,
                    timestamp: current_time,
                });
                return true
            };
        };
        false
    }

    // ===== View Functions =====

    // Registry views
    public fun get_total_allowlists(registry: &AllowlistRegistry): u64 {
        registry.total_allowlists
    }

    public fun get_chat_allowlist_id_by_chat(registry: &AllowlistRegistry, chat_id: ID): Option<ID> {
        if (table::contains(&registry.chat_allowlists, chat_id)) {
            option::some(*table::borrow(&registry.chat_allowlists, chat_id))
        } else {
            option::none()
        }
    }

    public fun get_match_allowlist_id_by_match(registry: &AllowlistRegistry, match_id: ID): Option<ID> {
        if (table::contains(&registry.match_allowlists, match_id)) {
            option::some(*table::borrow(&registry.match_allowlists, match_id))
        } else {
            option::none()
        }
    }

    public fun get_user_subscription_allowlist_ids(registry: &AllowlistRegistry, user: address): vector<ID> {
        if (table::contains(&registry.subscription_allowlists, user)) {
            *table::borrow(&registry.subscription_allowlists, user)
        } else {
            vector::empty()
        }
    }

    public fun get_user_custom_allowlist_ids(registry: &AllowlistRegistry, user: address): vector<ID> {
        if (table::contains(&registry.custom_allowlists, user)) {
            *table::borrow(&registry.custom_allowlists, user)
        } else {
            vector::empty()
        }
    }

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

    public fun is_chat_allowlist_expired(allowlist: &ChatAllowlist, current_time: u64): bool {
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            current_time > expires
        } else {
            false
        }
    }

    public fun is_subscription_allowlist_expired(allowlist: &SubscriptionAllowlist, current_time: u64): bool {
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            current_time > expires
        } else {
            false
        }
    }

    public fun is_match_allowlist_expired(allowlist: &MatchAllowlist, current_time: u64): bool {
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            current_time > expires
        } else {
            false
        }
    }

    public fun is_custom_allowlist_expired(allowlist: &CustomAllowlist, current_time: u64): bool {
        if (option::is_some(&allowlist.expires_at)) {
            let expires = *option::borrow(&allowlist.expires_at);
            current_time > expires
        } else {
            false
        }
    }

    public fun get_subscription_allowlist_subscriber_count(allowlist: &SubscriptionAllowlist): u64 {
        vec_set::length(&allowlist.subscribers)
    }

    public fun get_custom_allowlist_address_count(allowlist: &CustomAllowlist): u64 {
        vec_set::length(&allowlist.allowed_addresses)
    }

    // ===== Initialize Module =====

    fun init(ctx: &mut TxContext) {
        // Create and share AllowlistRegistry
        transfer::share_object(AllowlistRegistry {
            id: object::new(ctx),
            chat_allowlists: table::new(ctx),
            subscription_allowlists: table::new(ctx),
            match_allowlists: table::new(ctx),
            custom_allowlists: table::new(ctx),
            timelocks: table::new(ctx),
            total_allowlists: 0,
        });
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}