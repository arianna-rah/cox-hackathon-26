'use client'

import { Source, Layer } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import { useMapStore } from '@/stores/mapStore'
import { squareFootprint } from '@/lib/geo'

/** Glowing green outline + fill over the currently selected building. */
export function BuildingLayer() {
  const b = useMapStore((s) => s.selectedBuilding)
  if (!b) return null

  const data: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: squareFootprint(b.lat, b.lng, b.roofAreaSqFt),
        },
        properties: {},
      },
    ],
  }

  return (
    <Source id="selected-building" type="geojson" data={data}>
      <Layer
        id="selected-building-fill"
        type="fill"
        paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.25 }}
      />
      <Layer
        id="selected-building-glow"
        type="line"
        paint={{ 'line-color': '#22c55e', 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.6 }}
      />
      <Layer
        id="selected-building-line"
        type="line"
        paint={{ 'line-color': '#4ade80', 'line-width': 2 }}
      />
    </Source>
  )
}
