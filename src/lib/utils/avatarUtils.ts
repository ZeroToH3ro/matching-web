import type { AvatarSettings } from '@/lib/types/avatar';
import { DEFAULT_AVATAR_SETTINGS, AVATAR_SIZES } from '@/lib/types/avatar';
import { avatarSettingsSchema } from '@/lib/schemas/AvatarSchema';

/**
 * Validates and normalizes avatar settings from database JSON
 */
export function parseAvatarSettings(settingsJson: any): AvatarSettings {
  try {
    // If it's already an object, use it; otherwise parse JSON string
    const settings = typeof settingsJson === 'string' 
      ? JSON.parse(settingsJson) 
      : settingsJson || {};
    
    // Validate and apply defaults using Zod schema
    const result = avatarSettingsSchema.safeParse(settings);
    
    if (result.success) {
      return result.data;
    } else {
      console.warn('Invalid avatar settings, using defaults:', result.error);
      return DEFAULT_AVATAR_SETTINGS;
    }
  } catch (error) {
    console.warn('Failed to parse avatar settings, using defaults:', error);
    return DEFAULT_AVATAR_SETTINGS;
  }
}

/**
 * Serializes avatar settings for database storage
 */
export function serializeAvatarSettings(settings: Partial<AvatarSettings>): string {
  const fullSettings = { ...DEFAULT_AVATAR_SETTINGS, ...settings };
  return JSON.stringify(fullSettings);
}

/**
 * Gets avatar size configuration for a given size key
 */
export function getAvatarSize(size: keyof typeof AVATAR_SIZES = 'md') {
  return AVATAR_SIZES[size];
}

/**
 * Generates a placeholder avatar URL for users without avatars
 */
export function getPlaceholderAvatarUrl(userId: string, size: keyof typeof AVATAR_SIZES = 'md'): string {
  const { width, height } = getAvatarSize(size);
  // Using a service like DiceBear for consistent placeholder avatars
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}&size=${width}`;
}

/**
 * Checks if a user's avatar settings allow access for a given visibility level
 */
export function checkAvatarVisibility(
  settings: AvatarSettings,
  viewerMatchStatus: 'matched' | 'not_matched' | 'blocked',
  viewerSubscriptionTier?: number
): boolean {
  if (!settings.enabled) {
    return false;
  }

  if (viewerMatchStatus === 'blocked') {
    return false;
  }

  switch (settings.visibility) {
    case 'all_matches':
      return viewerMatchStatus === 'matched';
    
    case 'premium_matches':
      return viewerMatchStatus === 'matched' && (viewerSubscriptionTier || 0) >= 2;
    
    case 'matches_only':
    default:
      return viewerMatchStatus === 'matched';
  }
}

/**
 * Checks if an avatar has expired based on settings
 */
export function isAvatarExpired(uploadedAt: Date, settings: AvatarSettings): boolean {
  if (!settings.expiryDays) {
    return false;
  }

  const expiryDate = new Date(uploadedAt);
  expiryDate.setDate(expiryDate.getDate() + settings.expiryDays);
  
  return new Date() > expiryDate;
}

/**
 * Validates file type and size for avatar upload
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`
    };
  }

  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_SIZE / (1024 * 1024)}MB`
    };
  }

  return { valid: true };
}

/**
 * Generates a unique filename for avatar storage
 */
export function generateAvatarFilename(userId: string, type: 'public' | 'private'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `avatar_${type}_${userId}_${timestamp}_${random}`;
}