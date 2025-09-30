import { create } from 'zustand'

interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  profileComplete: boolean
  setAuth: (userId: string | null, profileComplete: boolean) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userId: null,
  profileComplete: false,
  setAuth: (userId, profileComplete) =>
    set({
      isAuthenticated: !!userId,
      userId,
      profileComplete,
    }),
  clearAuth: () =>
    set({
      isAuthenticated: false,
      userId: null,
      profileComplete: false,
    }),
}))
