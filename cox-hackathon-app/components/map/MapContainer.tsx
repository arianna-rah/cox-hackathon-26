'use client'

import { useEffect, useRef } from 'react'
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import { MapPin } from 'lucide-react'
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

/** Drops a pin on the searched place. */
function SearchMarker() {
  const place = useMapStore((s) => s.searchPlace)

  if (!place) return null

  return (
    <Marker longitude={place.lng} latitude={place.lat} anchor="bottom">
      <MapPin className="h-8 w-8 fill-canopy-green text-canopy-bg drop-shadow-lg" />
    </Marker>
  )
}

export default function MapContainer() {
  const mapRef = useRef<MapRef | null>(null)
  const selectedBuilding = useMapStore((s) => s.selectedBuilding)
  const searchPlace = useMapStore((s) => s.searchPlace)

  // Fly to the selected building whenever it changes.
  useEffect(() => {
    if (selectedBuilding) {
      mapRef.current?.flyTo({
        center: [selectedBuilding.lng, selectedBuilding.lat],
        zoom: 17,
        duration: 1200,
      })
    }
  }, [selectedBuilding])

  // Fly to a searched place whenever it changes.
  useEffect(() => {
    if (searchPlace) {
      mapRef.current?.flyTo({
        center: [searchPlace.lng, searchPlace.lat],
        zoom: 17,
        duration: 1200,
      })
    }
  }, [searchPlace])

  return (
    <Map
      ref={mapRef}
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
      <SearchMarker />
      <BuildingLayer />
      <CommunityLayer />
    </Map>
  )
}
