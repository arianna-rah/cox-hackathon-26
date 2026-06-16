'use client'

import dynamic from 'next/dynamic'
import { SidebarShell } from '@/components/sidebar/SidebarShell'
import { SearchBar } from '@/components/map/SearchBar'
import { SearchResultPopup } from '@/components/map/SearchResultPopup'

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
})

export default function MapPage() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canopy-bg">
      <div className="absolute inset-0 z-0">
        <MapContainer />
      </div>
      <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
        <SearchBar />
      </div>
      <SearchResultPopup />
      <SidebarShell />
    </div>
  )
}
