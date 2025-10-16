'use client'

import { useState, useCallback } from 'react'
import { Transaction } from '@mysten/sui/transactions'
import {
  useCurrentAccount,
  useSignTransaction,
  useSuiClient,
} from '@mysten/dapp-kit'
import { fromB64, toB64 } from '@mysten/sui/utils'
import { toast } from 'react-toastify'

export interface UseSponsoredTransactionOptions {
  onSuccess?: (digest: string) => void
  onError?: (error: Error) => void
  showToasts?: boolean
}

export interface SponsoredTransactionResult {
  success: boolean
  digest?: string
  error?: string
}

export function useSponsoredTransaction(
  options: UseSponsoredTransactionOptions = {}
) {
  const { onSuccess, onError, showToasts = false } = options

  const [isLoading, setIsLoading] = useState(false)
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutateAsync: signTransaction } = useSignTransaction()

  /**
   * Execute a transaction with Enoki sponsorship
   */
  const executeSponsored = useCallback(
    async (
      transaction: Transaction,
      sponsorOptions?: {
        allowedMoveCallTargets?: string[]
        allowedAddresses?: string[]
      }
    ): Promise<SponsoredTransactionResult> => {
      if (!account?.address) {
        const error = new Error('Wallet not connected')
        if (showToasts) toast.error('Please connect your wallet')
        onError?.(error)
        return { success: false, error: error.message }
      }

      setIsLoading(true)

      try {
        // Step 1: Build transaction bytes (only transaction kind, no gas/sponsor info)
        const txBytes = await transaction.build({
          client,
          onlyTransactionKind: true,
        })

        console.log('[SponsoredTx] Built transaction bytes:', txBytes.length)

        // Step 2: Request sponsorship from backend
        const sponsorResponse = await fetch('/api/enoki/sponsor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionKindBytes: toB64(txBytes),
            sender: account.address,
            allowedMoveCallTargets: sponsorOptions?.allowedMoveCallTargets,
            allowedAddresses: sponsorOptions?.allowedAddresses,
          }),
        })

        if (!sponsorResponse.ok) {
          const errorData = await sponsorResponse.json()
          throw new Error(errorData.error || 'Failed to sponsor transaction')
        }

        const sponsored = await sponsorResponse.json()

        if (!sponsored.success || !sponsored.bytes || !sponsored.digest) {
          throw new Error('Invalid sponsorship response')
        }

        console.log('[SponsoredTx] Transaction sponsored:', {
          digest: sponsored.digest.substring(0, 10) + '...',
        })

        // Step 3: Sign the sponsored transaction bytes
        // Create a new Transaction from the sponsored bytes
        const sponsoredTx = Transaction.from(sponsored.bytes)
        
        const signResult = await signTransaction({
          transaction: sponsoredTx,
        })

        if (!signResult.signature) {
          throw new Error('Failed to sign transaction')
        }

        console.log('[SponsoredTx] Transaction signed by user')

        // Step 4: Execute the sponsored transaction
        const executeResponse = await fetch('/api/enoki/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            digest: sponsored.digest,
            signature: signResult.signature,
          }),
        })

        if (!executeResponse.ok) {
          const errorData = await executeResponse.json()
          throw new Error(errorData.error || 'Failed to execute transaction')
        }

        const executeResult = await executeResponse.json()

        if (!executeResult.success || !executeResult.digest) {
          throw new Error('Transaction execution failed')
        }

        console.log('[SponsoredTx] Transaction executed:', executeResult.digest)

        if (showToasts) {
          toast.success('Transaction completed successfully! ⚡️')
        }

        onSuccess?.(executeResult.digest)

        return {
          success: true,
          digest: executeResult.digest,
        }
      } catch (error: any) {
        console.error('[SponsoredTx] Error:', error)

        if (showToasts) {
          toast.error(error.message || 'Transaction failed')
        }

        onError?.(error)

        return {
          success: false,
          error: error.message || 'Transaction failed',
        }
      } finally {
        setIsLoading(false)
      }
    },
    [account?.address, client, signTransaction, onSuccess, onError, showToasts]
  )

  /**
   * Check if sponsorship is available (wallet connected)
   */
  const isSponsorshipAvailable = !!account?.address

  return {
    executeSponsored,
    isLoading,
    isSponsorshipAvailable,
  }
}
