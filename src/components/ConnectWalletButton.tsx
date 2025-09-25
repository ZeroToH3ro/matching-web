'use client'

import { ConnectModal } from '@mysten/dapp-kit'
import { useDialogsStore } from '@/store/dialogs.store'
import { Button } from '@nextui-org/react'
import { BiLock } from 'react-icons/bi'

export function ConnectWalletButton({ className }: { className?: string }) {
  const { connectWalletOpen: isOpen, setConnectWalletOpen } = useDialogsStore()

  return (
    <ConnectModal
      open={isOpen}
      onOpenChange={setConnectWalletOpen}
      trigger={
        <Button startContent={<BiLock />} type="button" className={className}>
          Login
        </Button>
      }
    />
  )
}
