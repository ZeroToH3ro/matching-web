import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface UserInfo {
  name: string | null
  image: string | null
  avatarUrl: string | null
}

export interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  profileComplete: boolean
  userInfo: UserInfo | null
  setAuth: (userId: string | null, profileComplete: boolean, userInfo?: UserInfo) => void
  setUserInfo: (userInfo: UserInfo) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      profileComplete: false,
      userInfo: null,
      setAuth: (userId, profileComplete, userInfo) =>
        set({
          isAuthenticated: !!userId,
          userId,
          profileComplete,
          userInfo: userInfo || null,
        }),
      setUserInfo: (userInfo) =>
        set({
          userInfo,
        }),
      clearAuth: () =>
        set({
          isAuthenticated: false,
          userId: null,
          profileComplete: false,
          userInfo: null,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
