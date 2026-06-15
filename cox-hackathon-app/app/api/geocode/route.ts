import { NextResponse } from 'next/server'

/**
 * Atlanta bounding box (city limits, slightly padded).
 * [west, south, east, north]
 */
const ATLANTA_BBOX = {
  west: -84.5516,
  south: 33.6478,
  east: -84.2895,
  north: 33.8873,
}

export interface GeocodeResult {
  name: string
  address: string
  lat: number
  lng: number
  /** Nominatim OSM category, e.g. "building", "amenity", "leisure" */
  category: string
  /** Nominatim OSM type, e.g. "yes", "restaurant", "park" */
  osmType: string
}

function inAtlanta(lat: number, lng: number): boolean {
  return (
    lat >= ATLANTA_BBOX.south &&
    lat <= ATLANTA_BBOX.north &&
    lng >= ATLANTA_BBOX.west &&
    lng <= ATLANTA_BBOX.east
  )
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json<{ results: GeocodeResult[] }>({ results: [] })
  }

  // viewbox = left,top,right,bottom (lon,lat,lon,lat); bounded=1 restricts to box.
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'us',
    bounded: '1',
    viewbox: `${ATLANTA_BBOX.west},${ATLANTA_BBOX.north},${ATLANTA_BBOX.east},${ATLANTA_BBOX.south}`,
  })

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          // Nominatim usage policy requires an identifying User-Agent.
          'User-Agent': 'canopy-hackathon/1.0 (cox-hackathon-26)',
        },
        // Cache identical queries briefly to be gentle on the free API.
        next: { revalidate: 60 },
      },
    )

    if (!res.ok) {
      return NextResponse.json({ results: [], error: 'geocoder unavailable' }, { status: 502 })
    }

    type NominatimItem = {
      display_name: string
      name?: string
      lat: string
      lon: string
      category?: string
      type?: string
      address?: Record<string, string>
    }

    const raw = (await res.json()) as NominatimItem[]

    const results: GeocodeResult[] = raw
      .map((item) => {
        const lat = parseFloat(item.lat)
        const lng = parseFloat(item.lon)
        const addr = item.address ?? {}
        const primary =
          item.name ||
          addr.road ||
          addr.neighbourhood ||
          addr.suburb ||
          item.display_name.split(',')[0]
        return {
          name: primary,
          address: item.display_name,
          lat,
          lng,
          category: item.category ?? '',
          osmType: item.type ?? '',
        }
      })
      // Enforce Atlanta-only even if the geocoder strays past the box.
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && inAtlanta(r.lat, r.lng))

    return NextResponse.json<{ results: GeocodeResult[] }>({ results })
  } catch {
    return NextResponse.json({ results: [], error: 'geocoder request failed' }, { status: 502 })
  }
}
