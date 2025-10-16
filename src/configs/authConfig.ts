import type { NextAuthConfig } from 'next-auth'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { parseSerializedSignature } from '@mysten/sui/cryptography'
import { verifyPersonalMessageSignature } from '@mysten/sui/verify'
import { Web3AuthMessage } from '@/lib/Web3AuthMessage'
import Credentials from 'next-auth/providers/credentials'
import { loginSchema } from '../lib/schemas/LoginSchema'
import type { User } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { verifyMessage } from 'viem'

const SUI_NETWORK = process.env.SUI_NETWORK as 'testnet' | 'mainnet'

export default {
  providers: [
    Credentials({
      name: 'Bug Enoki Wallet',
      credentials: {
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(creds): Promise<User | null> {
        const { success, data } = loginSchema.safeParse(creds)
        if (!success) return null

        const { message, signature } = data

        console.group('verifyAuthMessageAndDeleteNonce')
        try {
          const authMsg = Web3AuthMessage.fromString(message)
          console.log('» appName:', authMsg.appName)
          console.log('» walletAddress:', authMsg.walletAddress)
          console.log('» nonce:', authMsg.nonce)

          let verificationResult = false

          // Try to detect wallet type based on signature format
          const isEvmSignature = signature.startsWith('0x') && signature.length === 132

          if (isEvmSignature) {
            // EVM signature verification
            console.log('» Detected EVM signature')
            try {
              const isValid = await verifyMessage({
                address: authMsg.walletAddress as `0x${string}`,
                message,
                signature: signature as `0x${string}`,
              })
              console.log('» EVM verification result:', isValid)
              verificationResult = isValid
            } catch (evmError) {
              console.error('» EVM verification failed:', evmError)
              verificationResult = false
            }
          } else {
            // Sui signature verification
            console.log('» Detected Sui signature')
            const signatureScheme = parseSerializedSignature(signature)
            console.log('» signatureScheme:', signatureScheme)

            const useZkLogin = signatureScheme.signatureScheme === 'ZkLogin'
            const suiResult = await verifyPersonalMessageSignature(
              new TextEncoder().encode(message),
              signature,
              {
                address: authMsg.walletAddress,
                client: useZkLogin
                  ? new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) })
                  : undefined,
              }
            )
            verificationResult = !!suiResult
          }

          console.log('» Verification result:', verificationResult)
          if (!verificationResult) {
            console.log('⚠️ Signature verification failed')
            return null
          }

          const user = await prisma.user.upsert({
            where: { id: authMsg.walletAddress },
            update: {
              walletAddress: authMsg.walletAddress,
            },
            create: {
              id: authMsg.walletAddress,
              walletAddress: authMsg.walletAddress,
            },
          })
          console.log('Upsert user successfully with wallet address:', authMsg.walletAddress)
          return user
        } catch (e) {
          console.error('🚨 Error verifying message', e)
          return null
        } finally {
          console.groupEnd()
        }
      },
    }),
  ],
} satisfies NextAuthConfig
