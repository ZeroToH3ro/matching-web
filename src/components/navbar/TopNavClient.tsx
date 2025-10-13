'use client'

import Link from 'next/link'
import React, { useEffect } from 'react'
import { GiSelfLove } from 'react-icons/gi'
import NavLink from './NavLink'
import UserMenu from './UserMenu'
import FiltersWrapper from './FiltersWrapper'
import { ConnectWalletButton } from '../ConnectWalletButton'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

type UserInfo = {
  name: string | null
  image: string | null
} | null

interface Props {
  initialUserInfo: UserInfo
  initialRole: 'ADMIN' | 'MEMBER' | null
}

export default function TopNavClient({ initialUserInfo, initialRole }: Props) {
  const { data: session, status } = useSession()
  const { isAuthenticated, userInfo, setUserInfo, clearAuth } = useAuthStore()

  useEffect(() => {
    console.log('TopNavClient session status:', status, 'user:', session?.user)
    // Update userInfo in store when session changes
    if (status === 'authenticated' && session?.user) {
      setUserInfo({
        name: session.user.name || null,
        image: session.user.image || null,
        avatarUrl: null, // Will be fetched by UserMenu
      })
    } else if (status === 'unauthenticated') {
      clearAuth()
    }
  }, [session, status, setUserInfo, clearAuth])

  const memberLinks = [
    { href: '/members', label: 'Matches' },
    { href: '/lists', label: 'Lists' },
    { href: '/messages', label: 'Messages' },
  ]

  const adminLinks = [
    {
      href: '/admin/moderation',
      label: 'Photo Moderation',
    },
  ]

  const role = session?.user?.role || initialRole
  const links = role === 'ADMIN' ? adminLinks : memberLinks
  const isLoggedIn = status === 'authenticated' && (isAuthenticated || !!session?.user)
  const showLinks = isLoggedIn

  console.log('TopNavClient render:', {
    status,
    isAuthenticated,
    isLoggedIn,
    userInfo,
    sessionUser: session?.user,
  })

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-pink-400 via-red-400 to-pink-600 shadow-lg backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-6">
          {/* Brand */}
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 transition-all duration-300 hover:scale-105",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pink-500 rounded-lg"
            )}
          >
            <GiSelfLove size={40} className="text-gray-200 drop-shadow-lg" />
            <span className="text-3xl font-bold text-gray-200 drop-shadow-md">
              MatchMe
            </span>
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {showLinks &&
              links.map(item => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
          </div>

          {/* Right Side - User Menu or Connect Button */}
          <div className="flex items-center">
            {isLoggedIn && userInfo ? (
              <UserMenu userInfo={userInfo} />
            ) : (
              <></>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {showLinks && (
          <div className="md:hidden border-t border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="container mx-auto flex items-center justify-center gap-1 px-4 py-2">
              {links.map(item => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          </div>
        )}
      </nav>
      <FiltersWrapper />
    </>
  )
}
