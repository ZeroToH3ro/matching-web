// Stub exports for PrivateAvatarTest component
// TODO: Implement actual avatar contract hooks

export function useAvatarContract() {
  return {
    isLoading: false,
    error: null as string | null,
    uploadPrivateAvatar: async (_profileId: string, _walrusBlobId: string, _sealPolicyId: string) => {
      throw new Error('Not implemented');
    },
    createAvatarAllowlist: async (_profileId: string) => {
      throw new Error('Not implemented');
    },
    grantAvatarAccess: async (_walrusBlobId: string, _profileId: string, _matchId: string, _targetUser: string) => {
      throw new Error('Not implemented');
    },
    revokeAvatarAccess: async (_walrusBlobId: string, _profileId: string, _targetUser: string) => {
      throw new Error('Not implemented');
    },
    addMatchedUser: async (_allowlistId: string, _profileId: string, _matchId: string, _targetUser: string) => {
      throw new Error('Not implemented');
    },
    removeMatchedUser: async (_allowlistId: string, _profileId: string, _targetUser: string) => {
      throw new Error('Not implemented');
    },
    getUserMediaIds: async (_userAddress: string) => {
      return [] as string[];
    },
    getAvatarAllowlistId: async (_userAddress: string) => {
      return null as string | null;
    }
  };
}

export function useSealApproval() {
  return {
    isLoading: false,
    error: null as string | null,
    approveAvatarAccess: async (_sealId: Uint8Array, _allowlistId: string) => {
      throw new Error('Not implemented');
    },
    checkApproval: async (_sealId: Uint8Array) => {
      return false;
    }
  };
}
