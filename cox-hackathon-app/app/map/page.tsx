'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { SidebarShell } from '@/components/sidebar/SidebarShell'
import { SearchBar } from '@/components/map/SearchBar'
import { SearchResultPopup } from '@/components/map/SearchResultPopup'
import { useMapStore } from '@/stores/mapStore'
import { useAuthStore } from '@/stores/authStore'

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
})
const BuildingScene3D = dynamic(() => import('@/components/scene3d/BuildingScene3D'), {
  ssr: false,
})

export default function MapPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const selectedBuilding = useMapStore((s) => s.selectedBuilding)
  const sidebarStep = useMapStore((s) => s.sidebarStep)

  useEffect(() => {
    if (hasHydrated && !user) {
      router.replace('/login')
    }
  }, [hasHydrated, user, router])

  // Wait for the persisted session to load before deciding to redirect.
  if (!hasHydrated || !user) return null

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-greentop-bg">
      <div className="absolute inset-0 z-0">
        <AnimatePresence>
          {selectedBuilding ? (
            <motion.div
              key="scene3d"
              className={`absolute inset-y-0 left-0 right-0 transition-[right] duration-500 ease-out ${
                sidebarStep === 'results' ? 'sm:right-[60vw]' : 'sm:right-[420px]'
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
        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
          <SearchBar />
        </div>
      )}
      <SearchResultPopup />
      <SidebarShell />
    </div>
  )
}
