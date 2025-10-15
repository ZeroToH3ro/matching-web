import { useState, useCallback } from 'react'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { toast } from 'react-toastify'

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!

export interface SendGiftParams {
  profileId: string
  recipientAddress: string
  giftType: number
  amount: number
  message: string
  suiNsName?: string
}

export interface SendSuiParams {
  recipientAddress: string
  amountInSui: number
}

export function useGiftTransaction() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const [isSending, setIsSending] = useState(false)

  /**
   * Send a virtual gift (DigitalGift NFT)
   */
  const sendVirtualGift = useCallback(
    async ({
      profileId,
      recipientAddress,
      giftType,
      amount,
      message,
      suiNsName,
    }: SendGiftParams): Promise<boolean> => {
      if (!account?.address) {
        toast.error('Please connect your wallet')
        return false
      }

      setIsSending(true)

      try {
        const tx = new Transaction()

        // Create DigitalGift object
        const giftObj = tx.moveCall({
          target: `${PACKAGE_ID}::core::send_gift`,
          arguments: [
            tx.object(profileId),
            tx.pure.address(recipientAddress),
            tx.pure.u8(giftType),
            tx.pure.u64(amount),
            tx.pure.string(message || 'A gift for you! 💝'),
            tx.pure.option('string', suiNsName || null),
            tx.object('0x6'), // Clock
          ],
        })

        // Transfer gift to recipient
        tx.transferObjects([giftObj], tx.pure.address(recipientAddress))

        // Execute transaction
        return new Promise((resolve, reject) => {
          signAndExecuteTransaction(
            { transaction: tx },
            {
              onSuccess: result => {
                console.log('[useGiftTransaction] Success:', result)
                toast.success('🎁 Gift sent successfully!')
                resolve(true)
              },
              onError: error => {
                console.error('[useGiftTransaction] Error:', error)
                toast.error('Failed to send gift')
                reject(error)
              },
            }
          )
        })
      } catch (error: any) {
        console.error('[useGiftTransaction] Error:', error)
        toast.error(error.message || 'Failed to send gift')
        return false
      } finally {
        setIsSending(false)
      }
    },
    [account?.address, signAndExecuteTransaction]
  )

  /**
   * Send SUI coins directly
   */
  const sendSuiCoins = useCallback(
    async ({
      recipientAddress,
      amountInSui,
    }: SendSuiParams): Promise<boolean> => {
      if (!account?.address) {
        toast.error('Please connect your wallet')
        return false
      }

      if (amountInSui <= 0) {
        toast.error('Invalid amount')
        return false
      }

      setIsSending(true)

      try {
        const tx = new Transaction()

        // Convert SUI to MIST (1 SUI = 1,000,000,000 MIST)
        const amountInMist = Math.floor(amountInSui * 1_000_000_000)

        // Split coin for exact amount
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)])

        // Transfer to recipient
        tx.transferObjects([coin], tx.pure.address(recipientAddress))

        // Execute transaction
        return new Promise((resolve, reject) => {
          signAndExecuteTransaction(
            { transaction: tx },
            {
              onSuccess: result => {
                console.log('[useGiftTransaction] SUI sent:', result)
                toast.success(`💰 Sent ${amountInSui} SUI successfully!`)
                resolve(true)
              },
              onError: error => {
                console.error('[useGiftTransaction] Error:', error)
                toast.error('Failed to send SUI')
                reject(error)
              },
            }
          )
        })
      } catch (error: any) {
        console.error('[useGiftTransaction] Error:', error)
        toast.error(error.message || 'Failed to send SUI')
        return false
      } finally {
        setIsSending(false)
      }
    },
    [account?.address, signAndExecuteTransaction]
  )

  return {
    sendVirtualGift,
    sendSuiCoins,
    isSending,
  }
}
