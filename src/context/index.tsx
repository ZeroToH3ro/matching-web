'use client'

import React, { type ReactNode, useEffect, useRef } from 'react'
import { config, projectId } from '@/config'
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type State, WagmiProvider } from 'wagmi'

// Setup queryClient
const queryClient = new QueryClient()

if (!projectId) throw new Error('Project ID is not defined')

interface Web3ModalProviderProps {
  children: ReactNode;
  initialState?: State;
}

export default function Web3ModalProvider({
  children,
  initialState
}: Web3ModalProviderProps) {
  const modalCreated = useRef(false)

  useEffect(() => {
    // Only create modal on client-side to avoid SSR issues with indexedDB
    if (!modalCreated.current && typeof window !== 'undefined' && projectId) {
      createWeb3Modal({
        wagmiConfig: config,
        projectId,
        enableAnalytics: true,
        enableOnramp: true
      })
      modalCreated.current = true
    }
  }, [])

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}