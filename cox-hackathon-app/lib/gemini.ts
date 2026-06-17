// Client helper: ask the frontend /api/gemini-analyze route for the recommended
// roof plan, then normalise Gemini's output into a safe DashRoofPlan (valid
// option ids, clamped percentages, real upfront costs from the local scorer).
// Returns null on any failure so callers fall back to the deterministic plan.

import type { Building, UserPreferences, ScoredOption, DashRoofPlan, DashPlanComponent } from '@/types'
import type { SolarData } from '@/lib/solar'

const VALID_OPTION_IDS = new Set([
  'cool-roof',
  'solar',
  'green-roof-extensive',
  'green-roof-intensive',
  'rainwater',
  'beekeeping',
])

const clampPct = (n: unknown) => {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0
}

export async function fetchGeminiPlan(
  building: Building,
  solar: SolarData | null,
  preferences: UserPreferences,
  ranked: ScoredOption[],
): Promise<DashRoofPlan | null> {
  try {
    const options = ranked.map((o) => ({
      optionId: o.id,
      name: o.name,
      upfrontCost: Math.round(o.uptrontCost),
      annualNet: Math.round(o.annualNetDollars),
      paybackYears: o.roiMonths < 900 ? Math.round((o.roiMonths / 12) * 10) / 10 : null,
      co2PerYear: o.co2TonsPerYear ?? null,
      feasible: o.feasible,
      bestFor: o.bestFor,
      warning: o.warningsForBuilding[0],
    }))

    const res = await fetch('/api/gemini-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ building, solar, preferences, options }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { plan?: unknown; error?: unknown }
    if (data.error || !data.plan) return null

    const raw = data.plan as Record<string, unknown>
    const rawComponents = Array.isArray(raw.components) ? raw.components : []
    const costById = new Map(ranked.map((o) => [o.id, Math.round(o.uptrontCost)]))

    const components: DashPlanComponent[] = rawComponents
      .map((c) => c as Record<string, unknown>)
      .filter((c) => VALID_OPTION_IDS.has(String(c.optionId)))
      .map((c) => {
        const id = String(c.optionId)
        return {
          optionId: id,
          name: String(c.name ?? ranked.find((o) => o.id === id)?.name ?? id),
          coveragePct: clampPct(c.coveragePct),
          upfrontCost: costById.get(id) ?? null,
          annualBenefit: String(c.annualBenefit ?? ''),
          implementation: String(c.implementation ?? ''),
        }
      })

    if (components.length === 0) return null

    return {
      strategyName: String(raw.strategyName ?? components.map((c) => c.name).join(' + ')),
      summary: String(raw.summary ?? ''),
      components,
      changeablePct: clampPct(raw.changeablePct ?? 100 - clampPct(raw.unusablePct)),
      unusablePct: clampPct(raw.unusablePct),
      unusableReason: String(raw.unusableReason ?? ''),
    }
  } catch {
    return null
  }
}
