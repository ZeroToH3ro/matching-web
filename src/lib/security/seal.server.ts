import { SealAccessControl } from '@/lib/storage/providers/seal';

export interface SealEncryptionRequest {
  payload: Record<string, unknown>;
  ownerAddress: string;
}

export interface SealEncryptionResult {
  ciphertext: string;
  policyId: string;
  keyId: string;
}

let sealAccessControl: SealAccessControl | null = null;

function getSealConfig() {
  if (typeof process === 'undefined') {
    throw new Error('Seal configuration is only available on the server');
  }

  const suiNetwork = (process.env.SEAL_NETWORK || 'testnet') as 'mainnet' | 'testnet' | 'devnet';
  const packageId = process.env.SEAL_PACKAGE_ID;
  const serverConfigJson = process.env.SEAL_SERVER_CONFIGS || '[]';

  if (!packageId) {
    throw new Error('Missing SEAL_PACKAGE_ID environment variable');
  }

  let serverConfigs: Array<{ objectId: string; weight: number }> | undefined;

  try {
    serverConfigs = JSON.parse(serverConfigJson);
  } catch (error) {
    throw new Error(`Invalid SEAL_SERVER_CONFIGS JSON: ${(error as Error).message}`);
  }

  return {
    suiNetwork,
    packageId,
    serverConfigs,
  };
}

function getSealAccessControl(): SealAccessControl {
  if (!sealAccessControl) {
    const config = getSealConfig();
    sealAccessControl = new SealAccessControl(config);
  }

  return sealAccessControl;
}

export async function encryptProfilePayload({
  payload,
  ownerAddress,
}: SealEncryptionRequest): Promise<SealEncryptionResult> {
  const seal = getSealAccessControl();
  const data = new TextEncoder().encode(JSON.stringify(payload));

  const policy = {
    rules: [
      {
        type: 'wallet' as const,
        value: ownerAddress,
        operation: 'allow' as const,
      },
    ],
    threshold: 1,
  };

  const { encryptedData, policyId, keyId } = await seal.createEncryptedStorage(
    data,
    policy,
    { owner: ownerAddress },
  );

  return {
    ciphertext: Buffer.from(encryptedData).toString('base64'),
    policyId,
    keyId,
  };
}
