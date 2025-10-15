'use client'

import React, { useEffect, useState } from 'react'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { Card, CardBody, CardHeader, Button, Chip, Tooltip } from '@nextui-org/react'
import { Gift, Package, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!

interface ReceivedGift {
  id: string
  from: string
  giftType: number
  amount: number
  message: string
  sentAt: string
  claimed: boolean
}

const GIFT_EMOJIS = ['🌹', '💎', '🍫', '⭐', '💐', '🎁']
const GIFT_NAMES = [
  'Virtual Rose',
  'Diamond',
  'Chocolate Box',
  'Star',
  'Bouquet',
  'Mystery Gift',
]

export default function ReceivedGifts() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const [gifts, setGifts] = useState<ReceivedGift[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!account?.address) {
      setIsLoading(false)
      return
    }

    fetchReceivedGifts()
  }, [account?.address])

  const fetchReceivedGifts = async () => {
    if (!account?.address) return

    try {
      setIsLoading(true)

      // Get all DigitalGift objects owned by user
      const ownedGifts = await client.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${PACKAGE_ID}::core::DigitalGift`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      })

      const giftData: ReceivedGift[] = []

      for (const obj of ownedGifts.data) {
        if (
          obj.data?.content &&
          obj.data.content.dataType === 'moveObject'
        ) {
          const fields = obj.data.content.fields as any
          giftData.push({
            id: obj.data.objectId,
            from: fields.from,
            giftType: parseInt(fields.gift_type),
            amount: parseInt(fields.amount),
            message: fields.message,
            sentAt: fields.sent_at,
            claimed: fields.claimed,
          })
        }
      }

      // Sort by most recent first
      giftData.sort((a, b) => parseInt(b.sentAt) - parseInt(a.sentAt))

      setGifts(giftData)
    } catch (error) {
      console.error('[ReceivedGifts] Error fetching gifts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!account?.address) {
    return (
      <Card className="w-full">
        <CardBody className="text-center py-8">
          <p className="text-gray-500">Connect your wallet to view received gifts</p>
        </CardBody>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardBody className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
          <p className="mt-2 text-gray-500">Loading gifts...</p>
        </CardBody>
      </Card>
    )
  }

  if (gifts.length === 0) {
    return (
      <Card className="w-full">
        <CardBody className="text-center py-8">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">No gifts received yet</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Gift className="w-5 h-5 text-pink-500" />
        Received Gifts ({gifts.length})
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gifts.map(gift => (
          <Card
            key={gift.id}
            className="border-2 border-pink-100 dark:border-pink-900"
          >
            <CardHeader className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <span className="text-4xl">
                  {GIFT_EMOJIS[gift.giftType] || '🎁'}
                </span>
                <div>
                  <p className="font-semibold">
                    {GIFT_NAMES[gift.giftType] || 'Gift'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {gift.amount > 1 ? `x${gift.amount}` : ''}
                  </p>
                </div>
              </div>
              {gift.claimed ? (
                <Chip color="success" size="sm" variant="flat">
                  Claimed
                </Chip>
              ) : (
                <Chip color="warning" size="sm" variant="flat">
                  New
                </Chip>
              )}
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {gift.message && (
                  <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg">
                    <p className="text-sm italic">"{gift.message}"</p>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <Tooltip content={gift.from}>
                    <span>From: {gift.from.slice(0, 6)}...{gift.from.slice(-4)}</span>
                  </Tooltip>
                  <span>
                    {formatDistanceToNow(parseInt(gift.sentAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
