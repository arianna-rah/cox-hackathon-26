'use client'

import { useEffect } from 'react'
import Map, { NavigationControl, useMap } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_DEFAULTS, ESRI_SATELLITE_TILES } from '@/lib/constants'
import { useMapStore } from '@/stores/mapStore'
import { BuildingLayer } from './BuildingLayer'
import { CommunityLayer } from './CommunityLayer'

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    'esri-satellite': {
      type: 'raster' as const,
      tiles: [ESRI_SATELLITE_TILES],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster' as const,
      source: 'esri-satellite',
    },
  ],
}

/** Flies the camera to the selected building whenever it changes. */
function FlyToSelected() {
  const { 'main-map': map } = useMap()
  const selected = useMapStore((s) => s.selectedBuilding)

  useEffect(() => {
    if (selected && map) {
      map.flyTo({
        center: [selected.lng, selected.lat],
        zoom: 17,
        duration: 1200,
      })
    }
  }, [selected, map])

  return null
}

export default function MapContainer() {
  return (
    <Map
      id="main-map"
      mapStyle={MAP_STYLE}
      initialViewState={{
        latitude: MAP_DEFAULTS.lat,
        longitude: MAP_DEFAULTS.lng,
        zoom: MAP_DEFAULTS.zoom,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <NavigationControl position="top-left" />
      <FlyToSelected />
      <BuildingLayer />
      <CommunityLayer />
    </Map>
  )
}
