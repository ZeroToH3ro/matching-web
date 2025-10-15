'use client'

import React, { useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Tabs,
  Tab,
} from '@nextui-org/react'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { toast } from 'react-toastify'
import { Gift, Coins, Image as ImageIcon } from 'lucide-react'
import { CONTRACT_IDS } from '@/lib/blockchain/contractQueries'

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!

interface SendGiftModalProps {
  isOpen: boolean
  onClose: () => void
  recipientAddress: string
  recipientName?: string
  chatRoomId?: string | null
  profileId?: string | null
}

// Gift types from the Move contract
const GIFT_TYPES = [
  { value: '0', label: 'Virtual Rose', emoji: '🌹' },
  { value: '1', label: 'Diamond', emoji: '💎' },
  { value: '2', label: 'Chocolate Box', emoji: '🍫' },
  { value: '3', label: 'Star', emoji: '⭐' },
  { value: '4', label: 'Bouquet', emoji: '💐' },
  { value: '5', label: 'Mystery Gift', emoji: '🎁' },
]

export default function SendGiftModal({
  isOpen,
  onClose,
  recipientAddress,
  recipientName,
  chatRoomId,
  profileId,
}: SendGiftModalProps) {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()

  const [selectedTab, setSelectedTab] = useState<'virtual' | 'sui'>('virtual')
  const [giftType, setGiftType] = useState('0')
  const [amount, setAmount] = useState('1')
  const [message, setMessage] = useState('')
  const [suiAmount, setSuiAmount] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSendVirtualGift = async () => {
    if (!account?.address || !profileId) {
      toast.error('Please connect your wallet and ensure you have a profile')
      return
    }

    setIsSending(true)

    try {
      const tx = new Transaction()

      // Call send_gift function to create DigitalGift
      const giftObj = tx.moveCall({
        target: `${PACKAGE_ID}::core::send_gift`,
        arguments: [
          tx.object(profileId), // from_profile
          tx.pure.address(recipientAddress), // recipient
          tx.pure.u8(parseInt(giftType)), // gift_type
          tx.pure.u64(parseInt(amount)), // amount
          tx.pure.string(message || 'A gift for you! 💝'), // message
          tx.pure.option('string', null), // sui_ns_name (optional)
          tx.object('0x6'), // Clock
        ],
      })

      // If we have a chat room, send it as a message in chat
      if (chatRoomId) {
        tx.transferObjects([giftObj], tx.pure.address(recipientAddress))
      } else {
        // Direct gift transfer
        tx.transferObjects([giftObj], tx.pure.address(recipientAddress))
      }

      // Execute transaction
      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: async result => {
              console.log('[SendGift] Transaction successful:', result)
              toast.success(`🎁 Gift sent to ${recipientName || 'user'}!`)
              setMessage('')
              onClose()
              resolve()
            },
            onError: error => {
              console.error('[SendGift] Transaction error:', error)
              toast.error('Failed to send gift')
              reject(error)
            },
          }
        )
      })
    } catch (error: any) {
      console.error('[SendGift] Error:', error)
      toast.error(error.message || 'Failed to send gift')
    } finally {
      setIsSending(false)
    }
  }

  const handleSendSuiCoins = async () => {
    if (!account?.address) {
      toast.error('Please connect your wallet')
      return
    }

    if (!suiAmount || parseFloat(suiAmount) <= 0) {
      toast.error('Please enter a valid SUI amount')
      return
    }

    setIsSending(true)

    try {
      const tx = new Transaction()

      // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
      const amountInMist = Math.floor(parseFloat(suiAmount) * 1_000_000_000)

      // Split coin for exact amount
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)])

      // Transfer to recipient
      tx.transferObjects([coin], tx.pure.address(recipientAddress))

      // Execute transaction
      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: async result => {
              console.log('[SendSUI] Transaction successful:', result)
              toast.success(
                `💰 Sent ${suiAmount} SUI to ${recipientName || 'user'}!`
              )
              setSuiAmount('')
              setMessage('')
              onClose()
              resolve()
            },
            onError: error => {
              console.error('[SendSUI] Transaction error:', error)
              toast.error('Failed to send SUI')
              reject(error)
            },
          }
        )
      })
    } catch (error: any) {
      console.error('[SendSUI] Error:', error)
      toast.error(error.message || 'Failed to send SUI')
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = () => {
    if (selectedTab === 'virtual') {
      handleSendVirtualGift()
    } else {
      handleSendSuiCoins()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-gradient-to-br from-pink-50 to-purple-50 dark:from-gray-900 dark:to-gray-800',
      }}
    >
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Gift className="w-6 h-6 text-pink-500" />
                <span>Send Gift to {recipientName || 'User'}</span>
              </div>
              <p className="text-sm text-gray-500 font-normal">
                Show your appreciation with a gift!
              </p>
            </ModalHeader>
            <ModalBody>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={key =>
                  setSelectedTab(key as 'virtual' | 'sui')
                }
                color="secondary"
                variant="bordered"
                fullWidth
              >
                <Tab
                  key="virtual"
                  title={
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                    </div>
                  }
                >
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">
                        Select Gift Type
                      </label>
                      <Select
                        placeholder="Choose a gift"
                        selectedKeys={[giftType]}
                        onChange={e => setGiftType(e.target.value)}
                        aria-label="Select Gift Type"
                        classNames={{
                          value: 'text-foreground',
                          listboxWrapper: 'max-h-[400px]',
                          popoverContent: 'bg-white dark:bg-gray-800',
                        }}
                        renderValue={items => {
                          return items.map(item => {
                            const gift = GIFT_TYPES.find(
                              g => g.value === item.key
                            )
                            return (
                              <div
                                key={item.key}
                                className="flex items-center gap-2"
                              >
                                <span>{gift?.emoji}</span>
                                <span>{gift?.label}</span>
                              </div>
                            )
                          })
                        }}
                      >
                        {GIFT_TYPES.map(gift => (
                          <SelectItem
                            key={gift.value}
                            value={gift.value}
                            startContent={
                              <span className="text-xl">{gift.emoji}</span>
                            }
                          >
                            {gift.label}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">
                        Quantity
                      </label>
                      <Input
                        type="number"
                        placeholder="1"
                        value={amount}
                        onValueChange={setAmount}
                        min="1"
                        max="100"
                        description="How many gifts to send (1-100)"
                        aria-label="Quantity"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">
                        Personal Message
                      </label>
                      <Textarea
                        value={message}
                        onValueChange={setMessage}
                        minRows={3}
                        maxRows={5}
                        description="Optional: Include a personal note"
                      />
                    </div>
                  </div>
                </Tab>

                <Tab
                  key="sui"
                  title={
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      <span>SUI Coins</span>
                    </div>
                  }
                >
                  <div className="flex flex-col gap-4 py-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        💡 Send SUI cryptocurrency directly to this user's
                        wallet
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-foreground">
                        Amount (SUI)
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={suiAmount}
                        onValueChange={setSuiAmount}
                        step="0.01"
                        min="0.01"
                        description="Enter the amount of SUI to send"
                      />
                    </div>
                    <div className="flex flex-col gap-4 py-4">
                      <label className="text-sm font-medium text-foreground">
                        Note (Optional)
                      </label>
                      <Textarea
                        placeholder="Add a note for this transaction..."
                        value={message}
                        onValueChange={setMessage}
                        minRows={2}
                        maxRows={4}
                        description="This note is for your reference only"
                      />
                    </div>

                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        ⚠️ Double-check the recipient address. Cryptocurrency
                        transactions cannot be reversed.
                      </p>
                    </div>
                  </div>
                </Tab>
              </Tabs>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="secondary"
                onPress={handleSend}
                isLoading={isSending}
                isDisabled={
                  isSending ||
                  (selectedTab === 'virtual' && (!giftType || !amount)) ||
                  (selectedTab === 'sui' &&
                    (!suiAmount || parseFloat(suiAmount) <= 0))
                }
                className="bg-gradient-to-r from-pink-500 to-purple-600"
              >
                {isSending
                  ? 'Sending...'
                  : selectedTab === 'virtual'
                  ? '🎁 Send Gift'
                  : '💰 Send SUI'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
