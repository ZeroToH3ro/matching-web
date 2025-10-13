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
import { SignInWithWalletDialog } from './SignInWithWalletDialog'
import AuthStateSync from './AuthStateSync'

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
      getUnreadMessageCount().then(count => {
        setUnreadCount(count)
      })
      isUnreadCountSet.current = true
    }
  }, [setUnreadCount, userId])
  usePresenceChannel(userId, profileComplete)
  useNotificationChannel(userId, profileComplete)
  return (
    <SessionProvider>
      <AuthStateSync />
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </SessionProvider>
  )
}
