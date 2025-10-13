import type { AvatarResult } from '@/lib/types/avatar';

interface CacheConfig {
  defaultTtl: number;
  publicAvatarTtl: number;
  privateAvatarTtl: number;
  metadataTtl: number;
  maxSize: number;
}

interface CachedAvatarData {
  result: AvatarResult;
  expiresAt: number;
}

interface AvatarMetadata {
  publicAvatarBlobId?: string;
  privateAvatarBlobId?: string;
  avatarSealPolicyId?: string;
  avatarUploadedAt?: string;
  avatarSettings?: any;
}

interface CachedMetadata {
  metadata: AvatarMetadata;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: string;
}

export class AvatarCacheService {
  private cache = new Map<string, CachedAvatarData | CachedMetadata>();
  private config: CacheConfig;
  private stats = { hits: 0, misses: 0 };

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      defaultTtl: 3600, // 1 hour
      publicAvatarTtl: 86400, // 24 hours (public avatars change less frequently)
      privateAvatarTtl: 1800, // 30 minutes (private avatars need fresher access checks)
      metadataTtl: 3600, // 1 hour
      maxSize: 1000, // Maximum number of cached items
      ...config
    };

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
  }

  /**
   * Gets cached avatar result for a user
   */
  async getCachedAvatar(
    targetUserId: string,
    viewerUserId?: string
  ): Promise<AvatarResult | null> {
    try {
      const cacheKey = this.getAvatarCacheKey(targetUserId, viewerUserId);
      const cached = this.cache.get(cacheKey) as CachedAvatarData | undefined;
      
      if (!cached) {
        this.stats.misses++;
        return null;
      }

      // Check if cache has expired
      if (Date.now() > cached.expiresAt) {
        this.cache.delete(cacheKey);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return cached.result;
    } catch (error) {
      console.error('Failed to get cached avatar:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Caches an avatar result for a user
   */
  async cacheAvatar(
    targetUserId: string,
    viewerUserId: string | undefined,
    result: AvatarResult,
    customTtl?: number
  ): Promise<void> {
    try {
      // Check cache size limit
      if (this.cache.size >= this.config.maxSize) {
        this.evictOldest();
      }

      const cacheKey = this.getAvatarCacheKey(targetUserId, viewerUserId);
      const ttl = customTtl || (result.type === 'public' ? this.config.publicAvatarTtl : this.config.privateAvatarTtl);
      
      const cachedData: CachedAvatarData = {
        result,
        expiresAt: Date.now() + (ttl * 1000)
      };

      this.cache.set(cacheKey, cachedData);
    } catch (error) {
      console.error('Failed to cache avatar:', error);
    }
  }

  /**
   * Gets cached avatar metadata for a user
   */
  async getCachedAvatarMetadata(userId: string): Promise<AvatarMetadata | null> {
    try {
      const cacheKey = this.getMetadataCacheKey(userId);
      const cached = this.cache.get(cacheKey) as CachedMetadata | undefined;
      
      if (!cached) {
        this.stats.misses++;
        return null;
      }

      // Check if cache has expired
      if (Date.now() > cached.expiresAt) {
        this.cache.delete(cacheKey);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return cached.metadata;
    } catch (error) {
      console.error('Failed to get cached metadata:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Caches avatar metadata for a user
   */
  async cacheAvatarMetadata(userId: string, metadata: AvatarMetadata): Promise<void> {
    try {
      // Check cache size limit
      if (this.cache.size >= this.config.maxSize) {
        this.evictOldest();
      }

      const cacheKey = this.getMetadataCacheKey(userId);
      const cachedData: CachedMetadata = {
        metadata,
        expiresAt: Date.now() + (this.config.metadataTtl * 1000)
      };

      this.cache.set(cacheKey, cachedData);
    } catch (error) {
      console.error('Failed to cache metadata:', error);
    }
  }

  /**
   * Invalidates all cached data for a user
   */
  async invalidateUserAvatar(userId: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];
      
      for (const key of this.cache.keys()) {
        if (key.includes(`user:${userId}`)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key));
    } catch (error) {
      console.error('Failed to invalidate user avatar cache:', error);
    }
  }

  /**
   * Invalidates cached avatar access between two users
   */
  async invalidateAvatarAccess(targetUserId: string, viewerUserId: string): Promise<void> {
    try {
      const cacheKey = this.getAvatarCacheKey(targetUserId, viewerUserId);
      this.cache.delete(cacheKey);
    } catch (error) {
      console.error('Failed to invalidate avatar access cache:', error);
    }
  }

  /**
   * Preloads avatars for multiple users
   */
  async preloadAvatars(
    userIds: string[],
    viewerUserId?: string,
    avatarLoader?: (targetUserId: string, viewerUserId?: string) => Promise<AvatarResult>
  ): Promise<void> {
    if (!avatarLoader) return;

    try {
      const preloadPromises = userIds.map(async (userId) => {
        const cached = await this.getCachedAvatar(userId, viewerUserId);
        if (!cached) {
          // Load and cache the avatar
          try {
            const result = await avatarLoader(userId, viewerUserId);
            await this.cacheAvatar(userId, viewerUserId, result);
          } catch (error) {
            console.warn(`Failed to preload avatar for user ${userId}:`, error);
          }
        }
      });

      await Promise.allSettled(preloadPromises);
    } catch (error) {
      console.error('Failed to preload avatars:', error);
    }
  }

  /**
   * Gets cache performance statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalKeys: this.cache.size,
      memoryUsage: `${this.cache.size} items`
    };
  }

  /**
   * Clears all cached avatar data
   */
  async clearAvatarCache(): Promise<void> {
    try {
      this.cache.clear();
      this.stats = { hits: 0, misses: 0 };
    } catch (error) {
      console.error('Failed to clear avatar cache:', error);
      throw error;
    }
  }

  /**
   * Closes any connections (no-op for in-memory cache)
   */
  async disconnect(): Promise<void> {
    // No-op for in-memory cache
    console.log('In-memory cache disconnected');
  }

  /**
   * Generates cache key for avatar data
   */
  private getAvatarCacheKey(targetUserId: string, viewerUserId?: string): string {
    return `avatar:user:${targetUserId}:viewer:${viewerUserId || 'anonymous'}`;
  }

  /**
   * Generates cache key for metadata
   */
  private getMetadataCacheKey(userId: string): string {
    return `metadata:user:${userId}`;
  }

  /**
   * Cleans up expired cache entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * Evicts oldest cache entries when size limit is reached
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    // Sort by expiration time and remove oldest 10%
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
}

// Singleton instance
let avatarCacheService: AvatarCacheService | null = null;

export function getAvatarCacheService(): AvatarCacheService {
  if (!avatarCacheService) {
    avatarCacheService = new AvatarCacheService();
  }
  return avatarCacheService;
}