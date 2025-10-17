import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'
import { cookieStorage, createStorage } from 'wagmi'
import { defineChain } from 'viem'
import { baseSepolia } from 'viem/chains'
// Get projectId from https://cloud.walletconnect.com
export const projectId: string | undefined = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!projectId) throw new Error('Project ID is not defined')

const metadata = {
  name: 'Web3Modal',
  description: 'Web3Modal Example',
  url: 'https://web3modal.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

// Define U2U Network Mainnet
// export const u2uMainnet = defineChain({
//   id: 39,
//   name: 'U2U Solaris Mainnet',
//   nativeCurrency: {
//     name: 'U2U',
//     symbol: 'U2U',
//     decimals: 18,
//   },
//   rpcUrls: {
//     default: {
//       http: ['https://rpc-mainnet.uniultra.xyz'],
//     },
//   },
//   blockExplorers: {
//     default: {
//       name: 'U2U Scan',
//       url: 'https://u2uscan.xyz',
//     },
//   },
//   testnet: false,
// })

// Create wagmiConfig
const chains = [baseSepolia] as const
export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: false, // Set to false to avoid SSR issues with indexedDB
  storage: createStorage({
    storage: cookieStorage
  }),
})