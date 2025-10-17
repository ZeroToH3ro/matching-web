'use client'

import { getUnreadMessageCount } from '@/app/actions/messageActions'
import useMessageStore from '@/hooks/useMessageStore'
import { useNotificationChannel } from '@/hooks/useNotificationChannel'
import { usePresenceChannel } from '@/hooks/usePresenceChannel'
import { NextUIProvider } from '@nextui-org/react'
import React, { type ReactNode, useCallback, useEffect, useRef } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import { networkConfig } from '@/configs/networkConfig'
import { RegisterEnokiWallets } from '@/providers/RegisterEnokiWallets'
import { WalrusClientProvider } from '@/providers/WalrusClientContext'
import { CurrentUserProvider } from '@/contexts/CurrentUserContext'
import { Web3ModalProvider as Web3ModalContextProvider } from '@/contexts/Web3ModalContext'
import { SignInWithWalletDialog } from './SignInWithWalletDialog'
import AuthStateSync from './AuthStateSync'
import dynamic from 'next/dynamic'

// Load Web3ModalProvider only on client-side to avoid SSR issues with indexedDB
const Web3ModalProvider = dynamic(() => import('@/context'), {
  ssr: false,
})

const preferredWallets = ['Enoki Google']
const queryClient = new QueryClient()

interface Props {
  children: ReactNode
  userId: string | null
  profileComplete: boolean
  suiNetwork: 'mainnet' | 'testnet'
  googleClientId: string
  enokiApiKey: string
  redirectUrl: string
}

export default function Providers({
  children,
  userId,
  profileComplete,
  suiNetwork,
  googleClientId,
  enokiApiKey,
  redirectUrl,
}: Props) {
  const isUnreadCountSet = useRef(false)
  const { updateUnreadCount } = useMessageStore(state => ({
    updateUnreadCount: state.updateUnreadCount,
  }))

  const setUnreadCount = useCallback(
    (amount: number) => {
      updateUnreadCount(amount)
    },
    [updateUnreadCount]
  )

  useEffect(() => {
    if (!isUnreadCountSet.current && userId) {
      // Delay to avoid blocking initial page load
      const timeoutId = setTimeout(() => {
        getUnreadMessageCount().then(count => {
          setUnreadCount(count)
        })
      }, 1000)
      isUnreadCountSet.current = true
      return () => clearTimeout(timeoutId)
    }
  }, [setUnreadCount, userId])
  usePresenceChannel(userId, profileComplete)
  useNotificationChannel(userId, profileComplete)
  return (
    <SessionProvider>
      <AuthStateSync />
      <QueryClientProvider client={queryClient}>
        <Web3ModalProvider>
          <Web3ModalContextProvider>
            <NextUIProvider>
              <ToastContainer
                position="bottom-right"
                hideProgressBar
                autoClose={5000}
                newestOnTop={true}
                closeOnClick={true}
                rtl={false}
                pauseOnFocusLoss={false}
                draggable={true}
                pauseOnHover={true}
                style={{ zIndex: 9999999 }}
                toastStyle={{ zIndex: 9999999 }}
                className="!z-[9999999]"
                toastClassName="!z-[9999999]"
              />
              <CurrentUserProvider>
                <SuiClientProvider
                  networks={networkConfig}
                  defaultNetwork={suiNetwork}
                >
                  <RegisterEnokiWallets
                    googleClientId={googleClientId}
                    enokiApiKey={enokiApiKey}
                    redirectUrl={redirectUrl}
                  />
                  <WalrusClientProvider>
                    <WalletProvider autoConnect preferredWallets={preferredWallets}>
                      <SignInWithWalletDialog />
                      {children}
                    </WalletProvider>
                  </WalrusClientProvider>
                </SuiClientProvider>
              </CurrentUserProvider>
            </NextUIProvider>
          </Web3ModalContextProvider>
        </Web3ModalProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
