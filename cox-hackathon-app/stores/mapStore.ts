import { create } from 'zustand'
import type { Building, UserPreferences, SidebarStep } from '@/types'

interface MapState {
  selectedBuilding: Building | null
  sidebarStep: SidebarStep
  userPreferences: UserPreferences | null
  showCommunityLayer: boolean
  selectBuilding: (b: Building) => void
  closeSidebar: () => void
  advanceTo: (step: SidebarStep) => void
  setPreferences: (p: UserPreferences) => void
  toggleCommunityLayer: () => void
}

export const useMapStore = create<MapState>((set) => ({
  selectedBuilding: null,
  sidebarStep: 'closed',
  userPreferences: null,
  showCommunityLayer: false,
  selectBuilding: (b) => set({ selectedBuilding: b, sidebarStep: 'info' }),
  closeSidebar: () => set({ selectedBuilding: null, sidebarStep: 'closed', showCommunityLayer: false }),
  advanceTo: (step) => set({ sidebarStep: step }),
  setPreferences: (p) => set({ userPreferences: p }),
  toggleCommunityLayer: () => set((s) => ({ showCommunityLayer: !s.showCommunityLayer })),
}))
