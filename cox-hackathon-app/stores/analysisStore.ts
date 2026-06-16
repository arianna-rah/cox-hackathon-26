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
  // The roof option currently focused in both the 3D scene (which widget is
  // highlighted) and the sidebar (which option card is expanded). Kept in
  // one place so either side can drive the other.
  selectedOptionId: string | null
  setResult: (r: AnalysisResult) => void
  setPhase: (n: number) => void
  appendMessage: (m: string) => void
  startAnalysis: () => void
  setSolar: (s: SolarData | null) => void
  setSolarLoading: (b: boolean) => void
  setSelectedOptionId: (id: string | null) => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  result: null,
  isAnalyzing: false,
  phase: 0,
  streamedMessages: [],
  solar: null,
  solarLoading: false,
  selectedOptionId: null,
  setResult: (r) =>
    set({ result: r, isAnalyzing: false, selectedOptionId: r.rankedOptions[0]?.id ?? null }),
  setPhase: (n) => set({ phase: n }),
  appendMessage: (m) => set((s) => ({ streamedMessages: [...s.streamedMessages, m] })),
  startAnalysis: () =>
    set({ isAnalyzing: true, phase: 0, result: null, streamedMessages: [], selectedOptionId: null }),
  setSolar: (s) => set({ solar: s }),
  setSolarLoading: (b) => set({ solarLoading: b }),
  setSelectedOptionId: (id) => set({ selectedOptionId: id }),
  reset: () =>
    set({ result: null, isAnalyzing: false, phase: 0, streamedMessages: [], selectedOptionId: null }),
}))
