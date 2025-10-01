export interface MatchingMeContractConfig {
  packageId: string;
  moduleName: string;
  profileRegistryId: string;
  clockObjectId: string;
}

const DEFAULT_CLOCK_OBJECT_ID = '0x6';

function readEnv(name: string, fallback = ''): string {
  if (typeof process === 'undefined') {
    return fallback;
  }

  return process.env[name] ?? fallback;
}

export const matchingMeContractConfig: MatchingMeContractConfig = {
  packageId: readEnv('NEXT_PUBLIC_MATCHING_ME_PACKAGE_ID'),
  moduleName: readEnv('NEXT_PUBLIC_MATCHING_ME_MODULE_NAME', 'core'),
  profileRegistryId: readEnv('NEXT_PUBLIC_MATCHING_ME_REGISTRY_ID'),
  clockObjectId: readEnv('NEXT_PUBLIC_SUI_CLOCK_OBJECT_ID', DEFAULT_CLOCK_OBJECT_ID),
};

export function assertMatchingMeConfig(): void {
  const missing: string[] = [];

  if (!matchingMeContractConfig.packageId) {
    missing.push('NEXT_PUBLIC_MATCHING_ME_PACKAGE_ID');
  }

  if (!matchingMeContractConfig.profileRegistryId) {
    missing.push('NEXT_PUBLIC_MATCHING_ME_REGISTRY_ID');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required MatchingMe contract environment variables: ${missing.join(', ')}`,
    );
  }
}
