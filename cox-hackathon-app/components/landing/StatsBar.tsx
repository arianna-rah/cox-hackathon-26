'use client'

import { motion } from 'framer-motion'

const STATS = [
  { value: '47,000+', label: 'Atlanta commercial rooftops' },
  { value: '$2.4B', label: 'Untapped energy value' },
  { value: '38°F', label: 'Possible surface temp reduction' },
]

export function StatsBar() {
  return (
    <section className="border-y border-canopy-border bg-canopy-surface/40">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-12 sm:grid-cols-3">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="text-center"
          >
            <p className="font-mono text-4xl font-bold text-canopy-green sm:text-5xl">
              {s.value}
            </p>
            <p className="mt-2 text-sm text-canopy-muted">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
