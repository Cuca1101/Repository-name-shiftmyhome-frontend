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
    `ShiftMyHome provides professional ${cityName} removals, with local movers who know ${region.areaPhrase}. Whether you need a removal company for a full house move, man with van ${cityName}, or furniture delivery, we plan access, parking, and loading so your ${region.moveContext} are handled with care.`,
    `Looking for a removal company in ${cityName}? We support house removals across ${region.label}, from compact flats to larger family homes. Our local movers confirm vehicle size, crew, and timing before move day — not a vague estimate.`,
    `From ${cityName} to anywhere in Scotland or the UK, our moving company delivers structured removals with clear communication. We regularly work in ${region.areaPhrase} and understand the streets, parking, and access that matter for ${cityName} removals.`,
    `Book ${cityName} removals online in minutes. ShiftMyHome combines house removals, man with van, and furniture delivery with insured crews and transparent pricing for moves within ${region.label} or further afield.`,
    `Need local movers in ${cityName}? Our removal company covers ${region.areaPhrase} daily — house removals, partial loads, and furniture collections quoted from your actual addresses and inventory.`,
    `Customers searching for ${cityName} removals, removal company ${cityName}, or man with van ${cityName} get one instant quote path. We serve ${region.moveContext} and longer UK routes with the same careful loading standards.`,
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
    `Based in Glasgow, we combine Scotland-wide coverage with local movers who know ${regionLabel}. ${cityName} house removals are fully insured on booked jobs, and same-day man with van slots are sometimes available when you quote early.`,
    `You receive a transparent online price from our removal company, experienced movers, and clear updates before arrival. Tell us about stairs, parking, or fragile items so your ${cityName} removals crew arrives prepared.`,
    `Need packing help, extra hands, or a specific time window? Add it in the quote wizard — we shape each ${cityName} removal around your access, furniture delivery needs, and timing.`,
    `Our ${cityName} removal company quotes house removals, furniture delivery, and man with van jobs the same way — real addresses, real items, and honest crew sizing for ${regionLabel}.`,
    `Whether you are comparing local movers or booking a moving company for the first time in ${cityName}, you get upfront pricing without phone-tag. Coverage spans ${regionLabel} and UK routes.`,
    `Furniture delivery ${cityName}, flat removals, and full house moves share one platform. Local crews know ${regionLabel} postcodes and typical access for local properties.`,
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
    {
      q: `How do I book a removal company in ${cityName}?`,
      a: `Use our instant quote wizard with your ${cityName} pickup and delivery postcodes, list your items, and receive a live price. You can book house removals, man with van, or furniture delivery in one flow.`,
    },
    {
      q: `Are you local movers in ${cityName}?`,
      a: `We provide local movers and removal company services across ${region.areaPhrase}, with Scotland-wide routes when you are moving further. Crews are assigned based on your quote details.`,
    },
    {
      q: `What is included in ${cityName} removals pricing?`,
      a: 'Your quote reflects volume, distance, access, and crew size. Insurance applies on confirmed bookings; add packing or extra stops in the wizard so pricing stays transparent.',
    },
  ]
  const extraStart = variant % extras.length
  const picked = [extras[extraStart % extras.length], extras[(extraStart + 1) % extras.length]]
  return [...base, ...picked]
}

export { pickSeoContentVariant as pickContentVariant }
