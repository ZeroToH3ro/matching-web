export interface MatchingMeContractConfig {
  packageId: string;
  moduleName: string;
  profileRegistryId: string;
  clockObjectId: string;
}

const DEFAULT_CLOCK_OBJECT_ID = '0x6';

export const matchingMeContractConfig: MatchingMeContractConfig = {
  packageId: process.env.NEXT_PUBLIC_PACKAGE_ID || '',
  moduleName: process.env.NEXT_PUBLIC_MATCHING_ME_MODULE_NAME || 'core',
  profileRegistryId: process.env.NEXT_PUBLIC_PROFILE_REGISTRY_ID || process.env.NEXT_PUBLIC_MATCHING_ME_REGISTRY_ID || '',
  clockObjectId: process.env.NEXT_PUBLIC_SUI_CLOCK_OBJECT_ID || DEFAULT_CLOCK_OBJECT_ID,
};

// Debug log on client-side
if (typeof window !== 'undefined') {
  console.log('[matchingMeContract] Config loaded:', {
    packageId: matchingMeContractConfig.packageId,
    moduleName: matchingMeContractConfig.moduleName,
    profileRegistryId: matchingMeContractConfig.profileRegistryId,
    isConfigured: !!(matchingMeContractConfig.packageId && matchingMeContractConfig.profileRegistryId),
  });
}

export function assertMatchingMeConfig(): void {
  // Temporarily disabled for development - using fallback values
  // TODO: Re-enable validation in production

  if (!matchingMeContractConfig.packageId) {
    console.warn('Missing NEXT_PUBLIC_MATCHING_ME_PACKAGE_ID - smart contract features disabled');
  }

  if (!matchingMeContractConfig.profileRegistryId) {
    console.warn('Missing NEXT_PUBLIC_MATCHING_ME_REGISTRY_ID - smart contract features disabled');
  }

  // Disabled: Allow app to run without contract config
  // if (missing.length > 0) {
  //   throw new Error(
  //     `Missing required MatchingMe contract environment variables: ${missing.join(', ')}`,
  //   );
  // }
}

export function isContractConfigured(): boolean {
  return !!(matchingMeContractConfig.packageId && matchingMeContractConfig.profileRegistryId);
}
