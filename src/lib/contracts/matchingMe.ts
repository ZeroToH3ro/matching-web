import type { SuiClient } from '@mysten/sui/client';
import { Inputs, Transaction } from '@mysten/sui/transactions';
import { matchingMeContractConfig, assertMatchingMeConfig } from '@/configs/matchingMeContract';

export interface BuildCreateProfileTxParams {
  ownerAddress: string;
  displayName: string;
  age: number;
  encryptedPayload: string;
  interests: string[];
  registry: SharedObjectInput;
}

const STRING_TYPE = '0x1::string::String';

export interface SharedObjectInput {
  objectId: string;
  initialSharedVersion: string | number;
  mutable?: boolean;
}

function isSharedOwner(
  owner: unknown,
): owner is { Shared: { initial_shared_version: string | number } } {
  if (typeof owner !== 'object' || owner === null) {
    return false;
  }

  if (!('Shared' in owner)) {
    return false;
  }

  const shared = (owner as { Shared?: unknown }).Shared;

  if (typeof shared !== 'object' || shared === null) {
    return false;
  }

  return 'initial_shared_version' in shared;
}

export async function fetchProfileRegistryReference(
  client: SuiClient,
): Promise<SharedObjectInput> {
  assertMatchingMeConfig();

  const profileRegistryId = matchingMeContractConfig.profileRegistryId;

  const { data } = await client.getObject({
    id: profileRegistryId,
    options: { showOwner: true },
  });

  if (!data) {
    throw new Error(`Profile registry object ${profileRegistryId} not found on network`);
  }

  const owner = data.owner;

  if (!isSharedOwner(owner)) {
    throw new Error('Profile registry must be a shared object');
  }

  const initialSharedVersion = owner.Shared.initial_shared_version;

  if (initialSharedVersion == null) {
    throw new Error('Profile registry shared version missing from object owner metadata');
  }

  return {
    objectId: data.objectId,
  initialSharedVersion: initialSharedVersion.toString(),
    mutable: true,
  };
}

/**
 * Check if a profile exists on-chain for a given wallet address
 * Queries the ProfileRegistry's dynamic field table
 */
export async function checkProfileExists(
  client: SuiClient,
  walletAddress: string,
): Promise<{ exists: boolean; profileId?: string }> {
  try {
    assertMatchingMeConfig();

    const profileRegistryId = matchingMeContractConfig.profileRegistryId;

    // Get ProfileRegistry object
    const registry = await client.getObject({
      id: profileRegistryId,
      options: { showContent: true },
    });

    if (!registry.data?.content || !('fields' in registry.data.content)) {
      throw new Error('Invalid profile registry structure');
    }

    const fields = registry.data.content.fields as any;
    const profilesTableId = fields.profiles.fields.id.id;

    // Query dynamic field for user's profile ID
    try {
      const dynamicField = await client.getDynamicFieldObject({
        parentId: profilesTableId,
        name: {
          type: 'address',
          value: walletAddress,
        },
      });

      if (dynamicField.data?.content && 'fields' in dynamicField.data.content) {
        const profileId = (dynamicField.data.content.fields as any).value;
        return { exists: true, profileId };
      }

      return { exists: false };
    } catch (err: any) {
      // Profile doesn't exist if dynamic field not found
      if (err.message?.includes('not found') || err.message?.includes('Could not find')) {
        return { exists: false };
      }
      throw err;
    }
  } catch (error) {
    console.error('[checkProfileExists] Error:', error);
    throw error;
  }
}

export function buildCreateProfileTransaction({
  ownerAddress,
  displayName,
  age,
  encryptedPayload,
  interests,
  registry,
}: BuildCreateProfileTxParams): Transaction {
  assertMatchingMeConfig();

  if (age < 0 || age > 120) {
    throw new Error(`Invalid age derived for profile creation: ${age}`);
  }

  const tx = new Transaction();

  const interestsList = normaliseInterests(interests);

  const interestsVector = tx.makeMoveVec({
    type: STRING_TYPE,
    elements: interestsList.map((interest) => tx.pure.string(interest)),
  });

  const registryArgument = tx.object(
    Inputs.SharedObjectRef({
      objectId: registry.objectId,
      initialSharedVersion: registry.initialSharedVersion,
      mutable: registry.mutable ?? true,
    }),
  );

  const clockArgument = matchingMeContractConfig.clockObjectId
    ? tx.object(matchingMeContractConfig.clockObjectId)
    : tx.object.clock();

  const profile = tx.moveCall({
    target: `${matchingMeContractConfig.packageId}::${matchingMeContractConfig.moduleName}::create_profile`,
    arguments: [
      registryArgument,
      tx.pure.string(displayName),
      tx.pure.u8(age),
      tx.pure.string(encryptedPayload),
      interestsVector,
      clockArgument,
    ],
  });

  tx.transferObjects([profile], tx.pure.address(ownerAddress));

  return tx;
}

function normaliseInterests(interests: string[]): string[] {
  const cleaned = Array.from(
    new Set(
      interests
        .map((interest) => interest.trim())
        .filter((interest) => interest.length > 0)
        .map((interest) => interest.slice(0, 32).toLowerCase()),
    ),
  );

  const MIN_INTERESTS = 3;
  const MAX_INTERESTS = 20;

  if (cleaned.length < MIN_INTERESTS) {
    throw new Error(
      `At least ${MIN_INTERESTS} interests are required to create an on-chain profile`,
    );
  }

  if (cleaned.length > MAX_INTERESTS) {
    return cleaned.slice(0, MAX_INTERESTS);
  }

  return cleaned;
}
