import { useNetworkConfig } from '@/configs/networkConfig'
import { useSuiClient } from '@mysten/dapp-kit'
import type { SuiClient } from '@mysten/sui/client'
import { WalrusClient } from '@mysten/walrus'
import { createContext, type ReactNode, useMemo } from 'react'

function createWalrusClient(
  suiClient: SuiClient,
  network: 'mainnet' | 'testnet'
): WalrusClient | null {
  if (typeof window === 'undefined') return null

  return new WalrusClient({
    network,
    suiClient,
    uploadRelay: {
      timeout: 600000,
      host: 'https://upload-relay.testnet.walrus.space',
      sendTip: {
        max: 1000,
      },
    },
  })
}

interface Props {
  children: ReactNode
}

export const WalrusClientContext = createContext<WalrusClient | null>(null)
export const WalrusClientProvider: React.FC<Props> = ({ children }) => {
  const suiClient = useSuiClient()
  const network = useNetworkConfig()
  const walrusClient = useMemo(
    () => createWalrusClient(suiClient, network.name),
    [suiClient, network]
  )

  return (
    <WalrusClientContext.Provider value={walrusClient}>
      {children}
    </WalrusClientContext.Provider>
  )
}
