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
        // Detect if running in iframe (Farcaster context)
        const isInIframe = typeof window !== 'undefined' && window.self !== window.top

        createWeb3Modal({
          wagmiConfig,
          projectId,
          enableAnalytics: false, // Disable to reduce external requests
          enableOnramp: false, // Disable to reduce external iframes causing CSP warnings
          themeMode: 'light',
          themeVariables: {
            '--w3m-z-index': 9999
          },
          featuredWalletIds: [
            'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
            '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
            '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
          ],
          // When in iframe, try to open wallet in new window to avoid nested CSP issues
          ...(isInIframe && {
            // Add custom modal configuration for iframe context
            defaultChain: wagmiConfig.chains[0]
          })
        })
        globalModalInitialized = true
        initRef.current = true
        setInitialized(true)
      } catch (error) {
        // Still set initialized to true to prevent blocking
        setInitialized(true)
      }
    } else {
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
