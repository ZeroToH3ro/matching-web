import { createNetworkConfig } from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'

const { networkConfig, useNetworkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet'), name: 'testnet' },
  mainnet: { url: getFullnodeUrl('mainnet'), name: 'mainnet' }
})

export { networkConfig, useNetworkConfig }
