import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Building, ScoredOption, DashboardAnalysis } from '@/types'
import type { SolarData } from '@/lib/solar'

export interface SavedPlan {
  id: string
  name: string
  createdAt: number
  building: Building
  selectedOption: ScoredOption
  dashboard: DashboardAnalysis
  solar: SolarData | null
  checklist: Record<string, boolean>
}

interface DashboardState {
  plans: SavedPlan[]
  addPlan: (data: Omit<SavedPlan, 'id' | 'name' | 'createdAt' | 'checklist'>) => string
  renamePlan: (id: string, name: string) => void
  deletePlan: (id: string) => void
  toggleChecklistItem: (planId: string, taskId: string) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      plans: [],
      addPlan: (data) => {
        const id = `plan-${Date.now()}`
        set((s) => ({
          plans: [
            { ...data, id, name: 'New Plan', createdAt: Date.now(), checklist: {} },
            ...s.plans,
          ],
        }))
        return id
      },
      renamePlan: (id, name) =>
        set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, name } : p)) })),
      deletePlan: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
      toggleChecklistItem: (planId, taskId) =>
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id === planId
              ? { ...p, checklist: { ...p.checklist, [taskId]: !p.checklist[taskId] } }
              : p,
          ),
        })),
    }),
    { name: 'canopy-dashboard' },
  ),
)
