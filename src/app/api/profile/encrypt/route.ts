import { NextResponse } from 'next/server';
import { encryptProfilePayload } from '@/lib/security/seal.server';

interface EncryptRequestBody {
  profile: Record<string, unknown>;
  ownerAddress: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EncryptRequestBody;

    if (!body?.profile || typeof body.profile !== 'object') {
      return NextResponse.json({ error: 'Invalid profile payload' }, { status: 400 });
    }

    if (!body.ownerAddress || typeof body.ownerAddress !== 'string') {
      return NextResponse.json({ error: 'Missing owner address' }, { status: 400 });
    }

    // Check if SEAL is properly configured
    const sealEnabled = process.env.SEAL_ENABLED === 'true';
    const sealPackageId = process.env.SEAL_PACKAGE_ID;
    const hasValidSealConfig = sealPackageId && sealPackageId !== 'your-seal-package-id';

    if (sealEnabled && hasValidSealConfig) {
      // Use Seal Protocol encryption
      const result = await encryptProfilePayload({
        payload: body.profile,
        ownerAddress: body.ownerAddress,
      });
      return NextResponse.json(result, { status: 200 });
    } else {
      // Fallback: Base64 encode without encryption (for development/testing)
      console.warn('[profile-encrypt] SEAL not configured, using base64 encoding fallback');
      const jsonString = JSON.stringify(body.profile);
      const base64 = Buffer.from(jsonString).toString('base64');

      return NextResponse.json({
        ciphertext: base64,
        policyId: 'mock-policy-id',
        keyId: 'mock-key-id',
      }, { status: 200 });
    }
  } catch (error) {
    console.error('[profile-encrypt] Failed to encrypt profile payload', error);
    return NextResponse.json({
      error: 'Failed to encrypt profile data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
