'use server';

import { AvatarService } from '@/services/avatarService';
import { getAuthUserId } from './authActions';
import { prisma } from '@/lib/prisma';
import type { AvatarUploadResult, AvatarSettings } from '@/lib/types/avatar';
import { avatarUploadSchema, avatarUpdateSettingsSchema } from '@/lib/schemas/AvatarSchema';

export interface AvatarActionResult {
  status: 'success' | 'error';
  data?: AvatarUploadResult;
  error?: string;
}

export interface AvatarSettingsResult {
  status: 'success' | 'error';
  error?: string;
}

/**
 * Uploads a new avatar for the current user
 * NOW ACCEPTS TWO SEPARATE FILES: publicAvatar (face-swapped) and privateAvatar (original)
 */
export async function uploadAvatar(
  formData: FormData
): Promise<AvatarActionResult> {
  try {
    const userId = await getAuthUserId();

    // Extract files and settings from form data
    const publicAvatar = formData.get('publicAvatar') as File;
    const privateAvatar = formData.get('privateAvatar') as File;
    const settingsJson = formData.get('settings') as string;

    // ✅ NEW: Accept separate public and private avatar files
    if (!publicAvatar || !privateAvatar) {
      return {
        status: 'error',
        error: 'Both public and private avatar files are required'
      };
    }

    console.log('📸 Avatar upload received:', {
      publicAvatar: { name: publicAvatar.name, size: publicAvatar.size, type: publicAvatar.type },
      privateAvatar: { name: privateAvatar.name, size: privateAvatar.size, type: privateAvatar.type }
    });

    // Parse settings
    const settings = settingsJson ? JSON.parse(settingsJson) : undefined;

    // Upload avatar using service with BOTH files
    const avatarService = new AvatarService();
    const result = await avatarService.uploadAvatarWithBothFiles(
      publicAvatar,
      privateAvatar,
      userId,
      settings
    );

    return {
      status: 'success',
      data: result
    };

  } catch (error) {
    console.error('Avatar upload action failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Updates avatar settings for the current user
 */
export async function updateAvatarSettings(
  settings: Partial<AvatarSettings>
): Promise<AvatarSettingsResult> {
  try {
    const userId = await getAuthUserId();

    // Validate settings
    const validation = avatarUpdateSettingsSchema.safeParse(settings);
    if (!validation.success) {
      return {
        status: 'error',
        error: validation.error.errors[0]?.message || 'Invalid settings'
      };
    }

    // Get current user avatar data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarSettings: true, avatarSealPolicyId: true } as any
    }) as any;

    if (!user) {
      return {
        status: 'error',
        error: 'User not found'
      };
    }

    // Parse current settings and merge with updates
    const currentSettings = typeof user.avatarSettings === 'string' 
      ? JSON.parse(user.avatarSettings) 
      : user.avatarSettings || {};
    
    const updatedSettings = { ...currentSettings, ...validation.data };

    // Update in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        avatarSettings: JSON.stringify(updatedSettings)
      } as any
    });

    // If there's a Seal policy, update it as well
    if (user.avatarSealPolicyId && (settings.visibility || settings.expiryDays)) {
      const avatarService = new AvatarService();
      // TODO: Update Seal policy settings when SDK supports it
      console.log('Avatar policy settings update needed for:', user.avatarSealPolicyId);
    }

    return {
      status: 'success'
    };

  } catch (error) {
    console.error('Avatar settings update failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Settings update failed'
    };
  }
}

/**
 * Deletes the current user's avatar
 */
export async function deleteAvatar(): Promise<AvatarSettingsResult> {
  try {
    const userId = await getAuthUserId();

    const avatarService = new AvatarService();
    await avatarService.deleteAvatar(userId);

    return {
      status: 'success'
    };

  } catch (error) {
    console.error('Avatar deletion failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Deletion failed'
    };
  }
}

/**
 * Gets the current user's avatar information
 */
export async function getAvatarInfo(): Promise<{
  status: 'success' | 'error';
  data?: {
    publicUrl?: string;
    privateUrl?: string;
    settings: AvatarSettings;
    uploadedAt?: Date;
  };
  error?: string;
}> {
  try {
    const userId = await getAuthUserId();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        publicAvatarBlobId: true,
        privateAvatarBlobId: true,
        avatarSettings: true,
        avatarUploadedAt: true
      } as any
    }) as any;

    if (!user) {
      return {
        status: 'error',
        error: 'User not found'
      };
    }

    // Parse settings
    const settings = typeof user.avatarSettings === 'string' 
      ? JSON.parse(user.avatarSettings) 
      : user.avatarSettings || {};

    // Get URLs from storage if blob IDs exist
    let publicUrl: string | undefined;
    let privateUrl: string | undefined;

    if (user.publicAvatarBlobId) {
      const { getStorageManager } = await import('@/lib/storage');
      const storageManager = getStorageManager();
      publicUrl = storageManager.getUrl(user.publicAvatarBlobId);
    }

    if (user.privateAvatarBlobId) {
      const { getStorageManager } = await import('@/lib/storage');
      const storageManager = getStorageManager();
      privateUrl = storageManager.getUrl(user.privateAvatarBlobId);
    }

    return {
      status: 'success',
      data: {
        publicUrl,
        privateUrl,
        settings,
        uploadedAt: user.avatarUploadedAt
      }
    };

  } catch (error) {
    console.error('Get avatar info failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to get avatar info'
    };
  }
}

/**
 * Gets avatar for display based on match status and permissions
 */
export async function getAvatarForUser(
  targetUserId: string,
  viewerUserId?: string
): Promise<{
  status: 'success' | 'error';
  data?: {
    url: string;
    type: 'public' | 'private' | 'placeholder';
    isEncrypted: boolean;
    hasAccess: boolean;
    error?: string;
  };
  error?: string;
}> {
  try {
    const avatarService = new AvatarService();
    const result = await avatarService.getAvatarForUser(targetUserId, viewerUserId);

    return {
      status: 'success',
      data: {
        url: result.url,
        type: result.type,
        isEncrypted: result.isEncrypted,
        hasAccess: result.hasAccess,
        error: result.error
      }
    };

  } catch (error) {
    console.error('Get avatar for user failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to get avatar'
    };
  }
}

/**
 * Updates avatar permissions when a match is created/deleted
 * This is called from match-related actions
 */
export async function updateAvatarPermissions(
  userId: string,
  matchUserId: string,
  action: 'grant' | 'revoke'
): Promise<void> {
  try {
    const avatarService = new AvatarService();
    await avatarService.updateAvatarPermissions(userId, matchUserId, action);
  } catch (error) {
    console.error('Avatar permission update failed:', error);
    // Don't throw - this is a background operation
  }
}