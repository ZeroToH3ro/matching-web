import type { NextAuthConfig } from 'next-auth'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { parseSerializedSignature } from '@mysten/sui/cryptography'
import { verifyPersonalMessageSignature } from '@mysten/sui/verify'
import { Web3AuthMessage } from '@/lib/Web3AuthMessage'
import Credentials from 'next-auth/providers/credentials'
import { loginSchema } from './lib/schemas/LoginSchema'
// import { getOrCreateUserByWalletAddress } from './app/actions/authActions'
import type { User } from 'next-auth'
import { PrismaClient } from '@prisma/client'

const SUI_NETWORK = process.env.SUI_NETWORK as 'testnet' | 'mainnet'
const prisma = new PrismaClient()

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

          // Verify signature
          const signatureScheme = parseSerializedSignature(signature)
          console.log('» signatureScheme:', signatureScheme)

          const useZkLogin = signatureScheme.signatureScheme === 'ZkLogin'
          const result = await verifyPersonalMessageSignature(
            new TextEncoder().encode(message),
            signature,
            {
              address: authMsg.walletAddress,
              client: useZkLogin
                ? new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) })
                : undefined,
            }
          )
          console.log('» Verification result:', result)
          if (!result) {
            console.log('⚠️ Signature verification failed')
            return null
          }
          const user = await prisma.user.upsert({
            where: { id: authMsg.walletAddress },
            update: {},
            create: { id: authMsg.walletAddress },
          })
          console.log("Upsert user successfully");
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
