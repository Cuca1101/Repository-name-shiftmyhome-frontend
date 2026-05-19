/**
 * Shared long-form copy blocks for SEO landing pages (300–600 words with intros).
 */

export const SEO_KEYWORD_PHRASES = [
  'Removals From £40',
  'House Removals',
  'Furniture Removals',
  'Man with Van Services',
  'Office Relocations',
  'Long Distance Removals',
  'Urgent Removals',
  'Student Moves',
  'Furniture Delivery',
  'Trusted UK Movers',
]

/** @param {string} cityName @param {number} seed */
export function pickContentVariant(cityName, seed) {
  let h = seed
  for (let i = 0; i < cityName.length; i += 1) {
    h = (h + cityName.charCodeAt(i) * (i + 3)) % 997
  }
  return h
}

/**
 * @param {string} serviceLabel e.g. "office removals"
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string, moveContext: string }} region
 * @param {number} variant
 */
export function buildBodySections(serviceLabel, cityName, region, variant) {
  const v = variant
  const pricing = [
    {
      heading: `Transparent ${serviceLabel} pricing in ${cityName}`,
      paragraphs: [
        `ShiftMyHome quotes online from your addresses, inventory, and access details — so the price reflects the job, not a guess. Many ${cityName} moves start from competitive rates when the load is small or local; larger house moves are priced on volume, crew, and distance. You see the estimate before you book.`,
        `We factor parking, stairs, lift access, and walking distance into the quote wizard. That helps avoid surprises on move day and keeps ${serviceLabel} in ${cityName} straightforward for customers and crews alike.`,
      ],
    },
    {
      heading: 'What to expect on move day',
      paragraphs: [
        `Your crew confirms timing, vehicle size, and any packing needs before arrival. We use blankets, straps, and careful loading as standard on booked ${serviceLabel} jobs across ${region.areaPhrase}.`,
        `Whether you are moving within ${cityName} or heading to another Scottish city or UK postcode, you have one point of contact and clear updates. Goods-in-transit cover applies on confirmed bookings — list fragile or high-value pieces when you quote.`,
      ],
    },
    {
      heading: `Why choose ShiftMyHome in ${cityName}`,
      paragraphs: [
        `We are based in Glasgow with Scotland-wide coverage and regular routes through ${region.label}. Local knowledge matters for ${region.moveContext} — we plan access and parking before we arrive.`,
        `Customers choose us for upfront pricing, professional movers, and flexible options from man-with-van loads to full removals. Add packing, dismantling, or a specific arrival window in the quote notes and we shape the job around your plan.`,
      ],
    },
  ]

  const access = [
    {
      heading: `Planning access in ${cityName}`,
      paragraphs: [
        `${cityName} properties often involve stairs, limited parking, or courtyard carries. Tell us about floors, lifts, and awkward access in your quote so we assign the right crew and allow enough time on site.`,
        `For ${serviceLabel} in busy streets or residential courts, early booking helps secure a practical arrival slot. We confirm honestly if same-day cover is possible when schedules are tight.`,
      ],
    },
    {
      heading: `Local routes and UK coverage`,
      paragraphs: [
        `From ${cityName} we run local jobs daily and longer routes across Scotland and the UK when you need to relocate further. Distance, volume, and date all feed into your live online estimate.`,
        `Our teams know ${region.areaPhrase} and common commuter links between major cities. That supports reliable scheduling for ${serviceLabel} without treating every street the same.`,
      ],
    },
    {
      heading: 'Straightforward booking',
      paragraphs: [
        `Use the instant quote wizard below with pickup and delivery postcodes, your item list, and preferred date. No obligation — adjust inventory or addresses until the scope matches your move.`,
        `Prefer to speak first? Call or WhatsApp with your ${cityName} details and we will talk through options before you confirm.`,
      ],
    },
  ]

  const choose = v % 3
  return [pricing[choose], access[(choose + 1) % 3], pricing[(choose + 2) % 3]]
}

/**
 * Natural keyword sentence for the bottom of the prose section.
 * @param {string} cityName
 * @param {string} serviceLabel
 */
export function buildKeywordSentence(cityName, serviceLabel) {
  const picks = SEO_KEYWORD_PHRASES.filter((_, i) => (cityName.length + serviceLabel.length + i) % 2 === 0).slice(0, 6)
  return `Popular searches we help with in ${cityName} include ${picks.join(', ')}, and professional ${serviceLabel} through ShiftMyHome.`
}
