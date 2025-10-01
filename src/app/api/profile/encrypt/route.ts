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

    const result = await encryptProfilePayload({
      payload: body.profile,
      ownerAddress: body.ownerAddress,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[profile-encrypt] Failed to encrypt profile payload', error);
    return NextResponse.json({ error: 'Failed to encrypt profile data' }, { status: 500 });
  }
}
