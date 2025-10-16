/**
 * Check if an address is an EVM wallet address
 * EVM addresses: 0x + 40 hex characters = 42 characters total
 * Sui addresses: Base58 or longer hex format
 */
export function isEvmAddress(address: string): boolean {
  if (!address) return false

  // EVM address format: 0x followed by exactly 40 hex characters
  const evmAddressRegex = /^0x[0-9a-fA-F]{40}$/
  return evmAddressRegex.test(address)
}

/**
 * Get wallet type from address
 */
export function getWalletType(address: string): 'evm' | 'sui' | 'unknown' {
  if (!address) return 'unknown'

  if (isEvmAddress(address)) {
    return 'evm'
  }

  // Assume Sui if not EVM
  // Sui addresses can be in various formats
  return 'sui'
}
