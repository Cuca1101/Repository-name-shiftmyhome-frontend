/**
 * Shared long-form copy blocks for SEO landing pages (Scotland keyword focus).
 */

export const SEO_KEYWORD_PHRASES = [
  'Scotland Removals',
  'House Removals Scotland',
  'Man and Van Scotland',
  'Man with Van Hire',
  'Furniture Delivery Scotland',
  'Furniture Removals',
  'Local Movers Scotland',
  'Removal Company Scotland',
  'Office Removals',
  'Student Moves Scotland',
  'Long Distance Removals',
  'Same Day Removals',
  'Sofa Delivery Scotland',
  'Flat Removals',
  'Cheap Removals Scotland',
  'House Movers Scotland',
  'Moving Company Scotland',
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
      heading: `${serviceLabel} pricing in ${cityName}`,
      paragraphs: [
        `ShiftMyHome quotes ${serviceLabel} in ${cityName} online from your addresses, inventory and access — so the price matches the job across Scotland. Small local loads and man and van jobs often cost less; larger house moves price on volume, crew and distance.`,
        `Parking, stairs, lifts and walking distance feed into the quote wizard. That keeps ${serviceLabel} in ${cityName} clear for customers comparing local movers and removal companies.`,
      ],
    },
    {
      heading: `What to expect on move day in ${cityName}`,
      paragraphs: [
        `Your crew confirms timing, vehicle size and packing needs before arrival. Blankets, straps and careful loading are standard on booked ${serviceLabel} jobs across ${region.areaPhrase}.`,
        `Whether you move within ${cityName} or to another Scotland city or UK postcode, you have one contact and clear updates. Goods-in-transit cover applies on confirmed bookings — list fragile items when you quote.`,
      ],
    },
    {
      heading: `Why choose local movers in ${cityName}`,
      paragraphs: [
        `We are based in Glasgow with Scotland-wide coverage and regular routes through ${region.label}. Local knowledge matters for ${region.moveContext} — we plan access and parking before we arrive.`,
        `Customers choose us for upfront pricing, professional Scotland movers, and flexible options from man and van to full house removals and furniture delivery. Add packing or a timed window in the quote notes.`,
      ],
    },
  ]

  const access = [
    {
      heading: `Access and parking for ${serviceLabel} in ${cityName}`,
      paragraphs: [
        `${cityName} jobs often involve stairs, limited parking or courtyard carries. Tell us about floors, lifts and awkward access so we assign the right crew for ${serviceLabel}.`,
        `For busy streets across ${region.areaPhrase}, early booking helps secure a practical slot. We confirm honestly if same day man and van or removals cover is possible.`,
      ],
    },
    {
      heading: `Local Scotland routes and UK coverage`,
      paragraphs: [
        `From ${cityName} we run local removals daily and long distance routes across Scotland and the UK. Distance, volume and date feed into your live online estimate for ${serviceLabel}.`,
        `Our teams know ${region.areaPhrase} and common links between Glasgow, Edinburgh, Aberdeen and other Scotland centres — reliable scheduling without treating every street the same.`,
      ],
    },
    {
      heading: `Book ${serviceLabel} in ${cityName} online`,
      paragraphs: [
        `Use the instant quote wizard with pickup and delivery postcodes, your item list and preferred date. No obligation — adjust inventory until the scope matches your ${cityName} move.`,
        `Prefer to speak first? Call or WhatsApp with your ${cityName} details and we will talk through house removals, man and van or furniture delivery before you confirm.`,
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
  const picks = SEO_KEYWORD_PHRASES.filter(
    (_, i) => (cityName.length + serviceLabel.length + i) % 2 === 0,
  ).slice(0, 7)
  return `Popular Scotland searches we help with from ${cityName} include ${picks.join(', ')}, plus professional ${serviceLabel} with instant online quotes across Scotland.`
}
