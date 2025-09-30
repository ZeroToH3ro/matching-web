'use client'

import { Button } from '@nextui-org/react'
import { useCurrentAccount, useCurrentWallet, useSignPersonalMessage, ConnectButton } from '@mysten/dapp-kit'
import { getCsrfToken, useSession } from 'next-auth/react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { Web3AuthMessage } from '@/lib/Web3AuthMessage'
import { signInUser } from '@/app/actions/authActions'
import { useAuthStore } from '@/hooks/useAuthStore'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

export default function HomeLoginButton() {
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  const { mutate: signPersonalMessage } = useSignPersonalMessage()
  const { update: updateSession } = useSession()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const connectButtonRef = useRef<HTMLDivElement>(null)

  // Auto sign in when wallet connected
  useEffect(() => {
    if (currentAccount && currentWallet && !loading) {
      handleSignIn()
    }
  }, [currentAccount, currentWallet])

  const handleSignIn = useCallback(async () => {
    if (!currentAccount || !currentWallet) return

    setLoading(true)
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

      // Update session
      await updateSession()
      await new Promise(resolve => setTimeout(resolve, 300))

      // Fetch fresh session
      const response = await fetch('/api/auth/session')
      const session = await response.json()

      // Update Zustand store
      if (session?.user) {
        setAuth(session.user.id, session.user.profileComplete || false)
      }

      // Redirect
      window.location.href = session?.user?.profileComplete ? '/members' : '/complete-profile'
    } catch (error) {
      console.error('Error signing in:', error)
      toast.error('Login failed')
    } finally {
      setLoading(false)
    }
  }, [currentAccount, currentWallet, signPersonalMessage, updateSession, setAuth])

  const handleLoginClick = () => {
    if (!currentAccount) {
      // Trigger hidden ConnectButton
      const button = connectButtonRef.current?.querySelector('button')
      if (button) {
        button.click()
      }
    }
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

      {/* Hidden ConnectButton */}
      <div ref={connectButtonRef} className="hidden">
        <ConnectButton />
      </div>
    </>
  )
}
