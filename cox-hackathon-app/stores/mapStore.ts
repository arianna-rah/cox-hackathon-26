import { create } from 'zustand'
import type { Building, UserPreferences, SidebarStep } from '@/types'
import { useAnalysisStore } from './analysisStore'

export interface SearchPlace {
  name: string
  address: string
  lat: number
  lng: number
  category: string
  osmType: string
}

/** How the map responds to mouse drags. */
export type MapMode = 'pan' | 'select'

interface MapState {
  selectedBuilding: Building | null
  sidebarStep: SidebarStep
  userPreferences: UserPreferences | null
  showCommunityLayer: boolean
  searchPlace: SearchPlace | null
  mapMode: MapMode
  selectBuilding: (b: Building) => void
  updateSelectedBuilding: (patch: Partial<Building>) => void
  closeSidebar: () => void
  advanceTo: (step: SidebarStep) => void
  setPreferences: (p: UserPreferences) => void
  toggleCommunityLayer: () => void
  setSearchPlace: (p: SearchPlace | null) => void
  setMapMode: (m: MapMode) => void
}

export const useMapStore = create<MapState>((set) => ({
  selectedBuilding: null,
  sidebarStep: 'closed',
  userPreferences: null,
  showCommunityLayer: false,
  searchPlace: null,
  mapMode: 'pan',
  selectBuilding: (b) => {
    useAnalysisStore.getState().reset()
    set({ selectedBuilding: b, sidebarStep: 'info' })
  },
  updateSelectedBuilding: (patch) =>
    set((s) => (s.selectedBuilding ? { selectedBuilding: { ...s.selectedBuilding, ...patch } } : {})),
  closeSidebar: () => {
    useAnalysisStore.getState().reset()
    set({ selectedBuilding: null, sidebarStep: 'closed', showCommunityLayer: false })
  },
  advanceTo: (step) => set({ sidebarStep: step }),
  setPreferences: (p) => set({ userPreferences: p }),
  toggleCommunityLayer: () => set((s) => ({ showCommunityLayer: !s.showCommunityLayer })),
  setSearchPlace: (p) => set({ searchPlace: p }),
  setMapMode: (m) => set({ mapMode: m }),
}))
