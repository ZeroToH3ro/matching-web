/**
 * Avatar-related type definitions for the Seal Profile Avatar system
 */

// Avatar Settings stored in database as JSON
export interface AvatarSettings {
  enabled: boolean;
  visibility: 'matches_only' | 'premium_matches' | 'all_matches';
  expiryDays?: number;
  allowDownload: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

// Avatar upload result from processing service
export interface AvatarUploadResult {
  publicAvatar: {
    walrusBlobId: string;
    url: string;
  };
  privateAvatar: {
    walrusBlobId: string;
    sealPolicyId: string;
    encryptedUrl: string;
  };
}

// Avatar display result for components
export interface AvatarResult {
  url: string;
  type: 'public' | 'private' | 'placeholder';
  isEncrypted: boolean;
  hasAccess: boolean;
  error?: string;
}

// Avatar upload component props
export interface AvatarUploadProps {
  currentAvatar?: {
    publicUrl?: string;
    privateUrl?: string;
  };
  onUploadComplete: (result: AvatarUploadResult) => void;
  onError: (error: string) => void;
  isLoading?: boolean;
}

// Avatar display component props
export interface AvatarDisplayProps {
  userId: string;
  currentUserId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

// Face swap integration result
export interface FaceSwapResult {
  swappedImage: Blob;
  randomFaceName: string;
  success: boolean;
  error?: string;
}

// Avatar error types
export interface AvatarError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  fallbackAvailable: boolean;
}

// Avatar access verification result
export interface AvatarAccessResult {
  hasAccess: boolean;
  reason?: string;
  matchStatus?: 'matched' | 'not_matched' | 'blocked';
  subscriptionTier?: number;
}

// Avatar processing status
export type AvatarProcessingStatus = 
  | 'idle'
  | 'uploading'
  | 'processing_face_swap'
  | 'encrypting'
  | 'storing'
  | 'creating_policy'
  | 'complete'
  | 'error';

// Avatar size variants
export interface AvatarSizeConfig {
  sm: { width: number; height: number };
  md: { width: number; height: number };
  lg: { width: number; height: number };
  xl: { width: number; height: number };
}

// Default avatar settings
export const DEFAULT_AVATAR_SETTINGS: AvatarSettings = {
  enabled: true,
  visibility: 'matches_only',
  allowDownload: false,
  moderationStatus: 'pending'
};

// Avatar size configurations
export const AVATAR_SIZES: AvatarSizeConfig = {
  sm: { width: 40, height: 40 },
  md: { width: 80, height: 80 },
  lg: { width: 120, height: 120 },
  xl: { width: 200, height: 200 }
};

// Supported image formats
export const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
] as const;

// Maximum file size (5MB)
export const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;

// Avatar content types
export type AvatarContentType = typeof SUPPORTED_IMAGE_FORMATS[number];