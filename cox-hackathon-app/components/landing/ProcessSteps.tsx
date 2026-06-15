'use client'

import { motion } from 'framer-motion'
import { MousePointerClick, SlidersHorizontal, Sparkles } from 'lucide-react'

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'Pick Your Roof',
    desc: 'Click any building on the satellite map.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Set Your Goals',
    desc: 'Budget, priorities, sustainability targets.',
  },
  {
    icon: Sparkles,
    title: 'Get Your Plan',
    desc: 'AI recommendation with ROI and community bonus.',
  },
]

export function ProcessSteps() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="mb-12 text-center text-2xl font-semibold text-canopy-text sm:text-3xl">
        Three steps to a smarter rooftop
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
            className="rounded-2xl border border-canopy-border bg-canopy-surface/50 p-6"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-canopy-green/15">
              <s.icon className="h-5 w-5 text-canopy-green" />
            </div>
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-sm text-canopy-green">
                0{i + 1}
              </span>
              <h3 className="text-lg font-semibold text-canopy-text">
                {s.title}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-canopy-muted">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
