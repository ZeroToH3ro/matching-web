# Avatar Caching Implementation

This document describes the avatar caching layer implementation for the Seal Profile Avatar feature.

## Overview

The avatar caching system provides three layers of optimization:

1. **Redis Cache**: In-memory caching for avatar metadata and access results
2. **CDN Integration**: Content delivery network for public avatar distribution
3. **Cache Invalidation**: Automatic cache management when avatars or permissions change

## Components

### AvatarCacheService

Located at `src/services/avatarCacheService.ts`

**Features:**
- Redis-based caching for avatar results and metadata
- Configurable TTL for different avatar types
- Automatic cache invalidation
- Performance monitoring and statistics
- Preloading capabilities for batch operations

**Configuration:**
```env
REDIS_URL="redis://localhost:6379"
```

### AvatarCdnService

Located at `src/services/avatarCdnService.ts`

**Features:**
- CDN URL generation with image transformations
- Multiple format support (WebP, JPEG)
- Responsive image generation
- Cache header management
- CDN cache invalidation

**Configuration:**
```env
CDN_ENABLED="true"
CDN_BASE_URL="https://your-cdn-domain.com"
```

### Integration with AvatarService

The existing `AvatarService` has been enhanced with caching:

- **Cache-first reads**: Check cache before database/storage
- **Automatic invalidation**: Clear cache on avatar updates
- **CDN optimization**: Use CDN URLs for public avatars
- **Preloading**: Background loading for performance

## Cache Keys

### Avatar Results
- Format: `avatar:{targetUserId}:{viewerUserId|'public'}`
- TTL: 24 hours (public), 30 minutes (private)

### Avatar Metadata
- Format: `avatar_meta:{userId}`
- TTL: 1 hour

## API Endpoints

### Cache Management
- `GET /api/avatar/cache` - Get cache statistics
- `DELETE /api/avatar/cache` - Clear avatar cache
- `POST /api/avatar/cache/preload` - Preload avatars for users

### Health Check
- `GET /api/avatar/health` - Service health status

## Usage Examples

### Preloading Avatars
```typescript
import { useAvatarPreloader } from '@/lib/utils/avatarCacheUtils';

const { preloadAvatars } = useAvatarPreloader();

// Preload avatars for users in viewport
preloadAvatars(['user1', 'user2', 'user3'], currentUserId);
```

### Cache Invalidation
```typescript
import { invalidateUserAvatarCache } from '@/lib/utils/avatarCacheUtils';

// After avatar upload
await invalidateUserAvatarCache(userId);
```

### Performance Monitoring
```typescript
import { getAvatarCacheStats } from '@/lib/utils/avatarCacheUtils';

const stats = await getAvatarCacheStats();
console.log('Cache hit rate:', stats.cache.hitRate);
```

## Performance Benefits

1. **Reduced Database Queries**: Cache avatar metadata and access results
2. **Faster Image Loading**: CDN distribution for public avatars
3. **Improved UX**: Preloading for smoother browsing
4. **Reduced Seal Verification**: Cache access verification results

## Cache Invalidation Strategy

### Automatic Invalidation
- Avatar upload/update: Clear all cache for user
- Match creation/deletion: Clear access cache for both users
- Avatar deletion: Clear all cache and CDN

### Manual Invalidation
- Admin cache management API
- Maintenance operations
- Error recovery

## Monitoring

### Key Metrics
- Cache hit/miss rates
- Average response times
- CDN performance
- Error rates

### Health Checks
- Redis connectivity
- CDN availability
- Storage service status

## Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_URL="redis://localhost:6379"

# CDN Configuration
CDN_ENABLED="true"
CDN_BASE_URL="https://cdn.example.com"

# Cache TTL (seconds)
AVATAR_CACHE_TTL_PUBLIC="86400"
AVATAR_CACHE_TTL_PRIVATE="1800"
AVATAR_CACHE_TTL_METADATA="3600"
```

### Redis Setup

For development:
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Using Homebrew (macOS)
brew install redis
brew services start redis
```

For production:
- Use managed Redis service (AWS ElastiCache, Redis Cloud, etc.)
- Configure clustering for high availability
- Set up monitoring and alerting

## Best Practices

1. **Cache Warming**: Preload frequently accessed avatars
2. **Graceful Degradation**: Fall back to direct storage if cache fails
3. **Monitoring**: Track cache performance and adjust TTL as needed
4. **Security**: Never cache private avatar URLs in public caches
5. **Cleanup**: Regular cache cleanup for expired entries

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - Check Redis server status
   - Verify connection string
   - Check network connectivity

2. **Cache Miss Rate High**
   - Adjust TTL values
   - Implement better preloading
   - Check invalidation frequency

3. **CDN Issues**
   - Verify CDN configuration
   - Check cache headers
   - Monitor CDN health endpoint

### Debug Commands

```bash
# Check Redis connectivity
redis-cli ping

# Monitor Redis operations
redis-cli monitor

# Check cache keys
redis-cli keys "avatar:*"

# Get cache statistics
curl http://localhost:3000/api/avatar/cache
```