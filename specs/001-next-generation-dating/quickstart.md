# Quickstart Guide: Next-Generation Dating Platform

**Branch**: `001-next-generation-dating` | **Date**: 2025-09-24

This guide provides step-by-step instructions for setting up, testing, and validating the next-generation dating platform implementation.

---

## Prerequisites

### System Requirements
- Node.js 18+ with npm/yarn
- Docker and Docker Compose
- PostgreSQL 14+
- Sui CLI tools (latest version)
- Git

### Development Environment Setup

1. **Install Sui CLI**
   ```bash
   # Install Sui CLI
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui

   # Verify installation
   sui --version
   ```

2. **Clone and Setup Repository**
   ```bash
   git clone <repository-url>
   cd match-me
   git checkout 001-next-generation-dating
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   # Configure environment variables (see Configuration section below)
   ```

---

## Configuration

### Environment Variables

Create `.env.local` with the following configuration:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/dating_platform"

# Sui Blockchain Configuration
SUI_NETWORK="testnet"  # or "mainnet" for production
SUI_PRIVATE_KEY="your-sui-private-key"
SUI_PACKAGE_ID="your-deployed-package-id"

# Web3 Service Configurations
WALRUS_ENDPOINT="https://walrus-testnet.mystenlabs.com"
WALRUS_API_KEY="your-walrus-api-key"

NAUTILUS_ENDPOINT="https://nautilus-testnet.example.com"
NAUTILUS_API_KEY="your-nautilus-api-key"

SEAL_PROTOCOL_ENDPOINT="https://seal-testnet.example.com"
SEAL_API_KEY="your-seal-api-key"

# NextAuth Configuration
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# OAuth Providers for zkLogin
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

FACEBOOK_CLIENT_ID="your-facebook-client-id"
FACEBOOK_CLIENT_SECRET="your-facebook-client-secret"

# Real-time Features
PUSHER_APP_ID="your-pusher-app-id"
PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
PUSHER_CLUSTER="your-cluster"

# Image Processing
CLOUDINARY_CLOUD_NAME="your-cloudinary-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-secret"

# Email Service
RESEND_API_KEY="your-resend-api-key"
```

### Database Setup

1. **Start PostgreSQL**
   ```bash
   # Using Docker
   docker run --name dating-postgres -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres:14

   # Or use existing PostgreSQL installation
   ```

2. **Setup Database Schema**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   npx prisma db seed
   ```

---

## Development Workflow

### 1. Move Smart Contract Deployment

Deploy the core Move contracts to Sui testnet:

```bash
# Navigate to contracts directory
cd src/contracts

# Build Move package
sui move build

# Deploy to testnet
sui client publish --gas-budget 100000000

# Note the package ID for environment configuration
```

### 2. Start Development Services

Start all required development services:

```bash
# Start the main application
npm run dev

# In separate terminals:

# Start PostgreSQL (if not already running)
docker-compose up postgres

# Start Redis for caching (optional)
docker-compose up redis

# Start local IPFS node (for testing)
docker-compose up ipfs
```

### 3. Access Development Environment

- **Main Application**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs
- **Prisma Studio**: http://localhost:5555 (run `npx prisma studio`)
- **Database**: localhost:5432

---

## Feature Testing Scenarios

### Scenario 1: User Onboarding via zkLogin

**Objective**: Verify seamless Web3 onboarding without wallet complexity

**Steps**:
1. Navigate to http://localhost:3000
2. Click "Sign In with Google"
3. Complete OAuth flow
4. Verify zkLogin proof generation (check developer console)
5. Complete profile creation form
6. Confirm dynamic NFT creation on Sui

**Expected Results**:
- User authenticated without handling private keys
- Profile NFT created with user as owner
- Privacy settings initialized with defaults
- User redirected to main app interface

**Validation**:
```bash
# Check Sui object creation
sui client object <profile-object-id>

# Verify database entry
psql -d dating_platform -c "SELECT * FROM users WHERE sui_address = '<user-address>';"
```

### Scenario 2: Privacy-Preserving Matching

**Objective**: Test confidential matching using ZK proofs

**Steps**:
1. Create multiple test profiles with different preferences
2. Navigate to "Discover" section
3. Generate ZK proof of matching preferences (background process)
4. Verify matches appear without revealing specific preferences
5. Check compatibility scores are shown but not detailed factors

**Expected Results**:
- Matches returned based on computed compatibility
- No raw preference data exposed in API responses
- ZK proof validation logs in server console
- Match records created in blockchain

**Validation**:
```bash
# Check ZK proof validation
curl http://localhost:3000/api/matching/validate-proof \
  -H "Authorization: Bearer <token>" \
  -d '{"proof": "<zk-proof>", "public_signals": ["<signal1>", "<signal2>"]}'

# Verify match creation
sui client object <match-object-id>
```

### Scenario 3: Decentralized Media Storage

**Objective**: Verify Walrus integration for photo/video storage

**Steps**:
1. Navigate to profile editing
2. Upload a high-quality photo (> 5MB)
3. Set visibility to "Matches Only"
4. Configure time-capsule reveal (optional)
5. Verify Walrus blob creation
6. Test access control enforcement

**Expected Results**:
- Large files uploaded without user-visible delays
- Walrus blob ID returned and stored
- Access control properly configured via Seal
- Media content object created on Sui

**Validation**:
```bash
# Check Walrus storage
curl https://walrus-testnet.mystenlabs.com/v1/blob/<blob-id>

# Verify Sui media object
sui client object <media-object-id>

# Test access control
curl http://localhost:3000/api/media/<media-id> \
  -H "Authorization: Bearer <unauthorized-token>"
```

### Scenario 4: Real-time Messaging with Encryption

**Objective**: Test secure messaging between matched users

**Steps**:
1. Create match between two test users
2. Send message from User A to User B
3. Verify end-to-end encryption
4. Test message delivery via Pusher
5. Confirm blockchain transaction recording

**Expected Results**:
- Messages encrypted before storage
- Real-time delivery to recipient
- Read receipts working (if enabled)
- Interaction recorded on blockchain

**Validation**:
```bash
# Check message encryption in database
psql -d dating_platform -c "SELECT content FROM messages WHERE id = '<message-id>';"

# Verify blockchain interaction
sui client object <interaction-object-id>

# Test real-time delivery
# (Use browser dev tools to monitor WebSocket traffic)
```

### Scenario 5: Premium Subscription via Seal

**Objective**: Test subscription management with decentralized access control

**Steps**:
1. Navigate to subscription page
2. Select Premium tier
3. Complete payment flow (test mode)
4. Verify Seal access policy creation
5. Test premium feature access
6. Attempt to access premium feature without subscription

**Expected Results**:
- Subscription created successfully
- Seal policy grants appropriate permissions
- Premium features become accessible
- Non-subscribers cannot access premium features

**Validation**:
```bash
# Check subscription on Sui
sui client object <subscription-object-id>

# Verify Seal policy
curl https://seal-testnet.example.com/policies/<policy-id>

# Test feature access
curl http://localhost:3000/api/premium/advanced-filters \
  -H "Authorization: Bearer <premium-token>"
```

### Scenario 6: Digital Gift Exchange

**Objective**: Test gift sending with SuiNS integration

**Steps**:
1. Ensure both users have SuiNS names (alice.sui, bob.sui)
2. User A sends virtual gift to "bob.sui"
3. Verify SuiNS resolution
4. Check gift notification delivery
5. User B claims the gift

**Expected Results**:
- SuiNS name resolves to correct address
- Gift object created on blockchain
- Recipient notified in real-time
- Gift claimed successfully

**Validation**:
```bash
# Check SuiNS resolution
sui client call --package <suins-package> --module suins --function resolve_name \
  --args "bob.sui"

# Verify gift object
sui client object <gift-object-id>
```

---

## Automated Testing

### Unit Tests

Run comprehensive unit tests for all components:

```bash
# Frontend/API tests
npm test

# Move contract tests
cd src/contracts
sui move test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Performance Testing

Test performance requirements:

```bash
# Load testing for API endpoints
npm run test:load

# Blockchain performance tests
npm run test:blockchain-perf

# ZK proof generation timing
npm run test:zk-performance
```

### Security Testing

Validate security implementation:

```bash
# Smart contract security audit
npm run audit:contracts

# API security testing
npm run test:security

# Privacy validation
npm run test:privacy
```

---

## Monitoring and Debugging

### Application Logs

Monitor key application components:

```bash
# Main application logs
npm run logs

# Database query logs
tail -f logs/database.log

# Blockchain interaction logs
tail -f logs/sui-transactions.log

# ZK proof generation logs
tail -f logs/zk-proofs.log
```

### Blockchain Monitoring

Track on-chain activity:

```bash
# Monitor contract events
sui client subscribe-event --package <package-id>

# Check transaction status
sui client transaction <transaction-digest>

# Monitor gas usage
sui client gas --owner <address>
```

### Performance Metrics

Key metrics to monitor:

- **Response Time**: API endpoints < 200ms (95th percentile)
- **Swiping Latency**: < 1 second end-to-end
- **ZK Proof Generation**: < 5 seconds on mobile
- **Walrus Upload Speed**: > 1MB/s for media files
- **Real-time Message Delivery**: < 100ms local, < 500ms global

---

## Troubleshooting

### Common Issues

**1. zkLogin Authentication Fails**
```bash
# Check OAuth configuration
curl https://accounts.google.com/.well-known/openid_configuration

# Verify JWT token structure
echo <jwt-token> | base64 -d

# Check ZK proof validation
curl http://localhost:3000/api/auth/validate-zk-proof
```

**2. Walrus Upload Timeouts**
```bash
# Check Walrus service status
curl https://walrus-testnet.mystenlabs.com/health

# Test direct upload
curl -X POST https://walrus-testnet.mystenlabs.com/v1/store \
  -H "Authorization: Bearer <token>" \
  -F "file=@test-image.jpg"
```

**3. Move Contract Deployment Issues**
```bash
# Check Sui client configuration
sui client active-env
sui client active-address

# Verify gas balance
sui client gas

# Debug contract compilation
sui move build --verbose
```

**4. Database Connection Problems**
```bash
# Test database connection
psql -d dating_platform -c "SELECT NOW();"

# Check Prisma client generation
npx prisma generate --verbose

# Reset database if needed
npx prisma migrate reset
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Start with debug logging
DEBUG=dating-platform:* npm run dev

# Enable Sui client debug
export SUI_CLIENT_DEBUG=1

# Enable Prisma query logging
export DEBUG="prisma:*"
```

---

## Production Deployment Checklist

Before deploying to production:

### Security Review
- [ ] All private keys secured in key management system
- [ ] API rate limiting configured
- [ ] Input validation implemented for all endpoints
- [ ] ZK circuits audited by security firm
- [ ] Smart contracts audited and verified

### Performance Optimization
- [ ] Database queries optimized with proper indexes
- [ ] CDN configured for static assets
- [ ] API response caching implemented
- [ ] Blockchain transaction batching optimized

### Monitoring Setup
- [ ] Application performance monitoring (APM) configured
- [ ] Error tracking service integrated
- [ ] Blockchain event monitoring setup
- [ ] User analytics privacy-compliant implementation

### Compliance Validation
- [ ] GDPR compliance verified
- [ ] CCPA compliance implemented
- [ ] Terms of Service and Privacy Policy updated
- [ ] Age verification systems tested
- [ ] Content moderation policies enforced

---

## Support and Resources

### Documentation
- **API Documentation**: Available at `/api/docs` when running locally
- **Move Contract Documentation**: Generated with `sui move build --doc`
- **Database Schema**: View with Prisma Studio

### Community
- **Discord**: Join our development community
- **GitHub Issues**: Report bugs and feature requests
- **Technical Blog**: Latest updates and deep dives

### Contact
- **Development Team**: dev@match-me.app
- **Security Issues**: security@match-me.app
- **Business Inquiries**: hello@match-me.app

---

**Status**: ✅ Quickstart guide complete - Ready for implementation testing