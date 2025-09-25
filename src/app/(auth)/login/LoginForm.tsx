'use client'

import { Button, Card, CardBody, CardHeader } from '@nextui-org/react'
import React, { useCallback, useState } from 'react'
import { GiPadlock } from 'react-icons/gi'
import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignPersonalMessage,
} from '@mysten/dapp-kit'
import { getCsrfToken, useSession } from 'next-auth/react'
import { Web3AuthMessage } from '@/lib/Web3AuthMessage'
import { toast } from 'react-toastify'
import { signInUser, signOutUser } from '@/app/actions/authActions'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const walletAccount = useCurrentAccount()
  const { data: sessionData } = useSession()
  const [loading, setLoading] = useState(false)
  const { mutate: disconnectWallet } = useDisconnectWallet()
  const { mutate: signPersonalMessage } = useSignPersonalMessage()
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  const router = useRouter()

  const handleSignInWithWallet = useCallback(async () => {
    if (!currentAccount || !currentWallet) return
    const address = currentAccount.address
    setLoading(true)
    try {
      const nonce = await getCsrfToken()
      const msg = new Web3AuthMessage(
        'Web3 Matching',
        address,
        nonce
      ).toString()
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
      const signinResult = await signInUser({
        message: msg,
        signature,
      })
      console.log('» signinResult:', signinResult)

      if (signinResult.status === 'error')
        return toast.error(`Login failed! ${signinResult.error}`)
      // Success

      toast.success('Login successful!')

      router.push('/complete-profile')
    } finally {
      setLoading(false)
    }
  }, [currentAccount, currentWallet, signPersonalMessage])

  const handleLogout = useCallback(() => {
    signOutUser()
    disconnectWallet()
  }, [signOutUser, disconnectWallet])

  return (
    <Card className="w-3/5 mx-auto">
      <CardHeader className="flex flex-col items-center justify-center">
        <div className="flex flex-col gap-2 items-center text-default">
          <div className="flex flex-row items-center gap-3">
            <GiPadlock size={30} />
            <h1 className="text-3xl font-semibold">Login</h1>
          </div>
          <p className="text-neutral-500">Welcome back to MatchMe!</p>
        </div>
      </CardHeader>
      <CardBody>
        {!walletAccount ? (
          <ConnectButton />
        ) : sessionData?.user.id === walletAccount.address ? (
          <div className="text-center text-lg text-green-600 font-medium">
            You are logged in!
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-center">
            <h3 className="text-xl font-semibold">Sign in</h3>
            <p className="text-default-500 text-sm">
              Please sign the message request
              <br />
              in your wallet to continue
            </p>

            <div className="space-y-3">
              <Button
                onPress={handleSignInWithWallet}
                className="w-full"
                size="lg"
                color="primary"
                isDisabled={loading}
                startContent={
                  loading && (
                    <AiOutlineLoading3Quarters className="animate-spin" />
                  )
                }
              >
                Sign in
              </Button>

              <Button onPress={handleLogout} className="w-full" size="lg">
                Logout / Switch Wallet
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
