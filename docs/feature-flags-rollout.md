# Feature Flags and Gradual Rollout

This document describes the feature flag system implemented for the Seal Profile Avatar feature, enabling controlled rollouts and A/B testing.

## Overview

The feature flag system provides:

1. **Granular Control**: Enable/disable specific avatar features for different user segments
2. **Gradual Rollout**: Percentage-based rollouts with user segment targeting
3. **A/B Testing**: Conditional feature access based on user attributes
4. **Rollback Capability**: Instant feature disabling without code deployment
5. **Real-time Management**: Admin dashboard for live feature flag management

## Architecture

### FeatureFlagService

Located at `src/services/featureFlagService.ts`

**Core Features:**
- Environment-based configuration loading
- User context evaluation (role, subscription, registration date)
- Multiple rollout strategies (percentage, segments, conditional, hybrid)
- Intelligent caching with TTL for performance
- Real-time flag updates without restart

**Rollout Strategies:**
1. **Percentage**: Random percentage of users based on user ID hash
2. **User Segments**: Target specific user groups (admin, premium, beta, etc.)
3. **Conditional**: Complex conditions based on user attributes
4. **Hybrid**: Combination of percentage, segments, and conditions

### React Integration

#### Hooks
- `useFeatureFlag`: Single feature flag checking
- `useFeatureFlags`: Multiple feature flags checking
- `useAvatarFeatureFlags`: Avatar-specific feature flags

#### Components
- `FeatureFlagWrapper`: Conditional rendering wrapper
- `withFeatureFlag`: Higher-order component for feature protection

## Available Feature Flags

### Avatar Core Features

#### avatar_upload_enabled
- **Description**: Controls avatar upload functionality
- **Default**: Enabled (100%)
- **Impact**: Hides upload interface when disabled

#### avatar_display_enabled
- **Description**: Controls avatar display functionality
- **Default**: Enabled (100%)
- **Impact**: Shows placeholder when disabled

#### avatar_face_swap_enabled
- **Description**: Controls face swap functionality for public avatars
- **Default**: Enabled (100%)
- **Impact**: Uses original image when disabled

#### avatar_encryption_enabled
- **Description**: Controls Seal Protocol encryption for private avatars
- **Default**: Enabled (100%)
- **Impact**: Falls back to basic access control when disabled

### Avatar Advanced Features

#### avatar_progressive_loading_enabled
- **Description**: Controls progressive image loading with placeholders
- **Default**: Disabled (0%)
- **Rollout**: 80% for beta and premium users
- **Impact**: Uses standard loading when disabled

#### avatar_cdn_enabled
- **Description**: Controls CDN usage for avatar delivery
- **Default**: Enabled (90%)
- **Impact**: Uses direct storage URLs when disabled

#### avatar_analytics_enabled
- **Description**: Controls avatar analytics tracking
- **Default**: Enabled (100%)
- **Impact**: Disables metrics collection when disabled

#### avatar_moderation_enabled
- **Description**: Controls avatar content moderation
- **Default**: Enabled (100%)
- **Impact**: Bypasses moderation checks when disabled

## Configuration

### Environment Variables

```env
# Feature Flag States
AVATAR_UPLOAD_ENABLED="true"
AVATAR_DISPLAY_ENABLED="true"
AVATAR_FACE_SWAP_ENABLED="true"
AVATAR_ENCRYPTION_ENABLED="true"
AVATAR_MODERATION_ENABLED="true"
AVATAR_PROGRESSIVE_LOADING_ENABLED="false"
AVATAR_CDN_ENABLED="true"

# Rollout Configuration
AVATAR_UPLOAD_ROLLOUT_PERCENTAGE="100"
AVATAR_UPLOAD_ROLLOUT_SEGMENTS="all"
AVATAR_PROGRESSIVE_ROLLOUT_PERCENTAGE="80"
```

### User Segments

The system automatically categorizes users into segments:

- **admin**: Users with ADMIN role
- **premium**: Users with premium subscription
- **beta**: Users enrolled in beta program
- **new_user**: Users registered within last 30 days
- **standard**: Default segment for regular users
- **all**: Matches all users

## Usage Examples

### React Component Integration

```tsx
import { useAvatarFeatureFlags } from '@/hooks/useFeatureFlag';

function AvatarUploadComponent() {
  const {
    canUploadAvatar,
    canUseFaceSwap,
    canUseEncryption,
    loading
  } = useAvatarFeatureFlags();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!canUploadAvatar) {
    return <div>Avatar upload is currently unavailable</div>;
  }

  return (
    <div>
      <AvatarUploadForm />
      {canUseFaceSwap && <FaceSwapOptions />}
      {canUseEncryption && <EncryptionSettings />}
    </div>
  );
}
```

### Feature Flag Wrapper

```tsx
import { FeatureFlagWrapper } from '@/hooks/useFeatureFlag';

function ProfilePage() {
  return (
    <div>
      <FeatureFlagWrapper 
        flagKey="avatar_progressive_loading_enabled"
        fallback={<StandardAvatarDisplay />}
      >
        <ProgressiveAvatarDisplay />
      </FeatureFlagWrapper>
    </div>
  );
}
```

### Higher-Order Component

```tsx
import { withFeatureFlag } from '@/hooks/useFeatureFlag';

const EnhancedAvatarUpload = withFeatureFlag(
  AvatarUploadComponent,
  'avatar_upload_enabled',
  false, // default value
  DisabledUploadComponent // fallback component
);
```

### Manual Flag Checking

```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function CustomComponent() {
  const { isEnabled, loading } = useFeatureFlag({
    flagKey: 'avatar_encryption_enabled',
    defaultValue: false,
    refreshInterval: 60000 // Check every minute
  });

  return (
    <div>
      {isEnabled ? 'Encryption Available' : 'Basic Mode'}
    </div>
  );
}
```

## API Endpoints

### Feature Flag Checking

#### POST /api/feature-flags/check
Check a single feature flag for a user:

```json
{
  "flagKey": "avatar_upload_enabled",
  "userId": "user123"
}
```

Response:
```json
{
  "success": true,
  "enabled": true,
  "flagKey": "avatar_upload_enabled",
  "userId": "user123",
  "timestamp": "2024-12-11T10:00:00Z"
}
```

#### POST /api/feature-flags/check-multiple
Check multiple feature flags at once:

```json
{
  "flagKeys": ["avatar_upload_enabled", "avatar_face_swap_enabled"],
  "userId": "user123"
}
```

Response:
```json
{
  "success": true,
  "flags": {
    "avatar_upload_enabled": true,
    "avatar_face_swap_enabled": false
  },
  "userId": "user123",
  "timestamp": "2024-12-11T10:00:00Z"
}
```

### Admin Management

#### GET /api/admin/feature-flags
Get all feature flags and statistics (admin only):

```json
{
  "success": true,
  "flags": [...],
  "statistics": {
    "totalFlags": 8,
    "enabledFlags": 6,
    "flagsWithRollout": 2,
    "cacheSize": 150
  }
}
```

#### POST /api/admin/feature-flags
Update a feature flag (admin only):

```json
{
  "flagKey": "avatar_progressive_loading_enabled",
  "enabled": true,
  "rolloutPercentage": 50,
  "userSegments": ["beta", "premium"]
}
```

#### POST /api/admin/feature-flags/[flagKey]/rollout
Update rollout configuration (admin only):

```json
{
  "strategy": "hybrid",
  "percentage": 80,
  "segments": ["beta", "premium"],
  "conditions": [
    {
      "type": "registration_date",
      "operator": "greater_than",
      "value": "2024-01-01"
    }
  ],
  "enabledUsers": ["user1", "user2"],
  "disabledUsers": ["user3"]
}
```

## Admin Dashboard

### Feature Flag Management

Access the admin dashboard at `/admin/feature-flags`:

**Features:**
- Real-time flag status overview
- Toggle flags on/off instantly
- Configure rollout strategies
- View rollout statistics
- Manage user segment targeting

**Rollout Configuration:**
- **Percentage Strategy**: Random rollout to X% of users
- **User Segments**: Target specific user groups
- **Conditional Strategy**: Complex attribute-based conditions
- **Hybrid Strategy**: Combine multiple conditions

**User Management:**
- Explicit user inclusion/exclusion lists
- Override rollout rules for specific users
- Test flag behavior for individual users

## Rollout Strategies

### Percentage-Based Rollout

Gradually increase feature availability:

```javascript
// Week 1: 10% of users
updateRollout('avatar_progressive_loading_enabled', {
  strategy: 'percentage',
  percentage: 10
});

// Week 2: 25% of users
updateRollout('avatar_progressive_loading_enabled', {
  strategy: 'percentage',
  percentage: 25
});

// Week 3: 50% of users
updateRollout('avatar_progressive_loading_enabled', {
  strategy: 'percentage',
  percentage: 50
});

// Week 4: 100% of users
updateRollout('avatar_progressive_loading_enabled', {
  strategy: 'percentage',
  percentage: 100
});
```

### Segment-Based Rollout

Target specific user groups:

```javascript
// Phase 1: Beta users only
updateRollout('new_avatar_feature', {
  strategy: 'user_segments',
  segments: ['beta']
});

// Phase 2: Beta and premium users
updateRollout('new_avatar_feature', {
  strategy: 'user_segments',
  segments: ['beta', 'premium']
});

// Phase 3: All users
updateRollout('new_avatar_feature', {
  strategy: 'user_segments',
  segments: ['all']
});
```

### Conditional Rollout

Complex attribute-based targeting:

```javascript
// Target users registered after a specific date
updateRollout('enhanced_avatars', {
  strategy: 'conditional',
  conditions: [
    {
      type: 'registration_date',
      operator: 'greater_than',
      value: '2024-06-01'
    },
    {
      type: 'role',
      operator: 'not_in',
      value: ['ADMIN'] // Exclude admins from beta testing
    }
  ]
});
```

### Hybrid Rollout

Combine multiple strategies:

```javascript
// 50% of premium users registered after Jan 2024
updateRollout('premium_avatar_features', {
  strategy: 'hybrid',
  percentage: 50,
  segments: ['premium'],
  conditions: [
    {
      type: 'registration_date',
      operator: 'greater_than',
      value: '2024-01-01'
    }
  ]
});
```

## Monitoring and Analytics

### Performance Metrics

The system tracks:
- Flag evaluation performance
- Cache hit rates
- User segment distribution
- Rollout effectiveness

### A/B Testing Support

Feature flags enable A/B testing:

```javascript
// Test two different avatar upload flows
const useNewUploadFlow = await isEnabled('new_avatar_upload_flow', userContext);

if (useNewUploadFlow) {
  // Track conversion for new flow
  analytics.track('avatar_upload_started', { flow: 'new' });
  return <NewAvatarUploadComponent />;
} else {
  // Track conversion for old flow
  analytics.track('avatar_upload_started', { flow: 'old' });
  return <OldAvatarUploadComponent />;
}
```

### Rollback Procedures

Instant rollback capabilities:

```javascript
// Emergency rollback - disable feature immediately
updateFlag('problematic_feature', { enabled: false });

// Gradual rollback - reduce percentage
updateRollout('problematic_feature', {
  strategy: 'percentage',
  percentage: 0
});

// Segment-specific rollback - disable for specific groups
updateRollout('problematic_feature', {
  strategy: 'user_segments',
  segments: [], // Empty segments = no users
  disabledUsers: ['affected_user_1', 'affected_user_2']
});
```

## Best Practices

### Flag Naming

Use descriptive, hierarchical names:
- `avatar_upload_enabled` (core functionality)
- `avatar_progressive_loading_enabled` (enhancement)
- `avatar_moderation_v2_enabled` (version-specific)

### Rollout Planning

1. **Start Small**: Begin with 1-5% of users
2. **Monitor Closely**: Watch error rates and user feedback
3. **Gradual Increase**: Double percentage weekly if stable
4. **Segment Testing**: Test with beta users first
5. **Full Rollout**: Reach 100% only after thorough validation

### Performance Considerations

- **Caching**: Flags are cached for 5 minutes per user
- **Batch Checking**: Use `useFeatureFlags` for multiple flags
- **Default Values**: Always provide sensible defaults
- **Graceful Degradation**: Handle flag service failures

### Security Guidelines

- **Admin Only**: Flag management requires admin role
- **Audit Logging**: All flag changes are logged
- **Rate Limiting**: API endpoints have rate limits
- **Validation**: Input validation on all flag operations

## Troubleshooting

### Common Issues

1. **Flag Not Taking Effect**
   - Check cache expiry (5-minute TTL)
   - Verify user segment assignment
   - Confirm rollout percentage

2. **Performance Issues**
   - Use batch flag checking
   - Implement proper caching
   - Avoid excessive flag evaluations

3. **Rollout Not Working**
   - Verify rollout configuration
   - Check user context data
   - Review condition logic

### Debug Commands

```bash
# Check flag status for a user
curl -X POST /api/feature-flags/check \
  -H "Content-Type: application/json" \
  -d '{"flagKey": "avatar_upload_enabled", "userId": "user123"}'

# Get all flags (admin)
curl -X GET /api/admin/feature-flags \
  -H "Authorization: Bearer admin-token"

# Check rollout configuration
curl -X GET /api/admin/feature-flags/avatar_progressive_loading_enabled/rollout \
  -H "Authorization: Bearer admin-token"
```

## Future Enhancements

### Planned Features

1. **Advanced Analytics**: Detailed rollout metrics and conversion tracking
2. **Automated Rollouts**: Schedule-based automatic percentage increases
3. **Machine Learning**: AI-powered rollout optimization
4. **External Integration**: Connect with analytics platforms
5. **Mobile Support**: React Native hook implementations

### Integration Opportunities

1. **Analytics Platforms**: Google Analytics, Mixpanel integration
2. **Monitoring Tools**: DataDog, New Relic integration
3. **A/B Testing**: Optimizely, LaunchDarkly compatibility
4. **CI/CD**: Automated flag management in deployment pipelines