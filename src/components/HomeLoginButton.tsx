'use client'

import { Button, Modal, ModalContent, ModalHeader, ModalBody } from '@nextui-org/react'
import { useCurrentAccount, useCurrentWallet, useSignPersonalMessage, ConnectButton } from '@mysten/dapp-kit'
import { getCsrfToken, useSession } from 'next-auth/react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { Web3AuthMessage } from '@/lib/Web3AuthMessage'
import { signInUser } from '@/app/actions/authActions'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { useAccount, useSignMessage } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useWeb3ModalContext } from '@/contexts/Web3ModalContext'

export default function HomeLoginButton() {
  const { initialized: web3ModalInitialized } = useWeb3ModalContext()

  // Don't render until Web3Modal is ready
  if (!web3ModalInitialized) {
    return (
      <Button
        isDisabled
        className="bg-white text-pink-500 border-2 border-pink-500 text-xl px-12 py-8 rounded-full opacity-50"
      >
        Loading...
      </Button>
    )
  }

  return <HomeLoginButtonInner />
}

function HomeLoginButtonInner() {
  // Sui wallet hooks
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  const { mutate: signPersonalMessage } = useSignPersonalMessage()

  // EVM wallet hooks
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount()
  const { signMessageAsync: signEvmMessage } = useSignMessage()
  const { open: openEvmModal } = useWeb3Modal()

  // Shared hooks
  const { update: updateSession, data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const connectButtonRef = useRef<HTMLDivElement>(null)

  // Track if connection was triggered by user action (not auto-reconnect)
  const userTriggeredConnection = useRef(false)
  const hasAttemptedSignIn = useRef(false)

  // Track initial connection state to detect auto-reconnect
  const initialConnectionChecked = useRef(false)

  // Detect iframe context
  const [isInIframe, setIsInIframe] = useState(false)

  useEffect(() => {
    setIsInIframe(typeof window !== 'undefined' && window.self !== window.top)
  }, [])

  useEffect(() => {
    // Mark initial state as checked after first render
    if (!initialConnectionChecked.current) {
      initialConnectionChecked.current = true
      // If wallet is already connected on first render, it's an auto-reconnect
      if (currentAccount || isEvmConnected) {
        console.log('🔄 Wallet auto-reconnected on page load - skipping auto sign-in')
      }
    }
  }, [])

  // Reset flags when wallet disconnects
  useEffect(() => {
    if (!currentAccount && !isEvmConnected) {
      hasAttemptedSignIn.current = false
      userTriggeredConnection.current = false
    }
  }, [currentAccount, isEvmConnected])

  // Auto sign in when Sui wallet connected (only if triggered by user)
  useEffect(() => {
    if (
      currentAccount &&
      currentWallet &&
      !loading &&
      status === 'unauthenticated' &&
      !hasAttemptedSignIn.current &&
      userTriggeredConnection.current && // Only if user triggered the connection
      initialConnectionChecked.current // Only after initial check
    ) {
      hasAttemptedSignIn.current = true
      handleSuiSignIn()
    }
  }, [currentAccount, currentWallet, status])

  // Auto sign in when EVM wallet connected (only if triggered by user)
  useEffect(() => {
    if (
      isEvmConnected &&
      evmAddress &&
      !loading &&
      status === 'unauthenticated' &&
      !hasAttemptedSignIn.current &&
      userTriggeredConnection.current && // Only if user triggered the connection
      initialConnectionChecked.current // Only after initial check
    ) {
      hasAttemptedSignIn.current = true
      handleEvmSignIn()
    }
  }, [isEvmConnected, evmAddress, status])

  const handleSuiSignIn = useCallback(async () => {
    if (!currentAccount || !currentWallet) return

    setLoading(true)
    setShowWalletModal(false)
    try {
      const address = currentAccount.address
      const nonce = await getCsrfToken()
      const msg = new Web3AuthMessage('Web3 Matching', address, nonce).toString()

      const signature = await new Promise<string | null>(resolve =>
        signPersonalMessage(
          {
            message: new TextEncoder().encode(msg),
            account: currentAccount,
          },
          {
            onSuccess: a => resolve(a.signature),
            onError: () => resolve(null),
          }
        )
      )

      if (!signature) return toast.error('Message signing failed!')

      const signinResult = await signInUser({ message: msg, signature })

      if (signinResult.status === 'error')
        return toast.error(`Login failed! ${signinResult.error}`)

      toast.success('Login successful!')

      // Update session once
      await updateSession()

      // Small delay to ensure session is updated
      await new Promise(resolve => setTimeout(resolve, 300))

      // Redirect and let middleware handle the rest
      window.location.href = '/members'
    } catch (error) {
      console.error('Error signing in:', error)
      toast.error('Login failed')
    } finally {
      setLoading(false)
    }
  }, [currentAccount, currentWallet, signPersonalMessage, updateSession])

  const handleEvmSignIn = useCallback(async () => {
    if (!evmAddress) return

    setLoading(true)
    setShowWalletModal(false)
    try {
      const nonce = await getCsrfToken()
      const msg = new Web3AuthMessage('Web3 Matching', evmAddress, nonce).toString()

      const signature = await signEvmMessage({ message: msg })

      if (!signature) return toast.error('Message signing failed!')

      const signinResult = await signInUser({ message: msg, signature })

      if (signinResult.status === 'error')
        return toast.error(`Login failed! ${signinResult.error}`)

      toast.success('Login successful!')

      // Update session once
      await updateSession()

      // Small delay to ensure session is updated
      await new Promise(resolve => setTimeout(resolve, 300))

      // Redirect and let middleware handle the rest
      window.location.href = '/members'
    } catch (error) {
      console.error('Error signing in:', error)
      toast.error('Login failed')
    } finally {
      setLoading(false)
    }
  }, [evmAddress, signEvmMessage, updateSession])

  const handleLoginClick = () => {
    // Always show wallet selection modal when not authenticated
    if (status === 'unauthenticated') {
      setShowWalletModal(true)
    }
  }

  const handleSuiWalletConnect = () => {
    userTriggeredConnection.current = true // Mark as user-triggered
    const button = connectButtonRef.current?.querySelector('button')
    if (button) {
      button.click()
    }
  }

  const handleEvmWalletConnect = async () => {
    userTriggeredConnection.current = true // Mark as user-triggered

    // Check if running in iframe (Farcaster context)
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top

    if (isInIframe) {
      // In iframe, show message about browser extensions
      toast.info('In Farcaster: Please use a browser extension wallet (MetaMask, Trust Wallet, etc.) or open in new tab', {
        autoClose: 5000
      })
    }

    await openEvmModal()
  }

  return (
    <>
      <Button
        onPress={handleLoginClick}
        isDisabled={loading}
        className="bg-white text-pink-500 border-2 border-pink-500 text-xl px-12 py-8 rounded-full hover:bg-pink-50 transform hover:scale-105 transition-all shadow-lg hover:shadow-xl"
        startContent={
          loading && <AiOutlineLoading3Quarters className="animate-spin" />
        }
      >
        {loading ? 'Signing in...' : 'Login'}
      </Button>

      {/* Wallet Selection Modal */}
      <Modal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        placement="center"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 bg-white">
            Select Wallet Type
          </ModalHeader>
          <ModalBody className="pb-6 bg-white">
            <div className="flex flex-col gap-3">
              {isInIframe && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <p className="font-semibold mb-1">Running in Farcaster</p>
                  <p>Use browser extension wallets (MetaMask, etc.) or open in new tab for full wallet support.</p>
                </div>
              )}
              <Button
                onPress={handleSuiWalletConnect}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-lg py-6"
                size="lg"
              >
                Connect Sui Wallet
              </Button>
              <Button
                onPress={handleEvmWalletConnect}
                className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-lg py-6"
                size="lg"
              >
                Connect EVM Wallet
              </Button>
              {isInIframe && (
                <Button
                  onPress={() => window.open(window.location.href, '_blank')}
                  className="bg-gray-200 text-gray-800 text-lg py-6 border-2 border-gray-300"
                  size="lg"
                  variant="bordered"
                >
                  Open in New Tab
                </Button>
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Hidden ConnectButton for Sui */}
      <div ref={connectButtonRef} className="hidden">
        <ConnectButton />
      </div>
    </>
  )
}
