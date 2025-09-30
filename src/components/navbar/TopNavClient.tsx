'use client'

import { Button, Navbar, NavbarBrand, NavbarContent } from '@nextui-org/react'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { GiSelfLove } from 'react-icons/gi'
import NavLink from './NavLink'
import UserMenu from './UserMenu'
import FiltersWrapper from './FiltersWrapper'
import { ConnectWalletButton } from '../ConnectWalletButton'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useSession } from 'next-auth/react'

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
  const { isAuthenticated } = useAuthStore()
  const [userInfo, setUserInfo] = useState<UserInfo>(initialUserInfo)

  useEffect(() => {
    console.log('TopNavClient session status:', status, 'user:', session?.user)
    // Update userInfo when session changes
    if (status === 'authenticated' && session?.user) {
      setUserInfo({
        name: session.user.name || null,
        image: session.user.image || null,
      })
    } else if (status === 'unauthenticated') {
      setUserInfo(null)
    }
  }, [session, status])

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
      <Navbar
        maxWidth="full"
        className="bg-gradient-to-r from-pink-400 via-red-400 to-pink-600"
        classNames={{
          item: [
            'text-xl',
            'text-white',
            'uppercase',
            'data-[active=true]:text-yellow-200',
          ],
        }}
      >
        <NavbarBrand as={Link} href="/">
          <GiSelfLove size={40} className="text-gray-200" />
          <div className="font-bold text-3xl flex">
            <span className="text-gray-200">MatchMe</span>
          </div>
        </NavbarBrand>
        <NavbarContent justify="center">
          {showLinks &&
            links.map(item => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
        </NavbarContent>
        <NavbarContent justify="end">
          {isLoggedIn && userInfo ? (
            <UserMenu userInfo={userInfo} />
          ) : (
            <ConnectWalletButton />
          )}
        </NavbarContent>
      </Navbar>
      <FiltersWrapper />
    </>
  )
}
