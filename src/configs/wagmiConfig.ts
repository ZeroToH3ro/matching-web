import { defaultWagmiConfig } from '@web3modal/wagmi'
import { cookieStorage, createStorage } from 'wagmi'
import { mainnet, sepolia, base, baseSepolia } from 'wagmi/chains'

// Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

if (!projectId) {
  console.warn(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. EVM wallet connection will not work. Get your project ID from https://cloud.reown.com'
  )
}

const metadata = {
  name: 'Web3 Matching',
  description: 'Connect with Web3 Matching using your EVM wallet',
  url: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
}

// Create wagmiConfig
export const chains = [mainnet, sepolia, base, baseSepolia] as const

export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
})
