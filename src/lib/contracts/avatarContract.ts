import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { CONTRACT_CONFIG } from './config';

export class AvatarContractService {
  constructor(
    private suiClient: SuiClient,
    private packageId: string = CONTRACT_CONFIG.PACKAGE_ID
  ) {}

  /**
   * Upload private avatar with Seal encryption
   */
  createUploadPrivateAvatarTransaction(
    profileId: string,
    walrusBlobId: string,
    sealPolicyId: string,
    clockId: string = '0x6'
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.CORE}::${CONTRACT_CONFIG.FUNCTIONS.UPLOAD_PRIVATE_AVATAR}`,
      arguments: [
        tx.object(CONTRACT_CONFIG.MEDIA_REGISTRY),
        tx.object(profileId),
        tx.pure.string(walrusBlobId),
        tx.pure.string(sealPolicyId),
        tx.object(clockId),
      ],
    });

    return tx;
  }

  /**
   * Create avatar allowlist for managing access
   */
  createAvatarAllowlistTransaction(
    profileId: string,
    expiresAt?: number,
    clockId: string = '0x6'
  ): Transaction {
    const tx = new Transaction();

    const expiresAtArg = expiresAt 
      ? tx.pure.option('u64', expiresAt)
      : tx.pure.option('u64', null);

    tx.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.SEAL_POLICIES}::${CONTRACT_CONFIG.FUNCTIONS.CREATE_AVATAR_ALLOWLIST_SHARED}`,
      arguments: [
        tx.object(CONTRACT_CONFIG.ALLOWLIST_REGISTRY),
        tx.object(profileId),
        expiresAtArg,
        tx.object(clockId),
      ],
    });

    return tx;
  }

  /**
   * Grant avatar access to a matched user
   */
  grantAvatarAccessTransaction(
    avatarMediaId: string,
    profileId: string,
    matchId: string,
    targetUser: string
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.CORE}::${CONTRACT_CONFIG.FUNCTIONS.GRANT_AVATAR_ACCESS}`,
      arguments: [
        tx.object(avatarMediaId),
        tx.object(profileId),
        tx.object(matchId),
        tx.pure.address(targetUser),
      ],
    });

    return tx;
  }

  /**
   * Revoke avatar access from a user
   */
  revokeAvatarAccessTransaction(
    avatarMediaId: string,
    profileId: string,
    targetUser: string
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.CORE}::${CONTRACT_CONFIG.FUNCTIONS.REVOKE_AVATAR_ACCESS}`,
      arguments: [
        tx.object(avatarMediaId),
        tx.object(profileId),
        tx.pure.address(targetUser),
      ],
    });

    return tx;
  }

  /**
   * Add matched user to avatar allowlist
   */
  addMatchedUserToAvatarTransaction(
    avatarAllowlistId: string,
    profileId: string,
    matchId: string,
    matchedUser: string
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.SEAL_POLICIES}::${CONTRACT_CONFIG.FUNCTIONS.ADD_MATCHED_USER_TO_AVATAR}`,
      arguments: [
        tx.object(avatarAllowlistId),
        tx.object(profileId),
        tx.object(matchId),
        tx.pure.address(matchedUser),
      ],
    });

    return tx;
  }

  /**
   * Remove matched user from avatar allowlist
   */
  removeMatchedUserFromAvatarTransaction(
    avatarAllowlistId: string,
    profileId: string,
    matchedUser: string
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.SEAL_POLICIES}::${CONTRACT_CONFIG.FUNCTIONS.REMOVE_MATCHED_USER_FROM_AVATAR}`,
      arguments: [
        tx.object(avatarAllowlistId),
        tx.object(profileId),
        tx.pure.address(matchedUser),
      ],
    });

    return tx;
  }

  /**
   * Seal approve for avatar access
   */
  sealApproveAvatarTransaction(
    sealId: Uint8Array,
    avatarAllowlistId: string,
    clockId: string = '0x6'
  ): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.SEAL_POLICIES}::${CONTRACT_CONFIG.FUNCTIONS.SEAL_APPROVE_AVATAR}`,
      arguments: [
        tx.pure.vector('u8', Array.from(sealId)),
        tx.object(avatarAllowlistId),
        tx.object(clockId),
      ],
    });

    return tx;
  }

  /**
   * Create regular media content (public)
   */
  createMediaContentTransaction(
    profileId: string,
    walrusBlobId: string,
    contentType: number,
    visibilityLevel: number,
    sealPolicyId?: string,
    caption: string = '',
    tags: string[] = [],
    clockId: string = '0x6'
  ): Transaction {
    const tx = new Transaction();

    const sealPolicyArg = sealPolicyId 
      ? tx.pure.option('string', sealPolicyId)
      : tx.pure.option('string', null);

    tx.moveCall({
      target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.CORE}::${CONTRACT_CONFIG.FUNCTIONS.CREATE_MEDIA_CONTENT}`,
      arguments: [
        tx.object(CONTRACT_CONFIG.MEDIA_REGISTRY),
        tx.object(profileId),
        tx.pure.string(walrusBlobId),
        tx.pure.u8(contentType),
        tx.pure.u8(visibilityLevel),
        sealPolicyArg,
        tx.pure.string(caption),
        tx.pure.vector('string', tags),
        tx.object(clockId),
      ],
    });

    return tx;
  }

  /**
   * Query user's media content
   */
  async getUserMediaIds(userAddress: string): Promise<string[]> {
    try {
      const result = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new Transaction();
          tx.moveCall({
            target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.CORE}::get_user_media_ids`,
            arguments: [
              tx.object(CONTRACT_CONFIG.MEDIA_REGISTRY),
              tx.pure.address(userAddress),
            ],
          });
          return tx;
        })(),
        sender: userAddress,
      });

      // Parse the result to extract media IDs
      if (result.results?.[0]?.returnValues?.[0]) {
        const [data] = result.results[0].returnValues[0];
        // Parse the BCS data to get the vector of IDs
        // This would need proper BCS parsing in a real implementation
        return []; // Placeholder
      }
      return [];
    } catch (error) {
      console.error('Failed to get user media IDs:', error);
      return [];
    }
  }

  /**
   * Query avatar allowlist for a user
   */
  async getAvatarAllowlistId(userAddress: string): Promise<string | null> {
    try {
      const result = await this.suiClient.devInspectTransactionBlock({
        transactionBlock: (() => {
          const tx = new Transaction();
          tx.moveCall({
            target: `${this.packageId}::${CONTRACT_CONFIG.MODULES.SEAL_POLICIES}::get_avatar_allowlist_id_by_owner`,
            arguments: [
              tx.object(CONTRACT_CONFIG.ALLOWLIST_REGISTRY),
              tx.pure.address(userAddress),
            ],
          });
          return tx;
        })(),
        sender: userAddress,
      });

      // Parse the result to extract allowlist ID
      if (result.results?.[0]?.returnValues?.[0]) {
        // Parse the Option<ID> result
        // This would need proper BCS parsing in a real implementation
        return null; // Placeholder
      }
      return null;
    } catch (error) {
      console.error('Failed to get avatar allowlist ID:', error);
      return null;
    }
  }

  /**
   * Build namespace for avatar allowlist
   */
  buildAvatarNamespace(allowlistId: string): Uint8Array {
    // Type prefix for avatar (0x06) + allowlist ID bytes
    const typePrefix = new Uint8Array([CONTRACT_CONFIG.ALLOWLIST_TYPES.AVATAR]);
    const idBytes = new Uint8Array(32); // Placeholder for actual ID bytes
    
    const namespace = new Uint8Array(typePrefix.length + idBytes.length);
    namespace.set(typePrefix, 0);
    namespace.set(idBytes, typePrefix.length);
    
    return namespace;
  }
}

// Export singleton instance
export const avatarContractService = new AvatarContractService(
  // This would be injected from the SuiClient context in a real app
  {} as SuiClient
);