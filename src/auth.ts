import NextAuth, { type NextAuthResult } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { Role } from '@prisma/client'
import authConfig from './configs/authConfig'
import { prisma } from '@/lib/prisma'

const result = NextAuth({
  callbacks: {
    async jwt({ user, token, trigger, session }) {
      if (user) {
        token.profileComplete = user.profileComplete
        token.role = user.role
      }
      // When session is updated, fetch latest data from database
      if (trigger === 'update') {
        if (session?.profileComplete !== undefined) {
          token.profileComplete = session.profileComplete
        }
        if (session?.role !== undefined) {
          token.role = session.role
        }
        // Also fetch from DB to be sure
        if (token.sub) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { profileComplete: true, role: true }
          })
          if (dbUser) {
            token.profileComplete = dbUser.profileComplete
            token.role = dbUser.role
          }
        }
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
