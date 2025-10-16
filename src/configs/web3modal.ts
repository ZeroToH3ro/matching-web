import { createWeb3Modal } from '@web3modal/wagmi/react'
import { wagmiConfig, projectId } from './wagmiConfig'

// Create modal once at module initialization
let modalInitialized = false

export function initWeb3Modal() {
  if (!modalInitialized && projectId && typeof window !== 'undefined') {
    createWeb3Modal({
      wagmiConfig,
      projectId,
      enableAnalytics: true,
      enableOnramp: true,
    })
    modalInitialized = true
    console.log('✅ Web3Modal initialized with project ID:', projectId)
  }
}

export function isWeb3ModalInitialized() {
  return modalInitialized
}
