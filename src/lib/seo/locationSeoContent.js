/**
 * Long-form SEO content for Scotland location removal pages.
 */

import { pickSeoContentVariant } from './seoKeywordHelpers.js'

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string, moveContext: string }} region
 * @param {number} variant
 */
export function buildLocationIntro(cityName, region, variant) {
  const intros = [
    `ShiftMyHome provides professional removals in ${cityName}, with crews who know ${region.areaPhrase}. Whether you are relocating within the town or moving to another part of Scotland, we plan access, parking, and loading so your ${region.moveContext} are handled with care.`,
    `Looking for dependable removals in ${cityName}? We support moves across ${region.label}, from compact flats to full-house relocations. Our team confirms vehicle size, crew, and timing before move day.`,
    `From ${cityName} to anywhere in Scotland or the UK, ShiftMyHome delivers structured removals with clear communication. We regularly work in ${region.areaPhrase} and understand the practical details that matter on local streets.`,
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
    `Based in Glasgow, we combine Scotland-wide coverage with local crews who know ${regionLabel}. Moves are fully insured on booked jobs, and same-day slots are sometimes available when you quote early.`,
    `You receive a transparent online price, experienced movers, and clear updates before arrival. Tell us about stairs, parking, or fragile items so the ${cityName} crew arrives prepared.`,
    `Need packing help, extra hands, or a specific time window? Add it in the quote wizard — we shape each ${cityName} job around your access and timing.`,
  ]
  return lines[variant % lines.length]
}

/**
 * @param {string} cityName
 * @param {{ areaPhrase: string, label: string, moveContext: string }} region
 * @param {number} variant
 */
export function buildLocationRemovalsBodySections(cityName, region, variant) {
  return [
    {
      heading: `House removals in ${cityName}`,
      paragraphs: [
        `Our house removals service in ${cityName} covers full and partial home moves. We assign the right van and crew from your inventory list, protect furniture with blankets and straps, and confirm access details before arrival.`,
        `From ${region.moveContext} to larger family homes, we plan loading order and route timing so your belongings travel safely — locally within ${cityName} or on longer Scottish and UK routes.`,
      ],
    },
    {
      heading: `Man with van ${cityName}`,
      paragraphs: [
        `A man with van crew in ${cityName} suits smaller loads — single items, flat moves, and quick collections. It is often the most efficient option when you do not need a full removal team.`,
        `Quote with pickup and delivery addresses, item sizes, and any stairs or parking constraints. We confirm honestly whether a van load or larger removal vehicle is the better fit.`,
      ],
    },
    {
      heading: `Furniture removals and delivery in ${cityName}`,
      paragraphs: [
        `We help with furniture removals in ${cityName} — sofas, beds, wardrobes, and bulky pieces that need two people and proper equipment. Collections from shops, private sellers, and marketplace purchases are all quoted the same transparent way.`,
        `Tell us dimensions if you know them, and whether assembly or disassembly is required. Our furniture delivery teams work across ${region.areaPhrase} with careful handling as standard.`,
      ],
    },
    {
      heading: 'Packing and moving services',
      paragraphs: [
        `Add packing materials, fragile wrapping, or dismantling in your online quote when you need extra help in ${cityName}. We can supply boxes and protective materials, or work with what you have already packed.`,
        `Packing support is priced from your inventory and access details — not a hidden add-on on move day. That keeps ${cityName} moves predictable for customers and crews alike.`,
      ],
    },
    {
      heading: `Local and long-distance removals from ${cityName}`,
      paragraphs: [
        `Local removals within ${cityName} and ${region.label} are booked daily. We also run longer routes across Scotland and the UK when you are relocating further — distance, volume, and date all feed into your live quote.`,
        `Inter-city moves from ${cityName} to Glasgow, Edinburgh, Aberdeen, and other major centres are common. Enter both postcodes in the wizard for an accurate price before you commit.`,
      ],
    },
    {
      heading: `Why choose ShiftMyHome for ${cityName} removals`,
      paragraphs: [
        `Customers choose ShiftMyHome for upfront online pricing, professional movers, and Scotland-wide coverage backed by local knowledge of ${region.areaPhrase}. Goods-in-transit cover applies on confirmed bookings.`,
        `You get clear communication before move day, flexible options from man with van to full house removals, and a quote process that takes minutes — not days of phone calls.`,
      ],
    },
  ]
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
      a: `Pricing depends on volume, distance, access, and date. Use our instant quote wizard with your ${cityName} pickup and delivery addresses for a live estimate — no obligation.`,
    },
    {
      q: `Do you cover postcodes around ${cityName}?`,
      a: `Yes. We serve ${region.areaPhrase} and can quote moves from ${cityName} to other Scottish towns or UK destinations.`,
    },
    {
      q: `Are moves in ${cityName} fully insured?`,
      a: 'Goods-in-transit cover applies on booked jobs. Share high-value or fragile items in your quote so we can confirm the right approach.',
    },
    {
      q: `Can I get a same-day removal in ${cityName}?`,
      a: 'Same-day availability depends on crew schedules — quote with your preferred date and we confirm honestly if we can help.',
    },
    {
      q: `How far in advance should I book removals in ${cityName}?`,
      a: 'Two to four weeks is ideal for house moves; we also accommodate shorter notice when crews are available.',
    },
  ]
  const extras = [
    {
      q: `Do you offer man with van as well as house removals in ${cityName}?`,
      a: 'Yes. Smaller loads often suit a man-with-van crew; the quote wizard recommends the right option from your inventory.',
    },
    {
      q: `Can you collect furniture for delivery in ${cityName}?`,
      a: 'Yes — add collection and delivery addresses, item details, and any stairs or parking notes for an accurate furniture delivery quote.',
    },
    {
      q: `Do you handle office or student moves in ${cityName}?`,
      a: 'We provide office relocations and student moves where availability allows. Select the relevant service in the quote wizard or mention it in your notes.',
    },
  ]
  const pick = variant % 2 === 0 ? extras[0] : extras[1]
  return [...base, pick, extras[2]]
}

export { pickSeoContentVariant as pickContentVariant }
