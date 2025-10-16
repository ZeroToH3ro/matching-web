'use client'

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { wagmiConfig, projectId } from '@/configs/wagmiConfig'

const Web3ModalContext = createContext<{ initialized: boolean }>({ initialized: false })

let globalModalInitialized = false

export function Web3ModalProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(globalModalInitialized)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current || globalModalInitialized) {
      setInitialized(true)
      return
    }

    if (projectId) {
      try {
        createWeb3Modal({
          wagmiConfig,
          projectId,
          enableAnalytics: true,
          enableOnramp: true,
        })
        globalModalInitialized = true
        initRef.current = true
        console.log('✅ Web3Modal initialized successfully')
        setInitialized(true)
      } catch (error) {
        console.error('Failed to initialize Web3Modal:', error)
        // Still set initialized to true to prevent blocking
        setInitialized(true)
      }
    } else {
      console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set')
      setInitialized(true)
    }
  }, [])

  // Render children immediately for SSR, modal will init on client
  return (
    <Web3ModalContext.Provider value={{ initialized }}>
      {children}
    </Web3ModalContext.Provider>
  )
}

export function useWeb3ModalContext() {
  return useContext(Web3ModalContext)
}
