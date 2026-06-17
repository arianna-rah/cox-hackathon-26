export interface YearProjection {
  year: number
  annualSavings: number
  cumulativeNet: number  // cumulative savings minus initial cost
  cumulativeCO2: number  // tons CO2 avoided to date
}

export function computeProjections(
  netCost: number,
  annualSavings: number,
  co2PerYear: number,
  years = 25,
): YearProjection[] {
  const rows: YearProjection[] = []
  for (let y = 0; y <= years; y++) {
    rows.push({
      year: y,
      annualSavings: y === 0 ? 0 : annualSavings,
      cumulativeNet: annualSavings * y - netCost,
      cumulativeCO2: co2PerYear * y,
    })
  }
  return rows
}
