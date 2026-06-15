'use client'

import { Source, Layer } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import { useMapStore } from '@/stores/mapStore'
import { NEIGHBOR_BUILDINGS } from '@/lib/buildings'
import { squareFootprint } from '@/lib/geo'

/**
 * When the "View Block Impact" toggle is on, glow the opted-in neighbor
 * buildings and draw dashed connecting lines from the selected building.
 */
export function CommunityLayer() {
  const b = useMapStore((s) => s.selectedBuilding)
  const show = useMapStore((s) => s.showCommunityLayer)
  if (!b || !show) return null

  const neighbors = b.neighborIds
    .map((id) => NEIGHBOR_BUILDINGS[id])
    .filter((n): n is NonNullable<typeof n> => Boolean(n && n.lat && n.lng))

  if (neighbors.length === 0) return null

  const footprints: FeatureCollection = {
    type: 'FeatureCollection',
    features: neighbors.map((n) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: squareFootprint(n.lat!, n.lng!, n.roofAreaSqFt ?? 8000),
      },
      properties: { name: n.name ?? '' },
    })),
  }

  const connectors: FeatureCollection = {
    type: 'FeatureCollection',
    features: neighbors.map((n) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [b.lng, b.lat],
          [n.lng!, n.lat!],
        ],
      },
      properties: {},
    })),
  }

  return (
    <>
      <Source id="community-connectors" type="geojson" data={connectors}>
        <Layer
          id="community-connectors-line"
          type="line"
          paint={{
            'line-color': '#22c55e',
            'line-width': 2,
            'line-dasharray': [2, 2],
            'line-opacity': 0.8,
          }}
        />
      </Source>
      <Source id="community-neighbors" type="geojson" data={footprints}>
        <Layer
          id="community-neighbors-glow"
          type="line"
          paint={{ 'line-color': '#22c55e', 'line-width': 7, 'line-blur': 6, 'line-opacity': 0.55 }}
        />
        <Layer
          id="community-neighbors-fill"
          type="fill"
          paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.2 }}
        />
      </Source>
    </>
  )
}
