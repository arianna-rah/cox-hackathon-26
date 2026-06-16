import { create } from 'zustand'
import type { AnalysisResult } from '@/types'
import type { SolarData } from '@/lib/solar'

interface AnalysisState {
  result: AnalysisResult | null
  isAnalyzing: boolean
  phase: number
  streamedMessages: string[]
  solar: SolarData | null
  solarLoading: boolean
  setResult: (r: AnalysisResult) => void
  setPhase: (n: number) => void
  appendMessage: (m: string) => void
  startAnalysis: () => void
  setSolar: (s: SolarData | null) => void
  setSolarLoading: (b: boolean) => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  result: null,
  isAnalyzing: false,
  phase: 0,
  streamedMessages: [],
  solar: null,
  solarLoading: false,
  setResult: (r) => set({ result: r, isAnalyzing: false }),
  setPhase: (n) => set({ phase: n }),
  appendMessage: (m) => set((s) => ({ streamedMessages: [...s.streamedMessages, m] })),
  startAnalysis: () => set({ isAnalyzing: true, phase: 0, result: null, streamedMessages: [] }),
  setSolar: (s) => set({ solar: s }),
  setSolarLoading: (b) => set({ solarLoading: b }),
  reset: () => set({ result: null, isAnalyzing: false, phase: 0, streamedMessages: [] }),
}))
