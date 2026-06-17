import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  email: string
}

interface AuthState {
  user: User | null
  // True once persisted state has rehydrated from localStorage. Guards must wait
  // for this before redirecting, or a refresh / direct link bounces the user out
  // before their saved session is restored.
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  login: (name: string, email: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      login: (name, email) =>
        set({ user: { id: `user-${Date.now()}`, name, email } }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'canopy-auth',
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
)
