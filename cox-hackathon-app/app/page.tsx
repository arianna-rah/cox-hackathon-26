'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Hero } from '@/components/landing/Hero'
import { useAuthStore } from '@/stores/authStore'

export default function Home() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  useEffect(() => {
    if (hasHydrated && user) {
      router.replace('/map')
    }
  }, [hasHydrated, user, router])

  return (
    <main className="flex h-screen flex-1 flex-col overflow-hidden bg-greentop-bg">
      <Hero loginHref="/login" />
    </main>
  )
}
