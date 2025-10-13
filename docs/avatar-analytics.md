# Avatar Analytics Implementation

This document describes the comprehensive analytics tracking system implemented for the Seal Profile Avatar feature.

## Overview

The avatar analytics system provides detailed insights into:

1. **Upload Performance**: Success rates, processing times, and error tracking
2. **Access Patterns**: User engagement, cache performance, and usage trends
3. **Error Monitoring**: Real-time error tracking and alerting
4. **User Engagement**: Activity patterns and feature adoption

## Components

### AvatarAnalyticsService

Located at `src/services/avatarAnalyticsService.ts`

**Features:**
- Batch processing for high-performance data collection
- Real-time metrics tracking with configurable flush intervals
- Comprehensive error tracking and categorization
- Automatic data retention management
- Performance-optimized database operations

**Configuration:**
```env
AVATAR_ANALYTICS_ENABLED="true"
ANALYTICS_BATCH_SIZE="50"
ANALYTICS_FLUSH_INTERVAL="30000"  # 30 seconds
ANALYTICS_RETENTION_DAYS="90"
```

### Database Schema

Three main analytics tables:

#### AvatarUploadMetric
Tracks avatar upload performance and outcomes:
```sql
- userId: String (who uploaded)
- timestamp: DateTime (when uploaded)
- fileSize: Int (original file size)
- originalFormat: String (input format)
- processedFormats: String[] (output formats)
- processingTime: Int (milliseconds)
- success: Boolean (upload success)
- errorCode: String? (error classification)
- errorMessage: String? (detailed error)
- compressionRatio: Float? (compression achieved)
- variantsGenerated: Int (number of variants created)
```

#### AvatarAccessMetric
Tracks avatar viewing and access patterns:
```sql
- targetUserId: String (avatar owner)
- viewerUserId: String? (who viewed)
- timestamp: DateTime (when accessed)
- avatarType: String (public/private/placeholder)
- isEncrypted: Boolean (encryption status)
- hasAccess: Boolean (access granted)
- loadTime: Int? (loading time in ms)
- cacheHit: Boolean (served from cache)
- userAgent: String? (browser info)
- referrer: String? (source page)
- errorCode: String? (access error)
```

#### AvatarEngagementMetric
Tracks user interactions with avatar features:
```sql
- userId: String (acting user)
- action: String (view/upload/update/delete/report)
- timestamp: DateTime (when occurred)
- sessionId: String? (session identifier)
- metadata: Json? (additional context)
```

### Analytics API

#### GET /api/avatar/analytics
Retrieves analytics data with flexible filtering:

**Query Parameters:**
- `metric`: 'overview' | 'uploads' | 'access' | 'errors' | 'engagement'
- `startDate`: ISO date string
- `endDate`: ISO date string
- `userId`: Filter by specific user

**Response Format:**
```json
{
  "success": true,
  "data": {
    "uploads": {
      "totalUploads": 1250,
      "successfulUploads": 1198,
      "successRate": 95.84,
      "averageProcessingTime": 2340,
      "averageFileSize": 2048576
    },
    "access": {
      "totalAccesses": 45230,
      "publicAccesses": 32100,
      "privateAccesses": 13130,
      "cacheHitRate": 78.5,
      "averageLoadTime": 145,
      "accessesByHour": { "09": 2340, "10": 2890 },
      "topViewers": [
        { "userId": "user123", "count": 45 }
      ]
    },
    "errors": {
      "uploadErrorRate": 4.16,
      "accessErrorRate": 1.2,
      "topUploadErrors": [
        { "code": "FILE_TOO_LARGE", "count": 23, "message": "File exceeds 5MB limit" }
      ],
      "errorTrends": [
        { "date": "2024-12-10", "uploadErrors": 5, "accessErrors": 12 }
      ]
    },
    "engagement": {
      "totalActions": 67890,
      "actionBreakdown": { "view": 45230, "upload": 1250, "update": 340 },
      "activeUsers": 2340,
      "averageActionsPerUser": 29.0,
      "engagementTrends": [
        { "date": "2024-12-10", "actions": 2340, "users": 890 }
      ]
    }
  }
}
```

#### POST /api/avatar/analytics/cleanup
Cleans up old analytics data based on retention policy.

### React Hooks

#### useAvatarAnalytics
Main hook for consuming analytics data:

```tsx
const { data, loading, error, refresh, setDateRange, setMetric } = useAvatarAnalytics({
  metric: 'overview',
  startDate: new Date('2024-11-01'),
  endDate: new Date(),
  userId: 'user123',
  autoRefresh: true,
  refreshInterval: 60000
});
```

#### useRealTimeAnalytics
Hook for real-time activity monitoring:

```tsx
const { recentUploads, recentAccesses, recentErrors } = useRealTimeAnalytics('user123');
```

#### useAnalyticsAlerts
Hook for automated alerting:

```tsx
const { alerts, dismissAlert } = useAnalyticsAlerts();
// Automatically generates alerts for high error rates and trending issues
```

### Dashboard Component

#### AvatarAnalyticsDashboard
Comprehensive dashboard component:

```tsx
<AvatarAnalyticsDashboard 
  userId="user123"  // Optional: filter to specific user
  className="custom-styles"
/>
```

**Features:**
- Real-time data updates
- Interactive date range selection
- Metric switching (overview, uploads, access, errors, engagement)
- Alert notifications
- Responsive design

## Integration Points

### Avatar Service Integration

The analytics service is automatically integrated into:

1. **Upload Process**: Tracks timing, success/failure, file sizes, compression ratios
2. **Access Process**: Tracks viewing patterns, cache performance, load times
3. **Error Handling**: Categorizes and tracks all error types
4. **User Actions**: Records all avatar-related user interactions

### Automatic Tracking

Analytics are automatically collected for:

- **Upload Events**: File validation, processing, storage, encryption
- **Access Events**: Avatar requests, cache hits/misses, permission checks
- **Engagement Events**: User interactions with avatar features
- **Error Events**: All failures with detailed context

## Performance Considerations

### Batch Processing
- Metrics are batched to reduce database load
- Configurable batch size and flush intervals
- Automatic retry on batch failures

### Database Optimization
- Indexed queries for fast analytics retrieval
- Partitioned tables for large datasets
- Automatic cleanup of old data

### Memory Management
- Bounded in-memory batches
- Graceful handling of memory pressure
- Efficient serialization of metric data

## Monitoring and Alerting

### Built-in Alerts
- High error rates (>10% upload, >5% access)
- Trending error patterns
- Performance degradation
- Unusual access patterns

### Custom Metrics
Easily extensible for custom tracking:

```typescript
await analyticsService.trackEngagement({
  userId: 'user123',
  action: 'custom_action',
  timestamp: Date.now(),
  metadata: { customField: 'value' }
});
```

### Real-time Monitoring
- WebSocket integration ready
- Server-sent events support
- Configurable refresh intervals

## Usage Examples

### Basic Analytics Dashboard
```tsx
import { AvatarAnalyticsDashboard } from '@/components/AvatarAnalyticsDashboard';

function AdminDashboard() {
  return (
    <div className="p-6">
      <h1>Avatar Analytics</h1>
      <AvatarAnalyticsDashboard />
    </div>
  );
}
```

### Custom Analytics Query
```tsx
import { useAvatarAnalytics } from '@/hooks/useAvatarAnalytics';

function CustomAnalytics() {
  const { data } = useAvatarAnalytics({
    metric: 'uploads',
    startDate: new Date('2024-12-01'),
    endDate: new Date(),
    autoRefresh: true
  });

  return (
    <div>
      <h2>Upload Performance</h2>
      <p>Success Rate: {data?.uploads?.successRate}%</p>
      <p>Avg Processing: {data?.uploads?.averageProcessingTime}ms</p>
    </div>
  );
}
```

### Error Monitoring
```tsx
import { useAnalyticsAlerts } from '@/hooks/useAvatarAnalytics';

function ErrorMonitor() {
  const { alerts, dismissAlert } = useAnalyticsAlerts();

  return (
    <div>
      {alerts.map((alert, index) => (
        <div key={index} className={`alert alert-${alert.type}`}>
          {alert.message}
          <button onClick={() => dismissAlert(index)}>×</button>
        </div>
      ))}
    </div>
  );
}
```

### Manual Tracking
```typescript
import { getAvatarAnalyticsService } from '@/services/avatarAnalyticsService';

const analytics = getAvatarAnalyticsService();

// Track custom upload event
await analytics.trackUpload({
  userId: 'user123',
  uploadStartTime: Date.now() - 5000,
  uploadEndTime: Date.now(),
  fileSize: 2048576,
  originalFormat: 'image/jpeg',
  processedFormats: ['image/webp', 'image/jpeg'],
  processingTime: 2340,
  success: true,
  variantsGenerated: 8,
  compressionRatio: 35
});

// Track access event
await analytics.trackAccess({
  targetUserId: 'user456',
  viewerUserId: 'user123',
  accessTime: Date.now(),
  avatarType: 'private',
  isEncrypted: true,
  hasAccess: true,
  loadTime: 145,
  cacheHit: false
});
```

## Data Export and Reporting

### CSV Export
```typescript
// Get analytics data
const data = await analyticsService.getUploadSuccessRate(startDate, endDate);

// Convert to CSV format
const csvData = convertToCSV(data);
downloadCSV(csvData, 'avatar-analytics.csv');
```

### API Integration
```typescript
// Fetch data for external systems
const response = await fetch('/api/avatar/analytics?metric=overview&startDate=2024-12-01');
const analytics = await response.json();

// Send to external analytics service
await sendToExternalService(analytics.data);
```

## Privacy and Compliance

### Data Protection
- No PII stored in analytics (only user IDs)
- Configurable data retention periods
- GDPR-compliant data deletion
- Anonymization options available

### Security
- Access control for analytics endpoints
- Rate limiting on analytics APIs
- Audit logging for data access
- Encrypted data transmission

## Performance Metrics

### Key Performance Indicators
- Upload success rate: Target >95%
- Average processing time: Target <3 seconds
- Cache hit rate: Target >80%
- Error rate: Target <5%
- User engagement: Actions per user per day

### Benchmarks
- Database query performance: <100ms for standard queries
- Analytics API response time: <500ms
- Batch processing latency: <30 seconds
- Memory usage: <50MB for analytics service

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Reduce batch size
   - Increase flush frequency
   - Check for memory leaks in custom tracking

2. **Slow Analytics Queries**
   - Verify database indexes
   - Optimize date range queries
   - Consider data archiving

3. **Missing Analytics Data**
   - Check analytics service status
   - Verify batch flushing
   - Review error logs

### Debug Commands

```bash
# Check analytics service health
curl http://localhost:3000/api/avatar/analytics

# View recent upload metrics
curl "http://localhost:3000/api/avatar/analytics?metric=uploads&startDate=2024-12-10"

# Monitor batch processing
tail -f logs/analytics.log | grep "batch"
```

## Future Enhancements

### Planned Features
1. **Machine Learning Integration**: Predictive analytics and anomaly detection
2. **Advanced Visualizations**: Interactive charts and graphs
3. **Custom Dashboards**: User-configurable analytics views
4. **A/B Testing Support**: Feature flag analytics integration
5. **Mobile Analytics**: React Native hook support

### Scalability Improvements
1. **Time-series Database**: Migration to InfluxDB or TimescaleDB
2. **Data Streaming**: Apache Kafka integration
3. **Distributed Processing**: Spark/Hadoop for large datasets
4. **Edge Analytics**: CDN-level metrics collection