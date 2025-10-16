import { NextRequest, NextResponse } from 'next/server';
import { enokiClient, getEnokiNetwork, isEnokiEnabled } from '@/lib/enoki/enokiClient';
import { auth } from '@/auth';

export interface SponsorTransactionRequest {
  transactionKindBytes: string; // Base64 encoded transaction bytes
  sender: string; // User's wallet address
  allowedMoveCallTargets?: string[]; // Whitelist of allowed move calls
  allowedAddresses?: string[]; // Whitelist of allowed recipient addresses
}

export interface SponsorTransactionResponse {
  success: boolean;
  bytes?: string; // Base64 encoded sponsored transaction bytes
  digest?: string; // Transaction digest for execution
  error?: string;
}

/**
 * POST /api/enoki/sponsor
 * Sponsor a transaction with Enoki gas sponsorship
 */
export async function POST(req: NextRequest): Promise<NextResponse<SponsorTransactionResponse>> {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if Enoki is enabled
    if (!isEnokiEnabled() || !enokiClient) {
      return NextResponse.json(
        { success: false, error: 'Transaction sponsorship not available' },
        { status: 503 }
      );
    }

    const body: SponsorTransactionRequest = await req.json();

    const { transactionKindBytes, sender, allowedMoveCallTargets, allowedAddresses } = body;

    if (!transactionKindBytes || !sender) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: transactionKindBytes, sender' },
        { status: 400 }
      );
    }

    // Get package ID for default allowed targets
    const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID;
    if (!packageId) {
      return NextResponse.json(
        { success: false, error: 'Smart contract package not configured' },
        { status: 500 }
      );
    }

    // Default allowed move call targets (your app's smart contract functions)
    const defaultAllowedTargets = [
      `${packageId}::core::create_profile`,
      `${packageId}::core::update_profile`,
      `${packageId}::core::update_match_status`,
      `${packageId}::core::send_gift`,
      `${packageId}::discovery::create_discovery_session`,
      `${packageId}::discovery::record_swipe`,
      `${packageId}::discovery::suggest_random_match`,
      `${packageId}::discovery::refresh_discovery_queue`,
      `${packageId}::chat::send_message_entry`,
      `${packageId}::seal_policies::create_match_allowlist_shared`,
      `${packageId}::seal_policies::seal_approve_match`,
      `0x2::kiosk::set_owner_custom`,
      `0x2::coin::split`,
      `0x2::pay::split`,
    ];

    // Merge custom and default allowed targets
    const finalAllowedTargets = allowedMoveCallTargets
      ? [...new Set([...defaultAllowedTargets, ...allowedMoveCallTargets])]
      : defaultAllowedTargets;

    console.log('[Enoki] Sponsoring transaction for:', {
      sender,
      network: getEnokiNetwork(),
      allowedTargets: finalAllowedTargets.length,
    });

    // Sponsor the transaction
    const sponsored = await enokiClient.createSponsoredTransaction({
      network: getEnokiNetwork(),
      transactionKindBytes,
      sender,
      allowedMoveCallTargets: finalAllowedTargets,
      allowedAddresses: allowedAddresses || [],
    });

    console.log('[Enoki] Transaction sponsored successfully:', {
      digest: sponsored.digest,
      bytesLength: sponsored.bytes.length,
    });

    return NextResponse.json({
      success: true,
      bytes: sponsored.bytes,
      digest: sponsored.digest,
    });
  } catch (error: any) {
    console.error('[Enoki] Sponsorship error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sponsor transaction',
      },
      { status: 500 }
    );
  }
}
