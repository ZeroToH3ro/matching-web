import { getStorageManager, type UploadOptions, type UploadResult } from '@/lib/storage';
import { getImageProcessingService, type ImageVariant } from './imageProcessingService';
import type { AvatarError } from '@/lib/types/avatar';

export class AvatarStorageService {
  private storageManager = getStorageManager();
  private imageProcessor = getImageProcessingService();

  /**
   * Uploads optimized avatar variants with multiple formats and sizes
   */
  async uploadOptimizedAvatarPair(
    publicAvatarBlob: Blob,
    privateAvatarFile: File,
    userId: string,
    walletAddress: string
  ): Promise<{
    publicResult: UploadResult & { variants?: { [key: string]: UploadResult } };
    privateResult: UploadResult & { variants?: { [key: string]: UploadResult } };
  }> {
    try {
      // Process images into multiple variants
      const publicBuffer = Buffer.from(await publicAvatarBlob.arrayBuffer());
      const privateBuffer = Buffer.from(await privateAvatarFile.arrayBuffer());

      const [publicVariants, privateVariants] = await Promise.all([
        this.imageProcessor.processImage(publicBuffer, {
          formats: ['webp', 'jpeg'],
          sizes: ['sm', 'md', 'lg', 'xl']
        }),
        this.imageProcessor.processImage(privateBuffer, {
          formats: ['webp', 'jpeg'],
          sizes: ['sm', 'md', 'lg', 'xl', 'original']
        })
      ]);

      // Upload main avatars
      const [publicResult, privateResult] = await Promise.all([
        this.uploadMainAvatar(publicBuffer, userId, walletAddress, true),
        this.uploadMainAvatar(privateBuffer, userId, walletAddress, false)
      ]);

      // Upload variants in parallel
      const [publicVariantResults, privateVariantResults] = await Promise.all([
        this.uploadImageVariants(publicVariants, userId, true),
        this.uploadImageVariants(privateVariants, userId, false)
      ]);

      return {
        publicResult: { ...publicResult, variants: publicVariantResults },
        privateResult: { ...privateResult, variants: privateVariantResults }
      };

    } catch (error) {
      console.error('Optimized avatar pair upload failed:', error);
      throw this.createAvatarError(
        'OPTIMIZED_UPLOAD_FAILED',
        `Failed to upload optimized avatar pair: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { userId, error },
        true
      );
    }
  }

  /**
   * Uploads both public and private avatar versions in parallel (legacy method)
   */
  async uploadAvatarPair(
    publicAvatarBlob: Blob,
    privateAvatarFile: File,
    userId: string,
    walletAddress: string
  ): Promise<{
    publicResult: UploadResult;
    privateResult: UploadResult;
  }> {
    try {
      // Convert public blob to buffer
      const publicBuffer = Buffer.from(await publicAvatarBlob.arrayBuffer());

      // Prepare upload options for both versions
      const publicUploadOptions: UploadOptions = {
        filename: `avatar_public_${userId}_${Date.now()}`,
        contentType: publicAvatarBlob.type,
        isPublic: true,
        maxSize: 5 * 1024 * 1024 // 5MB
      };

      const privateUploadOptions: UploadOptions = {
        filename: `avatar_private_${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        contentType: privateAvatarFile.type,
        isPublic: true, // Use public access for simplicity
        encrypt: false, // Disable encryption for now
        maxSize: 5 * 1024 * 1024 // 5MB
      };

      // Upload both versions in parallel for better performance
      const [publicResult, privateResult] = await Promise.all([
        this.storageManager.upload(publicBuffer, publicUploadOptions),
        this.storageManager.upload(privateAvatarFile, privateUploadOptions)
      ]);

      return {
        publicResult,
        privateResult
      };

    } catch (error) {
      console.error('Avatar pair upload failed:', error);
      throw this.createAvatarError(
        'UPLOAD_FAILED',
        `Failed to upload avatar pair: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { userId, error },
        true
      );
    }
  }

  /**
   * Uploads a single avatar with retry logic
   */
  async uploadAvatarWithRetry(
    file: File | Buffer,
    options: UploadOptions,
    maxRetries: number = 3
  ): Promise<UploadResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.storageManager.upload(file, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Avatar upload attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Exponential backoff: wait 1s, 2s, 4s between retries
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw this.createAvatarError(
      'UPLOAD_RETRY_FAILED',
      `Avatar upload failed after ${maxRetries} attempts: ${lastError?.message}`,
      { maxRetries, lastError },
      true
    );
  }

  /**
   * Downloads an avatar with fallback handling
   */
  async downloadAvatarWithFallback(
    primaryBlobId: string,
    fallbackBlobId?: string
  ): Promise<{ data: Buffer; contentType: string; source: 'primary' | 'fallback' }> {
    try {
      // Try primary avatar first
      const result = await this.storageManager.download(primaryBlobId);
      return {
        data: result.data,
        contentType: result.contentType,
        source: 'primary'
      };
    } catch (primaryError) {
      console.warn('Primary avatar download failed:', primaryError);

      if (fallbackBlobId) {
        try {
          // Try fallback avatar
          const result = await this.storageManager.download(fallbackBlobId);
          return {
            data: result.data,
            contentType: result.contentType,
            source: 'fallback'
          };
        } catch (fallbackError) {
          console.error('Fallback avatar download also failed:', fallbackError);
        }
      }

      throw this.createAvatarError(
        'DOWNLOAD_FAILED',
        'Failed to download avatar from both primary and fallback sources',
        { primaryBlobId, fallbackBlobId },
        true
      );
    }
  }

  /**
   * Gets avatar URL with fallback handling
   */
  getAvatarUrlWithFallback(
    primaryBlobId: string,
    fallbackBlobId?: string
  ): { url: string; source: 'primary' | 'fallback' } {
    try {
      const url = this.storageManager.getUrl(primaryBlobId);
      return { url, source: 'primary' };
    } catch (error) {
      console.warn('Primary avatar URL generation failed:', error);

      if (fallbackBlobId) {
        try {
          const url = this.storageManager.getUrl(fallbackBlobId);
          return { url, source: 'fallback' };
        } catch (fallbackError) {
          console.error('Fallback avatar URL generation also failed:', fallbackError);
        }
      }

      throw this.createAvatarError(
        'URL_GENERATION_FAILED',
        'Failed to generate avatar URL from both primary and fallback sources',
        { primaryBlobId, fallbackBlobId },
        false
      );
    }
  }

  /**
   * Verifies avatar access permissions
   */
  async verifyAvatarAccess(
    blobId: string,
    userAddress: string
  ): Promise<boolean> {
    try {
      // Extract policy ID from blob ID if it's an encrypted avatar
      const idParts = blobId.split(':');
      if (idParts.length > 2) {
        // This is an encrypted avatar with format: provider:actualId:policyId:keyId
        const policyId = idParts[2];
        return await this.storageManager.verifyAccess(policyId, userAddress);
      }

      // For non-encrypted avatars, access is always allowed
      return true;
    } catch (error) {
      console.error('Avatar access verification failed:', error);
      return false;
    }
  }

  /**
   * Deletes avatar files with error handling
   */
  async deleteAvatarFiles(blobIds: string[]): Promise<{
    successful: string[];
    failed: { blobId: string; error: string }[];
  }> {
    const successful: string[] = [];
    const failed: { blobId: string; error: string }[] = [];

    // Delete files in parallel
    const deletePromises = blobIds.map(async (blobId) => {
      try {
        await this.storageManager.delete(blobId);
        successful.push(blobId);
      } catch (error) {
        failed.push({
          blobId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.allSettled(deletePromises);

    return { successful, failed };
  }

  /**
   * Validates avatar file before upload
   */
  validateAvatarForUpload(file: File): { valid: boolean; error?: string } {
    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds maximum ${maxSize / (1024 * 1024)}MB`
      };
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type ${file.type}. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    // Check if file is not empty
    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty'
      };
    }

    return { valid: true };
  }

  /**
   * Gets storage provider information
   */
  getStorageInfo(): {
    providers: string[];
    strategy: string;
    hasWalrus: boolean;
    hasSeal: boolean;
  } {
    return {
      providers: this.storageManager.getProviders(),
      strategy: this.storageManager.getStrategy(),
      hasWalrus: this.storageManager.hasProvider('walrus'),
      hasSeal: true // Assuming Seal is configured if we're using this service
    };
  }

  /**
   * Creates a standardized avatar error
   */
  private createAvatarError(
    code: string,
    message: string,
    details?: Record<string, any>,
    retryable: boolean = false
  ): AvatarError {
    return {
      code,
      message,
      details,
      retryable,
      fallbackAvailable: this.storageManager.getStrategy() === 'hybrid'
    };
  }

  /**
   * Estimates upload time based on file size and network conditions
   */
  estimateUploadTime(fileSize: number): {
    estimatedSeconds: number;
    category: 'fast' | 'medium' | 'slow';
  } {
    // Rough estimates based on typical Walrus upload speeds
    const bytesPerSecond = 100 * 1024; // Assume 100KB/s average
    const estimatedSeconds = Math.ceil(fileSize / bytesPerSecond);

    let category: 'fast' | 'medium' | 'slow';
    if (estimatedSeconds <= 5) {
      category = 'fast';
    } else if (estimatedSeconds <= 15) {
      category = 'medium';
    } else {
      category = 'slow';
    }

    return { estimatedSeconds, category };
  }

  /**
   * Uploads the main avatar file
   */
  private async uploadMainAvatar(
    buffer: Buffer,
    userId: string,
    walletAddress: string,
    isPublic: boolean
  ): Promise<UploadResult> {
    const uploadOptions: UploadOptions = {
      filename: `avatar_${isPublic ? 'public' : 'private'}_${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      contentType: 'image/jpeg', // Default to JPEG for main avatar
      isPublic: true, // Make both public and private avatars publicly accessible for simplicity
      encrypt: false, // Disable encryption for now
      maxSize: 5 * 1024 * 1024
    };

    return await this.storageManager.upload(buffer, uploadOptions);
  }

  /**
   * Uploads image variants (different sizes and formats)
   */
  private async uploadImageVariants(
    variants: ImageVariant[],
    userId: string,
    isPublic: boolean
  ): Promise<{ [key: string]: UploadResult }> {
    const results: { [key: string]: UploadResult } = {};
    
    // Upload variants in parallel batches to avoid overwhelming the system
    const batchSize = 4;
    for (let i = 0; i < variants.length; i += batchSize) {
      const batch = variants.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (variant) => {
        const key = `${variant.size}_${variant.format}`;
        const uploadOptions: UploadOptions = {
          filename: `avatar_${isPublic ? 'public' : 'private'}_${userId}_${variant.size}_${variant.format}_${Date.now()}`,
          contentType: `image/${variant.format}`,
          isPublic,
          encrypt: !isPublic,
          maxSize: 5 * 1024 * 1024
        };

        try {
          const result = await this.storageManager.upload(variant.buffer, uploadOptions);
          results[key] = result;
        } catch (error) {
          console.warn(`Failed to upload variant ${key}:`, error);
          // Don't fail the entire upload if one variant fails
        }
      });

      await Promise.allSettled(batchPromises);
    }

    return results;
  }

  /**
   * Optimizes image for upload with format conversion and compression
   */
  async optimizeImageForUpload(
    file: File,
    options?: {
      maxWidth?: number;
      quality?: number;
      format?: 'webp' | 'jpeg';
    }
  ): Promise<{ optimized: Buffer; metadata: any }> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { maxWidth = 1024, quality = 85, format = 'webp' } = options || {};

      const optimized = await this.imageProcessor.optimizeForWeb(
        buffer,
        format,
        maxWidth,
        quality
      );

      return {
        optimized: optimized.buffer,
        metadata: {
          originalSize: buffer.length,
          optimizedSize: optimized.size,
          compressionRatio: this.imageProcessor.calculateCompressionRatio(buffer.length, optimized.size),
          format: optimized.format,
          dimensions: { width: optimized.width, height: optimized.height }
        }
      };
    } catch (error) {
      console.error('Image optimization failed:', error);
      throw error;
    }
  }

  /**
   * Generates progressive loading placeholder
   */
  async generateProgressivePlaceholder(file: File): Promise<{
    placeholder: Buffer;
    size: number;
  }> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const placeholder = await this.imageProcessor.generatePlaceholder(buffer);

      return {
        placeholder: placeholder.buffer,
        size: placeholder.size
      };
    } catch (error) {
      console.error('Placeholder generation failed:', error);
      throw error;
    }
  }

  /**
   * Validates and processes image for optimal upload
   */
  async validateAndProcessImage(file: File): Promise<{
    valid: boolean;
    error?: string;
    processed?: {
      webp: Buffer;
      jpeg: Buffer;
      placeholder: Buffer;
      metadata: any;
    };
  }> {
    try {
      // Basic validation
      const basicValidation = this.validateAvatarForUpload(file);
      if (!basicValidation.valid) {
        return basicValidation;
      }

      // Advanced image validation
      const buffer = Buffer.from(await file.arrayBuffer());
      const imageValidation = await this.imageProcessor.validateImage(buffer);
      
      if (!imageValidation.valid) {
        return { valid: false, error: imageValidation.error };
      }

      // Process image into optimal formats
      const [webpResult, jpegResult, placeholder] = await Promise.all([
        this.imageProcessor.optimizeForWeb(buffer, 'webp', 1024, 85),
        this.imageProcessor.optimizeForWeb(buffer, 'jpeg', 1024, 85),
        this.imageProcessor.generatePlaceholder(buffer)
      ]);

      return {
        valid: true,
        processed: {
          webp: webpResult.buffer,
          jpeg: jpegResult.buffer,
          placeholder: placeholder.buffer,
          metadata: {
            original: imageValidation.metadata,
            webp: { size: webpResult.size, dimensions: { width: webpResult.width, height: webpResult.height } },
            jpeg: { size: jpegResult.size, dimensions: { width: jpegResult.width, height: jpegResult.height } },
            placeholder: { size: placeholder.size, dimensions: { width: placeholder.width, height: placeholder.height } }
          }
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}