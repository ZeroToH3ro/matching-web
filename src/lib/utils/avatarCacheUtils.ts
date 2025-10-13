import { AvatarService } from '@/services/avatarService';

/**
 * Utility functions for avatar caching and performance optimization
 */

/**
 * Preloads avatars for a list of users in the background
 */
export async function preloadAvatarsForUsers(
  userIds: string[],
  viewerUserId?: string
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    // Batch preload in chunks of 10 to avoid overwhelming the system
    const chunkSize = 10;
    const chunks = [];
    
    for (let i = 0; i < userIds.length; i += chunkSize) {
      chunks.push(userIds.slice(i, i + chunkSize));
    }

    const avatarService = new AvatarService();
    
    // Process chunks sequentially to avoid rate limiting
    for (const chunk of chunks) {
      await avatarService.preloadAvatars(chunk, viewerUserId);
      
      // Small delay between chunks to be nice to the system
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error('Failed to preload avatars:', error);
  }
}

/**
 * Preloads avatars for users that are likely to be viewed next
 * (e.g., users in the current viewport or next page)
 */
export async function preloadVisibleAvatars(
  userIds: string[],
  viewerUserId?: string,
  priority: 'high' | 'low' = 'low'
): Promise<void> {
  if (priority === 'high') {
    // For high priority, preload immediately
    await preloadAvatarsForUsers(userIds, viewerUserId);
  } else {
    // For low priority, use requestIdleCallback if available
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        preloadAvatarsForUsers(userIds, viewerUserId);
      });
    } else {
      // Fallback to setTimeout for older browsers
      setTimeout(() => {
        preloadAvatarsForUsers(userIds, viewerUserId);
      }, 100);
    }
  }
}

/**
 * Invalidates cache for a user's avatar (useful after avatar updates)
 */
export async function invalidateUserAvatarCache(userId: string): Promise<void> {
  try {
    await fetch('/api/avatar/cache', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });
  } catch (error) {
    console.error('Failed to invalidate avatar cache:', error);
  }
}

/**
 * Gets cache statistics for monitoring
 */
export async function getAvatarCacheStats(): Promise<any> {
  try {
    const response = await fetch('/api/avatar/cache');
    if (response.ok) {
      const data = await response.json();
      return data.data;
    }
    return null;
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return null;
  }
}

/**
 * Checks if the avatar service is healthy
 */
export async function checkAvatarServiceHealth(): Promise<{
  healthy: boolean;
  services: any;
}> {
  try {
    const response = await fetch('/api/avatar/health');
    const data = await response.json();
    
    return {
      healthy: data.success,
      services: data.services
    };
  } catch (error) {
    console.error('Failed to check avatar service health:', error);
    return {
      healthy: false,
      services: null
    };
  }
}

/**
 * Optimizes image loading by using intersection observer
 */
export function createAvatarIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  return new IntersectionObserver(callback, {
    rootMargin: '50px', // Start loading 50px before the element is visible
    threshold: 0.1,
    ...options
  });
}

/**
 * Debounced function to batch avatar preload requests
 */
export function createDebouncedPreloader(delay: number = 300) {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingUserIds: Set<string> = new Set();
  let viewerUserId: string | undefined;

  return function preload(userIds: string[], viewer?: string) {
    // Add new user IDs to the pending set
    userIds.forEach(id => pendingUserIds.add(id));
    viewerUserId = viewer;

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(async () => {
      if (pendingUserIds.size > 0) {
        const idsToPreload = Array.from(pendingUserIds);
        pendingUserIds.clear();
        
        await preloadAvatarsForUsers(idsToPreload, viewerUserId);
      }
    }, delay);
  };
}

/**
 * React hook for managing avatar preloading
 */
export function useAvatarPreloader() {
  const preloader = createDebouncedPreloader();

  return {
    preloadAvatars: preloader,
    preloadImmediate: preloadAvatarsForUsers,
    invalidateCache: invalidateUserAvatarCache,
    getStats: getAvatarCacheStats,
    checkHealth: checkAvatarServiceHealth
  };
}