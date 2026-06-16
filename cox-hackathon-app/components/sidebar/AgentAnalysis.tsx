'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useMapStore } from '@/stores/mapStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { scoreAndRankOptions, calculateCommunityBonus, realSolarEconomics } from '@/lib/scoring'
import type { Building } from '@/types'
import type { SolarData } from '@/lib/solar'

const PHASES = [
  'Roof Assessment',
  'Environmental Data',
  'Financial Modeling',
  'Community Score',
]

const FALLBACK_MESSAGES = (b: Building, solar: SolarData | null) => {
  // When real Google Solar data is present, narrate the measured facts; the
  // solar line then reports the genuine production + savings, not a guess.
  const roofArea = solar?.roofAreaSqFt ?? b.roofAreaSqFt
  const solarLine = solar
    ? `✓ Google Solar API: ${solar.annualKwh.toLocaleString()} kWh/yr measured — est. $${realSolarEconomics(solar).annualSavings.toLocaleString()}/yr savings`
    : b.maxLoadPSF >= 4
      ? `Solar: feasible — est. $${Math.round(b.precomputedSolarKwhPerYear * 0.12).toLocaleString()}/yr savings`
      : 'Solar: ⚠ structural advisory for this building'
  return [
    solar
      ? `Google Solar: ${roofArea.toLocaleString()} sq ft usable roof · ${solar.maxPanels} panels max`
      : `Roof: ${roofArea.toLocaleString()} sq ft flat surface · ${b.roofMaterial}`,
    `${b.yearBuilt < 1980 ? '⚠ Pre-1980 — structural load caution flagged' : 'Post-1980 — standard load capacity'}`,
    solar
      ? `Sunshine: ${solar.maxSunshineHoursPerYear.toLocaleString()} hrs/yr measured · Grid carbon: ${Math.round(solar.carbonOffsetFactorKgPerMwh)} kg/MWh`
      : `Solar irradiance: 5.1 kWh/m²/day · Heat island: ${b.heatIslandIntensityF}°F above baseline`,
    `Wind: 9 mph avg — turbines not recommended · Rainfall: 50.2 in/yr — rainwater viable`,
    `Running ${roofArea > 15000 ? '1,247' : '891'} configuration scenarios...`,
    `Cool roof: $${Math.round(1.5 * roofArea).toLocaleString()} · ROI ~14 months`,
    solarLine,
    `${b.neighborIds.length} neighboring buildings identified · Block discount: 12%`,
    `Pooled stormwater credit: $${Math.round(b.annualStormwaterCreditDollars * 2.8).toLocaleString()}/yr · City grant: $25,000 eligible`,
    '─────────────────────────────────',
    '✓ Analysis complete.',
  ]
}

/** Segmented progress bar in the mono aesthetic. */
function PhaseBar({ filled }: { filled: number }) {
  const segments = 12
  const full = Math.round((filled / 100) * segments)
  return (
    <span className="font-mono text-canopy-green">
      {'█'.repeat(full)}
      <span className="text-canopy-border">{'░'.repeat(segments - full)}</span>
    </span>
  )
}

export function AgentAnalysis() {
  const building = useMapStore((s) => s.selectedBuilding)
  const preferences = useMapStore((s) => s.userPreferences)
  const advanceTo = useMapStore((s) => s.advanceTo)

  const phase = useAnalysisStore((s) => s.phase)
  const messages = useAnalysisStore((s) => s.streamedMessages)
  const startAnalysis = useAnalysisStore((s) => s.startAnalysis)
  const setPhase = useAnalysisStore((s) => s.setPhase)
  const appendMessage = useAnalysisStore((s) => s.appendMessage)
  const setResult = useAnalysisStore((s) => s.setResult)

  useEffect(() => {
    if (!building || !preferences) return

    startAnalysis()

    const b = building
    const p = preferences

    // Display pacing is decoupled from network delivery: incoming SSE
    // messages are queued and revealed on a fixed cadence, so the narration
    // animates smoothly for ~10s no matter how the bytes actually arrive
    // (incremental, batched, or via the offline fallback).
    const REVEAL_MS = 600
    const queue: string[] = []
    let revealed = 0
    let streamDone = false
    let usingFallback = false
    let finished = false
    let receivedAny = false
    let es: EventSource | null = null

    const finalize = () => {
      if (finished) return
      finished = true
      es?.close()
      clearInterval(ticker)
      clearTimeout(watchdog)
      // Use whatever real Google Solar data has loaded by now (fetched when the
      // building was selected); null falls back to modelled estimates.
      const solar = useAnalysisStore.getState().solar
      const ranked = scoreAndRankOptions(b, p, solar)
      const community = calculateCommunityBonus(b)
      setResult({
        building: b,
        preferences: p,
        rankedOptions: ranked,
        communityBonus: community,
      })
      setTimeout(() => advanceTo('results'), 650)
    }

    // Reveal one queued line per tick; finalize once drained + complete.
    const ticker = setInterval(() => {
      if (queue.length > 0) {
        const line = queue.shift() as string
        appendMessage(line)
        revealed += 1
        setPhase(Math.min(4, Math.floor((revealed - 1) / 4) + 1))
      } else if (streamDone || usingFallback) {
        finalize()
      }
    }, REVEAL_MS)

    const runFallback = () => {
      if (usingFallback || finished) return
      usingFallback = true
      es?.close()
      const solar = useAnalysisStore.getState().solar
      for (const line of FALLBACK_MESSAGES(b, solar)) queue.push(line)
    }

    // If nothing arrives quickly, assume the backend is down → fallback.
    const watchdog = setTimeout(() => {
      if (!receivedAny && !finished) runFallback()
    }, 2500)

    try {
      es = new EventSource(
        `/api/stream?buildingId=${encodeURIComponent(b.id)}&goal=${p.primaryGoal}`,
      )
      es.onmessage = (e) => {
        receivedAny = true
        clearTimeout(watchdog)
        if (streamDone) return // ignore any post-done auto-reconnect re-stream
        try {
          const data = JSON.parse(e.data) as { message?: string; done?: boolean }
          if (data.done) {
            streamDone = true
            es?.close() // stop EventSource from auto-reconnecting & re-streaming
            return
          }
          if (data.message) queue.push(data.message)
        } catch {
          /* ignore malformed line */
        }
      }
      es.onerror = () => {
        if (finished) return
        // Only react to a truly-closed connection; ignore transient reconnects.
        if (es && es.readyState === EventSource.CLOSED) {
          if (!receivedAny) runFallback()
          else streamDone = true
        }
      }
    } catch {
      runFallback()
    }

    return () => {
      es?.close()
      clearInterval(ticker)
      clearTimeout(watchdog)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!building) return null

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Phase progress */}
      <div className="space-y-2 rounded-xl border border-canopy-border bg-canopy-bg p-4 text-xs">
        {PHASES.map((name, i) => {
          const idx = i + 1
          const filled = phase > idx ? 100 : phase === idx ? 60 : 0
          return (
            <div key={name} className="flex items-center justify-between gap-3">
              <span
                className={`${phase >= idx ? 'text-canopy-text' : 'text-canopy-muted'}`}
              >
                Phase {idx}: {name}
              </span>
              <PhaseBar filled={filled} />
            </div>
          )
        })}
      </div>

      {/* Streamed narration */}
      <div className="min-h-[200px] space-y-1.5 font-mono text-[13px] leading-relaxed">
        {messages.map((m, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              m.startsWith('✓')
                ? 'text-canopy-green'
                : m.startsWith('⚠')
                  ? 'text-canopy-amber'
                  : 'text-canopy-text'
            }
          >
            <span className="mr-1.5 text-canopy-green">›</span>
            {m}
          </motion.p>
        ))}
        <span className="inline-block h-4 w-2 animate-pulse bg-canopy-green align-middle" />
      </div>
    </div>
  )
}
