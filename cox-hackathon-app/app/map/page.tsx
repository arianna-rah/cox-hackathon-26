'use client'

import dynamic from 'next/dynamic'
import { SidebarShell } from '@/components/sidebar/SidebarShell'
import { DemoPanel } from '@/components/map/DemoPanel'

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
})

export default function MapPage() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canopy-bg">
      <div className="absolute inset-0 z-0">
        <MapContainer />
      </div>
      <div className="absolute bottom-6 left-4 z-10">
        <DemoPanel />
      </div>
      <SidebarShell />
    </div>
  )
}
