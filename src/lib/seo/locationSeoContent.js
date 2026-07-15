/**
 * Long-form SEO content for Scotland location removal pages.
 * Query-led copy targeting Scotland searches: city removals, man with van, house movers.
 */

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string, moveContext: string }} region
 * @param {number} variant
 */
export function buildLocationIntro(cityName, region, variant) {
  const intros = [
    `Looking for ${cityName} removals? ShiftMyHome is a Scotland removal company with local movers who know ${region.areaPhrase}. Book house removals, man with van ${cityName}, or furniture delivery — we plan access, parking and loading for ${region.moveContext}.`,
    `${cityName} house removals from a local removal company. We cover flats and family homes across ${region.label}, quote man with van or a full crew, and confirm vehicle size before move day so you are not left guessing.`,
    `From ${cityName} removals to anywhere in Scotland or the UK, our moving company delivers structured house moves with clear communication. Local movers who work ${region.areaPhrase} daily understand the streets, parking and access that matter.`,
    `Book ${cityName} removals online in minutes. House removals, man and van hire, and furniture delivery with insured local movers — whether you stay in ${region.label} or relocate further across Scotland.`,
    `Need local movers in ${cityName}? Our removal company covers ${region.areaPhrase} for house removals, flat moves, cheap partial loads and furniture collection — priced from your real addresses and inventory.`,
    `Searches for ${cityName} removals, removal company ${cityName}, man and van ${cityName}, or house movers ${cityName} use one instant quote path. We handle ${region.moveContext} and longer UK routes with the same careful loading standards.`,
  ]
  return intros[variant % intros.length]
}

/**
 * @param {string} cityName
 * @param {string} regionLabel
 * @param {number} variant
 */
export function buildLocationIntroSecondary(cityName, regionLabel, variant) {
  const lines = [
    `Based in Glasgow with Scotland-wide coverage, we send local movers who know ${regionLabel}. ${cityName} house removals are insured on booked jobs, and same day man with van is sometimes available when you quote early.`,
    `Get a transparent online price from a Scottish removal company — experienced house movers, clear updates, and honest crew sizing. Tell us about stairs, parking or fragile items so your ${cityName} removals team arrives prepared.`,
    `Need packing help, extra hands, or a timed window? Add it in the quote wizard. We shape each ${cityName} removal around access, furniture delivery needs and timing — not a generic UK call-centre script.`,
    `Our ${cityName} removal company quotes house removals, furniture delivery and man with van the same way: real postcodes, real items, honest pricing for ${regionLabel} and wider Scotland routes.`,
    `Comparing local movers or booking a moving company in ${cityName} for the first time? You get upfront pricing without phone-tag. Coverage spans ${regionLabel}, Scotland cities and UK destinations.`,
    `Furniture delivery ${cityName}, flat removals and full house moves share one platform. Local crews know ${regionLabel} postcodes and typical access for Scottish properties.`,
  ]
  return lines[variant % lines.length]
}

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string, moveContext: string }} region
 * @param {number} variant
 */
export function buildLocationRemovalsBodySections(cityName, region, variant) {
  const sections = [
    {
      heading: `House removals in ${cityName}`,
      paragraphs: [
        `House removals in ${cityName} cover full and partial home moves across Scotland. We assign the right van and crew from your inventory, protect furniture with blankets and straps, and confirm access before arrival.`,
        `From ${region.moveContext} to larger family homes, we plan loading order and route timing — locally within ${cityName}, across ${region.label}, or on longer Scottish and UK house moves.`,
      ],
    },
    {
      heading: `Man and van ${cityName}`,
      paragraphs: [
        `Man and van hire in ${cityName} suits smaller loads — single items, flat moves, sofa delivery and quick collections. It is often the best option when you do not need a full house removals team.`,
        `Quote with pickup and delivery addresses, item sizes, and stairs or parking notes. We confirm honestly whether a man with van or a larger removal vehicle is the better fit for ${cityName}.`,
      ],
    },
    {
      heading: `Furniture delivery and removals in ${cityName}`,
      paragraphs: [
        `Furniture delivery ${cityName} covers sofas, beds, wardrobes and bulky pieces that need two people. Collections from shops, private sellers and marketplace buys are quoted the same transparent way as furniture removals.`,
        `Tell us dimensions where known, and whether assembly is required. Our furniture movers work across ${region.areaPhrase} with careful handling as standard for Scotland deliveries.`,
      ],
    },
    {
      heading: `Flat removals and packing in ${cityName}`,
      paragraphs: [
        `Flat removals in ${cityName} often mean stairs, tight closes and limited parking. Add packing materials, fragile wrapping or dismantling in your online quote when you need extra help.`,
        `Packing support is priced from your inventory — not a hidden add-on on move day. That keeps ${cityName} moves predictable for customers comparing removal companies in Scotland.`,
      ],
    },
    {
      heading: `Local and long distance removals from ${cityName}`,
      paragraphs: [
        `Local removals within ${cityName} and ${region.label} are booked daily. We also run long distance removals across Scotland and the UK — distance, volume and date feed into your live quote.`,
        `Inter-city moves from ${cityName} to Glasgow, Edinburgh, Aberdeen, Dundee and other Scotland centres are common. Enter both postcodes for an accurate house removals price before you book.`,
      ],
    },
    {
      heading: `Why book ${cityName} removals with ShiftMyHome`,
      paragraphs: [
        `Customers searching ${cityName} removals, local movers ${cityName} and removal company ${cityName} choose ShiftMyHome for upfront online pricing, professional Scotland movers, and local knowledge of ${region.areaPhrase}.`,
        `You get clear communication before move day, flexible options from man and van to full house removals, furniture delivery when needed, and a quote that takes minutes — not days of phone calls.`,
      ],
    },
  ]
  const offset = variant % sections.length
  return [...sections.slice(offset), ...sections.slice(0, offset)]
}

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string }} region
 * @param {number} variant
 */
export function buildLocationFaqs(cityName, region, variant) {
  const base = [
    {
      q: `How much do removals cost in ${cityName}?`,
      a: `House removals and man with van pricing depends on volume, distance, access and date. Use our instant quote with your ${cityName} pickup and delivery addresses for a live Scotland estimate — no obligation.`,
    },
    {
      q: `Do you cover postcodes around ${cityName}?`,
      a: `Yes. We serve ${region.areaPhrase} and quote moves from ${cityName} to other Scottish towns or UK destinations.`,
    },
    {
      q: `Are ${cityName} removals insured?`,
      a: 'Goods-in-transit cover applies on booked jobs. Share high-value or fragile items in your quote so we confirm the right approach.',
    },
    {
      q: `Can I get same day removals or man and van in ${cityName}?`,
      a: 'Same day availability depends on crew schedules — quote with your preferred date and we confirm honestly if local movers can help.',
    },
    {
      q: `How far in advance should I book house removals in ${cityName}?`,
      a: 'Two to four weeks is ideal for house moves; we also take shorter notice when man with van or removal crews are free.',
    },
  ]
  const extras = [
    {
      q: `Do you offer man and van as well as house removals in ${cityName}?`,
      a: 'Yes. Smaller loads often suit man and van hire; the quote wizard recommends the right option from your inventory.',
    },
    {
      q: `Can you do furniture delivery in ${cityName}?`,
      a: 'Yes — add collection and delivery addresses, item details, and stairs or parking notes for sofa delivery or furniture moves.',
    },
    {
      q: `Do you handle office removals or student moves in ${cityName}?`,
      a: 'We provide office removals and student moves where availability allows. Select the service in the quote wizard or mention it in your notes.',
    },
    {
      q: `How do I book a removal company in ${cityName}?`,
      a: `Use the instant quote with ${cityName} postcodes, list your items, and get a live price. Book house removals, man with van or furniture delivery in one flow.`,
    },
    {
      q: `Are you local movers for ${cityName} and Scotland?`,
      a: `We provide local movers across ${region.areaPhrase}, with Scotland-wide and UK routes when you move further. Crews are assigned from your quote details.`,
    },
    {
      q: `What is included in ${cityName} removals pricing?`,
      a: 'Your quote reflects volume, distance, access and crew size. Insurance applies on confirmed bookings; add packing or stops in the wizard so pricing stays clear.',
    },
  ]
  const extraStart = variant % extras.length
  const picked = [extras[extraStart % extras.length], extras[(extraStart + 1) % extras.length]]
  return [...base, ...picked]
}
