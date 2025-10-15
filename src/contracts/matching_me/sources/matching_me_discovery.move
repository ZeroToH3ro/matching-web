/// Module for randomized user discovery and matching
/// Uses Sui's on-chain randomness to provide unpredictable user ordering
module matching_me::discovery {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::random::{Self, Random, RandomGenerator};
    use std::vector;
    use std::string::String;

    // ===== Error Codes =====
    const ENoProfilesAvailable: u64 = 100;
    const EUnauthorized: u64 = 101;
    const EInvalidSwipe: u64 = 102;

    // Swipe directions
    const SWIPE_LEFT: u8 = 0;  // Pass/Reject
    const SWIPE_RIGHT: u8 = 1; // Like/Match

    // ===== Structs =====

    /// Represents a swipe action taken by a user
    public struct SwipeRecord has key, store {
        id: UID,
        swiper: address,
        target: address,
        direction: u8,  // 0 = left (pass), 1 = right (like)
        random_seed: u64,  // The random value used for this swipe
        timestamp: u64,
    }

    /// Discovery session - tracks a user's current discovery queue
    public struct DiscoverySession has key {
        id: UID,
        user: address,
        current_queue: vector<address>,  // Randomized queue of profiles
        queue_index: u64,
        session_seed: u64,  // Random seed for this session
        created_at: u64,
        last_updated: u64,
    }

    /// Registry for all swipe records
    public struct SwipeRegistry has key {
        id: UID,
        total_swipes: u64,
        total_right_swipes: u64,
        total_left_swipes: u64,
    }

    // ===== Events =====

    public struct SwipeRecorded has copy, drop {
        swipe_id: ID,
        swiper: address,
        target: address,
        direction: u8,
        random_seed: u64,
        timestamp: u64,
    }

    public struct DiscoverySessionCreated has copy, drop {
        session_id: ID,
        user: address,
        queue_size: u64,
        session_seed: u64,
        timestamp: u64,
    }

    public struct RandomMatchSuggested has copy, drop {
        user: address,
        suggested_profile: address,
        random_value: u64,
        timestamp: u64,
    }

    // ===== Public Entry Functions =====

    /// Generate a random discovery queue for a user
    /// Uses Sui's on-chain randomness to shuffle available profiles
    entry fun create_discovery_session(
        available_profiles: vector<address>,
        r: &Random,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let user = tx_context::sender(ctx);
        assert!(vector::length(&available_profiles) > 0, ENoProfilesAvailable);

        let current_time = clock::timestamp_ms(clock);
        let session_uid = object::new(ctx);
        let session_id = object::uid_to_inner(&session_uid);

        // Generate random seed for this session
        let mut generator = random::new_generator(r, ctx);
        let session_seed = random::generate_u64(&mut generator);

        // Shuffle the profiles using the random generator
        let shuffled_profiles = shuffle_profiles(available_profiles, &mut generator);

        let session = DiscoverySession {
            id: session_uid,
            user,
            current_queue: shuffled_profiles,
            queue_index: 0,
            session_seed,
            created_at: current_time,
            last_updated: current_time,
        };

        event::emit(DiscoverySessionCreated {
            session_id,
            user,
            queue_size: vector::length(&session.current_queue),
            session_seed,
            timestamp: current_time,
        });

        transfer::transfer(session, user);
    }

    /// Record a swipe action (left or right)
    /// This is called when user swipes on a profile
    entry fun record_swipe(
        session: &mut DiscoverySession,
        target: address,
        direction: u8,
        r: &Random,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let swiper = tx_context::sender(ctx);
        assert!(session.user == swiper, EUnauthorized);
        assert!(direction == SWIPE_LEFT || direction == SWIPE_RIGHT, EInvalidSwipe);

        let current_time = clock::timestamp_ms(clock);
        
        // Generate random seed for this swipe
        let mut generator = random::new_generator(r, ctx);
        let random_seed = random::generate_u64(&mut generator);

        let swipe_uid = object::new(ctx);
        let swipe_id = object::uid_to_inner(&swipe_uid);

        let swipe = SwipeRecord {
            id: swipe_uid,
            swiper,
            target,
            direction,
            random_seed,
            timestamp: current_time,
        };

        // Update session
        session.queue_index = session.queue_index + 1;
        session.last_updated = current_time;

        event::emit(SwipeRecorded {
            swipe_id,
            swiper,
            target,
            direction,
            random_seed,
            timestamp: current_time,
        });

        // Transfer swipe record to swiper for their records
        transfer::transfer(swipe, swiper);
    }

    /// Get next random profile from discovery session
    /// Returns the next profile in the randomized queue
    public fun get_next_profile(session: &DiscoverySession): address {
        let index = session.queue_index;
        assert!(index < vector::length(&session.current_queue), ENoProfilesAvailable);
        *vector::borrow(&session.current_queue, index)
    }

    /// Refresh discovery queue with new random order
    entry fun refresh_discovery_queue(
        session: &mut DiscoverySession,
        new_profiles: vector<address>,
        r: &Random,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(session.user == tx_context::sender(ctx), EUnauthorized);

        // Generate new random seed
        let mut generator = random::new_generator(r, ctx);
        let new_seed = random::generate_u64(&mut generator);

        // Shuffle new profiles
        let shuffled = shuffle_profiles(new_profiles, &mut generator);

        // Update session
        session.current_queue = shuffled;
        session.queue_index = 0;
        session.session_seed = new_seed;
        session.last_updated = clock::timestamp_ms(clock);
    }

    /// Generate random match suggestion
    /// Uses on-chain randomness to pick a random profile from available ones
    entry fun suggest_random_match(
        available_profiles: vector<address>,
        r: &Random,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let user = tx_context::sender(ctx);
        assert!(vector::length(&available_profiles) > 0, ENoProfilesAvailable);

        let mut generator = random::new_generator(r, ctx);
        let profiles_len = vector::length(&available_profiles);
        
        // Generate random index
        let random_index = random::generate_u64_in_range(&mut generator, 0, profiles_len - 1);
        let suggested_profile = *vector::borrow(&available_profiles, random_index);
        let random_value = random::generate_u64(&mut generator);

        event::emit(RandomMatchSuggested {
            user,
            suggested_profile,
            random_value,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    // ===== Helper Functions =====

    /// Shuffle a vector of addresses using Fisher-Yates algorithm with on-chain randomness
    fun shuffle_profiles(mut profiles: vector<address>, generator: &mut RandomGenerator): vector<address> {
        let len = vector::length(&profiles);
        if (len <= 1) {
            return profiles
        };

        let mut i = len - 1;
        while (i > 0) {
            // Generate random index from 0 to i
            let j = random::generate_u64_in_range(generator, 0, i);
            
            // Swap elements at i and j
            vector::swap(&mut profiles, i, j);
            
            i = i - 1;
        };

        profiles
    }

    // ===== View Functions =====

    public fun get_session_user(session: &DiscoverySession): address {
        session.user
    }

    public fun get_session_queue_size(session: &DiscoverySession): u64 {
        vector::length(&session.current_queue)
    }

    public fun get_session_current_index(session: &DiscoverySession): u64 {
        session.queue_index
    }

    public fun has_more_profiles(session: &DiscoverySession): bool {
        session.queue_index < vector::length(&session.current_queue)
    }

    public fun get_session_seed(session: &DiscoverySession): u64 {
        session.session_seed
    }

    public fun get_swipe_direction(swipe: &SwipeRecord): u8 {
        swipe.direction
    }

    public fun get_swipe_target(swipe: &SwipeRecord): address {
        swipe.target
    }

    public fun get_swipe_swiper(swipe: &SwipeRecord): address {
        swipe.swiper
    }

    public fun get_swipe_random_seed(swipe: &SwipeRecord): u64 {
        swipe.random_seed
    }

    public fun is_swipe_right(swipe: &SwipeRecord): bool {
        swipe.direction == SWIPE_RIGHT
    }

    public fun is_swipe_left(swipe: &SwipeRecord): bool {
        swipe.direction == SWIPE_LEFT
    }

    // ===== Module Initialization =====

    fun init(ctx: &mut TxContext) {
        // Create and share swipe registry
        transfer::share_object(SwipeRegistry {
            id: object::new(ctx),
            total_swipes: 0,
            total_right_swipes: 0,
            total_left_swipes: 0,
        });
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
