'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Leaf, ArrowRight, User, Mail } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const router = useRouter()
  const { user, login } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Already logged in → go straight to the map
  useEffect(() => {
    if (user) {
      router.replace('/map')
    }
  }, [user, router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSubmitting(true)
    login(name.trim(), email.trim())
    router.push('/map')
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-greentop-bg px-6">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-greentop-green/20 blur-[120px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-greentop-bg via-transparent to-greentop-bg" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-greentop-green/40 bg-greentop-green/10">
            <Leaf className="h-7 w-7 text-greentop-green" />
          </div>
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-greentop-green">GreenTop</p>
            <h1 className="mt-1 text-2xl font-bold text-greentop-text">Welcome</h1>
            <p className="mt-1 text-sm text-greentop-muted">
              Create your profile to save roof plans and track progress.
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-greentop-border bg-greentop-surface/80 p-6 shadow-2xl backdrop-blur">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-greentop-muted">
                <User className="h-3 w-3 text-greentop-green" />
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-greentop-border bg-greentop-bg px-4 py-3 text-sm text-greentop-text placeholder:text-greentop-muted/60 outline-none transition-colors focus:border-greentop-green focus:ring-1 focus:ring-greentop-green"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-greentop-muted">
                <Mail className="h-3 w-3 text-greentop-green" />
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-greentop-border bg-greentop-bg px-4 py-3 text-sm text-greentop-text placeholder:text-greentop-muted/60 outline-none transition-colors focus:border-greentop-green focus:ring-1 focus:ring-greentop-green"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !name.trim() || !email.trim()}
              className="group mt-2 flex items-center justify-center gap-2 rounded-xl bg-greentop-green px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enter GreenTop
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-greentop-muted">
          No password needed — your profile is stored locally for personalization.
        </p>
      </motion.div>
    </main>
  )
}
