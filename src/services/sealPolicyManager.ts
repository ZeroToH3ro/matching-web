import { SealAccessControl, type SealConfig } from '@/lib/storage/providers/seal';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { prisma } from '@/lib/prisma';
import type { AccessPolicy, AccessRule } from '@/lib/storage/types';

export interface AvatarPolicyConfig {
  userId: string;
  walletAddress: string;
  initialMatches?: string[];
  expiryDays?: number;
  visibility: 'matches_only' | 'premium_matches' | 'all_matches';
}

export interface PolicyUpdateResult {
  success: boolean;
  policyId?: string;
  transactionId?: string;
  error?: string;
}

export class SealPolicyManager {
  private sealAccessControl: SealAccessControl;
  private suiClient: SuiClient;

  constructor() {
    // Initialize with environment configuration
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
    this.suiClient = new SuiClient({
      url: getFullnodeUrl(sealConfig.suiNetwork)
    });
  }

  /**
   * Creates a new Seal policy for avatar access control
   */
  async createAvatarPolicy(config: AvatarPolicyConfig): Promise<PolicyUpdateResult> {
    try {
      // Build access policy based on configuration
      const accessPolicy = this.buildAvatarAccessPolicy(config);

      // Create the policy using Seal (placeholder implementation)
      // In a real implementation, this would create an on-chain policy
      const policyId = await this.createPolicyOnChain(accessPolicy, config);

      // Store policy metadata in database for quick lookups
      await this.storePolicyMetadata(policyId, config);

      return {
        success: true,
        policyId,
        transactionId: `tx_${Date.now()}` // Placeholder
      };

    } catch (error) {
      console.error('Failed to create avatar policy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Adds a match to an existing avatar policy
   */
  async addMatchToPolicy(policyId: string, matchUserId: string): Promise<PolicyUpdateResult> {
    try {
      // Get match user's wallet address
      const matchUser = await prisma.user.findUnique({
        where: { id: matchUserId },
        select: { walletAddress: true }
      });

      if (!matchUser?.walletAddress) {
        throw new Error('Match user wallet address not found');
      }

      // Update the policy to include the new match
      await this.updatePolicyOnChain(policyId, 'add', matchUser.walletAddress);

      // Update policy metadata in database
      await this.updatePolicyMetadata(policyId, 'add_match', matchUserId);

      return {
        success: true,
        policyId
      };

    } catch (error) {
      console.error('Failed to add match to policy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Removes a match from an existing avatar policy
   */
  async removeMatchFromPolicy(policyId: string, matchUserId: string): Promise<PolicyUpdateResult> {
    try {
      // Get match user's wallet address
      const matchUser = await prisma.user.findUnique({
        where: { id: matchUserId },
        select: { walletAddress: true }
      });

      if (!matchUser?.walletAddress) {
        throw new Error('Match user wallet address not found');
      }

      // Update the policy to remove the match
      await this.updatePolicyOnChain(policyId, 'remove', matchUser.walletAddress);

      // Update policy metadata in database
      await this.updatePolicyMetadata(policyId, 'remove_match', matchUserId);

      return {
        success: true,
        policyId
      };

    } catch (error) {
      console.error('Failed to remove match from policy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verifies if a user has access to an avatar through the policy
   */
  async verifyAccess(policyId: string, viewerAddress: string): Promise<boolean> {
    try {
      // First check database cache for quick lookup
      const cachedResult = await this.checkCachedAccess(policyId, viewerAddress);
      if (cachedResult !== null) {
        return cachedResult;
      }

      // Fallback to on-chain verification (placeholder)
      // In a real implementation, this would verify against the Seal policy
      const hasAccess = await this.verifyAccessOnChain(policyId, viewerAddress);

      // Cache the result for future lookups
      await this.cacheAccessResult(policyId, viewerAddress, hasAccess);

      return hasAccess;

    } catch (error) {
      console.error('Access verification failed:', error);
      return false; // Deny access on error
    }
  }

  /**
   * Updates avatar policy settings (visibility, expiry, etc.)
   */
  async updatePolicySettings(
    policyId: string, 
    settings: Partial<AvatarPolicyConfig>
  ): Promise<PolicyUpdateResult> {
    try {
      // Update policy on-chain if needed
      if (settings.visibility || settings.expiryDays) {
        await this.updatePolicyOnChain(policyId, 'update_settings', settings);
      }

      // Update metadata in database
      await this.updatePolicyMetadata(policyId, 'update_settings', settings);

      return {
        success: true,
        policyId
      };

    } catch (error) {
      console.error('Failed to update policy settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deactivates an avatar policy (when user deletes avatar)
   */
  async deactivatePolicy(policyId: string): Promise<PolicyUpdateResult> {
    try {
      // Deactivate policy on-chain
      await this.deactivatePolicyOnChain(policyId);

      // Mark as inactive in database
      await this.updatePolicyMetadata(policyId, 'deactivate', null);

      return {
        success: true,
        policyId
      };

    } catch (error) {
      console.error('Failed to deactivate policy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets policy information and current access list
   */
  async getPolicyInfo(policyId: string): Promise<{
    active: boolean;
    allowedAddresses: string[];
    settings: Partial<AvatarPolicyConfig>;
    createdAt: Date;
    lastUpdated: Date;
  } | null> {
    try {
      // Get policy metadata from database
      // This would be stored in a new table for policy tracking
      // For now, return a placeholder structure
      return {
        active: true,
        allowedAddresses: [],
        settings: {
          visibility: 'matches_only'
        },
        createdAt: new Date(),
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Failed to get policy info:', error);
      return null;
    }
  }

  /**
   * Builds an access policy based on avatar configuration
   */
  private buildAvatarAccessPolicy(config: AvatarPolicyConfig): AccessPolicy {
    const rules: AccessRule[] = [
      // Always allow the owner
      {
        type: 'wallet',
        value: config.walletAddress,
        operation: 'allow'
      }
    ];

    // Add initial matches if provided
    if (config.initialMatches) {
      for (const matchAddress of config.initialMatches) {
        rules.push({
          type: 'wallet',
          value: matchAddress,
          operation: 'allow'
        });
      }
    }

    // Add time-based expiry if specified
    if (config.expiryDays) {
      const expiryTime = Date.now() + (config.expiryDays * 24 * 60 * 60 * 1000);
      rules.push({
        type: 'time',
        value: expiryTime,
        operation: 'allow'
      } as AccessRule);
    }

    return {
      rules,
      threshold: 1 // Only need one rule to match for access
    };
  }

  /**
   * Creates policy on-chain (placeholder implementation)
   */
  private async createPolicyOnChain(
    accessPolicy: AccessPolicy, 
    config: AvatarPolicyConfig
  ): Promise<string> {
    // TODO: Implement actual on-chain policy creation
    // This would use the Seal SDK to create a policy on Sui
    
    // For now, generate a mock policy ID
    const policyId = `avatar_policy_${config.userId}_${Date.now()}`;
    
    console.log('Creating avatar policy on-chain:', {
      policyId,
      userId: config.userId,
      visibility: config.visibility,
      rulesCount: accessPolicy.rules.length
    });

    return policyId;
  }

  /**
   * Updates policy on-chain (placeholder implementation)
   */
  private async updatePolicyOnChain(
    policyId: string, 
    action: 'add' | 'remove' | 'update_settings', 
    data: any
  ): Promise<void> {
    // TODO: Implement actual on-chain policy updates
    console.log('Updating avatar policy on-chain:', {
      policyId,
      action,
      data
    });
  }

  /**
   * Deactivates policy on-chain (placeholder implementation)
   */
  private async deactivatePolicyOnChain(policyId: string): Promise<void> {
    // TODO: Implement actual on-chain policy deactivation
    console.log('Deactivating avatar policy on-chain:', { policyId });
  }

  /**
   * Verifies access on-chain (placeholder implementation)
   */
  private async verifyAccessOnChain(policyId: string, viewerAddress: string): Promise<boolean> {
    // TODO: Implement actual on-chain access verification
    // This would check the Seal policy to see if the viewer has access
    
    // For now, check if there's a match relationship in the database
    const user = await prisma.user.findFirst({
      where: { avatarSealPolicyId: policyId },
      select: { id: true }
    });

    if (!user) {
      return false;
    }

    // Check if viewer has a match with the avatar owner
    const viewerUser = await prisma.user.findFirst({
      where: { walletAddress: viewerAddress },
      select: { id: true }
    });

    if (!viewerUser) {
      return false;
    }

    const match = await prisma.like.findFirst({
      where: {
        OR: [
          { sourceUserId: user.id, targetUserId: viewerUser.id, matchStatus: 1 },
          { sourceUserId: viewerUser.id, targetUserId: user.id, matchStatus: 1 }
        ]
      }
    });

    return !!match;
  }

  /**
   * Stores policy metadata in database for quick lookups
   */
  private async storePolicyMetadata(policyId: string, config: AvatarPolicyConfig): Promise<void> {
    // TODO: Create a policy metadata table and store the information
    // For now, just log the action
    console.log('Storing policy metadata:', { policyId, config });
  }

  /**
   * Updates policy metadata in database
   */
  private async updatePolicyMetadata(
    policyId: string, 
    action: string, 
    data: any
  ): Promise<void> {
    // TODO: Update policy metadata table
    console.log('Updating policy metadata:', { policyId, action, data });
  }

  /**
   * Checks cached access result for performance
   */
  private async checkCachedAccess(policyId: string, viewerAddress: string): Promise<boolean | null> {
    // TODO: Implement Redis or database caching for access results
    // Return null if no cached result exists
    return null;
  }

  /**
   * Caches access result for future lookups
   */
  private async cacheAccessResult(
    policyId: string, 
    viewerAddress: string, 
    hasAccess: boolean
  ): Promise<void> {
    // TODO: Cache the access result with appropriate TTL
    console.log('Caching access result:', { policyId, viewerAddress, hasAccess });
  }
}