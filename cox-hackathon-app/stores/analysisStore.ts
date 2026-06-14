import { create } from 'zustand'
import type { AnalysisResult } from '@/types'

interface AnalysisState {
  result: AnalysisResult | null
  isAnalyzing: boolean
  phase: number
  streamedMessages: string[]
  setResult: (r: AnalysisResult) => void
  setPhase: (n: number) => void
  appendMessage: (m: string) => void
  startAnalysis: () => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  result: null,
  isAnalyzing: false,
  phase: 0,
  streamedMessages: [],
  setResult: (r) => set({ result: r, isAnalyzing: false }),
  setPhase: (n) => set({ phase: n }),
  appendMessage: (m) => set((s) => ({ streamedMessages: [...s.streamedMessages, m] })),
  startAnalysis: () => set({ isAnalyzing: true, phase: 0, result: null, streamedMessages: [] }),
  reset: () => set({ result: null, isAnalyzing: false, phase: 0, streamedMessages: [] }),
}))
