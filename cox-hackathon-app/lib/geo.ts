// Small geo helpers for drawing building footprints on the map.
// Demo buildings only carry a centroid + roof area, so we synthesize a
// square footprint sized from the roof area for the glowing outline.

type Ring = [number, number][]

export function squareFootprint(
  lat: number,
  lng: number,
  roofAreaSqFt: number,
): Ring[] {
  const areaM2 = roofAreaSqFt * 0.092903
  const side = Math.sqrt(areaM2)
  const half = side / 2
  const dLat = half / 111320
  const dLng = half / (111320 * Math.cos((lat * Math.PI) / 180))
  return [
    [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ],
  ]
}
