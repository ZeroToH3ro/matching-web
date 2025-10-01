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

    // ===== Error Codes =====

    const EProfileAlreadyExists: u64 = 1;
    const EProfileNotFound: u64 = 2;
    const EUnauthorized: u64 = 3;
    const EInvalidAge: u64 = 4;
    const EInvalidInterests: u64 = 5;
    const ECannotMatchSelf: u64 = 6;
    const EInsufficientPermissions: u64 = 7;
    const EInvalidSubscription: u64 = 8;

    // ===== public Structs =====

    /// Dynamic User Profile NFT
    public struct UserProfile has key, store {
        id: UID,
        owner: address,
        display_name: String,
        age: u8,
        bio: String,
        interests: vector<String>,

        // Privacy & Reputation
        reputation_score: u64,
        privacy_settings: PrivacySettings,

        // Blockchain Metadata
        created_at: u64,
        last_active: u64,
        profile_version: u64,

        // Premium Features
        subscription_id: Option<ID>,
    }

    /// Registry of profile ownership used for uniqueness checks
    public struct ProfileRegistry has key {
        id: UID,
        entries: vector<ProfileIndex>,
    }

    public struct ProfileIndex has copy, drop, store {
        owner: address,
        profile_id: ID,
    }

    /// Privacy Settings Configuration
    public struct PrivacySettings has store, copy, drop {
        profile_visibility: u8, // 0=public, 1=verified_only, 2=matches_only
        location_sharing: bool,
        read_receipts: bool,
        online_status_visible: bool,
    }

    /// Match Record between two users
    public struct Match has key {
        id: UID,
        user_a: address,
        user_b: address,
        compatibility_score: u64, // Encrypted/hashed score from ZK computation
        status: u8, // 0=pending, 1=active, 2=expired, 3=blocked
        created_at: u64,
        last_interaction: u64,
        mutual_like: bool,
    }

    /// Media Content stored on Walrus
    public struct MediaContent has key, store {
        id: UID,
        owner: address,
        walrus_blob_id: String,
        content_type: u8, // 0=image, 1=video, 2=audio
        visibility_level: u8, // 0=public, 1=matches, 2=private

        // Access Control
        seal_policy_id: Option<String>,
        access_permissions: vector<address>,

        // Moderation
        moderation_status: u8, // 0=pending, 1=approved, 2=rejected
        ai_safety_score: u64,

        // Metadata
        caption: String,
        tags: vector<String>,
        uploaded_at: u64,
        expires_at: Option<u64>,
    }

    /// Subscription managed via Seal Protocol
    public struct Subscription has key {
        id: UID,
        subscriber: address,
        tier: u8, // 0=free, 1=basic, 2=premium, 3=platinum
        seal_policy_id: String,

        // Billing
        start_date: u64,
        end_date: u64,
        auto_renewal: bool,

        // Features
        unlimited_likes: bool,
        super_likes_count: u64,
        advanced_filters: bool,
        incognito_mode: bool,
    }

    /// Identity Verification Record
    public struct VerificationRecord has key {
        id: UID,
        subject: address,

        // Trust Metrics
        trust_score: u64,
        reputation_history: vector<ReputationEvent>,

        // Timestamps
        created_at: u64,
        last_updated: u64,
        expires_at: Option<u64>,
    }

    /// Reputation change event
    public struct ReputationEvent has store, copy, drop {
        event_type: u8, // 0=positive, 1=negative, 2=violation
        impact: u64,
        timestamp: u64,
        reporter: Option<address>,
    }

    /// Digital Gift/Interaction
    public struct DigitalGift has key {
        id: UID,
        from: address,
        to: address,
        gift_type: u8, // 0=flower, 1=coffee, 2=donation, 3=custom
        amount: u64,
        message: String,
        sui_ns_recipient: Option<String>, // If sent via SuiNS
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

    public struct MatchCreated has copy, drop {
        match_id: ID,
        user_a: address,
        user_b: address,
        compatibility_score: u64,
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

    fun registry_contains_owner(registry: &ProfileRegistry, owner: address): bool {
        let len = vector::length(&registry.entries);
        let mut i = 0;
        while (i < len) {
            let entry = vector::borrow(&registry.entries, i);
            if (entry.owner == owner) {
                return true
            };
            i = i + 1;
        };
        false
    }

    fun registry_contains_profile(registry: &ProfileRegistry, owner: address, profile_id: ID): bool {
        let len = vector::length(&registry.entries);
        let mut i = 0;
        while (i < len) {
            let entry = vector::borrow(&registry.entries, i);
            if (entry.owner == owner && entry.profile_id == profile_id) {
                return true
            };
            i = i + 1;
        };
        false
    }

    fun add_profile_entry(registry: &mut ProfileRegistry, owner: address, profile_id: ID) {
        vector::push_back(&mut registry.entries, ProfileIndex { owner, profile_id });
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
        assert!(!registry_contains_owner(registry, sender), EProfileAlreadyExists);
        assert!(age >= 18 && age <= 100, EInvalidAge);
        assert!(vector::length(&interests) >= 3 && vector::length(&interests) <= 20, EInvalidInterests);

        let current_time = clock::timestamp_ms(clock);
        let profile_id = object::new(ctx);
        let profile = UserProfile {
            id: profile_id,
            owner: sender,
            display_name,
            age,
            bio,
            interests,
            reputation_score: 0, // Starting reputation
            privacy_settings: PrivacySettings {
                profile_visibility: 0, // Public by default
                location_sharing: false,
                read_receipts: true,
                online_status_visible: true,
            },
            created_at: current_time,
            last_active: current_time,
            profile_version: 1,
            subscription_id: option::none(),
        };

        add_profile_entry(registry, sender, object::id(&profile));

        event::emit(ProfileCreated {
            profile_id: object::id(&profile),
            owner: sender,
            timestamp: current_time,
        });

        profile
    }

    /// Update user profile (triggers NFT evolution)
    public fun update_profile(
        registry: &ProfileRegistry,
        profile: &mut UserProfile,
        new_bio: Option<String>,
        new_interests: Option<vector<String>>,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(registry_contains_profile(registry, profile.owner, object::id(profile)), EProfileNotFound);
        assert!(profile.owner == tx_context::sender(ctx), EUnauthorized);

        if (option::is_some(&new_bio)) {
            profile.bio = option::destroy_some(new_bio);
        };

        if (option::is_some(&new_interests)) {
            let interests = option::destroy_some(new_interests);
            assert!(vector::length(&interests) >= 3 && vector::length(&interests) <= 20, EInvalidInterests);
            profile.interests = interests;
        };

        profile.profile_version = profile.profile_version + 1;
        let timestamp = clock::timestamp_ms(clock);
        profile.last_active = timestamp;

        event::emit(ProfileUpdated {
            profile_id: object::id(profile),
            owner: profile.owner,
            version: profile.profile_version,
            timestamp,
        });
    }

    /// Create a match between two users (requires ZK proof validation off-chain)
    public fun create_match(
        user_a: address,
        user_b: address,
        compatibility_score: u64,
        zk_proof_valid: bool, // Validated off-chain via Nautilus
        clock: &Clock,
        ctx: &mut TxContext
    ): Match {
        assert!(user_a != user_b, ECannotMatchSelf);
        assert!(zk_proof_valid, EInsufficientPermissions);

        let current_time = clock::timestamp_ms(clock);
        let match_id = object::new(ctx);

        let match_obj = Match {
            id: match_id,
            user_a,
            user_b,
            compatibility_score,
            status: 0, // Pending
            created_at: current_time,
            last_interaction: current_time,
            mutual_like: false,
        };

        event::emit(MatchCreated {
            match_id: object::id(&match_obj),
            user_a,
            user_b,
            compatibility_score,
            timestamp: current_time,
        });

        match_obj
    }

    /// Send digital gift using SuiNS or direct address
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
        let gift_id = object::new(ctx);

        let gift = DigitalGift {
            id: gift_id,
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
            gift_id: object::id(&gift),
            from: from_profile.owner,
            to: recipient,
            gift_type,
            amount,
            timestamp: current_time,
        });

        gift
    }

    /// Create premium subscription via Seal Protocol
    public fun create_subscription(
        profile: &mut UserProfile,
        tier: u8,
        seal_policy_id: String,
        duration_days: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Subscription {
        assert!(profile.owner == tx_context::sender(ctx), EUnauthorized);
        assert!(tier > 0 && tier <= 3, EInvalidSubscription);

        let current_time = clock::timestamp_ms(clock);
        let end_time = current_time + (duration_days * 24 * 60 * 60 * 1000);
        let subscription_id = object::new(ctx);

        let subscription = Subscription {
            id: subscription_id,
            subscriber: profile.owner,
            tier,
            seal_policy_id,
            start_date: current_time,
            end_date: end_time,
            auto_renewal: false,
            unlimited_likes: tier >= 2, // Premium and above
            super_likes_count: if (tier == 1) 5 else if (tier == 2) 25 else 100,
            advanced_filters: tier >= 2,
            incognito_mode: tier >= 3, // Platinum only
        };

        // Link subscription to profile
        profile.subscription_id = option::some(object::id(&subscription));

        event::emit(SubscriptionCreated {
            subscription_id: object::id(&subscription),
            subscriber: profile.owner,
            tier,
            start_date: current_time,
            end_date: end_time,
        });

        subscription
    }

    /// Upload media content to Walrus with access control
    public fun create_media_content(
        profile: &UserProfile,
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

        let current_time = clock::timestamp_ms(clock);
        let media_id = object::new(ctx);

        MediaContent {
            id: media_id,
            owner: profile.owner,
            walrus_blob_id,
            content_type,
            visibility_level,
            seal_policy_id,
            access_permissions: vector::empty(),
            moderation_status: 0, // Pending moderation
            ai_safety_score: 0, // To be set by AI moderation
            caption,
            tags,
            uploaded_at: current_time,
            expires_at: option::none(),
        }
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
            expires_at: option::some(current_time + (2 * 365 * 24 * 60 * 60 * 1000)), // 2 years
        }
    }

    // ===== View Functions =====

    public fun get_profile_owner(profile: &UserProfile): address {
        profile.owner
    }

    public fun get_profile_reputation(profile: &UserProfile): u64 {
        profile.reputation_score
    }

    public fun get_match_status(match_obj: &Match): u8 {
        match_obj.status
    }

    public fun get_subscription_tier(subscription: &Subscription): u8 {
        subscription.tier
    }

    public fun is_subscription_active(subscription: &Subscription, current_time: u64): bool {
        subscription.end_date > current_time
    }

    public fun get_media_visibility(media: &MediaContent): u8 {
        media.visibility_level
    }

    public fun get_verification_trust_score(verification: &VerificationRecord): u64 {
        verification.trust_score
    }

    // ===== Admin Functions =====

    /// Update moderation status for media content (admin only)
    public fun update_media_moderation(
        media: &mut MediaContent,
        new_status: u8,
        ai_safety_score: u64,
        _admin_cap: &AdminCap,
    ) {
        media.moderation_status = new_status;
        media.ai_safety_score = ai_safety_score;
    }

    /// Admin capability for platform operations
    public struct AdminCap has key { id: UID }

    /// Create admin capability (one-time setup)
    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap {
            id: object::new(ctx)
        }, tx_context::sender(ctx));
        transfer::share_object(ProfileRegistry {
            id: object::new(ctx),
            entries: vector::empty(),
        });
    }
}