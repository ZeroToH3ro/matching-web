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

        try {
          const authMsg = Web3AuthMessage.fromString(message)
          let verificationResult = false

          // Try to detect wallet type based on signature format
          const isEvmSignature = signature.startsWith('0x') && signature.length === 132

          if (isEvmSignature) {
            // EVM signature verification
            try {
              const isValid = await verifyMessage({
                address: authMsg.walletAddress as `0x${string}`,
                message,
                signature: signature as `0x${string}`,
              })
              verificationResult = isValid
            } catch (evmError) {
              verificationResult = false
            }
          } else {
            // Sui signature verification
            const signatureScheme = parseSerializedSignature(signature)
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

          if (!verificationResult) {
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
          return user
        } catch (e) {
          return null
        }
      },
    }),
  ],
} satisfies NextAuthConfig
