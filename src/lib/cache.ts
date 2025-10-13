import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * Cache tags for different data types
 */
export const CACHE_TAGS = {
  MEMBERS: 'members',
  MEMBER_PHOTOS: 'member-photos',
  MESSAGES: 'messages',
  LIKES: 'likes',
  USER: 'user',
  MATCH: 'match',
} as const;

/**
 * Cache revalidation times (in seconds)
 */
export const CACHE_REVALIDATE = {
  SHORT: 30,      // 30 seconds - for frequently changing data
  MEDIUM: 60,     // 1 minute - for moderate changes
  LONG: 300,      // 5 minutes - for stable data
  VERY_LONG: 3600 // 1 hour - for rarely changing data
} as const;

/**
 * Revalidate specific cache tag
 */
export function revalidateCache(tag: string) {
  try {
    revalidateTag(tag);
    console.log(`[Cache] Revalidated tag: ${tag}`);
  } catch (error) {
    console.error(`[Cache] Failed to revalidate tag ${tag}:`, error);
  }
}

/**
 * Revalidate multiple cache tags
 */
export function revalidateCacheTags(tags: string[]) {
  tags.forEach(tag => revalidateCache(tag));
}

/**
 * Revalidate specific path
 */
export function revalidateCachePath(path: string) {
  try {
    revalidatePath(path);
    console.log(`[Cache] Revalidated path: ${path}`);
  } catch (error) {
    console.error(`[Cache] Failed to revalidate path ${path}:`, error);
  }
}
