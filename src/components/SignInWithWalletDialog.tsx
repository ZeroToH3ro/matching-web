'use client'

import {
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignPersonalMessage,
} from '@mysten/dapp-kit'
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from '@nextui-org/react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'
import { useDialogsStore } from '@/store/dialogs.store'
import { signInUser, signOutUser } from '@/app/actions/authActions'
import { getCsrfToken } from 'next-auth/react'
import { Web3AuthMessage } from '@/lib/Web3AuthMessage'

export function SignInWithWalletDialog() {
  const { walletLoginOpen: open, setWalletLoginOpen } = useDialogsStore()
  const [loading, setLoading] = useState(false)
  const { mutate: disconnectWallet } = useDisconnectWallet()
  const { mutate: signPersonalMessage } = useSignPersonalMessage()
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()

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
      if (signinResult.status === 'error')
        return toast.error(`Login failed! ${signinResult.error}`)
      // Success

      toast.success('Login successful!')
      setWalletLoginOpen(false)
    } finally {
      setLoading(false)
    }
  }, [currentAccount, currentWallet, signPersonalMessage])

  const handleLogout = useCallback(() => {
    signOutUser()
    disconnectWallet()
  }, [disconnectWallet])

  return (
    <Modal
      isOpen={open}
      onOpenChange={setWalletLoginOpen}
      hideCloseButton={true}
      isDismissable={false}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 text-center">
          <h3 className="text-xl font-semibold">Sign in</h3>
          <p className="text-default-500 text-sm">
            Please sign the message request
            <br />
            in your wallet to continue
          </p>
        </ModalHeader>
        <ModalBody className="pb-6">
          {/* TODO: Add logo here */}

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

            <Button
              onPress={handleLogout}
              variant="ghost"
              className="w-full"
              size="lg"
            >
              Logout / Switch Wallet
            </Button>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
