import { SealAccessControl, type SealConfig } from '@/lib/storage/providers/seal';
import { SealPolicyManager, type AvatarPolicyConfig } from './sealPolicyManager';
import type { AccessPolicy } from '@/lib/storage/types';

export interface EncryptionResult {
  encryptedData: Uint8Array;
  policyId: string;
  keyId: string;
  metadata: {
    originalSize: number;
    contentType: string;
    encryptedAt: number;
  };
}

export interface DecryptionResult {
  decryptedData: Uint8Array;
  metadata: {
    originalSize: number;
    contentType: string;
    decryptedAt: number;
  };
}

export interface EncryptionOptions {
  userId: string;
  walletAddress: string;
  contentType: string;
  visibility: 'matches_only' | 'premium_matches' | 'all_matches';
  expiryDays?: number;
  initialMatches?: string[];
}

export class AvatarEncryptionService {
  private sealAccessControl: SealAccessControl;
  private policyManager: SealPolicyManager;

  constructor() {
    // Initialize Seal access control
    const sealConfig: SealConfig = {
      suiNetwork: (process.env.SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet') || 'testnet',
      privateKey: process.env.SUI_PRIVATE_KEY,
      packageId: process.env.SEAL_PACKAGE_ID,
      serverConfigs: process.env.SEAL_SERVER_OBJECT_IDS
        ? process.env.SEAL_SERVER_OBJECT_IDS.split(',').map(objectId => ({
            objectId: objectId.trim(),
            weight: 1
          }))
        : undefined
    };

    this.sealAccessControl = new SealAccessControl(sealConfig);
    this.policyManager = new SealPolicyManager();
  }

  /**
   * Encrypts an avatar image with Seal Protocol
   */
  async encryptAvatar(
    imageData: Uint8Array,
    options: EncryptionOptions
  ): Promise<EncryptionResult> {
    try {
      // Validate input data
      if (imageData.length === 0) {
        throw new Error('Image data is empty');
      }

      if (imageData.length > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('Image data too large for encryption');
      }

      // Create avatar policy configuration
      const policyConfig: AvatarPolicyConfig = {
        userId: options.userId,
        walletAddress: options.walletAddress,
        initialMatches: options.initialMatches || [],
        expiryDays: options.expiryDays,
        visibility: options.visibility
      };

      // Create the access policy
      const policyResult = await this.policyManager.createAvatarPolicy(policyConfig);
      if (!policyResult.success || !policyResult.policyId) {
        throw new Error(`Failed to create avatar policy: ${policyResult.error}`);
      }

      // Build access policy for Seal encryption
      const accessPolicy = this.buildAccessPolicy(options);

      // Encrypt the image data using Seal
      const encryptionResult = await this.sealAccessControl.createEncryptedStorage(
        imageData,
        accessPolicy,
        {
          userId: options.userId,
          contentType: options.contentType,
          policyId: policyResult.policyId
        }
      );

      return {
        encryptedData: encryptionResult.encryptedData,
        policyId: encryptionResult.policyId,
        keyId: encryptionResult.keyId,
        metadata: {
          originalSize: imageData.length,
          contentType: options.contentType,
          encryptedAt: Date.now()
        }
      };

    } catch (error) {
      console.error('Avatar encryption failed:', error);
      throw new Error(`Avatar encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypts an avatar image with access verification
   */
  async decryptAvatar(
    encryptedData: Uint8Array,
    keyId: string,
    policyId: string,
    viewerAddress: string
  ): Promise<DecryptionResult> {
    try {
      // Verify access permissions first
      const hasAccess = await this.policyManager.verifyAccess(policyId, viewerAddress);
      if (!hasAccess) {
        throw new Error('Access denied: User does not have permission to view this avatar');
      }

      // Decrypt the image data using Seal
      const decryptedData = await this.sealAccessControl.decryptStorage(
        encryptedData,
        keyId,
        viewerAddress
      );

      return {
        decryptedData,
        metadata: {
          originalSize: decryptedData.length,
          contentType: 'image/png', // Default, should be stored in metadata
          decryptedAt: Date.now()
        }
      };

    } catch (error) {
      console.error('Avatar decryption failed:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Access denied')) {
          throw error; // Re-throw access denied errors as-is
        }
        if (error.message.includes('not yet fully implemented')) {
          throw new Error('Avatar decryption temporarily unavailable - service under maintenance');
        }
      }
      
      throw new Error(`Avatar decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates encryption policy when matches change
   */
  async updateAvatarAccess(
    policyId: string,
    action: 'grant' | 'revoke',
    matchUserId: string
  ): Promise<boolean> {
    try {
      let result;
      
      if (action === 'grant') {
        result = await this.policyManager.addMatchToPolicy(policyId, matchUserId);
      } else {
        result = await this.policyManager.removeMatchFromPolicy(policyId, matchUserId);
      }

      if (!result.success) {
        console.error(`Failed to ${action} avatar access:`, result.error);
        return false;
      }

      return true;

    } catch (error) {
      console.error(`Avatar access ${action} failed:`, error);
      return false;
    }
  }

  /**
   * Validates encrypted avatar data integrity
   */
  async validateEncryptedAvatar(
    encryptedData: Uint8Array,
    expectedSize?: number
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Basic validation checks
      if (encryptedData.length === 0) {
        return { valid: false, error: 'Encrypted data is empty' };
      }

      if (encryptedData.length < 100) {
        return { valid: false, error: 'Encrypted data too small to be valid' };
      }

      if (expectedSize && Math.abs(encryptedData.length - expectedSize) > expectedSize * 0.5) {
        return { valid: false, error: 'Encrypted data size differs significantly from expected' };
      }

      // TODO: Add more sophisticated validation (checksums, headers, etc.)
      
      return { valid: true };

    } catch (error) {
      return { 
        valid: false, 
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Gets encryption status and metadata
   */
  async getEncryptionInfo(policyId: string): Promise<{
    active: boolean;
    allowedUsers: number;
    createdAt: Date;
    lastAccessed?: Date;
    settings: {
      visibility: string;
      expiryDays?: number;
    };
  } | null> {
    try {
      const policyInfo = await this.policyManager.getPolicyInfo(policyId);
      if (!policyInfo) {
        return null;
      }

      return {
        active: policyInfo.active,
        allowedUsers: policyInfo.allowedAddresses.length,
        createdAt: policyInfo.createdAt,
        lastAccessed: policyInfo.lastUpdated,
        settings: {
          visibility: policyInfo.settings.visibility || 'matches_only',
          expiryDays: policyInfo.settings.expiryDays
        }
      };

    } catch (error) {
      console.error('Failed to get encryption info:', error);
      return null;
    }
  }

  /**
   * Deactivates avatar encryption (when avatar is deleted)
   */
  async deactivateAvatarEncryption(policyId: string): Promise<boolean> {
    try {
      const result = await this.policyManager.deactivatePolicy(policyId);
      return result.success;

    } catch (error) {
      console.error('Failed to deactivate avatar encryption:', error);
      return false;
    }
  }

  /**
   * Builds access policy from encryption options
   */
  private buildAccessPolicy(options: EncryptionOptions): AccessPolicy {
    const rules: AccessPolicy['rules'] = [
      // Always allow the owner
      {
        type: 'wallet',
        value: options.walletAddress,
        operation: 'allow'
      }
    ];

    // Add initial matches if provided
    if (options.initialMatches) {
      for (const matchAddress of options.initialMatches) {
        rules.push({
          type: 'wallet',
          value: matchAddress,
          operation: 'allow'
        });
      }
    }

    // Add subscription requirement for premium visibility
    if (options.visibility === 'premium_matches') {
      rules.push({
        type: 'subscription',
        value: 'premium',
        operation: 'allow'
      });
    }

    // Add time-based expiry if specified
    if (options.expiryDays) {
      const expiryTime = Date.now() + (options.expiryDays * 24 * 60 * 60 * 1000);
      rules.push({
        type: 'time',
        value: expiryTime,
        operation: 'allow'
      });
    }

    return {
      rules,
      threshold: options.visibility === 'premium_matches' ? 2 : 1 // Require both match and subscription for premium
    };
  }

  /**
   * Estimates encryption/decryption time based on data size
   */
  estimateProcessingTime(dataSize: number): {
    encryptionSeconds: number;
    decryptionSeconds: number;
    category: 'fast' | 'medium' | 'slow';
  } {
    // Rough estimates based on typical Seal processing speeds
    const bytesPerSecond = 50 * 1024; // Assume 50KB/s for encryption operations
    const encryptionSeconds = Math.ceil(dataSize / bytesPerSecond);
    const decryptionSeconds = Math.ceil(encryptionSeconds * 0.8); // Decryption typically faster

    let category: 'fast' | 'medium' | 'slow';
    if (encryptionSeconds <= 3) {
      category = 'fast';
    } else if (encryptionSeconds <= 10) {
      category = 'medium';
    } else {
      category = 'slow';
    }

    return { encryptionSeconds, decryptionSeconds, category };
  }
}