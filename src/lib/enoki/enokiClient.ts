/**
 * Enoki Client for Transaction Sponsorship
 * Server-side only - handles gas sponsorship for all on-chain transactions
 */

import { EnokiClient } from '@mysten/enoki';

if (!process.env.ENOKI_SECRET_KEY) {
  console.warn('[Enoki] ENOKI_SECRET_KEY not configured - transaction sponsorship disabled');
}

/**
 * Server-side Enoki client for sponsoring transactions
 * This MUST be initialized with a PRIVATE API key from the Enoki Portal
 */
export const enokiClient = process.env.ENOKI_SECRET_KEY
  ? new EnokiClient({
      apiKey: process.env.ENOKI_SECRET_KEY,
    })
  : null;

/**
 * Get the network for Enoki operations
 */
export function getEnokiNetwork(): 'mainnet' | 'testnet' {
  const network = process.env.SUI_NETWORK || 'testnet';
  return network as 'mainnet' | 'testnet';
}

/**
 * Check if Enoki sponsorship is enabled
 */
export function isEnokiEnabled(): boolean {
  return !!enokiClient;
}

/**
 * Validate Enoki configuration
 */
export function validateEnokiConfig(): { valid: boolean; error?: string } {
  if (!process.env.ENOKI_SECRET_KEY) {
    return { valid: false, error: 'ENOKI_SECRET_KEY not configured' };
  }

  const network = getEnokiNetwork();
  if (!['mainnet', 'testnet'].includes(network)) {
    return { valid: false, error: `Invalid SUI_NETWORK: ${network}` };
  }

  return { valid: true };
}
