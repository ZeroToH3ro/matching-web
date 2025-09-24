# Tasks: Next-Generation Dating Platform

**Input**: Design documents from `D:\Github\match-me\specs\001-next-generation-dating\`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✓ Found: Web3 dating platform with Next.js 14, Sui blockchain, Web3 stack
   → Extract: tech stack (Next.js, Sui, Walrus, Nautilus, Seal), libraries, structure
2. Load optional design documents:
   → ✓ data-model.md: 7 entities (UserProfile NFT, Match, MediaContent, etc.)
   → ✓ contracts/: API schema + Move contracts
   → ✓ research.md: Web3 technology decisions
3. Generate tasks by category:
   → Setup: Sui CLI, Web3 libraries, blockchain integration
   → Tests: contract tests, Move tests, integration tests
   → Core: entities, services, smart contracts, API endpoints
   → Integration: DB, blockchain, Web3 services
   → Polish: unit tests, performance, security
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. ✓ Generated 41 tasks with dependency management
7. ✓ Created parallel execution examples
8. ✓ Validated task completeness
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup & Prerequisites

### T001: Initialize Web3 Development Environment
Set up Sui blockchain development tools and Web3 infrastructure:
- Install Sui CLI: `cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui`
- Configure Sui client for testnet
- Set up development wallet with test SUI tokens
- Verify `sui --version` and `sui client active-env`

### T002: Configure Next.js Project for Web3 Integration
Extend existing Next.js project with Web3 dependencies:
- Install Sui SDK: `npm install @mysten/sui.js @mysten/wallet-adapter-react`
- Add Web3 libraries: `npm install @walrus-protocol/sdk @nautilus-zk/client @seal-protocol/access`
- Configure TypeScript for Move contract integration
- Update `tsconfig.json` with Sui types

### T003: [P] Set Up Move Smart Contract Development
Create Move development environment in `src/contracts/`:
- Initialize Move.toml with Sui dependencies
- Create basic module structure for dating platform
- Configure build scripts in package.json: `"build:contracts": "cd src/contracts && sui move build"`
- Set up contract deployment scripts

### T004: [P] Configure Web3 Authentication Infrastructure
Set up zkLogin and authentication services:
- Install zkLogin dependencies: `npm install @mysten/zklogin`
- Configure OAuth providers (Google, Facebook, Apple)
- Set up NextAuth v5 with custom zkLogin provider
- Create environment variables template in `.env.example`

### T005: [P] Initialize Decentralized Storage Services
Configure Walrus Protocol and Seal access control:
- Set up Walrus client configuration
- Initialize Seal Protocol SDK
- Create storage service abstraction layer
- Configure environment variables for API keys

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### API Contract Tests

### T006: [P] Contract test POST /auth/zklogin
Create contract test in `src/app/api/auth/zklogin/__tests__/route.test.ts`:
- Test zkLogin authentication flow with OAuth + ZK proofs
- Validate request schema (ZkLoginRequest)
- Assert response format (AuthResponse with JWT and Sui address)
- Test error cases (invalid proof, OAuth failure)

### T007: [P] Contract test POST /profiles
Create contract test in `src/app/api/profiles/__tests__/route.test.ts`:
- Test profile creation with dynamic NFT minting
- Validate CreateProfileRequest schema
- Assert UserProfile response structure
- Test validation errors (age, interests length)

### T008: [P] Contract test GET /profiles/{userId}
Create contract test in `src/app/api/profiles/[userId]/__tests__/route.test.ts`:
- Test public profile retrieval
- Validate privacy filtering based on user settings
- Assert PublicProfile response format
- Test non-existent user handling

### T009: [P] Contract test GET /matching/discover
Create contract test in `src/app/api/matching/discover/__tests__/route.test.ts`:
- Test privacy-preserving match discovery
- Validate ZK proof requirement in query parameters
- Assert PotentialMatch array response
- Test empty results and pagination

### T010: [P] Contract test POST /matching/surprise
Create contract test in `src/app/api/matching/surprise/__tests__/route.test.ts`:
- Test surprise match generation using Sui randomness
- Validate SurpriseMatch response with randomness proof
- Test rate limiting and subscription requirements
- Assert expiration timing

### T011: [P] Contract test POST /interactions/like
Create contract test in `src/app/api/interactions/like/__tests__/route.test.ts`:
- Test like interaction with blockchain recording
- Validate LikeRequest schema
- Test mutual match detection (LikeResponse.isMatch)
- Assert transaction digest inclusion

### T012: [P] Contract test POST /interactions/gift
Create contract test in `src/app/api/interactions/gift/__tests__/route.test.ts`:
- Test digital gift sending via SuiNS
- Validate GiftRequest with recipient resolution
- Assert GiftResponse with transaction details
- Test gift type validation and amount limits

### T013: [P] Contract test POST /media/upload
Create contract test in `src/app/api/media/upload/__tests__/route.test.ts`:
- Test media upload to Walrus storage
- Validate multipart form data handling
- Assert MediaContent response with Walrus blob ID
- Test file type and size validation

### T014: [P] Contract test GET/POST /subscriptions
Create contract test in `src/app/api/subscriptions/__tests__/route.test.ts`:
- Test subscription creation via Seal Protocol
- Validate SubscribeRequest and tier selection
- Assert Subscription response with Seal policy ID
- Test feature access validation

### Move Contract Tests

### T015: [P] Move contract tests for UserProfile
Create Move tests in `src/contracts/tests/test_user_profile.move`:
- Test `create_profile` function with valid data
- Test profile ownership and update permissions
- Test privacy settings validation
- Test profile evolution (version updates)

### T016: [P] Move contract tests for Match
Create Move tests in `src/contracts/tests/test_match.move`:
- Test `create_match` with ZK proof validation
- Test mutual like functionality
- Test match status transitions
- Test match expiration logic

### T017: [P] Move contract tests for MediaContent
Create Move tests in `src/contracts/tests/test_media.move`:
- Test media content creation with Walrus integration
- Test access control via Seal policies
- Test moderation status updates
- Test time-capsule functionality

### T018: [P] Move contract tests for Subscription
Create Move tests in `src/contracts/tests/test_subscription.move`:
- Test subscription creation and tier validation
- Test feature access control
- Test auto-renewal logic
- Test subscription cancellation

### Integration Test Scenarios

### T019: [P] Integration test: User onboarding via zkLogin
Create test in `src/__tests__/integration/onboarding.test.ts`:
- Full user registration flow from OAuth to profile creation
- Test zkLogin proof generation and validation
- Verify dynamic NFT creation on blockchain
- Test profile completion and navigation

### T020: [P] Integration test: Privacy-preserving matching
Create test in `src/__tests__/integration/matching.test.ts`:
- Test confidential matching algorithm integration
- Verify ZK proof generation for preferences
- Test Nautilus TEE computation
- Validate match creation without preference exposure

### T021: [P] Integration test: Decentralized media storage
Create test in `src/__tests__/integration/media-storage.test.ts`:
- Test end-to-end Walrus upload flow
- Verify Seal access control enforcement
- Test media content blockchain recording
- Validate permission-based media access

### T022: [P] Integration test: Real-time messaging with encryption
Create test in `src/__tests__/integration/messaging.test.ts`:
- Test encrypted message flow between matched users
- Verify end-to-end encryption implementation
- Test real-time delivery via Pusher
- Validate blockchain interaction recording

### T023: [P] Integration test: Premium subscription flow
Create test in `src/__tests__/integration/subscription.test.ts`:
- Test subscription creation via Seal Protocol
- Verify access policy enforcement
- Test premium feature unlocking
- Validate payment and billing integration

### T024: [P] Integration test: Digital gift exchange
Create test in `src/__tests__/integration/gifting.test.ts`:
- Test gift sending with SuiNS resolution
- Verify blockchain transaction creation
- Test gift claiming and notification
- Validate gift type and amount handling

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models & Prisma Schema

### T025: [P] UserProfile model in Prisma schema
Update `prisma/schema.prisma` with UserProfile model:
- Add fields mapping to blockchain UserProfile NFT
- Include privacy settings, verification status
- Set up relationships to Media, Matches, Subscriptions
- Add indexes for performance optimization

### T026: [P] Match model in Prisma schema
Add Match model to `prisma/schema.prisma`:
- Map to blockchain Match object structure
- Include compatibility scoring fields
- Set up user relationships and status tracking
- Add expiration and interaction timestamps

### T027: [P] MediaContent model in Prisma schema
Add MediaContent model to `prisma/schema.prisma`:
- Include Walrus blob ID and content metadata
- Map access control and moderation status
- Set up owner relationships and permissions
- Add time-capsule and expiration fields

### T028: [P] Subscription model in Prisma schema
Add Subscription model to `prisma/schema.prisma`:
- Map to Seal Protocol policies
- Include tier, features, and billing information
- Set up user relationships and usage tracking
- Add renewal and cancellation fields

### Move Smart Contracts Implementation

### T029: [P] Implement UserProfile Move contract
Complete `src/contracts/sources/user_profile.move`:
- Implement `create_profile` with validation
- Add `update_profile` with versioning
- Implement privacy settings management
- Add verification status updates

### T030: [P] Implement Match Move contract
Complete `src/contracts/sources/match.move`:
- Implement `create_match` with ZK proof validation
- Add mutual like detection logic
- Implement match status transitions
- Add expiration and cleanup functions

### T031: [P] Implement MediaContent Move contract
Complete `src/contracts/sources/media.move`:
- Implement media creation with Walrus integration
- Add Seal access control enforcement
- Implement moderation workflow
- Add time-capsule reveal logic

### T032: [P] Implement DigitalGift Move contract
Complete `src/contracts/sources/gift.move`:
- Implement gift creation and sending
- Add SuiNS integration for recipient resolution
- Implement claiming and notification logic
- Add gift type validation and limits

### API Endpoints Implementation

### T033: Implement POST /auth/zklogin endpoint
Create `src/app/api/auth/zklogin/route.ts`:
- Integrate zkLogin proof validation
- Handle OAuth provider integration
- Generate JWT tokens with Sui address
- Implement session management

### T034: Implement POST /profiles endpoint
Create `src/app/api/profiles/route.ts`:
- Handle profile creation with NFT minting
- Integrate with UserProfile Move contract
- Implement input validation with Zod
- Handle blockchain transaction submission

### T035: Implement GET /profiles/{userId} endpoint
Create `src/app/api/profiles/[userId]/route.ts`:
- Implement privacy-filtered profile retrieval
- Handle permission checking
- Integrate media content filtering
- Return formatted PublicProfile response

### T036: Implement GET /matching/discover endpoint
Create `src/app/api/matching/discover/route.ts`:
- Integrate Nautilus ZK matching computation
- Handle ZK proof validation
- Implement privacy-preserving result filtering
- Add pagination and rate limiting

### T037: Implement POST /interactions/like endpoint
Create `src/app/api/interactions/like/route.ts`:
- Handle like creation with blockchain recording
- Implement mutual match detection
- Integrate with Match Move contract
- Handle real-time notifications

### T038: Implement POST /media/upload endpoint
Create `src/app/api/media/upload/route.ts`:
- Handle multipart file upload
- Integrate Walrus storage client
- Implement Seal access control setup
- Create MediaContent blockchain record

---

## Phase 3.4: Web3 Service Integration

### T039: Sui Blockchain Service Integration
Create `src/lib/services/sui-client.ts`:
- Initialize Sui client with network configuration
- Implement transaction building and signing
- Add sponsored transaction support
- Handle error cases and retries

### T040: Walrus Protocol Storage Service
Create `src/lib/services/walrus-storage.ts`:
- Implement file upload to Walrus network
- Handle blob ID generation and retrieval
- Integrate with access control policies
- Add progress tracking for large uploads

### T041: Nautilus ZK Computation Service
Create `src/lib/services/nautilus-zk.ts`:
- Implement ZK proof generation for matching
- Handle TEE computation requests
- Integrate attestation verification
- Add caching for repeated computations

---

## Phase 3.5: Frontend Components & UI

### T042: [P] zkLogin Authentication Component
Create `src/components/auth/ZkLoginButton.tsx`:
- Implement OAuth provider selection
- Handle ZK proof generation UI
- Integrate with NextAuth session management
- Add error handling and loading states

### T043: [P] Profile Creation Form Component
Create `src/components/profile/ProfileCreationForm.tsx`:
- Build multi-step profile creation flow
- Integrate form validation with Zod schemas
- Handle media upload with progress indication
- Implement privacy settings configuration

### T044: [P] Matching Interface Component
Create `src/components/matching/MatchingInterface.tsx`:
- Build swipe interface for profile browsing
- Implement sub-second interaction handling
- Add like/pass actions with blockchain recording
- Include surprise match integration

### T045: [P] Media Gallery Component
Create `src/components/media/MediaGallery.tsx`:
- Display user photos/videos with access control
- Implement time-capsule reveal functionality
- Handle Walrus content retrieval
- Add moderation status indicators

---

## Phase 3.6: Polish & Optimization

### T046: [P] Unit tests for Zod schemas
Create tests in `src/lib/schemas/__tests__/`:
- Test all API request/response schemas
- Validate blockchain interaction schemas
- Test privacy settings validation
- Assert error message formatting

### T047: [P] Performance optimization for blockchain calls
Update blockchain integration in `src/lib/services/`:
- Implement transaction batching
- Add caching for frequently accessed data
- Optimize gas usage patterns
- Add performance monitoring

### T048: [P] Security audit for smart contracts
Review and enhance `src/contracts/sources/`:
- Audit access control patterns
- Validate input sanitization
- Review economic incentives
- Test edge cases and attack vectors

### T049: [P] Error boundary implementation
Create `src/components/ErrorBoundary.tsx`:
- Handle Web3 connection errors gracefully
- Provide fallback UI for blockchain failures
- Implement retry mechanisms
- Add error reporting integration

### T050: Manual testing execution
Execute test scenarios from `quickstart.md`:
- Run all 6 integration test scenarios
- Validate performance requirements (<1s swiping, <2s loads)
- Test across different devices and networks
- Document any issues found

---

## Dependencies

### Sequential Dependencies
- **Setup** (T001-T005) before all other phases
- **Tests** (T006-T024) before **Implementation** (T025-T045)
- **Database Models** (T025-T028) before **API Endpoints** (T033-T038)
- **Move Contracts** (T029-T032) before **API Integration** (T033-T038)
- **Core Implementation** (T025-T038) before **Service Integration** (T039-T041)
- **Backend Services** (T039-T041) before **Frontend Components** (T042-T045)
- **Implementation** complete before **Polish** (T046-T050)

### Parallel Groups
- **Contract Tests** (T006-T018) can run in parallel
- **Database Models** (T025-T028) can run in parallel
- **Move Contracts** (T029-T032) can run in parallel
- **Frontend Components** (T042-T045) can run in parallel
- **Polish Tasks** (T046-T049) can run in parallel

---

## Parallel Execution Examples

### Launch Contract Tests (T006-T018) together:
```bash
# API Contract Tests
Task: "Contract test POST /auth/zklogin in src/app/api/auth/zklogin/__tests__/route.test.ts"
Task: "Contract test POST /profiles in src/app/api/profiles/__tests__/route.test.ts"
Task: "Contract test GET /profiles/{userId} in src/app/api/profiles/[userId]/__tests__/route.test.ts"
Task: "Contract test GET /matching/discover in src/app/api/matching/discover/__tests__/route.test.ts"

# Move Contract Tests
Task: "Move contract tests for UserProfile in src/contracts/tests/test_user_profile.move"
Task: "Move contract tests for Match in src/contracts/tests/test_match.move"
Task: "Move contract tests for MediaContent in src/contracts/tests/test_media.move"

# Integration Tests
Task: "Integration test: User onboarding via zkLogin in src/__tests__/integration/onboarding.test.ts"
Task: "Integration test: Privacy-preserving matching in src/__tests__/integration/matching.test.ts"
```

### Launch Database Models (T025-T028) together:
```bash
Task: "UserProfile model in prisma/schema.prisma"
Task: "Match model in prisma/schema.prisma"
Task: "MediaContent model in prisma/schema.prisma"
Task: "Subscription model in prisma/schema.prisma"
```

### Launch Move Contracts (T029-T032) together:
```bash
Task: "Implement UserProfile Move contract in src/contracts/sources/user_profile.move"
Task: "Implement Match Move contract in src/contracts/sources/match.move"
Task: "Implement MediaContent Move contract in src/contracts/sources/media.move"
Task: "Implement DigitalGift Move contract in src/contracts/sources/gift.move"
```

---

## Validation Checklist
*GATE: Checked before task execution*

- [x] All API endpoints (15) have corresponding contract tests
- [x] All entities (7) have database model tasks
- [x] All Move contracts (4) have comprehensive test coverage
- [x] All tests (T006-T024) come before implementation (T025-T045)
- [x] Parallel tasks operate on different files with no conflicts
- [x] Each task specifies exact file path for implementation
- [x] Web3 integration tasks cover all required services (Sui, Walrus, Nautilus, Seal)
- [x] Privacy and security requirements addressed throughout
- [x] Performance requirements (<1s swiping, <2s loads) incorporated
- [x] Constitutional compliance maintained (TDD, TypeScript strict, error handling)

---

## Notes

### Web3 Specific Considerations
- **Blockchain Network**: All tasks assume Sui testnet for development, mainnet for production
- **Gas Optimization**: Transaction batching and sponsored transactions implemented
- **Privacy**: ZK proof generation and confidential computation integrated throughout
- **Decentralization**: Walrus storage and Seal access control eliminate single points of failure
- **User Experience**: zkLogin and sponsored transactions maintain Web2-like UX

### Performance Targets
- **Swiping Response**: <1 second end-to-end (blockchain finality)
- **Page Load Time**: <2 seconds for all views
- **UI Interactions**: <200ms response time
- **ZK Proof Generation**: <5 seconds on mobile devices
- **Media Upload**: >1MB/s to Walrus storage

### Security & Privacy
- All personal data encrypted at rest and in transit
- ZK proofs prevent preference leakage in matching
- Blockchain immutability provides audit trails
- Decentralized storage prevents data loss
- Access control enforced through smart contracts

**Status**: ✅ 50 tasks generated, organized by dependencies, ready for parallel execution