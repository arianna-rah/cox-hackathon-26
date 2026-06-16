import type { Building } from '@/types'

export const NEIGHBOR_BUILDINGS: Record<string, Partial<Building>> = {
  castleberry_n1: { id: 'castleberry_n1', name: '180 Peters St SW', lat: 33.7492, lng: -84.3985, yearBuilt: 2014, maxLoadPSF: 80, roofAreaSqFt: 12000, annualStormwaterCreditDollars: 1200 },
  castleberry_n2: { id: 'castleberry_n2', name: '175 Walker St SW', lat: 33.7488, lng: -84.3975, yearBuilt: 1978, maxLoadPSF: 20, roofAreaSqFt: 9500, annualStormwaterCreditDollars: 950 },
  midtown_n1:     { id: 'midtown_n1', name: '1270 W Peachtree St', lat: 33.7920, lng: -84.3885, yearBuilt: 2001, maxLoadPSF: 50, roofAreaSqFt: 7800, annualStormwaterCreditDollars: 820 },
  midtown_n2:     { id: 'midtown_n2', name: '1290 W Peachtree St', lat: 33.7930, lng: -84.3875, yearBuilt: 1995, maxLoadPSF: 40, roofAreaSqFt: 8100, annualStormwaterCreditDollars: 860 },
  downtown_n1:    { id: 'downtown_n1', name: '185 Peachtree St NE', lat: 33.7576, lng: -84.3875, yearBuilt: 2005, maxLoadPSF: 60, roofAreaSqFt: 19000, annualStormwaterCreditDollars: 2100 },
  downtown_n2:    { id: 'downtown_n2', name: '197 Peachtree St NE', lat: 33.7570, lng: -84.3885, yearBuilt: 1998, maxLoadPSF: 45, roofAreaSqFt: 21000, annualStormwaterCreditDollars: 2350 },
}
