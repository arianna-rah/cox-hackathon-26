'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Leaf, ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* ambient gradient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-canopy-green/20 blur-[120px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-canopy-bg via-transparent to-canopy-bg" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="mb-8 flex items-center gap-2 rounded-full border border-canopy-border bg-canopy-surface/60 px-4 py-1.5 backdrop-blur">
          <Leaf className="h-4 w-4 text-canopy-green" />
          <span className="text-sm font-medium text-canopy-text">Canopy</span>
          <span className="text-xs text-canopy-muted">· Atlanta rooftops</span>
        </div>

        <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight text-canopy-text sm:text-6xl">
          Your roof is costing Atlanta.
        </h1>
        <p className="mt-4 max-w-xl text-balance text-lg text-canopy-muted sm:text-2xl">
          Find out what it could be doing instead.
        </p>

        <Link
          href="/map"
          className="group mt-10 inline-flex items-center gap-2 rounded-full bg-canopy-green px-7 py-3.5 text-base font-semibold text-canopy-bg transition-colors hover:bg-canopy-green-dim"
        >
          Explore Atlanta Rooftops
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </section>
  )
}
