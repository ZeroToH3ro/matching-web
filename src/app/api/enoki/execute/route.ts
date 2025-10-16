import { NextRequest, NextResponse } from 'next/server';
import { enokiClient, isEnokiEnabled } from '@/lib/enoki/enokiClient';
import { auth } from '@/auth';

export interface ExecuteSponsoredTransactionRequest {
  digest: string;
  signature: string;
}

export interface ExecuteSponsoredTransactionResponse {
  success: boolean;
  digest?: string;
  error?: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ExecuteSponsoredTransactionResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isEnokiEnabled() || !enokiClient) {
      return NextResponse.json(
        { success: false, error: 'Transaction sponsorship not available' },
        { status: 503 }
      );
    }

    const body: ExecuteSponsoredTransactionRequest = await req.json();

    const { digest, signature } = body;

    if (!digest || !signature) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: digest, signature' },
        { status: 400 }
      );
    }

    console.log('[Enoki] Executing sponsored transaction:', {
      digest: digest.substring(0, 10) + '...',
      signatureLength: signature.length,
    });

    const result = await enokiClient.executeSponsoredTransaction({
      digest,
      signature,
    });

    console.log('[Enoki] Transaction executed successfully:', {
      digest: result.digest,
    });

    return NextResponse.json({
      success: true,
      digest: result.digest,
    });
  } catch (error: any) {
    console.error('[Enoki] Execution error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute sponsored transaction',
      },
      { status: 500 }
    );
  }
}
