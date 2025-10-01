'use client'

import { useAuthStore } from '@/hooks/useAuthStore'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

export default function AuthStateSync() {
  const { data: session, status } = useSession()
  const { setAuth, clearAuth } = useAuthStore()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      setAuth(session.user.id, session.user.profileComplete || false)
    } else if (status === 'unauthenticated') {
      clearAuth()
    }
  }, [session, status, setAuth, clearAuth])

  return null
}
