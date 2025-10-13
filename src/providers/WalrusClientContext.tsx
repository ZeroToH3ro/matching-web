'use client'

import { useNetworkConfig } from '@/configs/networkConfig'
import { walrusConfig } from '@/configs/walrusConfig'
import { useSuiClient } from '@mysten/dapp-kit'
import type { SuiClient } from '@mysten/sui/client'
import type { WalrusClient } from '@mysten/walrus'
import { createContext, type ReactNode, useEffect, useState } from 'react'

async function createWalrusClient(
  suiClient: SuiClient,
  network: 'mainnet' | 'testnet'
): Promise<WalrusClient | null> {
  if (typeof window === 'undefined') return null

  const { WalrusClient: WalrusClientClass } = await import('@mysten/walrus')

  return new WalrusClientClass({
    network,
    suiClient,
    ...walrusConfig,
  })
}

interface Props {
  children: ReactNode
}

export const WalrusClientContext = createContext<WalrusClient | null>(null)
export const WalrusClientProvider: React.FC<Props> = ({ children }) => {
  const suiClient = useSuiClient()
  const network = useNetworkConfig()
  const [walrusClient, setWalrusClient] = useState<WalrusClient | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      createWalrusClient(suiClient, network.name).then(setWalrusClient)
    }
  }, [suiClient, network.name])

  return (
    <WalrusClientContext.Provider value={walrusClient}>
      {children}
    </WalrusClientContext.Provider>
  )
}
