'use client'

import { WagmiProvider } from 'wagmi'
import type { State } from 'wagmi'
import { wagmiConfig } from '@/configs/wagmiConfig'
import type { ReactNode } from 'react'
import { Web3ModalProvider } from '@/contexts/Web3ModalContext'

export function EVMWeb3Provider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <Web3ModalProvider>
        {children}
      </Web3ModalProvider>
    </WagmiProvider>
  )
}
