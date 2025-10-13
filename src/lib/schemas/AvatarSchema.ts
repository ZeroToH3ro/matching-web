import { z } from 'zod';
import { SUPPORTED_IMAGE_FORMATS, MAX_AVATAR_FILE_SIZE } from '@/lib/types/avatar';

// Avatar settings validation schema
export const avatarSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  visibility: z.enum(['matches_only', 'premium_matches', 'all_matches']).default('matches_only'),
  expiryDays: z.number().min(1).max(365).optional(),
  allowDownload: z.boolean().default(false),
  moderationStatus: z.enum(['pending', 'approved', 'rejected']).default('pending')
});

// Avatar upload validation schema
export const avatarUploadSchema = z.object({
  file: z.custom<File>((file) => {
    if (!(file instanceof File)) {
      return false;
    }
    
    // Check file size
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      return false;
    }
    
    // Check file type
    if (!SUPPORTED_IMAGE_FORMATS.includes(file.type as any)) {
      return false;
    }
    
    return true;
  }, {
    message: `File must be an image (${SUPPORTED_IMAGE_FORMATS.join(', ')}) and less than ${MAX_AVATAR_FILE_SIZE / (1024 * 1024)}MB`
  }),
  settings: avatarSettingsSchema.optional()
});

// Avatar update settings schema
export const avatarUpdateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  visibility: z.enum(['matches_only', 'premium_matches', 'all_matches']).optional(),
  expiryDays: z.number().min(1).max(365).optional(),
  allowDownload: z.boolean().optional()
});

// Avatar access request schema
export const avatarAccessSchema = z.object({
  userId: z.string().min(1),
  viewerUserId: z.string().min(1).optional(),
  size: z.enum(['sm', 'md', 'lg', 'xl']).optional().default('md')
});

// Face swap validation schema
export const faceSwapSchema = z.object({
  sourceImage: z.custom<File>((file) => {
    if (!(file instanceof File)) return false;
    if (file.size > MAX_AVATAR_FILE_SIZE) return false;
    return SUPPORTED_IMAGE_FORMATS.includes(file.type as any);
  }),
  targetImage: z.custom<File>((file) => {
    if (!(file instanceof File)) return false;
    if (file.size > MAX_AVATAR_FILE_SIZE) return false;
    return SUPPORTED_IMAGE_FORMATS.includes(file.type as any);
  }),
  mode: z.enum(['auto', 'manual', 'gemini']).default('auto')
});

// Export types
export type AvatarSettingsSchema = z.infer<typeof avatarSettingsSchema>;
export type AvatarUploadSchema = z.infer<typeof avatarUploadSchema>;
export type AvatarUpdateSettingsSchema = z.infer<typeof avatarUpdateSettingsSchema>;
export type AvatarAccessSchema = z.infer<typeof avatarAccessSchema>;
export type FaceSwapSchema = z.infer<typeof faceSwapSchema>;