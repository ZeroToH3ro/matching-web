# Data Model: Next-Generation Dating Platform

**Branch**: `001-next-generation-dating` | **Date**: 2025-09-24

## Entity Definitions

This document defines the core entities for the next-generation dating platform, incorporating Sui blockchain objects, Web3 technologies, and privacy-preserving mechanisms.

---

## 1. User Profile (Dynamic NFT)

### Description
A dynamic, evolving NFT that represents a user's complete profile on the platform. Changes based on user interactions, relationship status, and personal growth.

### Fields
```typescript
type UserProfile = {
  // Core Identity
  id: ObjectID;                    // Sui object identifier
  owner: SuiAddress;              // User's wallet address
  suiNSName?: string;             // Human-readable name (alice.sui)

  // Profile Information
  displayName: string;            // Public display name
  age: number;                    // User's age
  location: EncryptedField;       // Encrypted location data
  bio: string;                    // User-updateable biography
  interests: string[];            // List of interests/hobbies

  // Dynamic Attributes
  personalityVector: number[];    // ML-derived personality traits
  compatibilityFactors: EncryptedField; // Encrypted matching factors
  evolutionHistory: ProfileChange[]; // Record of profile changes

  // Privacy & Security
  privacySettings: PrivacyConfig; // Granular privacy controls
  verificationStatus: VerificationLevel; // Identity verification level
  encryptionKeys: KeyPair;        // For confidential interactions

  // Platform Engagement
  reputation: number;             // Trust score (0-100)
  memberSince: timestamp;         // Join date
  lastActive: timestamp;          // Last platform activity
  premiumUntil?: timestamp;       // Premium subscription expiry

  // Blockchain Metadata
  version: number;                // NFT version for updates
  metadataURI: string;           // IPFS metadata link
}
```

### State Transitions
- **Creation**: New user onboarding through zkLogin
- **Evolution**: Regular updates based on user interactions
- **Verification**: Identity verification process
- **Suspension**: Temporary deactivation for policy violations
- **Deletion**: Complete removal from platform

### Validation Rules
- Display name: 2-50 characters, no special characters
- Age: 18-100 years (legal dating age)
- Bio: Maximum 500 characters
- Interests: 3-20 tags from predefined list
- Privacy settings: Must maintain legal compliance standards

---

## 2. Match (Confidential Connection)

### Description
Represents a mutual interest or compatibility connection between two users, computed through privacy-preserving algorithms using Zero Knowledge proofs.

### Fields
```typescript
type Match = {
  // Core Match Data
  id: ObjectID;                   // Sui object identifier
  users: [SuiAddress, SuiAddress]; // Matched user addresses
  createdAt: timestamp;           // Match creation time

  // Compatibility Analysis
  compatibilityScore: EncryptedField; // ZK-computed score
  compatibilityProof: ZKProof;    // Verifiable computation proof
  matchingFactors: EncryptedField; // Shared interests/traits

  // Interaction State
  status: MatchStatus;            // PENDING | ACTIVE | EXPIRED | BLOCKED
  mutualLike: boolean;           // Both users liked each other
  conversationStarted: boolean;   // Has messaging begun
  lastInteraction: timestamp;     // Most recent activity

  // Privacy & Access
  visibilitySettings: AccessControl; // Who can see this match
  messagePermissions: MessagePerms; // Communication rules

  // Blockchain Events
  events: MatchEvent[];          // History of match events
  expiresAt?: timestamp;         // Auto-expiry for inactive matches
}

type MatchStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'DELETED';

type MatchEvent = {
  eventType: 'CREATED' | 'LIKED' | 'MESSAGE_SENT' | 'EXPIRED';
  timestamp: timestamp;
  actor: SuiAddress;
  metadata?: object;
}
```

### State Transitions
- **Creation**: ZK matching algorithm finds compatibility
- **Activation**: Mutual interest confirmed by both users
- **Conversation**: Users begin messaging
- **Expiration**: Match expires due to inactivity
- **Deletion**: Either user removes the match

### Validation Rules
- Compatibility score: Generated only through verified ZK proofs
- Users: Cannot match with themselves or blocked users
- Status transitions: Must follow defined state machine
- Expiry: 48 hours for inactive matches unless premium

---

## 3. Media Content (Walrus + Seal Storage)

### Description
User photos, videos, and other multimedia content stored on decentralized infrastructure with granular access controls.

### Fields
```typescript
type MediaContent = {
  // Core Media Data
  id: ObjectID;                   // Sui object identifier
  owner: SuiAddress;             // Content owner
  contentType: MediaType;        // IMAGE | VIDEO | AUDIO

  // Storage Information
  walrusBlobId: string;          // Walrus storage identifier
  originalHash: string;          // Content integrity hash
  encryptionKey: EncryptedField; // Seal-managed encryption key

  // Access Control
  accessPolicy: SealPolicy;      // Seal protocol access rules
  visibilityLevel: VisibilityLevel; // PUBLIC | FRIENDS | MATCHES | PRIVATE
  sharePermissions: SharePerms[];  // Who can share/save content

  // Content Metadata
  caption?: string;              // User-provided description
  tags: string[];               // Content categorization
  location?: EncryptedField;    // Photo location (if enabled)

  // Approval & Moderation
  moderationStatus: ModerationStatus; // PENDING | APPROVED | REJECTED
  aiSafetyScore: number;        // Automated content safety rating
  reportCount: number;          // Number of user reports

  // Platform Usage
  uploadedAt: timestamp;        // Upload timestamp
  lastViewed: timestamp;        // Recent view activity
  viewCount: number;            // Total views (privacy-respecting)

  // Time-sensitive Features
  timeCapsule?: TimeCapsuleConfig; // Future reveal settings
  expiresAt?: timestamp;        // Auto-deletion time
}

type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO';
type VisibilityLevel = 'PUBLIC' | 'FRIENDS' | 'MATCHES' | 'PRIVATE';
type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
```

### State Transitions
- **Upload**: User uploads content to Walrus storage
- **Moderation**: AI and human review for policy compliance
- **Publication**: Approved content becomes visible per settings
- **Sharing**: Content shared with specific users/groups
- **Expiration**: Time-sensitive content automatically removed

### Validation Rules
- File size: Maximum 50MB per file
- Content types: Only allowed image/video/audio formats
- Moderation: All content must pass safety checks
- Access policies: Must comply with privacy regulations

---

## 4. Interaction (Blockchain Transactions)

### Description
Various forms of user engagement including messages, digital gifts, gestures, and social actions, recorded as blockchain transactions for transparency and permanence.

### Fields
```typescript
type Interaction = {
  // Core Interaction Data
  id: ObjectID;                  // Sui object identifier
  type: InteractionType;         // Type of interaction
  from: SuiAddress;             // Initiating user
  to: SuiAddress;               // Target user

  // Content & Context
  content: EncryptedField;      // Interaction content (encrypted)
  metadata: InteractionMetadata; // Type-specific data
  context: InteractionContext;   // Conversation/match context

  // Blockchain Data
  transactionDigest: string;     // Sui transaction hash
  timestamp: timestamp;         // Blockchain timestamp
  gasUsed: number;              // Transaction cost
  sponsored: boolean;           // Was transaction sponsored?

  // Privacy & Security
  encryptionScheme: EncryptionType; // How content is encrypted
  messageProof?: ZKProof;       // Privacy-preserving message proof

  // Delivery & Status
  deliveryStatus: DeliveryStatus; // Message delivery state
  readStatus: ReadStatus;       // Read receipt information
  reactions: Reaction[];        // User reactions to interaction

  // Moderation
  reportStatus?: ReportStatus;  // If interaction was reported
  moderationFlags: string[];   // Automated moderation flags
}

type InteractionType =
  | 'MESSAGE'           // Text/media message
  | 'LIKE'             // Profile like/interest
  | 'SUPER_LIKE'       // Enhanced like with premium features
  | 'GIFT'             // Digital gift or token
  | 'GESTURE'          // Social gesture (wave, wink, etc.)
  | 'VOICE_NOTE'       // Audio message
  | 'TIME_CAPSULE';    // Future-reveal message

type DeliveryStatus = 'SENT' | 'DELIVERED' | 'FAILED' | 'BLOCKED';
type ReadStatus = 'UNREAD' | 'READ' | 'PRIVACY_HIDDEN';
```

### State Transitions
- **Creation**: User initiates interaction
- **Delivery**: Interaction reaches target user
- **Reading**: Target user views interaction
- **Response**: Target user responds to interaction
- **Archival**: Interaction archived after time period

### Validation Rules
- Content length: Maximum based on interaction type
- Recipient validation: Must be valid user and not blocked
- Rate limiting: Prevent spam through smart contract limits
- Privacy compliance: All content properly encrypted

---

## 5. Privacy Settings (ZK Parameters)

### Description
Granular controls for data visibility, matching preferences, and privacy protection using Zero Knowledge proof parameters.

### Fields
```typescript
type PrivacySettings = {
  // Core Privacy Controls
  id: ObjectID;                 // Sui object identifier
  owner: SuiAddress;           // Settings owner
  version: number;             // Settings version for updates

  // Profile Visibility
  profileVisibility: VisibilityConfig; // Who can see profile
  photoVisibility: MediaVisibilityConfig; // Photo sharing rules
  locationSharing: LocationConfig; // Location privacy settings

  // Matching Privacy
  matchingPreferences: MatchingPrivacy; // ZK matching parameters
  compatibilitySharing: CompatibilityConfig; // Score visibility
  recommendationOptOut: boolean; // Opt out of algorithmic matching

  // Communication Controls
  messagePermissions: MessageConfig; // Who can message
  readReceiptSharing: boolean;  // Share read status
  onlineStatusVisibility: boolean; // Show online presence

  // Data Retention
  dataRetentionPeriod: number; // Days to keep data
  autoDeleteMatches: boolean;  // Auto-clean inactive matches
  rightToBeForgotten: boolean; // Enhanced deletion rights

  // Zero Knowledge Parameters
  zkCircuitParameters: ZKParameters; // Private matching circuits
  privacyLevel: PrivacyLevel;  // MINIMAL | BALANCED | MAXIMUM
  proofGenerationSettings: ProofConfig; // ZK proof preferences

  // Compliance & Legal
  gdprConsent: ConsentRecord;  // GDPR compliance data
  ccpaOptOut: boolean;         // California privacy rights
  parentalControls?: ParentalSettings; // If applicable
}

type PrivacyLevel = 'MINIMAL' | 'BALANCED' | 'MAXIMUM';
type VisibilityConfig = {
  level: VisibilityLevel;
  customRules: AccessRule[];
  exceptions: SuiAddress[];
}
```

### State Transitions
- **Initialization**: Default privacy settings on signup
- **Customization**: User modifies privacy preferences
- **Compliance Update**: Legal requirement changes
- **Verification**: Privacy settings validation
- **Enforcement**: Privacy controls applied to interactions

### Validation Rules
- Minimum privacy levels: Cannot disable essential protections
- Legal compliance: Must meet jurisdiction requirements
- ZK parameters: Must use verified circuit configurations
- Consent tracking: All changes must be auditable

---

## 6. Subscription (Seal Access Policies)

### Description
Premium feature access managed through Seal Protocol's decentralized access control, enabling flexible subscription models and fair monetization.

### Fields
```typescript
type Subscription = {
  // Core Subscription Data
  id: ObjectID;                 // Sui object identifier
  subscriber: SuiAddress;       // Subscription holder
  tier: SubscriptionTier;       // Subscription level

  // Access Control
  sealPolicyId: string;         // Seal protocol policy ID
  accessRights: FeatureAccess[]; // Enabled features
  usageLimits: UsageQuotas;     // Feature quotas/limits

  // Billing Information
  paymentMethod: PaymentMethod; // How subscription is paid
  billingCycle: BillingCycle;   // MONTHLY | YEARLY | LIFETIME
  amount: number;               // Cost per billing cycle
  currency: string;             // Payment currency

  // Subscription Lifecycle
  startDate: timestamp;         // Subscription start
  endDate: timestamp;           // Subscription expiry
  renewalDate?: timestamp;      // Next renewal date
  status: SubscriptionStatus;   // Current status

  // Feature Usage Tracking
  usageStats: UsageStatistics;  // Feature usage metrics
  featureHistory: FeatureUsage[]; // Historical usage

  // Promotional & Referral
  promoCode?: string;           // Applied promotional code
  discount?: DiscountInfo;      // Current discount
  referralCredits: number;      // Earned referral credits

  // Platform Integration
  createdAt: timestamp;         // Subscription creation
  lastModified: timestamp;      // Last update
  autoRenewal: boolean;         // Automatic renewal setting
}

type SubscriptionTier = 'FREE' | 'BASIC' | 'PREMIUM' | 'PLATINUM';
type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
type BillingCycle = 'MONTHLY' | 'YEARLY' | 'LIFETIME';

type FeatureAccess = {
  feature: PremiumFeature;
  unlimited: boolean;
  quota?: number;
  enabled: boolean;
}

type PremiumFeature =
  | 'UNLIMITED_LIKES'
  | 'SUPER_LIKES'
  | 'PROFILE_BOOST'
  | 'ADVANCED_FILTERS'
  | 'READ_RECEIPTS'
  | 'INCOGNITO_MODE'
  | 'TIME_CAPSULES'
  | 'SURPRISE_MATCHES'
  | 'GIFT_SENDING';
```

### State Transitions
- **Creation**: User subscribes to premium tier
- **Activation**: Payment confirmed and features enabled
- **Renewal**: Automatic or manual subscription renewal
- **Upgrade/Downgrade**: Tier changes during active subscription
- **Cancellation**: User cancels subscription
- **Expiration**: Subscription expires and features disabled

### Validation Rules
- Tier progression: Cannot skip tiers without payment
- Feature limits: Usage must respect tier limitations
- Payment validation: All payments must be confirmed
- Access control: Seal policies must be valid and current

---

## 7. Verification Record (On-chain Attestations)

### Description
Identity and profile authenticity status with cryptographic attestations, trust scores, and anti-fraud measures recorded on the blockchain.

### Fields
```typescript
type VerificationRecord = {
  // Core Verification Data
  id: ObjectID;                 // Sui object identifier
  subject: SuiAddress;          // User being verified
  verificationLevel: VerificationLevel; // Current verification status

  // Identity Verification
  identityVerified: boolean;    // Government ID verified
  identityProvider: string;     // Verification service used
  identityProof: EncryptedField; // Encrypted verification data

  // Social Verification
  socialProfiles: SocialProfile[]; // Connected social accounts
  phoneVerified: boolean;       // Phone number verification
  emailVerified: boolean;       // Email verification

  // Biometric Verification
  faceVerified: boolean;        // Facial recognition match
  livenessCheck: boolean;       // Anti-spoofing verification
  biometricHash?: string;       // Privacy-preserving biometric hash

  // Trust & Reputation
  trustScore: number;           // Computed trust rating (0-100)
  reputationHistory: ReputationEvent[]; // Historical reputation changes
  communityEndorsements: Endorsement[]; // User endorsements

  // Anti-Fraud Measures
  riskScore: number;            // Fraud risk assessment
  suspiciousActivity: SecurityFlag[]; // Flagged activities
  deviceFingerprint: EncryptedField; // Device identification

  // Verification Timeline
  createdAt: timestamp;         // Initial verification
  lastUpdated: timestamp;       // Most recent update
  expiresAt?: timestamp;        // Verification expiry
  verificationHistory: VerificationEvent[]; // All verification events

  // Attestation Data
  attestations: Attestation[];  // Cryptographic attestations
  verifierSignature: Signature; // Verification authority signature
  blockchainProof: string;      // On-chain proof of verification
}

type VerificationLevel =
  | 'UNVERIFIED'     // No verification completed
  | 'EMAIL_VERIFIED' // Email only
  | 'PHONE_VERIFIED' // Phone + email
  | 'ID_VERIFIED'    // Government ID verified
  | 'FULL_VERIFIED'  // Complete verification
  | 'PREMIUM_VERIFIED'; // Enhanced verification with additional checks

type SocialProfile = {
  platform: 'INSTAGRAM' | 'FACEBOOK' | 'TWITTER' | 'LINKEDIN';
  profileUrl: string;
  verified: boolean;
  followersCount?: number;
  verificationDate: timestamp;
}

type ReputationEvent = {
  eventType: 'POSITIVE_REPORT' | 'NEGATIVE_REPORT' | 'SUCCESSFUL_DATE' | 'POLICY_VIOLATION';
  impact: number; // Change in trust score
  timestamp: timestamp;
  reporter?: SuiAddress;
  details: EncryptedField;
}
```

### State Transitions
- **Initialization**: Basic verification record created
- **Progressive Verification**: Additional verification steps completed
- **Trust Building**: Reputation score changes based on interactions
- **Flagging**: Suspicious activity triggers security review
- **Re-verification**: Periodic re-validation of identity claims
- **Suspension**: Temporary verification suspension for violations

### Validation Rules
- Identity documents: Must be government-issued and valid
- Biometric verification: Must pass liveness detection
- Trust score: Calculated using transparent algorithm
- Attestations: Must be cryptographically verifiable
- Expiration: Identity verification expires after 2 years

---

## Entity Relationships

### Primary Relationships
```
UserProfile (1) → (0..n) MediaContent
UserProfile (1) → (1) PrivacySettings
UserProfile (1) → (0..1) Subscription
UserProfile (1) → (1) VerificationRecord

Match (1) → (2) UserProfile [users]
Match (1) → (0..n) Interaction

Interaction (1) → (2) UserProfile [from, to]
Interaction (1) → (0..1) MediaContent

Subscription (1) → (1) UserProfile [subscriber]
```

### Data Flow Patterns
1. **User Onboarding**: UserProfile → VerificationRecord → PrivacySettings
2. **Matching Process**: UserProfile + PrivacySettings → ZK Computation → Match
3. **Content Sharing**: MediaContent + AccessPolicy → VisibilityControl
4. **Messaging Flow**: Interaction + Encryption → Message Delivery
5. **Subscription Management**: PaymentEvent → Subscription → FeatureAccess

### Privacy Preservation
- All personally identifiable information encrypted at rest
- ZK proofs used for compatibility without revealing preferences
- Access control enforced through Seal Protocol policies
- Blockchain immutability balanced with right to be forgotten through encryption key deletion

---

## Technical Implementation Notes

### Sui Object Design
- Each entity maps to a Sui object with appropriate capabilities
- Ownership patterns ensure data sovereignty
- Events emitted for off-chain indexing and real-time updates

### Encryption Strategy
- End-to-end encryption for all personal communications
- Searchable encryption for discovery without privacy loss
- Key rotation supported through Seal Protocol integration

### Scalability Considerations
- Object references minimize on-chain storage costs
- Bulk operations optimized through programmable transactions
- Off-chain storage (Walrus) for large media content

### Compliance Integration
- GDPR/CCPA compliance through cryptographic deletion
- Data portability through standardized export formats
- Consent management tracked on-chain for auditability

**Status**: ✅ Data model complete - Ready for contract generation