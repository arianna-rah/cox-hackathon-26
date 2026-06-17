'use client'

import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { SidebarShell } from '@/components/sidebar/SidebarShell'
import { SearchBar } from '@/components/map/SearchBar'
import { SearchResultPopup } from '@/components/map/SearchResultPopup'
import { MapModeToggle } from '@/components/map/MapModeToggle'
import { useMapStore } from '@/stores/mapStore'

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
})
const BuildingScene3D = dynamic(() => import('@/components/scene3d/BuildingScene3D'), {
  ssr: false,
})

export default function MapPage() {
  const selectedBuilding = useMapStore((s) => s.selectedBuilding)
  const sidebarStep = useMapStore((s) => s.sidebarStep)

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-greentop-bg">
      <div className="absolute inset-0 z-0">
        <AnimatePresence>
          {selectedBuilding ? (
            <motion.div
              key="scene3d"
              className={`absolute inset-y-0 left-0 transition-[right] duration-500 ease-out ${
                sidebarStep === 'results' ? 'right-0 sm:right-[60vw]' : 'right-0'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <BuildingScene3D />
            </motion.div>
          ) : (
            <motion.div
              key="map"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MapContainer />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!selectedBuilding && (
        <>
          <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
            <SearchBar />
          </div>
          <MapModeToggle />
        </>
      )}
      <SearchResultPopup />
      <SidebarShell />
    </div>
  )
}
