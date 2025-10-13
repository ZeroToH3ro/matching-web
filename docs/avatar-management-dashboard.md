# Avatar Management Dashboard

This document describes the comprehensive avatar management dashboard system implemented for administrators and users.

## Overview

The avatar management dashboard provides two main interfaces:

1. **Admin Dashboard**: For content moderation, platform analytics, and system management
2. **User Dashboard**: For personal avatar management, privacy settings, and usage statistics

## Components

### Admin Dashboard

#### AvatarModerationDashboard
Located at `src/components/admin/AvatarModerationDashboard.tsx`

**Features:**
- Real-time moderation queue with pending, approved, and rejected content
- User report management and content flagging
- Comprehensive analytics integration
- Bulk moderation actions and automated workflows
- Performance monitoring and system health checks

**Tabs:**
1. **Overview**: Quick stats, recent activity, and system health
2. **Moderation Queue**: Pending content requiring review
3. **Reports**: User-reported content and automated flags
4. **Analytics**: Comprehensive platform analytics

#### Admin API Endpoints

**GET /api/admin/avatar/moderation**
- Retrieves moderation queue with filtering options
- Supports pagination and status filtering
- Returns user info, upload dates, and report counts

**POST /api/admin/avatar/moderation/[itemId]**
- Approves or rejects avatar content
- Records moderation decisions and reasons
- Updates user avatar settings automatically

### User Dashboard

#### AvatarManagementPanel
Located at `src/components/user/AvatarManagementPanel.tsx`

**Features:**
- Avatar upload and replacement interface
- Comprehensive privacy settings management
- Personal usage statistics and analytics
- Privacy education and best practices guide
- Real-time moderation status updates

**Tabs:**
1. **Upload Avatar**: Upload interface with guidelines
2. **Privacy Settings**: Visibility controls and access management
3. **Statistics**: Personal usage analytics and insights
4. **Privacy Guide**: Educational content about avatar privacy

#### AvatarUsageReport
Located at `src/components/AvatarUsageReport.tsx`

**Features:**
- Detailed usage analytics with multiple time ranges
- Performance insights and optimization recommendations
- CSV export functionality for data analysis
- Visual charts and trend analysis
- Cache performance and load time monitoring

## Admin Dashboard Features

### Moderation Queue Management

#### Overview Tab
```tsx
// Quick statistics display
- Pending Review: Items awaiting moderation
- Reported Content: User-flagged content
- Approved Today: Recently approved items
- Rejected Today: Recently rejected items

// Recent Activity Feed
- Real-time moderation actions
- Moderator activity tracking
- System performance alerts
```

#### Moderation Tab
```tsx
// Content Review Interface
- Avatar preview with user information
- Upload timestamp and metadata
- Report count and flagging reasons
- One-click approve/reject actions
- Bulk moderation capabilities

// Rejection Modal
- Reason selection and custom messages
- User notification system
- Appeal process integration
```

#### Reports Tab
```tsx
// User Reports Management
- Reported content prioritization
- Auto-flagged content review
- Report categorization and tracking
- False positive identification
```

#### Analytics Tab
```tsx
// Platform Analytics Integration
- Upload success rates and trends
- User engagement metrics
- Error rate monitoring
- Performance optimization insights
```

### Admin Configuration

```env
# Admin Dashboard Configuration
ADMIN_MODERATION_BATCH_SIZE="20"
ADMIN_AUTO_APPROVE_THRESHOLD="0.95"
ADMIN_NOTIFICATION_WEBHOOK="https://your-webhook-url.com"
```

## User Dashboard Features

### Avatar Upload Management

#### Upload Interface
```tsx
// Current Avatar Display
- Preview of active avatar
- Upload date and status
- Quick delete option

// Upload Guidelines
- File format requirements
- Size limitations
- Content policy reminders
- Quality recommendations
```

#### Privacy Settings
```tsx
// Visibility Controls
- Matches Only: Maximum privacy
- Premium Matches: Selective sharing
- All Matches: Broader visibility

// Advanced Settings
- Auto-expire configuration
- Download permissions
- Access logging preferences
```

### Personal Analytics

#### Usage Statistics
```tsx
// View Metrics
- Total views and unique viewers
- View patterns and trends
- Geographic distribution
- Device and browser analytics

// Performance Metrics
- Load times and cache performance
- Image optimization statistics
- Bandwidth usage tracking
```

#### Privacy Insights
```tsx
// Access Patterns
- Who viewed your avatar
- When access was granted/revoked
- Match-based access history
- Privacy setting effectiveness
```

## API Integration

### Admin APIs

#### Moderation Queue
```typescript
// Get moderation items
GET /api/admin/avatar/moderation?status=pending&limit=50

// Moderate content
POST /api/admin/avatar/moderation/{itemId}
{
  "action": "approve" | "reject",
  "reason": "Optional rejection reason"
}
```

#### Analytics
```typescript
// Get admin analytics
GET /api/avatar/analytics?metric=overview&startDate=2024-12-01

// Cleanup old data
POST /api/avatar/analytics/cleanup
```

### User APIs

#### Avatar Management
```typescript
// Get avatar info and stats
GET /api/avatar/info

// Update privacy settings
PATCH /api/avatar/settings
{
  "visibility": "matches_only",
  "enabled": true,
  "allowDownload": false
}

// Delete avatar
DELETE /api/avatar/settings
```

## Usage Examples

### Admin Moderation Workflow

```tsx
import { AvatarModerationDashboard } from '@/components/admin/AvatarModerationDashboard';

function AdminPage() {
  return (
    <div className="admin-layout">
      <h1>Avatar Moderation</h1>
      <AvatarModerationDashboard />
    </div>
  );
}
```

### User Avatar Management

```tsx
import { AvatarManagementPanel } from '@/components/user/AvatarManagementPanel';
import { AvatarUsageReport } from '@/components/AvatarUsageReport';

function ProfilePage({ userId }: { userId: string }) {
  return (
    <div className="profile-layout">
      <AvatarManagementPanel userId={userId} />
      <AvatarUsageReport userId={userId} timeRange="month" />
    </div>
  );
}
```

### Custom Analytics Dashboard

```tsx
import { useAvatarAnalytics } from '@/hooks/useAvatarAnalytics';

function CustomDashboard() {
  const { data, loading } = useAvatarAnalytics({
    metric: 'overview',
    autoRefresh: true
  });

  return (
    <div>
      <h2>Platform Overview</h2>
      {data?.summary && (
        <div className="stats-grid">
          <StatCard title="Total Uploads" value={data.summary.totalUploads} />
          <StatCard title="Success Rate" value={`${data.summary.uploadSuccessRate}%`} />
        </div>
      )}
    </div>
  );
}
```

## Security and Permissions

### Admin Access Control

```typescript
// Role-based access checking
const checkAdminAccess = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  
  return user?.role === 'ADMIN';
};
```

### User Data Protection

```typescript
// Privacy-safe analytics
const getUserAnalytics = async (userId: string, requesterId: string) => {
  // Only allow users to see their own detailed analytics
  if (userId !== requesterId) {
    throw new Error('Access denied');
  }
  
  return getDetailedAnalytics(userId);
};
```

## Performance Optimization

### Caching Strategy

```typescript
// Admin dashboard caching
const CACHE_KEYS = {
  MODERATION_QUEUE: 'admin:moderation:queue',
  PLATFORM_STATS: 'admin:stats:platform',
  USER_REPORTS: 'admin:reports:active'
};

// Cache moderation queue for 5 minutes
const getModerationQueue = async () => {
  return await cache.get(CACHE_KEYS.MODERATION_QUEUE, async () => {
    return await fetchModerationQueue();
  }, { ttl: 300 });
};
```

### Real-time Updates

```typescript
// WebSocket integration for real-time updates
const setupRealtimeUpdates = () => {
  const ws = new WebSocket('/api/admin/realtime');
  
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    
    switch (update.type) {
      case 'NEW_REPORT':
        updateModerationQueue(update.data);
        break;
      case 'MODERATION_ACTION':
        updateModerationStats(update.data);
        break;
    }
  };
};
```

## Monitoring and Alerting

### Key Metrics

```typescript
// Admin dashboard metrics
const ADMIN_METRICS = {
  PENDING_QUEUE_SIZE: 'admin.moderation.queue.size',
  MODERATION_RESPONSE_TIME: 'admin.moderation.response_time',
  REPORT_RATE: 'admin.reports.rate',
  FALSE_POSITIVE_RATE: 'admin.moderation.false_positive_rate'
};

// Alert thresholds
const ALERT_THRESHOLDS = {
  QUEUE_SIZE: 100,        // Alert if queue > 100 items
  RESPONSE_TIME: 3600,    // Alert if response time > 1 hour
  REPORT_RATE: 0.1,       // Alert if report rate > 10%
  FALSE_POSITIVE: 0.05    // Alert if false positive > 5%
};
```

### Automated Workflows

```typescript
// Auto-moderation rules
const autoModerationRules = [
  {
    condition: 'reportCount > 5',
    action: 'auto_reject',
    reason: 'Multiple user reports'
  },
  {
    condition: 'aiConfidence > 0.95 && aiResult === "safe"',
    action: 'auto_approve',
    reason: 'AI pre-approval'
  }
];
```

## Customization and Extensions

### Custom Moderation Rules

```typescript
// Plugin system for custom moderation
interface ModerationPlugin {
  name: string;
  evaluate: (avatar: AvatarData) => Promise<ModerationResult>;
}

const customModerationPlugin: ModerationPlugin = {
  name: 'CustomContentFilter',
  evaluate: async (avatar) => {
    // Custom moderation logic
    return {
      action: 'approve' | 'reject' | 'flag',
      confidence: 0.95,
      reason: 'Custom rule applied'
    };
  }
};
```

### Dashboard Themes

```css
/* Admin dashboard themes */
.admin-dashboard.theme-dark {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #ffffff;
  --accent-color: #3b82f6;
}

.admin-dashboard.theme-light {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #1f2937;
  --accent-color: #2563eb;
}
```

## Troubleshooting

### Common Issues

1. **Moderation Queue Not Loading**
   ```bash
   # Check database connection
   curl -X GET /api/admin/avatar/moderation
   
   # Verify admin permissions
   SELECT role FROM users WHERE id = 'admin-user-id';
   ```

2. **Analytics Data Missing**
   ```bash
   # Check analytics service
   curl -X GET /api/avatar/analytics?metric=overview
   
   # Verify batch processing
   tail -f logs/analytics.log | grep "batch"
   ```

3. **Real-time Updates Not Working**
   ```bash
   # Check WebSocket connection
   wscat -c ws://localhost:3000/api/admin/realtime
   
   # Verify event publishing
   grep "event_published" logs/realtime.log
   ```

### Performance Issues

1. **Slow Dashboard Loading**
   - Enable caching for moderation queue
   - Implement pagination for large datasets
   - Optimize database queries with proper indexes

2. **High Memory Usage**
   - Reduce batch sizes for analytics processing
   - Implement data archiving for old records
   - Use streaming for large data exports

## Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - Machine learning insights
   - Predictive moderation
   - Trend analysis and forecasting

2. **Enhanced Automation**
   - Smart auto-moderation
   - Workflow automation
   - Integration with external services

3. **Mobile Support**
   - React Native components
   - Mobile-optimized interfaces
   - Push notifications

4. **Advanced Reporting**
   - Custom report builder
   - Scheduled reports
   - Data visualization improvements

### Integration Opportunities

1. **External Moderation Services**
   - Third-party content analysis
   - Human moderation services
   - AI/ML moderation APIs

2. **Business Intelligence**
   - Data warehouse integration
   - Advanced analytics platforms
   - Custom dashboard builders

3. **Compliance Tools**
   - GDPR compliance automation
   - Audit trail management
   - Legal reporting features