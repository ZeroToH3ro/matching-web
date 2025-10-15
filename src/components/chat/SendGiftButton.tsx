'use client'

import React, { useState } from 'react'
import { Button, Tooltip } from '@nextui-org/react'
import { Gift } from 'lucide-react'
import SendGiftModal from './SendGiftModal'

interface SendGiftButtonProps {
  recipientAddress: string
  recipientName?: string
  chatRoomId?: string | null
  profileId?: string | null
  variant?: 'icon' | 'button'
  size?: 'sm' | 'md' | 'lg'
}

export default function SendGiftButton({
  recipientAddress,
  recipientName,
  chatRoomId,
  profileId,
  variant = 'icon',
  size = 'md',
}: SendGiftButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip content="Send Gift" placement="top">
          <Button
            isIconOnly
            size={size}
            variant="light"
            color="secondary"
            onPress={() => setIsModalOpen(true)}
            className="hover:bg-pink-100 dark:hover:bg-pink-900/30"
          >
            <Gift className="w-5 h-5" />
          </Button>
        </Tooltip>
      ) : (
        <Button
          size={size}
          variant="flat"
          color="secondary"
          startContent={<Gift className="w-4 h-4" />}
          onPress={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white"
        >
          Send Gift
        </Button>
      )}

      <SendGiftModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        recipientAddress={recipientAddress}
        recipientName={recipientName}
        chatRoomId={chatRoomId}
        profileId={profileId}
      />
    </>
  )
}
