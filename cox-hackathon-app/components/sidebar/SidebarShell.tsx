'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { X, Leaf } from 'lucide-react'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { fetchSolarData } from '@/lib/solar'
import { BuildingInfo } from './BuildingInfo'
import { Preferences } from './Preferences'
import { AgentAnalysis } from './AgentAnalysis'
import { Results } from './Results'

const variants: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } },
}

const STEP_TITLES: Record<string, string> = {
  info: 'Building Overview',
  preferences: 'Your Priorities',
  analysis: 'Canopy Analysis',
  results: 'Recommendations',
}

export function SidebarShell() {
  const step = useMapStore((s) => s.sidebarStep)
  const close = useMapStore((s) => s.closeSidebar)
  const selectedBuilding = useMapStore((s) => s.selectedBuilding)
  const setSolar = useAnalysisStore((s) => s.setSolar)
  const setSolarLoading = useAnalysisStore((s) => s.setSolarLoading)
  const open = step !== 'closed'

  // Fetch real Google Solar data as soon as a building is selected, so it's
  // ready by the time the analysis step runs (and the info screen can show
  // the measured roof area). Falls back silently if unavailable.
  useEffect(() => {
    if (!selectedBuilding) return
    let cancelled = false
    setSolar(null)
    setSolarLoading(true)
    fetchSolarData(selectedBuilding.lat, selectedBuilding.lng).then((data) => {
      if (cancelled) return
      setSolar(data)
      setSolarLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedBuilding, setSolar, setSolarLoading])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="sidebar"
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute right-0 top-0 z-20 flex h-screen w-full flex-col border-l border-canopy-border bg-canopy-surface shadow-2xl sm:w-[420px]"
        >
          <header className="flex items-center justify-between border-b border-canopy-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-canopy-green" />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-canopy-green">
                  Canopy
                </p>
                <h2 className="text-sm font-semibold text-canopy-text">
                  {STEP_TITLES[step] ?? ''}
                </h2>
              </div>
            </div>
            <button
              onClick={close}
              aria-label="Close"
              className="rounded-md p-1.5 text-canopy-muted transition-colors hover:bg-canopy-bg hover:text-canopy-text"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {step === 'info' && <BuildingInfo />}
            {step === 'preferences' && <Preferences />}
            {step === 'analysis' && <AgentAnalysis />}
            {step === 'results' && <Results />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
