import NextAuth, { type NextAuthResult } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient, Role } from '@prisma/client'
import authConfig from './auth.config'

const prisma = new PrismaClient()

const result = NextAuth({
  callbacks: {
    async jwt({ user, token }) {
      if (user) {
        token.profileComplete = user.profileComplete
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.userId = token.sub
        session.user = {
          ...session.user,
          id: token.sub,
          profileComplete: token.profileComplete as boolean,
          role: token.role as Role,
        }
      }
      return session
    },
  },
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  ...authConfig,
})

export const handlers: NextAuthResult['handlers'] = result.handlers
export const auth: NextAuthResult['auth'] = result.auth
export const signIn: NextAuthResult['signIn'] = result.signIn
export const signOut: NextAuthResult['signOut'] = result.signOut
