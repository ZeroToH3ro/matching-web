'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardBody, CardHeader, Divider, Input, Code } from '@nextui-org/react'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import SendGiftButton from '@/components/chat/SendGiftButton'
import ReceivedGifts from '@/components/chat/ReceivedGifts'
import { getProfileIdByAddress } from '@/lib/blockchain/contractQueries'
import { Gift, Wallet } from 'lucide-react'

export default function GiftDemoPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const [myProfileId, setMyProfileId] = useState<string | null>(null)
  const [recipientAddress, setRecipientAddress] = useState('')

  useEffect(() => {
    if (account?.address) {
      getProfileIdByAddress(client, account.address).then(setMyProfileId)
    }
  }, [account?.address, client])

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Gift & SUI Transfer Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Send virtual gifts or SUI cryptocurrency on the blockchain
          </p>
        </div>

        {/* Wallet Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Wallet Status</h2>
            </div>
          </CardHeader>
          <CardBody>
            {account?.address ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Connected:</span>
                  <Code size="sm">{account.address.slice(0, 10)}...{account.address.slice(-8)}</Code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Profile ID:</span>
                  <Code size="sm">
                    {myProfileId
                      ? `${myProfileId.slice(0, 10)}...${myProfileId.slice(-8)}`
                      : 'Not found - Create profile first'}
                  </Code>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500">
                Please connect your wallet to continue
              </p>
            )}
          </CardBody>
        </Card>

        {/* Send Gift Demo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-500" />
              <h2 className="text-xl font-semibold">Send Gift</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter a recipient wallet address to send them a gift or SUI coins.
              </p>
              
              <Input
                label="Recipient Wallet Address"
                placeholder="0x..."
                value={recipientAddress}
                onValueChange={setRecipientAddress}
                description="Enter the full Sui wallet address"
                classNames={{
                  input: 'font-mono text-sm',
                }}
              />

              {recipientAddress && account?.address && (
                <div className="flex justify-center pt-4">
                  <SendGiftButton
                    recipientAddress={recipientAddress}
                    recipientName="Demo User"
                    profileId={myProfileId}
                    variant="button"
                    size="lg"
                  />
                </div>
              )}

              {!account?.address && (
                <p className="text-center text-gray-500 py-4">
                  Connect wallet to send gifts
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        <Divider className="my-8" />

        {/* Received Gifts */}
        <ReceivedGifts />

        {/* Developer Info */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardHeader>
            <h3 className="text-lg font-semibold">Developer Information</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Gift Types Available:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { emoji: '🌹', name: 'Virtual Rose', type: 0 },
                    { emoji: '💎', name: 'Diamond', type: 1 },
                    { emoji: '🍫', name: 'Chocolate Box', type: 2 },
                    { emoji: '⭐', name: 'Star', type: 3 },
                    { emoji: '💐', name: 'Bouquet', type: 4 },
                    { emoji: '🎁', name: 'Mystery Gift', type: 5 },
                  ].map(gift => (
                    <div key={gift.type} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded">
                      <span className="text-2xl">{gift.emoji}</span>
                      <span className="text-sm">{gift.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Divider />

              <div>
                <h4 className="font-semibold mb-2">Smart Contract Functions:</h4>
                <div className="space-y-2 text-sm">
                  <Code className="block w-full">
                    core::send_gift(profile, recipient, gift_type, amount, message)
                  </Code>
                  <Code className="block w-full">
                    sui::transfer::public_transfer(coin, recipient)
                  </Code>
                </div>
              </div>

              <Divider />

              <div>
                <h4 className="font-semibold mb-2">Components Used:</h4>
                <ul className="list-disc list-inside text-sm space-y-1 text-gray-600 dark:text-gray-400">
                  <li><Code size="sm">SendGiftModal</Code> - Main gift sending interface</li>
                  <li><Code size="sm">SendGiftButton</Code> - Trigger button component</li>
                  <li><Code size="sm">ReceivedGifts</Code> - Display received gifts</li>
                  <li><Code size="sm">useGiftTransaction</Code> - Transaction hook</li>
                </ul>
              </div>

              <Divider />

              <div>
                <h4 className="font-semibold mb-2">Documentation:</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  See <Code size="sm">/docs/GIFT_FEATURE.md</Code> for complete documentation
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
