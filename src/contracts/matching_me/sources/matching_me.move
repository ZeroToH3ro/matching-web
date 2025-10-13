#[allow(duplicate_alias, unused_use, unused_field)]
module matching_me::core {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use std::vector;
    use sui::clock::{Self, Clock};
    use sui::random::{Self, Random};
    use sui::table::{Self, Table};
    use sui::bag::{Self, Bag};

    // ===== Error Codes =====

    const EProfileAlreadyExists: u64 = 1;
    const EProfileNotFound: u64 = 2;
    const EUnauthorized: u64 = 3;
    const EInvalidAge: u64 = 4;
    const EInvalidInterests: u64 = 5;
    const ECannotMatchSelf: u64 = 6;
    const EInsufficientPermissions: u64 = 7;
    const EInvalidSubscription: u64 = 8;
    const ESubscriptionExpired: u64 = 10;
    const EInvalidVisibilityLevel: u64 = 12;
    const EInactive: u64 = 13;

    // ===== Constants =====

    const MAX_INTERESTS: u64 = 20;
    const MIN_INTERESTS: u64 = 3;
    const MIN_AGE: u8 = 18;
    const MAX_AGE: u8 = 100;
    const SUBSCRIPTION_2_YEARS_MS: u64 = 63072000000; // 2 years in milliseconds

    // Profile Visibility Levels
    const VISIBILITY_PUBLIC: u8 = 0;
    const VISIBILITY_MATCHES_ONLY: u8 = 2;

    // Match Status
    const MATCH_STATUS_PENDING: u8 = 0;
    const MATCH_STATUS_ACTIVE: u8 = 1;
    const MATCH_STATUS_BLOCKED: u8 = 3;

    // Subscription Tiers
    const TIER_BASIC: u8 = 1;
    const TIER_PREMIUM: u8 = 2;
    const TIER_PLATINUM: u8 = 3;

    // Media Content Types
    const CONTENT_TYPE_IMAGE: u8 = 0;
    const CONTENT_TYPE_AVATAR: u8 = 1;
    const CONTENT_TYPE_VIDEO: u8 = 2;

    // ===== Optimized Structs =====

    /// Dynamic User Profile NFT
    public struct UserProfile has key, store {
        id: UID,
        owner: address,
        display_name: String,
        age: u8,
        bio: String,
        interests: vector<String>,
        reputation_score: u64,
        privacy_settings: PrivacySettings,
        created_at: u64,
        last_active: u64,
        profile_version: u64,
        subscription_id: Option<ID>,
        
        // New: Track user's matches and media
        match_count: u64,
        media_count: u64,
    }

    /// Optimized Registry with Table for O(1) lookup
    public struct ProfileRegistry has key {
        id: UID,
        profiles: Table<address, ID>,  // O(1) lookup by address
        total_profiles: u64,
    }

    public struct PrivacySettings has store, copy, drop {
        profile_visibility: u8,
        location_sharing: bool,
        read_receipts: bool,
        online_status_visible: bool,
    }

    public struct Match has key {
        id: UID,
        user_a: address,
        user_b: address,
        compatibility_score: u64,
        status: u8,
        created_at: u64,
        last_interaction: u64,
        mutual_like: bool,
    }

    /// New: Global Match Registry for efficient querying
    public struct MatchRegistry has key {
        id: UID,
        user_matches: Table<address, vector<ID>>,  // User's match IDs
        total_matches: u64,
    }

    public struct MediaContent has key, store {
        id: UID,
        owner: address,
        walrus_blob_id: String,
        content_type: u8,
        visibility_level: u8,
        seal_policy_id: Option<String>,
        access_permissions: vector<address>,
        moderation_status: u8,
        ai_safety_score: u64,
        caption: String,
        tags: vector<String>,
        uploaded_at: u64,
        expires_at: Option<u64>,
        view_count: u64,  // New: Track views
    }

    /// New: Media Registry for efficient querying
    public struct MediaRegistry has key {
        id: UID,
        user_media: Table<address, vector<ID>>,  // User's media IDs
        total_media: u64,
    }

    public struct Subscription has key {
        id: UID,
        subscriber: address,
        tier: u8,
        seal_policy_id: String,
        start_date: u64,
        end_date: u64,
        auto_renewal: bool,
        unlimited_likes: bool,
        super_likes_count: u64,
        super_likes_used: u64,  // New: Track usage
        advanced_filters: bool,
        incognito_mode: bool,
    }

    public struct VerificationRecord has key {
        id: UID,
        subject: address,
        trust_score: u64,
        reputation_history: vector<ReputationEvent>,
        created_at: u64,
        last_updated: u64,
        expires_at: Option<u64>,
    }

    public struct ReputationEvent has store, copy, drop {
        event_type: u8,
        impact: u64,
        timestamp: u64,
        reporter: Option<address>,
    }

    public struct DigitalGift has key, store {
        id: UID,
        from: address,
        to: address,
        gift_type: u8,
        amount: u64,
        message: String,
        sui_ns_recipient: Option<String>,
        sent_at: u64,
        claimed: bool,
    }

    // ===== Events =====

    public struct ProfileCreated has copy, drop {
        profile_id: ID,
        owner: address,
        timestamp: u64,
    }

    public struct ProfileUpdated has copy, drop {
        profile_id: ID,
        owner: address,
        version: u64,
        timestamp: u64,
    }

    public struct ProfileDeleted has copy, drop {
        profile_id: ID,
        owner: address,
        timestamp: u64,
    }

    public struct MatchCreated has copy, drop {
        match_id: ID,
        user_a: address,
        user_b: address,
        compatibility_score: u64,
        timestamp: u64,
    }

    public struct MatchDeleted has copy, drop {
        match_id: ID,
        user_a: address,
        user_b: address,
        timestamp: u64,
    }

    public struct LikeGiven has copy, drop {
        from: address,
        to: address,
        is_super: bool,
        is_mutual: bool,
        timestamp: u64,
    }

    public struct GiftSent has copy, drop {
        gift_id: ID,
        from: address,
        to: address,
        gift_type: u8,
        amount: u64,
        timestamp: u64,
    }

    public struct SubscriptionCreated has copy, drop {
        subscription_id: ID,
        subscriber: address,
        tier: u8,
        start_date: u64,
        end_date: u64,
    }

    public struct MediaUploaded has copy, drop {
        media_id: ID,
        owner: address,
        content_type: u8,
        timestamp: u64,
    }

    // ===== Optimized Helper Functions =====

    /// O(1) lookup instead of O(n)
    fun profile_exists(registry: &ProfileRegistry, owner: address): bool {
        table::contains(&registry.profiles, owner)
    }

    public fun get_profile_id(registry: &ProfileRegistry, owner: address): ID {
        *table::borrow(&registry.profiles, owner)
    }

    /// Add profile to registry
    fun add_profile_to_registry(registry: &mut ProfileRegistry, owner: address, profile_id: ID) {
        table::add(&mut registry.profiles, owner, profile_id);
        registry.total_profiles = registry.total_profiles + 1;
    }

    /// Remove profile from registry
    fun remove_profile_from_registry(registry: &mut ProfileRegistry, owner: address) {
        table::remove(&mut registry.profiles, owner);
        registry.total_profiles = registry.total_profiles - 1;
    }

    /// Add match to user's match list
    fun add_match_to_registry(
        registry: &mut MatchRegistry,
        user_a: address,
        user_b: address,
        match_id: ID
    ) {
        // Add to user_a's matches
        if (!table::contains(&registry.user_matches, user_a)) {
            table::add(&mut registry.user_matches, user_a, vector::empty());
        };
        let matches_a = table::borrow_mut(&mut registry.user_matches, user_a);
        vector::push_back(matches_a, match_id);

        // Add to user_b's matches
        if (!table::contains(&registry.user_matches, user_b)) {
            table::add(&mut registry.user_matches, user_b, vector::empty());
        };
        let matches_b = table::borrow_mut(&mut registry.user_matches, user_b);
        vector::push_back(matches_b, match_id);

        registry.total_matches = registry.total_matches + 1;
    }

    /// Add media to user's media list
    fun add_media_to_registry(registry: &mut MediaRegistry, owner: address, media_id: ID) {
        if (!table::contains(&registry.user_media, owner)) {
            table::add(&mut registry.user_media, owner, vector::empty());
        };
        let media_list = table::borrow_mut(&mut registry.user_media, owner);
        vector::push_back(media_list, media_id);
        registry.total_media = registry.total_media + 1;
    }

    // ===== Public Functions =====

    /// Create a new user profile (Dynamic NFT)
    public fun create_profile(
        registry: &mut ProfileRegistry,
        display_name: String,
        age: u8,
        bio: String,
        interests: vector<String>,
        clock: &Clock,
        ctx: &mut TxContext
    ): UserProfile {
        let sender = tx_context::sender(ctx);
        assert!(!profile_exists(registry, sender), EProfileAlreadyExists);
        assert!(age >= MIN_AGE && age <= MAX_AGE, EInvalidAge);
        
        let interests_len = vector::length(&interests);
        assert!(interests_len >= MIN_INTERESTS && interests_len <= MAX_INTERESTS, EInvalidInterests);

        let current_time = clock::timestamp_ms(clock);
        let profile_uid = object::new(ctx);
        let profile_id = object::uid_to_inner(&profile_uid);

        let profile = UserProfile {
            id: profile_uid,
            owner: sender,
            display_name,
            age,
            bio,
            interests,
            reputation_score: 0,
            privacy_settings: PrivacySettings {
                profile_visibility: VISIBILITY_PUBLIC,
                location_sharing: false,
                read_receipts: true,
                online_status_visible: true,
            },
            created_at: current_time,
            last_active: current_time,
            profile_version: 1,
            subscription_id: option::none(),
            match_count: 0,
            media_count: 0,
        };

        add_profile_to_registry(registry, sender, profile_id);

        event::emit(ProfileCreated {
            profile_id,
            owner: sender,
            timestamp: current_time,
        });

        profile
    }

    /// Update user profile
    public fun update_profile(
        registry: &ProfileRegistry,
        profile: &mut UserProfile,
        new_display_name: Option<String>,
        new_bio: Option<String>,
        new_interests: Option<vector<String>>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(profile.owner == sender, EUnauthorized);
        assert!(profile_exists(registry, sender), EProfileNotFound);

        if (option::is_some(&new_display_name)) {
            profile.display_name = option::destroy_some(new_display_name);
        };

        if (option::is_some(&new_bio)) {
            profile.bio = option::destroy_some(new_bio);
        };

        if (option::is_some(&new_interests)) {
            let interests = option::destroy_some(new_interests);
            let interests_len = vector::length(&interests);
            assert!(interests_len >= MIN_INTERESTS && interests_len <= MAX_INTERESTS, EInvalidInterests);
            profile.interests = interests;
        };

        profile.profile_version = profile.profile_version + 1;
        let timestamp = clock::timestamp_ms(clock);
        profile.last_active = timestamp;

        event::emit(ProfileUpdated {
            profile_id: object::uid_to_inner(&profile.id),
            owner: profile.owner,
            version: profile.profile_version,
            timestamp,
        });
    }

    /// Update privacy settings
    public fun update_privacy_settings(
        profile: &mut UserProfile,
        profile_visibility: Option<u8>,
        location_sharing: Option<bool>,
        read_receipts: Option<bool>,
        online_status_visible: Option<bool>,
        ctx: &TxContext
    ) {
        assert!(profile.owner == tx_context::sender(ctx), EUnauthorized);

        if (option::is_some(&profile_visibility)) {
            let visibility = option::destroy_some(profile_visibility);
            assert!(visibility <= VISIBILITY_MATCHES_ONLY, EInvalidVisibilityLevel);
            profile.privacy_settings.profile_visibility = visibility;
        };

        if (option::is_some(&location_sharing)) {
            profile.privacy_settings.location_sharing = option::destroy_some(location_sharing);
        };

        if (option::is_some(&read_receipts)) {
            profile.privacy_settings.read_receipts = option::destroy_some(read_receipts);
        };

        if (option::is_some(&online_status_visible)) {
            profile.privacy_settings.online_status_visible = option::destroy_some(online_status_visible);
        };
    }

    /// Soft delete profile (mark as inactive)
    public fun delete_profile(
        registry: &mut ProfileRegistry,
        profile: UserProfile,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(profile.owner == tx_context::sender(ctx), EUnauthorized);
        
        let profile_id = object::uid_to_inner(&profile.id);
        let owner = profile.owner;
        
        remove_profile_from_registry(registry, owner);
        
        let UserProfile {
            id,
            owner: _,
            display_name: _,
            age: _,
            bio: _,
            interests: _,
            reputation_score: _,
            privacy_settings: _,
            created_at: _,
            last_active: _,
            profile_version: _,
            subscription_id: _,
            match_count: _,
            media_count: _,
        } = profile;
        
        object::delete(id);

        event::emit(ProfileDeleted {
            profile_id,
            owner,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Create a match between two users
    public fun create_match(
        registry: &mut MatchRegistry,
        profile_a: &mut UserProfile,
        profile_b: &mut UserProfile,
        compatibility_score: u64,
        zk_proof_valid: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ): Match {
        assert!(profile_a.owner != profile_b.owner, ECannotMatchSelf);
        assert!(zk_proof_valid, EInsufficientPermissions);

        let current_time = clock::timestamp_ms(clock);
        let match_uid = object::new(ctx);
        let match_id = object::uid_to_inner(&match_uid);

        let match_obj = Match {
            id: match_uid,
            user_a: profile_a.owner,
            user_b: profile_b.owner,
            compatibility_score,
            status: MATCH_STATUS_PENDING,
            created_at: current_time,
            last_interaction: current_time,
            mutual_like: false,
        };

        // Update match counts
        profile_a.match_count = profile_a.match_count + 1;
        profile_b.match_count = profile_b.match_count + 1;

        // Add to registry
        add_match_to_registry(registry, profile_a.owner, profile_b.owner, match_id);

        event::emit(MatchCreated {
            match_id,
            user_a: profile_a.owner,
            user_b: profile_b.owner,
            compatibility_score,
            timestamp: current_time,
        });

        match_obj
    }

    /// Create match with only sender's profile (one-sided match request)
    /// This is more practical as user can only modify their own profile
    /// Returns the match_id for tracking
    public fun create_match_request(
        registry: &mut MatchRegistry,
        my_profile: &mut UserProfile,
        target_user: address,
        compatibility_score: u64,
        zk_proof_valid: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        let sender = tx_context::sender(ctx);
        assert!(my_profile.owner == sender, EInsufficientPermissions);
        assert!(sender != target_user, ECannotMatchSelf);
        assert!(zk_proof_valid, EInsufficientPermissions);

        let current_time = clock::timestamp_ms(clock);
        let match_uid = object::new(ctx);
        let match_id = object::uid_to_inner(&match_uid);

        let match_obj = Match {
            id: match_uid,
            user_a: sender,
            user_b: target_user,
            compatibility_score,
            status: MATCH_STATUS_PENDING,
            created_at: current_time,
            last_interaction: current_time,
            mutual_like: false,
        };

        // Only update sender's match count
        my_profile.match_count = my_profile.match_count + 1;

        // Add to registry
        add_match_to_registry(registry, sender, target_user, match_id);

        event::emit(MatchCreated {
            match_id,
            user_a: sender,
            user_b: target_user,
            compatibility_score,
            timestamp: current_time,
        });

        // Transfer match object to sender
        transfer::transfer(match_obj, sender);

        match_id
    }

    /// Update match status
    public fun update_match_status(
        match_obj: &mut Match,
        new_status: u8,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(
            match_obj.user_a == sender || match_obj.user_b == sender,
            EUnauthorized
        );
        assert!(new_status <= MATCH_STATUS_BLOCKED, EInvalidVisibilityLevel);

        match_obj.status = new_status;
        match_obj.last_interaction = clock::timestamp_ms(clock);
    }

    /// Delete a match
    public fun delete_match(
        match_obj: Match,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(
            match_obj.user_a == sender || match_obj.user_b == sender,
            EUnauthorized
        );

        let match_id = object::uid_to_inner(&match_obj.id);
        let user_a = match_obj.user_a;
        let user_b = match_obj.user_b;

        let Match {
            id,
            user_a: _,
            user_b: _,
            compatibility_score: _,
            status: _,
            created_at: _,
            last_interaction: _,
            mutual_like: _,
        } = match_obj;

        object::delete(id);

        event::emit(MatchDeleted {
            match_id,
            user_a,
            user_b,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Send digital gift
    public fun send_gift(
        from_profile: &UserProfile,
        recipient: address,
        gift_type: u8,
        amount: u64,
        message: String,
        sui_ns_name: Option<String>,
        clock: &Clock,
        ctx: &mut TxContext
    ): DigitalGift {
        assert!(from_profile.owner == tx_context::sender(ctx), EUnauthorized);

        let current_time = clock::timestamp_ms(clock);
        let gift_uid = object::new(ctx);
        let gift_id = object::uid_to_inner(&gift_uid);

        let gift = DigitalGift {
            id: gift_uid,
            from: from_profile.owner,
            to: recipient,
            gift_type,
            amount,
            message,
            sui_ns_recipient: sui_ns_name,
            sent_at: current_time,
            claimed: false,
        };

        event::emit(GiftSent {
            gift_id,
            from: from_profile.owner,
            to: recipient,
            gift_type,
            amount,
            timestamp: current_time,
        });

        gift
    }

    /// Claim a gift
    public fun claim_gift(gift: &mut DigitalGift, ctx: &TxContext) {
        assert!(gift.to == tx_context::sender(ctx), EUnauthorized);
        assert!(!gift.claimed, EUnauthorized);
        gift.claimed = true;
    }

    /// Create premium subscription
    public fun create_subscription(
        profile: &mut UserProfile,
        tier: u8,
        seal_policy_id: String,
        duration_days: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Subscription {
        assert!(profile.owner == tx_context::sender(ctx), EUnauthorized);
        assert!(tier >= TIER_BASIC && tier <= TIER_PLATINUM, EInvalidSubscription);

        let current_time = clock::timestamp_ms(clock);
        let end_time = current_time + (duration_days * 24 * 60 * 60 * 1000);
        let subscription_uid = object::new(ctx);
        let subscription_id = object::uid_to_inner(&subscription_uid);

        let (unlimited_likes, super_likes, advanced_filters, incognito) = 
            get_tier_features(tier);

        let subscription = Subscription {
            id: subscription_uid,
            subscriber: profile.owner,
            tier,
            seal_policy_id,
            start_date: current_time,
            end_date: end_time,
            auto_renewal: false,
            unlimited_likes,
            super_likes_count: super_likes,
            super_likes_used: 0,
            advanced_filters,
            incognito_mode: incognito,
        };

        profile.subscription_id = option::some(subscription_id);

        event::emit(SubscriptionCreated {
            subscription_id,
            subscriber: profile.owner,
            tier,
            start_date: current_time,
            end_date: end_time,
        });

        subscription
    }

    /// Helper: Get tier features
    fun get_tier_features(tier: u8): (bool, u64, bool, bool) {
        if (tier == TIER_BASIC) {
            (false, 5, false, false)
        } else if (tier == TIER_PREMIUM) {
            (true, 25, true, false)
        } else if (tier == TIER_PLATINUM) {
            (true, 100, true, true)
        } else {
            (false, 0, false, false)
        }
    }

    /// Use super like
    public fun use_super_like(
        subscription: &mut Subscription,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(subscription.subscriber == tx_context::sender(ctx), EUnauthorized);
        assert!(is_subscription_active(subscription, clock::timestamp_ms(clock)), ESubscriptionExpired);
        assert!(
            subscription.super_likes_used < subscription.super_likes_count,
            EInsufficientPermissions
        );

        subscription.super_likes_used = subscription.super_likes_used + 1;
    }

    /// Upload media content
    public fun create_media_content(
        registry: &mut MediaRegistry,
        profile: &mut UserProfile,
        walrus_blob_id: String,
        content_type: u8,
        visibility_level: u8,
        seal_policy_id: Option<String>,
        caption: String,
        tags: vector<String>,
        clock: &Clock,
        ctx: &mut TxContext
    ): MediaContent {
        assert!(profile.owner == tx_context::sender(ctx), EUnauthorized);
        assert!(visibility_level <= VISIBILITY_MATCHES_ONLY, EInvalidVisibilityLevel);

        let current_time = clock::timestamp_ms(clock);
        let media_uid = object::new(ctx);
        let media_id = object::uid_to_inner(&media_uid);

        let media = MediaContent {
            id: media_uid,
            owner: profile.owner,
            walrus_blob_id,
            content_type,
            visibility_level,
            seal_policy_id,
            access_permissions: vector::empty(),
            moderation_status: 0,
            ai_safety_score: 0,
            caption,
            tags,
            uploaded_at: current_time,
            expires_at: option::none(),
            view_count: 0,
        };

        profile.media_count = profile.media_count + 1;
        add_media_to_registry(registry, profile.owner, media_id);

        event::emit(MediaUploaded {
            media_id,
            owner: profile.owner,
            content_type,
            timestamp: current_time,
        });

        media
    }

    /// Upload private avatar with Seal encryption - only visible to matched users
    public fun upload_private_avatar(
        registry: &mut MediaRegistry,
        profile: &mut UserProfile,
        walrus_blob_id: String,
        seal_policy_id: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): MediaContent {
        assert!(profile.owner == tx_context::sender(ctx), EUnauthorized);

        let current_time = clock::timestamp_ms(clock);
        let media_uid = object::new(ctx);
        let media_id = object::uid_to_inner(&media_uid);

        // Create private avatar media with Seal encryption
        let media = MediaContent {
            id: media_uid,
            owner: profile.owner,
            walrus_blob_id,
            content_type: 1, // Avatar content type
            visibility_level: VISIBILITY_MATCHES_ONLY, // Only matches can see
            seal_policy_id: option::some(seal_policy_id),
            access_permissions: vector::empty(),
            moderation_status: 0,
            ai_safety_score: 0,
            caption: string::utf8(b"Private Avatar"),
            tags: vector::singleton(string::utf8(b"avatar")),
            uploaded_at: current_time,
            expires_at: option::none(),
            view_count: 0,
        };

        profile.media_count = profile.media_count + 1;
        add_media_to_registry(registry, profile.owner, media_id);

        event::emit(MediaUploaded {
            media_id,
            owner: profile.owner,
            content_type: 1, // Avatar
            timestamp: current_time,
        });

        media
    }

    /// Grant avatar access to a matched user
    public fun grant_avatar_access(
        avatar_media: &mut MediaContent,
        profile: &UserProfile,
        match_obj: &Match,
        target_user: address,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(profile.owner == sender, EUnauthorized);
        assert!(avatar_media.owner == sender, EUnauthorized);
        
        // Verify this is a valid match
        let (user_a, user_b) = get_match_users(match_obj);
        assert!(
            (sender == user_a && target_user == user_b) || 
            (sender == user_b && target_user == user_a),
            EUnauthorized
        );
        
        // Verify match is active
        assert!(is_match_active(match_obj), EInactive);
        
        // Add target user to access permissions if not already present
        if (!vector::contains(&avatar_media.access_permissions, &target_user)) {
            vector::push_back(&mut avatar_media.access_permissions, target_user);
        };
    }

    /// Revoke avatar access from a user
    public fun revoke_avatar_access(
        avatar_media: &mut MediaContent,
        profile: &UserProfile,
        target_user: address,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(profile.owner == sender, EUnauthorized);
        assert!(avatar_media.owner == sender, EUnauthorized);
        
        // Find and remove target user from access permissions
        let (found, index) = vector::index_of(&avatar_media.access_permissions, &target_user);
        if (found) {
            vector::remove(&mut avatar_media.access_permissions, index);
        };
    }

    /// Increment media view count
    public fun increment_media_views(media: &mut MediaContent) {
        media.view_count = media.view_count + 1;
    }

    /// Create identity verification record
    public fun create_verification_record(
        subject: address,
        trust_score: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): VerificationRecord {
        let current_time = clock::timestamp_ms(clock);
        let verification_id = object::new(ctx);

        VerificationRecord {
            id: verification_id,
            subject,
            trust_score,
            reputation_history: vector::empty(),
            created_at: current_time,
            last_updated: current_time,
            expires_at: option::some(current_time + SUBSCRIPTION_2_YEARS_MS),
        }
    }

    // ===== Enhanced View Functions =====

    // Profile Views
    public fun get_profile_owner(profile: &UserProfile): address {
        profile.owner
    }

    public fun get_profile_display_name(profile: &UserProfile): String {
        profile.display_name
    }

    public fun get_profile_age(profile: &UserProfile): u8 {
        profile.age
    }

    public fun get_profile_bio(profile: &UserProfile): String {
        profile.bio
    }

    public fun get_profile_interests(profile: &UserProfile): &vector<String> {
        &profile.interests
    }

    public fun get_profile_reputation(profile: &UserProfile): u64 {
        profile.reputation_score
    }

    public fun get_profile_created_at(profile: &UserProfile): u64 {
        profile.created_at
    }

    public fun get_profile_last_active(profile: &UserProfile): u64 {
        profile.last_active
    }

    public fun get_profile_version(profile: &UserProfile): u64 {
        profile.profile_version
    }

    public fun get_profile_match_count(profile: &UserProfile): u64 {
        profile.match_count
    }

    public fun get_profile_media_count(profile: &UserProfile): u64 {
        profile.media_count
    }

    public fun get_profile_subscription_id(profile: &UserProfile): Option<ID> {
        profile.subscription_id
    }

    public fun has_subscription(profile: &UserProfile): bool {
        option::is_some(&profile.subscription_id)
    }

    // Privacy Settings Views
    public fun get_privacy_visibility(profile: &UserProfile): u8 {
        profile.privacy_settings.profile_visibility
    }

    public fun get_privacy_location_sharing(profile: &UserProfile): bool {
        profile.privacy_settings.location_sharing
    }

    public fun get_privacy_read_receipts(profile: &UserProfile): bool {
        profile.privacy_settings.read_receipts
    }

    public fun get_privacy_online_status(profile: &UserProfile): bool {
        profile.privacy_settings.online_status_visible
    }

    // Registry Views
    public fun get_total_profiles(registry: &ProfileRegistry): u64 {
        registry.total_profiles
    }

    public fun get_total_matches(registry: &MatchRegistry): u64 {
        registry.total_matches
    }

    public fun get_total_media(registry: &MediaRegistry): u64 {
        registry.total_media
    }

    public fun has_profile(registry: &ProfileRegistry, owner: address): bool {
        profile_exists(registry, owner)
    }

    public fun get_user_match_ids(registry: &MatchRegistry, user: address): &vector<ID> {
        table::borrow(&registry.user_matches, user)
    }

    public fun get_user_media_ids(registry: &MediaRegistry, user: address): &vector<ID> {
        table::borrow(&registry.user_media, user)
    }

    public fun get_user_match_count(registry: &MatchRegistry, user: address): u64 {
        if (table::contains(&registry.user_matches, user)) {
            vector::length(table::borrow(&registry.user_matches, user))
        } else {
            0
        }
    }

    public fun get_user_media_count(registry: &MediaRegistry, user: address): u64 {
        if (table::contains(&registry.user_media, user)) {
            vector::length(table::borrow(&registry.user_media, user))
        } else {
            0
        }
    }

    // Match Views
    public fun get_match_users(match_obj: &Match): (address, address) {
        (match_obj.user_a, match_obj.user_b)
    }

    public fun get_match_compatibility_score(match_obj: &Match): u64 {
        match_obj.compatibility_score
    }

    public fun get_match_status(match_obj: &Match): u8 {
        match_obj.status
    }

    public fun get_match_created_at(match_obj: &Match): u64 {
        match_obj.created_at
    }

    public fun get_match_last_interaction(match_obj: &Match): u64 {
        match_obj.last_interaction
    }

    public fun is_mutual_like(match_obj: &Match): bool {
        match_obj.mutual_like
    }

    public fun is_match_active(match_obj: &Match): bool {
        match_obj.status == MATCH_STATUS_ACTIVE
    }

    public fun get_match_id(match_obj: &Match): ID {
        object::uid_to_inner(&match_obj.id)
    }

    // Subscription Views
    public fun get_subscription_tier(subscription: &Subscription): u8 {
        subscription.tier
    }

    public fun get_subscription_subscriber(subscription: &Subscription): address {
        subscription.subscriber
    }

    public fun get_subscription_dates(subscription: &Subscription): (u64, u64) {
        (subscription.start_date, subscription.end_date)
    }

    public fun is_subscription_active(subscription: &Subscription, current_time: u64): bool {
        subscription.end_date > current_time
    }

    public fun has_unlimited_likes(subscription: &Subscription): bool {
        subscription.unlimited_likes
    }

    public fun get_super_likes_remaining(subscription: &Subscription): u64 {
        subscription.super_likes_count - subscription.super_likes_used
    }

    public fun has_advanced_filters(subscription: &Subscription): bool {
        subscription.advanced_filters
    }

    public fun has_incognito_mode(subscription: &Subscription): bool {
        subscription.incognito_mode
    }

    public fun is_auto_renewal(subscription: &Subscription): bool {
        subscription.auto_renewal
    }

    // Media Views
    public fun get_media_owner(media: &MediaContent): address {
        media.owner
    }

    public fun get_media_walrus_id(media: &MediaContent): String {
        media.walrus_blob_id
    }

    public fun get_media_content_type(media: &MediaContent): u8 {
        media.content_type
    }

    public fun get_media_visibility_level(media: &MediaContent): u8 {
        media.visibility_level
    }

    public fun get_media_seal_policy_id(media: &MediaContent): Option<String> {
        media.seal_policy_id
    }

    public fun get_media_access_permissions(media: &MediaContent): &vector<address> {
        &media.access_permissions
    }

    public fun get_media_caption(media: &MediaContent): String {
        media.caption
    }

    public fun get_media_tags(media: &MediaContent): &vector<String> {
        &media.tags
    }

    public fun get_media_uploaded_at(media: &MediaContent): u64 {
        media.uploaded_at
    }

    public fun get_media_view_count(media: &MediaContent): u64 {
        media.view_count
    }

    public fun is_avatar_content(media: &MediaContent): bool {
        media.content_type == CONTENT_TYPE_AVATAR
    }

    public fun can_access_avatar(media: &MediaContent, viewer: address): bool {
        // Owner can always access their own avatar
        if (media.owner == viewer) {
            return true
        };
        
        // Check if viewer is in access permissions (i.e., matched users)
        vector::contains(&media.access_permissions, &viewer)
    }

    public fun has_seal_encryption(media: &MediaContent): bool {
        option::is_some(&media.seal_policy_id)
    }

    public fun get_media_visibility(media: &MediaContent): u8 {
        media.visibility_level
    }

    public fun get_media_moderation_status(media: &MediaContent): u8 {
        media.moderation_status
    }

    public fun get_media_ai_safety_score(media: &MediaContent): u64 {
        media.ai_safety_score
    }

    public fun is_media_expired(media: &MediaContent, current_time: u64): bool {
        if (option::is_some(&media.expires_at)) {
            let expires = *option::borrow(&media.expires_at);
            current_time > expires
        } else {
            false
        }
    }

    // Gift Views
    public fun get_gift_sender(gift: &DigitalGift): address {
        gift.from
    }

    public fun get_gift_recipient(gift: &DigitalGift): address {
        gift.to
    }

    public fun get_gift_type(gift: &DigitalGift): u8 {
        gift.gift_type
    }

    public fun get_gift_amount(gift: &DigitalGift): u64 {
        gift.amount
    }

    public fun get_gift_message(gift: &DigitalGift): String {
        gift.message
    }

    public fun is_gift_claimed(gift: &DigitalGift): bool {
        gift.claimed
    }

    public fun get_gift_sent_at(gift: &DigitalGift): u64 {
        gift.sent_at
    }

    public fun get_gift_id(gift: &DigitalGift): ID {
        object::uid_to_inner(&gift.id)
    }

    public fun get_media_id(media: &MediaContent): ID {
        object::uid_to_inner(&media.id)
    }

    // Verification Views
    public fun get_verification_subject(verification: &VerificationRecord): address {
        verification.subject
    }

    public fun get_verification_trust_score(verification: &VerificationRecord): u64 {
        verification.trust_score
    }

    public fun get_verification_created_at(verification: &VerificationRecord): u64 {
        verification.created_at
    }

    public fun get_verification_last_updated(verification: &VerificationRecord): u64 {
        verification.last_updated
    }

    public fun is_verification_expired(verification: &VerificationRecord, current_time: u64): bool {
        if (option::is_some(&verification.expires_at)) {
            let expires = *option::borrow(&verification.expires_at);
            current_time > expires
        } else {
            false
        }
    }

    public fun get_reputation_history_length(verification: &VerificationRecord): u64 {
        vector::length(&verification.reputation_history)
    }

    // ===== Admin Functions =====

    public struct AdminCap has key { id: UID }

    /// Update moderation status for media content
    public fun update_media_moderation(
        media: &mut MediaContent,
        new_status: u8,
        ai_safety_score: u64,
        _admin_cap: &AdminCap,
    ) {
        media.moderation_status = new_status;
        media.ai_safety_score = ai_safety_score;
    }

    /// Update user reputation (admin only)
    public fun update_reputation(
        profile: &mut UserProfile,
        new_score: u64,
        _admin_cap: &AdminCap,
    ) {
        profile.reputation_score = new_score;
    }

    /// Add reputation event to verification record
    public fun add_reputation_event(
        verification: &mut VerificationRecord,
        event_type: u8,
        impact: u64,
        reporter: Option<address>,
        clock: &Clock,
        _admin_cap: &AdminCap,
    ) {
        let event = ReputationEvent {
            event_type,
            impact,
            timestamp: clock::timestamp_ms(clock),
            reporter,
        };
        vector::push_back(&mut verification.reputation_history, event);
        verification.last_updated = clock::timestamp_ms(clock);
    }

    /// Initialize module
    fun init(ctx: &mut TxContext) {
        // Create and transfer admin capability
        transfer::transfer(
            AdminCap { id: object::new(ctx) },
            tx_context::sender(ctx)
        );

        // Create and share registries
        transfer::share_object(ProfileRegistry {
            id: object::new(ctx),
            profiles: table::new(ctx),
            total_profiles: 0,
        });

        transfer::share_object(MatchRegistry {
            id: object::new(ctx),
            user_matches: table::new(ctx),
            total_matches: 0,
        });

        transfer::share_object(MediaRegistry {
            id: object::new(ctx),
            user_media: table::new(ctx),
            total_media: 0,
        });
    }

    // ===== Test Helper Functions =====
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}