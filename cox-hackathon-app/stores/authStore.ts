import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  email: string
}

interface AuthState {
  user: User | null
  login: (name: string, email: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (name, email) =>
        set({ user: { id: `user-${Date.now()}`, name, email } }),
      logout: () => set({ user: null }),
    }),
    { name: 'canopy-auth' },
  ),
)
