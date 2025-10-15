/**
 * Gift Transaction Examples
 * 
 * This file contains practical examples of using the gift transaction features.
 */

import { useGiftTransaction } from '@/hooks/useGiftTransaction'
import { getProfileIdByAddress } from '@/lib/blockchain/contractQueries'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { useState, useEffect } from 'react'

// ===================================================================
// Example 1: Send a Virtual Gift
// ===================================================================

export function Example1_SendVirtualGift() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { sendVirtualGift, isSending } = useGiftTransaction()
  const [profileId, setProfileId] = useState<string | null>(null)

  // Get user's profile ID
  useEffect(() => {
    if (account?.address) {
      getProfileIdByAddress(client, account.address).then(setProfileId)
    }
  }, [account?.address, client])

  const handleSendGift = async () => {
    if (!profileId) {
      alert('Profile not found')
      return
    }

    const success = await sendVirtualGift({
      profileId,
      recipientAddress: '0x123...', // Replace with actual address
      giftType: 0, // Rose
      amount: 5,
      message: 'Thinking of you! 💝',
    })

    if (success) {
      console.log('Gift sent successfully!')
    }
  }

  return (
    <button onClick={handleSendGift} disabled={isSending || !profileId}>
      {isSending ? 'Sending...' : 'Send 5 Roses'}
    </button>
  )
}

// ===================================================================
// Example 2: Send SUI Coins
// ===================================================================

export function Example2_SendSuiCoins() {
  const { sendSuiCoins, isSending } = useGiftTransaction()

  const handleSendSui = async () => {
    const success = await sendSuiCoins({
      recipientAddress: '0x123...', // Replace with actual address
      amountInSui: 1.5, // 1.5 SUI
    })

    if (success) {
      console.log('SUI sent successfully!')
    }
  }

  return (
    <button onClick={handleSendSui} disabled={isSending}>
      {isSending ? 'Sending...' : 'Send 1.5 SUI'}
    </button>
  )
}

// ===================================================================
// Example 3: Send Different Gift Types
// ===================================================================

export function Example3_SendDifferentGifts() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { sendVirtualGift } = useGiftTransaction()
  const [profileId, setProfileId] = useState<string | null>(null)

  useEffect(() => {
    if (account?.address) {
      getProfileIdByAddress(client, account.address).then(setProfileId)
    }
  }, [account?.address, client])

  const sendRose = () => {
    if (!profileId) return
    sendVirtualGift({
      profileId,
      recipientAddress: '0x123...',
      giftType: 0,
      amount: 1,
      message: 'A rose for you 🌹',
    })
  }

  const sendDiamond = () => {
    if (!profileId) return
    sendVirtualGift({
      profileId,
      recipientAddress: '0x123...',
      giftType: 1,
      amount: 1,
      message: 'You shine bright! 💎',
    })
  }

  const sendChocolate = () => {
    if (!profileId) return
    sendVirtualGift({
      profileId,
      recipientAddress: '0x123...',
      giftType: 2,
      amount: 3,
      message: 'Sweet treats! 🍫',
    })
  }

  return (
    <div>
      <button onClick={sendRose}>Send Rose</button>
      <button onClick={sendDiamond}>Send Diamond</button>
      <button onClick={sendChocolate}>Send 3 Chocolates</button>
    </div>
  )
}

// ===================================================================
// Example 4: Send Gift with Form Input
// ===================================================================

export function Example4_SendGiftWithForm() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { sendVirtualGift, isSending } = useGiftTransaction()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    recipientAddress: '',
    giftType: '0',
    amount: '1',
    message: '',
  })

  useEffect(() => {
    if (account?.address) {
      getProfileIdByAddress(client, account.address).then(setProfileId)
    }
  }, [account?.address, client])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileId) return

    await sendVirtualGift({
      profileId,
      recipientAddress: formData.recipientAddress,
      giftType: parseInt(formData.giftType),
      amount: parseInt(formData.amount),
      message: formData.message,
    })

    // Reset form
    setFormData({
      recipientAddress: '',
      giftType: '0',
      amount: '1',
      message: '',
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Recipient Address"
        value={formData.recipientAddress}
        onChange={e =>
          setFormData({ ...formData, recipientAddress: e.target.value })
        }
      />
      <select
        value={formData.giftType}
        onChange={e => setFormData({ ...formData, giftType: e.target.value })}
      >
        <option value="0">🌹 Rose</option>
        <option value="1">💎 Diamond</option>
        <option value="2">🍫 Chocolate</option>
        <option value="3">⭐ Star</option>
        <option value="4">💐 Bouquet</option>
        <option value="5">🎁 Mystery</option>
      </select>
      <input
        type="number"
        placeholder="Quantity"
        value={formData.amount}
        onChange={e => setFormData({ ...formData, amount: e.target.value })}
        min="1"
        max="100"
      />
      <textarea
        placeholder="Personal message"
        value={formData.message}
        onChange={e => setFormData({ ...formData, message: e.target.value })}
      />
      <button type="submit" disabled={isSending || !profileId}>
        {isSending ? 'Sending...' : 'Send Gift'}
      </button>
    </form>
  )
}

// ===================================================================
// Example 5: Send Gift with SuiNS Name
// ===================================================================

export function Example5_SendGiftWithSuiNS() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { sendVirtualGift } = useGiftTransaction()
  const [profileId, setProfileId] = useState<string | null>(null)

  useEffect(() => {
    if (account?.address) {
      getProfileIdByAddress(client, account.address).then(setProfileId)
    }
  }, [account?.address, client])

  const handleSend = async () => {
    if (!profileId) return

    await sendVirtualGift({
      profileId,
      recipientAddress: '0x123...', // This would be resolved from SuiNS
      giftType: 4, // Bouquet
      amount: 10,
      message: 'Happy Birthday! 🎉',
      suiNsName: 'alice.sui', // Optional SuiNS name
    })
  }

  return <button onClick={handleSend}>Send Birthday Gift to alice.sui</button>
}

// ===================================================================
// Example 6: Batch Send Gifts (Multiple Recipients)
// ===================================================================

export function Example6_BatchSendGifts() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { sendVirtualGift, isSending } = useGiftTransaction()
  const [profileId, setProfileId] = useState<string | null>(null)

  useEffect(() => {
    if (account?.address) {
      getProfileIdByAddress(client, account.address).then(setProfileId)
    }
  }, [account?.address, client])

  const recipients = [
    { address: '0x123...', name: 'Alice' },
    { address: '0x456...', name: 'Bob' },
    { address: '0x789...', name: 'Charlie' },
  ]

  const sendToAll = async () => {
    if (!profileId) return

    for (const recipient of recipients) {
      await sendVirtualGift({
        profileId,
        recipientAddress: recipient.address,
        giftType: 3, // Star
        amount: 1,
        message: `A star for ${recipient.name}! ⭐`,
      })

      // Wait a bit between transactions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  return (
    <button onClick={sendToAll} disabled={isSending || !profileId}>
      {isSending ? 'Sending...' : 'Send Stars to All Friends'}
    </button>
  )
}

// ===================================================================
// Example 7: Conditional Gift Sending
// ===================================================================

export function Example7_ConditionalGiftSending() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { sendVirtualGift } = useGiftTransaction()
  const [profileId, setProfileId] = useState<string | null>(null)

  useEffect(() => {
    if (account?.address) {
      getProfileIdByAddress(client, account.address).then(setProfileId)
    }
  }, [account?.address, client])

  const sendBasedOnOccasion = async (occasion: string) => {
    if (!profileId) return

    let giftType = 0
    let message = ''

    switch (occasion) {
      case 'birthday':
        giftType = 5 // Mystery Gift
        message = 'Happy Birthday! 🎂'
        break
      case 'anniversary':
        giftType = 1 // Diamond
        message = 'Happy Anniversary! 💕'
        break
      case 'thankyou':
        giftType = 4 // Bouquet
        message = 'Thank you! 🙏'
        break
      default:
        giftType = 0 // Rose
        message = 'Thinking of you! 💝'
    }

    await sendVirtualGift({
      profileId,
      recipientAddress: '0x123...',
      giftType,
      amount: 1,
      message,
    })
  }

  return (
    <div>
      <button onClick={() => sendBasedOnOccasion('birthday')}>
        Send Birthday Gift
      </button>
      <button onClick={() => sendBasedOnOccasion('anniversary')}>
        Send Anniversary Gift
      </button>
      <button onClick={() => sendBasedOnOccasion('thankyou')}>
        Send Thank You Gift
      </button>
    </div>
  )
}

// ===================================================================
// Example 8: Gift with Error Handling
// ===================================================================

export function Example8_GiftWithErrorHandling() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { sendVirtualGift, isSending } = useGiftTransaction()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (account?.address) {
      getProfileIdByAddress(client, account.address).then(setProfileId)
    }
  }, [account?.address, client])

  const handleSend = async () => {
    setError(null)

    // Validate inputs
    if (!account?.address) {
      setError('Please connect your wallet')
      return
    }

    if (!profileId) {
      setError('Profile not found. Please create a profile first.')
      return
    }

    try {
      const success = await sendVirtualGift({
        profileId,
        recipientAddress: '0x123...',
        giftType: 0,
        amount: 1,
        message: 'A gift for you!',
      })

      if (success) {
        console.log('Gift sent successfully!')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send gift')
      console.error('Error sending gift:', err)
    }
  }

  return (
    <div>
      <button onClick={handleSend} disabled={isSending}>
        {isSending ? 'Sending...' : 'Send Gift'}
      </button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  )
}

// ===================================================================
// Example 9: Simple SUI Transfer with Validation
// ===================================================================

export function Example9_ValidatedSuiTransfer() {
  const account = useCurrentAccount()
  const { sendSuiCoins, isSending } = useGiftTransaction()
  const [amount, setAmount] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')

  const handleSend = async () => {
    // Validate amount
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    // Validate address
    if (!recipientAddress.startsWith('0x')) {
      alert('Please enter a valid Sui address')
      return
    }

    const success = await sendSuiCoins({
      recipientAddress,
      amountInSui: parsedAmount,
    })

    if (success) {
      setAmount('')
      setRecipientAddress('')
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Recipient Address (0x...)"
        value={recipientAddress}
        onChange={e => setRecipientAddress(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount in SUI"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        step="0.01"
      />
      <button onClick={handleSend} disabled={isSending || !account}>
        {isSending ? 'Sending...' : 'Send SUI'}
      </button>
    </div>
  )
}

// ===================================================================
// Gift Type Reference
// ===================================================================

export const GIFT_TYPES = {
  ROSE: 0,
  DIAMOND: 1,
  CHOCOLATE: 2,
  STAR: 3,
  BOUQUET: 4,
  MYSTERY: 5,
} as const

export const GIFT_INFO = [
  { type: 0, emoji: '🌹', name: 'Virtual Rose' },
  { type: 1, emoji: '💎', name: 'Diamond' },
  { type: 2, emoji: '🍫', name: 'Chocolate Box' },
  { type: 3, emoji: '⭐', name: 'Star' },
  { type: 4, emoji: '💐', name: 'Bouquet' },
  { type: 5, emoji: '🎁', name: 'Mystery Gift' },
]
