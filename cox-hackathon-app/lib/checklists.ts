export interface ChecklistItem {
  id: string
  task: string
  description: string
}

export const CHECKLISTS: Record<string, ChecklistItem[]> = {
  'cool-roof': [
    {
      id: 'cool-roof-1',
      task: 'Commission a roof audit',
      description: 'Hire a licensed roofing contractor to assess existing membrane condition, drainage, and any repairs needed before coating application.',
    },
    {
      id: 'cool-roof-2',
      task: 'Pre-qualify for Georgia Power rebate',
      description: 'Submit a pre-application to Georgia Power\'s Commercial Cool Roof Rebate program ($0.15/sq ft). Pre-approval must happen before installation.',
    },
    {
      id: 'cool-roof-3',
      task: 'Collect 3 competitive quotes',
      description: 'Get bids from at least 3 Georgia-licensed roofing contractors for elastomeric or silicone cool-roof coating. Compare warranty terms (look for 10+ yr).',
    },
    {
      id: 'cool-roof-4',
      task: 'Complete surface preparation',
      description: 'Power-wash the roof deck, repair any blisters or cracks, and prime bare areas. Clean substrate is essential for coating adhesion and warranty validity.',
    },
    {
      id: 'cool-roof-5',
      task: 'Apply cool-roof coating',
      description: 'Install two coats of ENERGY STAR-rated elastomeric coating per manufacturer specs (typically 1–1.5 gal/100 sq ft per coat). Inspect for uniform coverage.',
    },
    {
      id: 'cool-roof-6',
      task: 'Submit Georgia Power + Federal rebate paperwork',
      description: 'File the Georgia Power Commercial Rebate claim within 90 days of completion. File IRS Form 5695 (residential) or Form 3468 (commercial) for the Federal Energy Tax Credit in the applicable tax year.',
    },
  ],

  solar: [
    {
      id: 'solar-1',
      task: 'Structural assessment for 4 lbs/sq ft live load',
      description: 'Hire a licensed structural engineer to verify the roof deck and framing can support the additional 4 lbs/sq ft dead load from panel racking. Required by Atlanta Building Code § 109.',
    },
    {
      id: 'solar-2',
      task: 'Collect 3 quotes from NABCEP-certified installers',
      description: 'Request bids from at least 3 installers holding NABCEP PV Installation Professional certification. Verify each includes panel brand, inverter type, production estimate, and warranty terms.',
    },
    {
      id: 'solar-3',
      task: 'Pull Atlanta building permit',
      description: 'Submit electrical and structural drawings to the City of Atlanta Office of Buildings. Commercial rooftop PV requires a building permit and electrical permit. Typical review time: 2–4 weeks.',
    },
    {
      id: 'solar-4',
      task: 'Confirm Federal ITC eligibility (Form 5695 / 3468)',
      description: 'Verify you qualify for the 30% Federal Investment Tax Credit under IRA 2022. Residential owners use Form 5695; commercial owners use Form 3468. Consult a CPA if uncertain.',
    },
    {
      id: 'solar-5',
      task: 'Submit Georgia Power net metering interconnection application',
      description: 'File the Distributed Generation Interconnection Application with Georgia Power before installation begins. Processing takes 10–30 business days. Required for grid-tied systems.',
    },
    {
      id: 'solar-6',
      task: 'Schedule installation',
      description: 'Coordinate with your chosen installer for racking, panel, and inverter installation. Confirm a pre-inspection walkthrough. Typical commercial install: 2–5 days.',
    },
    {
      id: 'solar-7',
      task: 'Pass inspection and receive Permission to Operate (PTO)',
      description: 'Schedule the City of Atlanta electrical inspection, then submit the passing inspection report to Georgia Power to receive PTO. The system must not be energized until PTO is granted.',
    },
  ],

  'green-roof-extensive': [
    {
      id: 'ext-1',
      task: 'Structural sign-off for 12 lbs/sq ft saturated load',
      description: 'Engage a licensed structural engineer to review dead-load capacity for the saturated growing medium (typically 10–15 lbs/sq ft). Submit engineer\'s letter to the City of Atlanta Office of Buildings.',
    },
    {
      id: 'ext-2',
      task: 'Obtain Atlanta stormwater management permit',
      description: 'File a Land Disturbance Permit or stormwater plan with the City of Atlanta Department of Watershed Management if the green roof is part of a broader stormwater management plan.',
    },
    {
      id: 'ext-3',
      task: 'Upgrade waterproofing membrane',
      description: 'Install a root-resistant waterproofing membrane (EPDM, TPO, or modified bitumen with root-barrier) below the growing medium. This is critical — root penetration voids the roof warranty.',
    },
    {
      id: 'ext-4',
      task: 'Install drainage layer',
      description: 'Lay a drainage mat or gravel layer (1–2 inches) above the waterproofing. Confirm all roof drains have overflow scuppers per Atlanta Building Code.',
    },
    {
      id: 'ext-5',
      task: 'Install growing medium',
      description: 'Spread 2–4 inches of lightweight expanded shale or engineered green-roof substrate. Do not use garden soil — it compacts and exceeds load limits.',
    },
    {
      id: 'ext-6',
      task: 'Plant sedum or native species',
      description: 'Install sedum plugs or drought-tolerant native groundcovers (e.g. Delosperma, native sedges). Allow 1 full growing season to establish before reducing irrigation.',
    },
    {
      id: 'ext-7',
      task: 'Apply for City of Atlanta Stormwater Credit',
      description: 'Submit a Green Infrastructure Credit application to Atlanta Watershed Management. An approved extensive green roof can reduce stormwater utility fees by up to 50%. Include as-built drawings and photos.',
    },
  ],

  'green-roof-intensive': [
    {
      id: 'int-1',
      task: 'Hire a licensed structural engineer (mandatory)',
      description: 'Intensive green roofs impose 80–150+ lbs/sq ft saturated. A licensed structural engineer\'s stamped drawings are required by Atlanta Building Code before any permit is issued.',
    },
    {
      id: 'int-2',
      task: 'Engage a landscape architect',
      description: 'Georgia law requires a licensed landscape architect for commercial planting designs exceeding 1,000 sq ft. Coordinate with the structural engineer early — tree locations affect load distribution.',
    },
    {
      id: 'int-3',
      task: 'Pull building permit and landscape permit',
      description: 'Submit plans to the City of Atlanta Office of Buildings for the structural work and to Atlanta Parks & Recreation if the design includes public amenity space. Landscape permit required for plans with trees.',
    },
    {
      id: 'int-4',
      task: 'Complete structural reinforcement',
      description: 'Execute any beam, column, or deck upgrades specified by the structural engineer before roofing work begins. This is typically the longest and most expensive phase.',
    },
    {
      id: 'int-5',
      task: 'Install root-barrier waterproofing',
      description: 'Lay a high-density polyethylene root barrier over a 60-mil EPDM or PVC waterproofing membrane. Intensive roots can penetrate standard membranes within 5 years.',
    },
    {
      id: 'int-6',
      task: 'Install drip irrigation system',
      description: 'Intensive roofs require supplemental irrigation during Atlanta\'s summer dry spells (July–August). Install a drip irrigation network with a timer and rain sensor to reduce water waste.',
    },
    {
      id: 'int-7',
      task: 'Apply for City of Atlanta Green Space Grant',
      description: 'Submit a Green Space Grant application to the City of Atlanta Office of Resilience. Qualifying rooftop parks and community gardens can receive grants up to $25,000. Include community-benefit documentation.',
    },
  ],

  rainwater: [
    {
      id: 'rain-1',
      task: 'Audit existing roof drains and gutters',
      description: 'Map all downspouts and determine the catchment area. Clean gutters, inspect downspout condition, and identify the best location for the first-flush diverter and cistern.',
    },
    {
      id: 'rain-2',
      task: 'Obtain Fulton County rainwater harvesting permit',
      description: 'Under Georgia O.C.G.A. § 12-5-1, rainwater harvesting systems used for non-potable purposes are generally permitted but must comply with county plumbing codes. File a plumbing permit with Fulton County Building & Zoning.',
    },
    {
      id: 'rain-3',
      task: 'Size the cistern',
      description: 'Use the formula: cistern size (gallons) = roof catchment area (sq ft) × annual rainfall (50 in/yr) × 0.623 × collection efficiency (0.85). A 2,000 sq ft roof supports roughly a 5,000-gallon cistern.',
    },
    {
      id: 'rain-4',
      task: 'Install cistern and first-flush diverter',
      description: 'Install a polyethylene or fiberglass cistern at grade or below grade. A first-flush diverter (1 gallon per 100 sq ft of roof) must be installed to discard the first, most contaminated runoff of each rain event.',
    },
    {
      id: 'rain-5',
      task: 'Add filtration if used for non-irrigation purposes',
      description: 'If harvested water will be used for toilet flushing or HVAC make-up water, install a sediment filter (100 micron), activated carbon filter, and UV disinfection unit per Atlanta plumbing code.',
    },
    {
      id: 'rain-6',
      task: 'Apply for City of Atlanta Stormwater Credit',
      description: 'Submit a Green Infrastructure Credit application to Atlanta Watershed Management with as-built drawings showing cistern volume and overflow routing. Approved systems can reduce stormwater utility fees by 10–25%.',
    },
  ],

  beekeeping: [
    {
      id: 'bee-1',
      task: 'Obtain City of Atlanta beekeeping permit (~$25)',
      description: 'File a Keeping of Bees application under Atlanta City Code § 114-434 with the City of Atlanta Department of Planning. Annual permit fee is approximately $25. Requires a site plan showing hive placement.',
    },
    {
      id: 'bee-2',
      task: 'Complete a Metro Atlanta Beekeepers Association course',
      description: 'MABA offers a beginner beekeeping course each spring (typically January–March). The 8-week course covers hive management, swarm prevention, and honey harvesting. Strongly recommended before purchasing equipment.',
    },
    {
      id: 'bee-3',
      task: 'Purchase equipment (~$600–$800 per hive)',
      description: 'Budget approximately $600–$800 per hive for a complete setup: 2 deep hive bodies, 2 honey supers, frames, foundation, inner and outer cover, bottom board, entrance reducer, smoker, hive tool, veil, and gloves.',
    },
    {
      id: 'bee-4',
      task: 'Obtain lease/HOA approval',
      description: 'Review your building lease and any association rules. Many commercial leases require landlord consent for any rooftop modifications. Get written approval before purchasing bees.',
    },
    {
      id: 'bee-5',
      task: 'Install hives in April–May with 2 nucleus colonies',
      description: 'Order 2 nucleus colonies (5-frame "nucs") from a Georgia-registered beekeeper or MABA supplier for April–May delivery — coinciding with Atlanta\'s spring nectar flow. Install on a flat, sunny, sheltered section of the roof.',
    },
    {
      id: 'bee-6',
      task: 'Conduct monthly inspections',
      description: 'Inspect hives every 7–14 days during the active season (April–October) and monthly in winter. Check for queen presence, adequate food stores, signs of disease (Varroa mites, American foulbrood), and swarm cells.',
    },
    {
      id: 'bee-7',
      task: 'First honey harvest (months 6–12)',
      description: 'A new colony established in spring can yield 20–60 lbs of honey in its first year. Harvest when frames are 80%+ capped. Use a hand extractor or outsource to a local honey house. Label per Georgia Department of Agriculture regulations if selling.',
    },
  ],
}
