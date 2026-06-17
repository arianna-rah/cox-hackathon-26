// Frontend Gemini call for the roof recommendation. Takes the (possibly
// owner-edited) building + Solar data + preferences + candidate options, and
// asks Gemini for the single best STRATEGY — which may combine several options
// (e.g. solar + a pollinator garden) — with the share of roof each uses, how
// much stays unusable and why, and how each piece is implemented.
//
// GEMINI_API_KEY is read server-side only. Returns { plan } JSON, or an error
// the client treats as "fall back to the deterministic plan".

export const dynamic = 'force-dynamic'

const MODEL = 'gemini-2.0-flash'

interface OptionSummary {
  optionId: string
  name: string
  upfrontCost: number
  annualNet: number
  paybackYears: number | null
  co2PerYear: number | null
  feasible: boolean
  bestFor: string
  warning?: string
}

const COMPONENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    optionId: { type: 'STRING' },
    name: { type: 'STRING' },
    coveragePct: { type: 'NUMBER' },
    annualBenefit: { type: 'STRING' },
    implementation: { type: 'STRING' },
  },
  required: ['optionId', 'name', 'coveragePct', 'annualBenefit', 'implementation'],
}

const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    strategyName: { type: 'STRING' },
    summary: { type: 'STRING' },
    whyThisWins: { type: 'STRING' },
    changeablePct: { type: 'NUMBER' },
    unusablePct: { type: 'NUMBER' },
    unusableReason: { type: 'STRING' },
    components: { type: 'ARRAY', items: COMPONENT_SCHEMA },
  },
  required: [
    'strategyName',
    'summary',
    'whyThisWins',
    'changeablePct',
    'unusablePct',
    'unusableReason',
    'components',
  ],
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY
  if (!key) return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 501 })

  let body: {
    building?: Record<string, unknown>
    solar?: Record<string, unknown> | null
    preferences?: Record<string, unknown>
    options?: OptionSummary[]
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 })
  }

  const { building, solar, preferences, options = [] } = body

  const prompt = `You are GreenTop, an expert rooftop-retrofit advisor for Atlanta buildings.
Pick the SINGLE best strategy for this roof. It MAY combine more than one option when
they genuinely fit together (e.g. solar on the sunny area + a small pollinator garden
on a shaded corner). Recommend ONLY the best plan — never a menu of alternatives.

Rules:
- Use only these option ids for components: cool-roof, solar, green-roof-extensive,
  green-roof-intensive, rainwater, beekeeping.
- coveragePct = share of the WHOLE roof each component uses. The component coveragePct
  values plus unusablePct must sum to about 100. changeablePct = 100 - unusablePct.
- unusableReason: concrete (rooftop HVAC/equipment, setbacks & walkways, parapet edges,
  shading, structural load limits, drainage). Keep it specific to this building.
- implementation: 2-3 sentences on HOW that component is built on THIS roof and what it
  uses (panels/beds/coating area). annualBenefit: one short line ($ saved or earned per
  year, or the social/biodiversity benefit for non-financial options).
- summary: 1-2 sentence plain-English project description. whyThisWins: 1-2 sentences.
- STRONGLY respect the owner's primary goal when selecting the FIRST (lead) component:
    savings → prioritise the option with the fastest payback (often cool-roof)
    revenue → prioritise beekeeping or solar (cash-generating options)
    environment → prioritise solar or green roofs (highest CO₂ reduction)
    community → prioritise green roofs with rainwater and/or beekeeping
- Respect structural limits (low max load → avoid heavy intensive green roofs).
- Do NOT always default to solar — match the lead option to the goal and the CANDIDATE
  OPTIONS list (which is already scored and ranked for this building and goal).
- The lead (first) component in the response should match the top feasible option in
  the CANDIDATE OPTIONS list unless there is a clear structural or site reason not to.

BUILDING: ${JSON.stringify(building)}
GOOGLE SOLAR DATA (owner may have edited these numbers): ${JSON.stringify(solar)}
OWNER PREFERENCES: ${JSON.stringify(preferences)}
CANDIDATE OPTIONS (modeled economics for this roof): ${JSON.stringify(options)}

Return JSON for the recommended plan only.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: PLAN_SCHEMA,
          temperature: 0.5,
        },
      }),
    })
    if (!upstream.ok) {
      const detail = await upstream.text()
      return Response.json({ error: `gemini ${upstream.status}`, detail }, { status: 502 })
    }
    const data = await upstream.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return Response.json({ error: 'empty gemini response' }, { status: 502 })

    const plan = JSON.parse(text)
    return Response.json({ plan })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 })
  }
}
