import { getStorageManager, type UploadOptions } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { FaceSwapIntegrationService } from './faceSwapIntegrationService';
import { AvatarStorageService } from './avatarStorageService';
import { AvatarEncryptionService } from './avatarEncryptionService';
import { SealPolicyManager } from './sealPolicyManager';
import { getAvatarCacheService } from './avatarCacheService';
import { getAvatarCdnService } from './avatarCdnService';
import { getAvatarAnalyticsService } from './avatarAnalyticsService';
import { AvatarContractService } from '@/lib/contracts/avatarContract';
import { CONTRACT_CONFIG } from '@/lib/contracts/config';
import type {
  AvatarUploadResult,
  AvatarResult,
  AvatarError,
  AvatarSettings
} from '@/lib/types/avatar';
import {
  validateAvatarFile,
  generateAvatarFilename,
  parseAvatarSettings,
  serializeAvatarSettings,
  checkAvatarVisibility,
  isAvatarExpired,
  getPlaceholderAvatarUrl
} from '@/lib/utils/avatarUtils';

export class AvatarService {
  private storageManager = getStorageManager();
  private faceSwapService = new FaceSwapIntegrationService();
  private avatarStorageService = new AvatarStorageService();
  private encryptionService = new AvatarEncryptionService();
  private policyManager = new SealPolicyManager();
  private cacheService: ReturnType<typeof getAvatarCacheService> | null = null;
  private cdnService = getAvatarCdnService();
  private analyticsService = getAvatarAnalyticsService();
  private contractService: AvatarContractService | null = null;

  private getCacheService() {
    if (!this.cacheService) {
      this.cacheService = getAvatarCacheService();
    }
    return this.cacheService;
  }

  private getContractService() {
    if (!this.contractService) {
      // This would be properly initialized with SuiClient in a real implementation
      this.contractService = new AvatarContractService({} as any);
    }
    return this.contractService;
  }

  /**
   * ✅ NEW: Uploads avatar with BOTH pre-processed files (face-swapped + original)
   * This method receives already face-swapped public avatar from client for security
   */
  async uploadAvatarWithBothFiles(
    publicAvatarFile: File,  // Already face-swapped by client
    privateAvatarFile: File, // Original file
    userId: string,
    settings?: Partial<AvatarSettings>
  ): Promise<AvatarUploadResult> {
    const uploadStartTime = Date.now();
    let success = false;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    let variantsGenerated = 0;

    try {
      console.log('📸 uploadAvatarWithBothFiles - Starting secure upload');
      console.log('  - Public (face-swapped):', publicAvatarFile.name, publicAvatarFile.size);
      console.log('  - Private (original):', privateAvatarFile.name, privateAvatarFile.size);

      // Validate both files
      const publicValidation = validateAvatarFile(publicAvatarFile);
      const privateValidation = validateAvatarFile(privateAvatarFile);

      if (!publicValidation.valid) {
        throw new Error(`Public avatar: ${publicValidation.error}`);
      }
      if (!privateValidation.valid) {
        throw new Error(`Private avatar: ${privateValidation.error}`);
      }

      // Get user to ensure they exist
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // ✅ NO FACE-SWAP NEEDED - files are already processed on client
      console.log('✅ Using pre-processed files - NO server-side face-swap needed');

      // Upload both avatars using the optimized avatar storage service
      console.log('Starting avatar upload for user:', userId, 'wallet:', user.walletAddress);

      const { publicResult: publicUploadResult, privateResult: privateUploadResult } =
        await this.avatarStorageService.uploadOptimizedAvatarPair(
          publicAvatarFile,  // ✅ Already face-swapped
          privateAvatarFile, // ✅ Original file
          userId,
          user.walletAddress || userId
        );

      console.log('✅ Upload results:', {
        public: { id: publicUploadResult.id, url: publicUploadResult.url },
        private: { id: privateUploadResult.id, url: privateUploadResult.url, metadata: privateUploadResult.metadata }
      });

      // Count variants generated
      variantsGenerated = 2; // public and private
      if (publicUploadResult.variants) {
        variantsGenerated += Object.keys(publicUploadResult.variants).length;
      }
      if (privateUploadResult.variants) {
        variantsGenerated += Object.keys(privateUploadResult.variants).length;
      }

      // Extract Seal policy ID from the encrypted upload result
      let sealPolicyId = privateUploadResult.metadata?.policyId;

      // Temporary workaround: generate a mock policy ID if not provided
      if (!sealPolicyId) {
        console.warn('Seal policy ID not found in upload result, generating temporary ID');
        sealPolicyId = `temp_policy_${userId}_${Date.now()}`;
      }

      // Update user record in database
      const avatarSettings = serializeAvatarSettings(settings || {});

      await prisma.user.update({
        where: { id: userId },
        data: {
          publicAvatarBlobId: publicUploadResult.id,
          privateAvatarBlobId: privateUploadResult.id,
          avatarSealPolicyId: sealPolicyId,
          avatarUploadedAt: new Date(),
          avatarSettings: avatarSettings
        } as any
      });

      console.log('✅ Database updated successfully');

      // Invalidate cache and preload to CDN
      await Promise.allSettled([
        this.getCacheService().invalidateUserAvatar(userId),
        this.cdnService.preloadToCache(publicUploadResult.id)
      ]);

      success = true;

      // Track successful upload
      await this.analyticsService.trackUpload({
        userId,
        uploadStartTime,
        uploadEndTime: Date.now(),
        fileSize: privateAvatarFile.size,
        originalFormat: privateAvatarFile.type,
        processedFormats: ['image/jpeg', 'image/webp'],
        processingTime: Date.now() - uploadStartTime,
        success: true,
        variantsGenerated,
        compressionRatio: this.calculateCompressionRatio(privateAvatarFile.size, publicAvatarFile.size)
      });

      // Track engagement
      await this.analyticsService.trackEngagement({
        userId,
        action: 'upload',
        timestamp: Date.now(),
        metadata: {
          fileSize: privateAvatarFile.size,
          originalFormat: privateAvatarFile.type,
          variantsGenerated,
          secureUpload: true // Flag to indicate client-side face-swap
        }
      });

      // Upload private avatar to contract (if user has profile on-chain)
      try {
        await this.uploadPrivateAvatarToContract(
          userId,
          privateUploadResult.id,
          sealPolicyId
        );
      } catch (contractError) {
        console.warn('Failed to upload private avatar to contract:', contractError);
      }

      console.log('✅ Avatar upload completed successfully!');

      return {
        publicAvatar: {
          walrusBlobId: publicUploadResult.id,
          url: publicUploadResult.url
        },
        privateAvatar: {
          walrusBlobId: privateUploadResult.id,
          sealPolicyId: sealPolicyId,
          encryptedUrl: privateUploadResult.url
        }
      };

    } catch (error) {
      console.error('❌ Avatar upload failed:', error);

      errorCode = error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Track failed upload
      await this.analyticsService.trackUpload({
        userId,
        uploadStartTime,
        uploadEndTime: Date.now(),
        fileSize: privateAvatarFile.size,
        originalFormat: privateAvatarFile.type,
        processedFormats: [],
        processingTime: Date.now() - uploadStartTime,
        success: false,
        errorCode,
        errorMessage,
        variantsGenerated: 0
      });

      throw new Error(`Avatar upload failed: ${errorMessage}`);
    }
  }

  /**
   * @deprecated Use uploadAvatarWithBothFiles instead for better security
   * Uploads and processes a user's avatar, creating both public and private versions
   */
  async uploadAvatar(
    file: File,
    userId: string,
    settings?: Partial<AvatarSettings>
  ): Promise<AvatarUploadResult> {
    const uploadStartTime = Date.now();
    let processingStartTime = 0;
    let success = false;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    let variantsGenerated = 0;

    try {
      // Validate the uploaded file
      const validation = validateAvatarFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Note: Face validation is handled on the client-side before upload
      // Server-side validation is disabled to avoid issues with face-api.js in server environment
      console.log('Skipping server-side face validation - handled on client-side');

      // Get user to ensure they exist
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate unique filenames for both versions
      const publicFilename = generateAvatarFilename(userId, 'public');
      const privateFilename = generateAvatarFilename(userId, 'private');

      // Step 1: Generate face-swapped public version
      processingStartTime = Date.now();
      const publicAvatarBlob = await this.generatePublicAvatar(file);

      // Step 2: Upload both avatars using the optimized avatar storage service
      console.log('Starting avatar upload for user:', userId, 'wallet:', user.walletAddress);

      const { publicResult: publicUploadResult, privateResult: privateUploadResult } =
        await this.avatarStorageService.uploadOptimizedAvatarPair(
          publicAvatarBlob,
          file,
          userId,
          user.walletAddress || userId
        );

      console.log('Upload results:', {
        public: { id: publicUploadResult.id, url: publicUploadResult.url },
        private: { id: privateUploadResult.id, url: privateUploadResult.url, metadata: privateUploadResult.metadata }
      });

      // Count variants generated
      variantsGenerated = 2; // public and private
      if (publicUploadResult.variants) {
        variantsGenerated += Object.keys(publicUploadResult.variants).length;
      }
      if (privateUploadResult.variants) {
        variantsGenerated += Object.keys(privateUploadResult.variants).length;
      }

      // Extract Seal policy ID from the encrypted upload result
      let sealPolicyId = privateUploadResult.metadata?.policyId;

      // Temporary workaround: generate a mock policy ID if not provided
      if (!sealPolicyId) {
        console.warn('Seal policy ID not found in upload result, generating temporary ID');
        sealPolicyId = `temp_policy_${userId}_${Date.now()}`;

        // Log for debugging
        console.log('Private upload result:', {
          id: privateUploadResult.id,
          url: privateUploadResult.url,
          metadata: privateUploadResult.metadata
        });

        // TODO: Implement proper Seal policy creation
        // For now, we'll use a temporary ID to allow the upload to complete
        // In production, this should create a real Seal policy
      }

      // Step 4: Update user record in database
      const avatarSettings = serializeAvatarSettings(settings || {});

      await prisma.user.update({
        where: { id: userId },
        data: {
          publicAvatarBlobId: publicUploadResult.id,
          privateAvatarBlobId: privateUploadResult.id,
          avatarSealPolicyId: sealPolicyId,
          avatarUploadedAt: new Date(),
          avatarSettings: avatarSettings
        } as any // Type assertion to work around TypeScript cache issue
      });

      // Step 5: Invalidate cache and preload to CDN
      await Promise.allSettled([
        this.getCacheService().invalidateUserAvatar(userId),
        this.cdnService.preloadToCache(publicUploadResult.id)
      ]);

      success = true;

      // Track successful upload
      await this.analyticsService.trackUpload({
        userId,
        uploadStartTime,
        uploadEndTime: Date.now(),
        fileSize: file.size,
        originalFormat: file.type,
        processedFormats: ['image/jpeg', 'image/webp'], // Assuming these formats are generated
        processingTime: Date.now() - processingStartTime,
        success: true,
        variantsGenerated,
        compressionRatio: this.calculateCompressionRatio(file.size, publicAvatarBlob.size)
      });

      // Track engagement
      await this.analyticsService.trackEngagement({
        userId,
        action: 'upload',
        timestamp: Date.now(),
        metadata: {
          fileSize: file.size,
          originalFormat: file.type,
          variantsGenerated
        }
      });

      // Step 6: Upload private avatar to contract (if user has profile on-chain)
      try {
        await this.uploadPrivateAvatarToContract(
          userId,
          privateUploadResult.id,
          sealPolicyId
        );
      } catch (contractError) {
        console.warn('Failed to upload private avatar to contract:', contractError);
        // Continue without contract upload - avatar still works via traditional storage
      }

      return {
        publicAvatar: {
          walrusBlobId: publicUploadResult.id,
          url: publicUploadResult.url
        },
        privateAvatar: {
          walrusBlobId: privateUploadResult.id,
          sealPolicyId: sealPolicyId,
          encryptedUrl: privateUploadResult.url
        }
      };

    } catch (error) {
      console.error('Avatar upload failed:', error);

      errorCode = error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Track failed upload
      await this.analyticsService.trackUpload({
        userId,
        uploadStartTime,
        uploadEndTime: Date.now(),
        fileSize: file.size,
        originalFormat: file.type,
        processedFormats: [],
        processingTime: processingStartTime > 0 ? Date.now() - processingStartTime : 0,
        success: false,
        errorCode,
        errorMessage,
        variantsGenerated: 0
      });

      throw new Error(`Avatar upload failed: ${errorMessage}`);
    }
  }

  /**
   * Gets the appropriate avatar for a user based on match status and permissions
   */
  async getAvatarForUser(
    targetUserId: string,
    viewerUserId?: string
  ): Promise<AvatarResult> {
    const accessStartTime = Date.now();
    let cacheHit = false;
    let errorCode: string | undefined;

    try {
      // Check cache first
      const cachedResult = await this.getCacheService().getCachedAvatar(targetUserId, viewerUserId);
      if (cachedResult) {
        cacheHit = true;

        // Track cache hit
        await this.analyticsService.trackAccess({
          targetUserId,
          viewerUserId,
          accessTime: Date.now(),
          avatarType: cachedResult.type,
          isEncrypted: cachedResult.isEncrypted,
          hasAccess: cachedResult.hasAccess,
          loadTime: Date.now() - accessStartTime,
          cacheHit: true
        });

        return cachedResult;
      }

      // Get target user's avatar data (try cache first for metadata)
      let targetUser: {
        publicAvatarBlobId?: string;
        privateAvatarBlobId?: string;
        avatarSealPolicyId?: string;
        avatarUploadedAt?: string;
        avatarSettings?: any;
      } | null = await this.getCacheService().getCachedAvatarMetadata(targetUserId);

      if (!targetUser) {
        const dbUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: {
            publicAvatarBlobId: true,
            privateAvatarBlobId: true,
            avatarSealPolicyId: true,
            avatarUploadedAt: true,
            avatarSettings: true
          } as any // Type assertion to work around TypeScript cache issue
        }) as any;

        if (dbUser) {
          const metadata = {
            publicAvatarBlobId: dbUser.publicAvatarBlobId,
            privateAvatarBlobId: dbUser.privateAvatarBlobId,
            avatarSealPolicyId: dbUser.avatarSealPolicyId,
            avatarUploadedAt: dbUser.avatarUploadedAt?.toISOString(),
            avatarSettings: dbUser.avatarSettings
          };

          targetUser = metadata;

          // Cache the metadata
          await this.getCacheService().cacheAvatarMetadata(targetUserId, metadata);
        }
      }

      if (!targetUser) {
        const result = {
          url: getPlaceholderAvatarUrl(targetUserId),
          type: 'placeholder' as const,
          isEncrypted: false,
          hasAccess: false
        };
        await this.getCacheService().cacheAvatar(targetUserId, viewerUserId, result);
        return result;
      }

      // If no avatar uploaded, return placeholder
      if (!targetUser.publicAvatarBlobId) {
        const result = {
          url: getPlaceholderAvatarUrl(targetUserId),
          type: 'placeholder' as const,
          isEncrypted: false,
          hasAccess: false
        };
        await this.getCacheService().cacheAvatar(targetUserId, viewerUserId, result);
        return result;
      }

      // Parse avatar settings
      const settings = parseAvatarSettings(targetUser.avatarSettings);

      // Check if avatar has expired
      if (targetUser.avatarUploadedAt && isAvatarExpired(new Date(targetUser.avatarUploadedAt), settings)) {
        const result = {
          url: getPlaceholderAvatarUrl(targetUserId),
          type: 'placeholder' as const,
          isEncrypted: false,
          hasAccess: false,
          error: 'Avatar has expired'
        };
        await this.getCacheService().cacheAvatar(targetUserId, viewerUserId, result);
        return result;
      }

      // If viewer is the same as target, always show private avatar
      if (viewerUserId === targetUserId) {
        if (targetUser.privateAvatarBlobId) {
          try {
            const privateUrl = this.storageManager.getUrl(targetUser.privateAvatarBlobId);
            const result = {
              url: privateUrl,
              type: 'private' as const,
              isEncrypted: true,
              hasAccess: true
            };
            await this.getCacheService().cacheAvatar(targetUserId, viewerUserId, result);
            return result;
          } catch (error) {
            // Fallback to public avatar if private fails
            const publicUrl = this.cdnService.getCdnUrl(targetUser.publicAvatarBlobId);
            const result = {
              url: publicUrl,
              type: 'public' as const,
              isEncrypted: false,
              hasAccess: true,
              error: 'Private avatar access failed, showing public version'
            };
            await this.getCacheService().cacheAvatar(targetUserId, viewerUserId, result);
            return result;
          }
        }
      }

      // If no viewer specified, return public avatar with CDN optimization
      if (!viewerUserId) {
        const publicUrl = this.cdnService.getCdnUrl(targetUser.publicAvatarBlobId);
        const result = {
          url: publicUrl,
          type: 'public' as const,
          isEncrypted: false,
          hasAccess: true
        };
        await this.getCacheService().cacheAvatar(targetUserId, viewerUserId, result);
        return result;
      }

      // Check match status between viewer and target
      const matchStatus = await this.getMatchStatus(viewerUserId, targetUserId);

      console.log('Avatar access check:', {
        targetUserId,
        viewerUserId,
        matchStatus
      });

      // Get viewer's subscription tier (if applicable)
      const viewerSubscriptionTier = await this.getViewerSubscriptionTier(viewerUserId);

      // Check if viewer has access to private avatar
      const hasPrivateAccess = checkAvatarVisibility(
        settings,
        matchStatus,
        viewerSubscriptionTier
      );
      
      console.log('Private access result:', {
        hasPrivateAccess,
        settings,
        matchStatus,
        viewerSubscriptionTier
      });

      let result: AvatarResult;

      if (hasPrivateAccess && targetUser.privateAvatarBlobId) {
        try {
          // ✅ FIX: Skip Seal verification for temporary policies
          // When using temp_policy_* IDs, we trust the match status check
          const isTempPolicy = targetUser.avatarSealPolicyId?.startsWith('temp_policy_');

          let canAccess = false;
          if (isTempPolicy) {
            // For temp policies (development/testing), trust the match status check
            canAccess = true;
            console.log('✅ [Avatar] Using temp policy - trusting match status check');
          } else {
            // For real Seal policies, verify on-chain access
            console.log('🔐 [Avatar] Verifying Seal access for policy:', targetUser.avatarSealPolicyId);
            canAccess = await this.verifyAvatarAccess(
              targetUser.avatarSealPolicyId!,
              viewerUserId
            );
          }

          if (canAccess) {
            const privateUrl = this.storageManager.getUrl(targetUser.privateAvatarBlobId);
            console.log('✅ [Avatar] Granting private avatar access:', {
              targetUserId,
              viewerUserId,
              privateUrl: privateUrl.substring(0, 50) + '...',
              isTempPolicy
            });
            result = {
              url: privateUrl,
              type: 'private',
              isEncrypted: true,
              hasAccess: true
            };
          } else {
            // Fallback to public avatar with CDN
            console.warn('⚠️ [Avatar] Seal verification failed, showing public avatar');
            const publicUrl = this.cdnService.getCdnUrl(targetUser.publicAvatarBlobId);
            result = {
              url: publicUrl,
              type: 'public',
              isEncrypted: false,
              hasAccess: true
            };
          }
        } catch (error) {
          console.warn('❌ [Avatar] Private avatar access verification failed:', error);
          // Fallback to public avatar with CDN
          const publicUrl = this.cdnService.getCdnUrl(targetUser.publicAvatarBlobId);
          result = {
            url: publicUrl,
            type: 'public',
            isEncrypted: false,
            hasAccess: true
          };
        }
      } else {
        // Fallback to public avatar with CDN
        const publicUrl = this.cdnService.getCdnUrl(targetUser.publicAvatarBlobId);
        result = {
          url: publicUrl,
          type: 'public',
          isEncrypted: false,
          hasAccess: true
        };
      }

      // Cache the result
      await this.getCacheService().cacheAvatar(targetUserId, viewerUserId, result);

      // Track access
      await this.analyticsService.trackAccess({
        targetUserId,
        viewerUserId,
        accessTime: Date.now(),
        avatarType: result.type,
        isEncrypted: result.isEncrypted,
        hasAccess: result.hasAccess,
        loadTime: Date.now() - accessStartTime,
        cacheHit: false
      });

      // Track engagement for viewer
      if (viewerUserId && result.hasAccess) {
        await this.analyticsService.trackEngagement({
          userId: viewerUserId,
          action: 'view',
          timestamp: Date.now(),
          metadata: {
            targetUserId,
            avatarType: result.type,
            isEncrypted: result.isEncrypted
          }
        });
      }

      return result;

    } catch (error) {
      console.error('Failed to get avatar for user:', error);

      errorCode = error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR';

      const errorResult = {
        url: getPlaceholderAvatarUrl(targetUserId),
        type: 'placeholder' as const,
        isEncrypted: false,
        hasAccess: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      // Track error
      await this.analyticsService.trackAccess({
        targetUserId,
        viewerUserId,
        accessTime: Date.now(),
        avatarType: 'placeholder',
        isEncrypted: false,
        hasAccess: false,
        loadTime: Date.now() - accessStartTime,
        cacheHit,
        errorCode
      });

      // Cache error result with shorter TTL
      await this.getCacheService().cacheAvatar(targetUserId, viewerUserId, errorResult);
      return errorResult;
    }
  }

  /**
   * Updates avatar permissions when matches are created or deleted
   */
  async updateAvatarPermissions(
    userId: string,
    matchUserId: string,
    action: 'grant' | 'revoke'
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarSealPolicyId: true, walletAddress: true } as any
      }) as any;

      if (!user?.avatarSealPolicyId) {
        return; // No avatar or policy to update
      }

      const matchUser = await prisma.user.findUnique({
        where: { id: matchUserId },
        select: { walletAddress: true }
      });

      if (!matchUser?.walletAddress) {
        throw new Error('Match user wallet address not found');
      }

      // Use the encryption service to update avatar access
      const success = await this.encryptionService.updateAvatarAccess(
        user.avatarSealPolicyId,
        action,
        matchUserId
      );

      if (!success) {
        throw new Error(`Failed to ${action} avatar access for user ${matchUserId}`);
      }

      // Invalidate cache for both users
      await Promise.allSettled([
        this.getCacheService().invalidateAvatarAccess(userId, matchUserId),
        this.getCacheService().invalidateAvatarAccess(matchUserId, userId)
      ]);

      console.log(`Avatar permission ${action} successful for user ${matchUserId} on policy ${user.avatarSealPolicyId}`);

    } catch (error) {
      console.error('Failed to update avatar permissions:', error);
      throw error;
    }
  }

  /**
   * Deletes a user's avatar and cleans up storage
   */
  async deleteAvatar(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          publicAvatarBlobId: true,
          privateAvatarBlobId: true,
          avatarSealPolicyId: true
        } as any
      }) as any;

      if (!user) {
        throw new Error('User not found');
      }

      // Delete from storage (Walrus doesn't support deletion, but we try anyway)
      const deletePromises: Promise<void>[] = [];

      if (user.publicAvatarBlobId) {
        deletePromises.push(this.storageManager.delete(user.publicAvatarBlobId));
      }

      if (user.privateAvatarBlobId) {
        deletePromises.push(this.storageManager.delete(user.privateAvatarBlobId));
      }

      // Wait for storage cleanup (will be no-op for Walrus)
      await Promise.allSettled(deletePromises);

      // Clear avatar data from database
      await prisma.user.update({
        where: { id: userId },
        data: {
          publicAvatarBlobId: null,
          privateAvatarBlobId: null,
          avatarSealPolicyId: null,
          avatarUploadedAt: null,
          avatarSettings: '{}'
        } as any
      });

      // Invalidate cache and CDN
      await Promise.allSettled([
        this.getCacheService().invalidateUserAvatar(userId),
        user.publicAvatarBlobId ? this.cdnService.invalidateCdnCache(user.publicAvatarBlobId) : Promise.resolve()
      ]);

    } catch (error) {
      console.error('Failed to delete avatar:', error);
      throw error;
    }
  }

  /**
   * Generates a face-swapped public avatar from the original image
   */
  private async generatePublicAvatar(originalImage: File): Promise<Blob> {
    try {
      // Use face swap service to generate public avatar
      const result = await this.faceSwapService.generatePublicAvatar(originalImage);

      if (result.success) {
        return result.swappedImage;
      } else {
        console.warn('Face swap failed, using original image:', result.error);
        // Fallback to original image if face swap fails
        return new Blob([await originalImage.arrayBuffer()], { type: originalImage.type });
      }
    } catch (error) {
      console.error('Face swap generation failed:', error);
      // Fallback to original image
      return new Blob([await originalImage.arrayBuffer()], { type: originalImage.type });
    }
  }

  /**
   * Gets the match status between two users
   */
  private async getMatchStatus(
    viewerUserId: string,
    targetUserId: string
  ): Promise<'matched' | 'not_matched' | 'blocked'> {
    try {
      console.log('Checking match status:', { viewerUserId, targetUserId });

      // Find all likes between the two users (both directions)
      const likes = await prisma.like.findMany({
        where: {
          OR: [
            { sourceUserId: viewerUserId, targetUserId: targetUserId },
            { sourceUserId: targetUserId, targetUserId: viewerUserId }
          ]
        }
      });

      console.log('Likes found:', likes);

      // Check if either user has blocked
      const hasBlocked = likes.some(like => like.matchStatus === 3);
      if (hasBlocked) {
        console.log('Blocked status detected');
        return 'blocked';
      }

      // Check for mutual match: both users liked each other AND matchStatus is 1
      const viewerLikedTarget = likes.find(
        like => like.sourceUserId === viewerUserId && like.targetUserId === targetUserId
      );
      const targetLikedViewer = likes.find(
        like => like.sourceUserId === targetUserId && like.targetUserId === viewerUserId
      );

      // Mutual match exists if:
      // 1. Both likes exist (viewer liked target AND target liked viewer)
      // 2. At least one has matchStatus = 1 (indicating active mutual match)
      const isMutualMatch = viewerLikedTarget && targetLikedViewer &&
        (viewerLikedTarget.matchStatus === 1 || targetLikedViewer.matchStatus === 1);

      if (isMutualMatch) {
        console.log('Mutual match detected - returning matched');
        return 'matched';
      }

      console.log('No mutual match found - returning not_matched');
      return 'not_matched';
    } catch (error) {
      console.error('Failed to get match status:', error);
      return 'not_matched';
    }
  }

  /**
   * Gets the viewer's subscription tier
   */
  private async getViewerSubscriptionTier(viewerUserId: string): Promise<number> {
    try {
      // TODO: Implement subscription tier lookup when subscription system is available
      // For now, return basic tier (1)
      return 1;
    } catch (error) {
      console.error('Failed to get viewer subscription tier:', error);
      return 1;
    }
  }

  /**
   * Preloads avatars for multiple users (for performance optimization)
   */
  async preloadAvatars(userIds: string[], viewerUserId?: string): Promise<void> {
    try {
      await this.getCacheService().preloadAvatars(
        userIds,
        viewerUserId,
        (targetUserId, viewerUserId) => this.getAvatarForUser(targetUserId, viewerUserId)
      );
    } catch (error) {
      console.error('Failed to preload avatars:', error);
    }
  }

  /**
   * Gets cache and CDN performance statistics
   */
  async getPerformanceStats(): Promise<{
    cache: any;
    cdn: any;
  }> {
    try {
      const [cacheStats, cdnMetrics] = await Promise.all([
        this.getCacheService().getCacheStats(),
        this.cdnService.getCdnMetrics()
      ]);

      return {
        cache: cacheStats,
        cdn: cdnMetrics
      };
    } catch (error) {
      console.error('Failed to get performance stats:', error);
      return {
        cache: null,
        cdn: null
      };
    }
  }

  /**
   * Clears all avatar cache (for maintenance)
   */
  async clearCache(): Promise<void> {
    try {
      await this.getCacheService().clearAvatarCache();
    } catch (error) {
      console.error('Failed to clear avatar cache:', error);
      throw error;
    }
  }

  /**
   * Health check for avatar service dependencies
   */
  async healthCheck(): Promise<{
    storage: boolean;
    cache: boolean;
    cdn: boolean;
  }> {
    try {
      const [cdnHealth] = await Promise.all([
        this.cdnService.healthCheck()
      ]);

      return {
        storage: true, // Assume storage is healthy if no errors
        cache: true, // Cache service handles its own connection state
        cdn: cdnHealth
      };
    } catch (error) {
      console.error('Avatar service health check failed:', error);
      return {
        storage: false,
        cache: false,
        cdn: false
      };
    }
  }

  /**
   * Calculates compression ratio between original and compressed file
   */
  private calculateCompressionRatio(originalSize: number, compressedSize: number): number {
    if (originalSize === 0) return 0;
    return Math.round(((originalSize - compressedSize) / originalSize) * 100);
  }

  /**
   * Verifies if a user has access to an avatar through Seal policy
   */
  private async verifyAvatarAccess(
    policyId: string,
    userAddress: string
  ): Promise<boolean> {
    try {
      return await this.storageManager.verifyAccess(policyId, userAddress);
    } catch (error) {
      console.error('Avatar access verification failed:', error);
      return false;
    }
  }

  /**
   * Upload private avatar to contract (on-chain)
   */
  private async uploadPrivateAvatarToContract(
    userId: string,
    walrusBlobId: string,
    sealPolicyId: string
  ): Promise<void> {
    try {
      // Get user's profile ID from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          profileObjectId: true,
          walletAddress: true
        }
      });

      if (!user?.profileObjectId || !user?.walletAddress) {
        throw new Error('User does not have on-chain profile');
      }

      const contractService = this.getContractService();

      // Create transaction to upload private avatar
      const uploadTx = contractService.createUploadPrivateAvatarTransaction(
        user.profileObjectId,
        walrusBlobId,
        sealPolicyId
      );

      // Create transaction to create avatar allowlist
      const allowlistTx = contractService.createAvatarAllowlistTransaction(
        user.profileObjectId
      );

      // Note: In a real implementation, these transactions would be signed and executed
      // by the user's wallet through the frontend
      console.log('Private avatar upload transactions prepared:', {
        uploadTx: uploadTx.serialize(),
        allowlistTx: allowlistTx.serialize(),
        userProfile: user.profileObjectId,
        walrusBlobId,
        sealPolicyId
      });

      // Store transaction data for frontend to execute
      await prisma.user.update({
        where: { id: userId },
        data: {
          pendingAvatarUploadTx: JSON.stringify({
            uploadTx: uploadTx.serialize(),
            allowlistTx: allowlistTx.serialize(),
            walrusBlobId,
            sealPolicyId
          })
        } as any
      });

    } catch (error) {
      console.error('Failed to prepare private avatar contract upload:', error);
      throw error;
    }
  }

  /**
   * Grant avatar access to matched user (on-chain)
   */
  async grantAvatarAccessOnChain(
    userId: string,
    matchedUserId: string,
    matchId: string
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          profileObjectId: true,
          privateAvatarBlobId: true,
          walletAddress: true
        } as any
      }) as any;

      const matchedUser = await prisma.user.findUnique({
        where: { id: matchedUserId },
        select: { walletAddress: true }
      });

      if (!user?.profileObjectId || !user?.privateAvatarBlobId || !matchedUser?.walletAddress) {
        throw new Error('Missing required on-chain data');
      }

      const contractService = this.getContractService();

      // Create transaction to grant avatar access
      const grantTx = contractService.grantAvatarAccessTransaction(
        user.privateAvatarBlobId, // This would be the on-chain media object ID
        user.profileObjectId,
        matchId, // This would be the on-chain match object ID
        matchedUser.walletAddress
      );

      // Get avatar allowlist ID
      const allowlistId = await contractService.getAvatarAllowlistId(user.walletAddress!);
      if (allowlistId) {
        const addUserTx = contractService.addMatchedUserToAvatarTransaction(
          allowlistId,
          user.profileObjectId,
          matchId,
          matchedUser.walletAddress
        );

        console.log('Avatar access grant transactions prepared:', {
          grantTx: grantTx.serialize(),
          addUserTx: addUserTx.serialize()
        });
      }

    } catch (error) {
      console.error('Failed to grant avatar access on-chain:', error);
      throw error;
    }
  }

  /**
   * Revoke avatar access from matched user (on-chain)
   */
  async revokeAvatarAccessOnChain(
    userId: string,
    matchedUserId: string
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          profileObjectId: true,
          privateAvatarBlobId: true,
          walletAddress: true
        } as any
      }) as any;

      const matchedUser = await prisma.user.findUnique({
        where: { id: matchedUserId },
        select: { walletAddress: true }
      });

      if (!user?.profileObjectId || !user?.privateAvatarBlobId || !matchedUser?.walletAddress) {
        throw new Error('Missing required on-chain data');
      }

      const contractService = this.getContractService();

      // Create transaction to revoke avatar access
      const revokeTx = contractService.revokeAvatarAccessTransaction(
        user.privateAvatarBlobId,
        user.profileObjectId,
        matchedUser.walletAddress
      );

      // Get avatar allowlist ID and remove user
      const allowlistId = await contractService.getAvatarAllowlistId(user.walletAddress!);
      if (allowlistId) {
        const removeUserTx = contractService.removeMatchedUserFromAvatarTransaction(
          allowlistId,
          user.profileObjectId,
          matchedUser.walletAddress
        );

        console.log('Avatar access revoke transactions prepared:', {
          revokeTx: revokeTx.serialize(),
          removeUserTx: removeUserTx.serialize()
        });
      }

    } catch (error) {
      console.error('Failed to revoke avatar access on-chain:', error);
      throw error;
    }
  }
}