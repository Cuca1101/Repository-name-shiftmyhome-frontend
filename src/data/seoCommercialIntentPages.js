/**
 * Additional high-intent commercial SEO pages (IKEA, marketplace, homeware).
 * Imported by seoIntentPages.js — descriptive brand usage only, no partnership claims.
 */

/** @typedef {import('./seoIntentPages.js').IntentPageDef} IntentPageDef */

/** @type {IntentPageDef[]} */
export const COMMERCIAL_INTENT_PAGES = [
  {
    path: '/ikea-furniture-delivery',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'IKEA Furniture Delivery in Scotland',
    metaDescription:
      'We can help collect and deliver IKEA furniture across Scotland — not an official IKEA partner. Two-person delivery, careful handling, and instant online quotes from ShiftMyHome.',
    heroTeaser: 'Collection and delivery for IKEA flat-pack and bulky items.',
    intro:
      'Bought furniture from IKEA and need it home without the hassle? ShiftMyHome can collect from an IKEA store or help with delivery to your address across Scotland. We are an independent moving company — not affiliated with or authorised by IKEA.',
    introSecondary:
      'Add collection and delivery postcodes, item types, and access details in the quote wizard. Flat-pack boxes, sofas, beds, and wardrobes are quoted transparently before you book.',
    serviceBullets: [
      'Store collection or address-to-address delivery',
      'Two-person teams for bulky IKEA items',
      'Scotland-wide routes from Glasgow base',
    ],
    faqs: [
      {
        q: 'Are you an official IKEA delivery partner?',
        a: 'No. ShiftMyHome is an independent removals and delivery company. We help customers who purchased IKEA items and need transport — we do not represent IKEA.',
      },
      {
        q: 'Can you deliver IKEA furniture upstairs?',
        a: 'Yes where access allows — tell us about floors, lifts, and stairs in your quote.',
      },
      {
        q: 'Do you assemble IKEA flat-pack furniture?',
        a: 'Assembly can be discussed when you quote. We focus on safe delivery; mention assembly needs in your notes.',
      },
    ],
    extraRelated: [
      { href: '/ikea-delivery-glasgow', label: 'IKEA delivery Glasgow' },
      { href: '/flat-pack-furniture-delivery', label: 'Flat-pack delivery' },
    ],
  },
  {
    path: '/ikea-sofa-delivery-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'Furniture Delivery',
    h1: 'IKEA Sofa Delivery in Edinburgh',
    metaDescription:
      'Independent IKEA sofa delivery in Edinburgh — we can collect from store or deliver to your address. Not an official IKEA service. Quote online with ShiftMyHome.',
    heroTeaser: 'Two-person sofa delivery for Edinburgh IKEA purchases.',
    intro:
      'Need an IKEA sofa delivered in Edinburgh? We provide independent two-person delivery — we are not an official IKEA partner. Quote with collection point, delivery address, and access details.',
    introSecondary:
      'Sofas need space planning and careful handling on stairs and lifts. Tell us about your property so we assign the right crew and vehicle.',
    serviceBullets: ['Edinburgh & Lothian delivery', 'Two-person sofa handling', 'Store or private collection'],
    faqs: [
      { q: 'Can you collect from IKEA Edinburgh?', a: 'We can quote collection from IKEA or delivery between addresses — confirm details in the wizard.' },
      { q: 'Is this an IKEA service?', a: 'No — ShiftMyHome is independent. We transport furniture customers have purchased themselves.' },
    ],
    extraRelated: [{ href: '/furniture-delivery-edinburgh', label: 'Furniture delivery Edinburgh' }],
  },
  {
    path: '/ikea-collection-service',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'IKEA Collection Service',
    metaDescription:
      'Independent IKEA collection and delivery across Scotland. We can pick up IKEA purchases and deliver to your home — not affiliated with IKEA. Instant quotes online.',
    heroTeaser: 'Collect IKEA orders and deliver to your door.',
    intro:
      'Our independent collection service helps when you have bought from IKEA and need items transported. We are not authorised by IKEA — we provide professional movers for your purchase.',
    introSecondary:
      'Works for flat-pack boxes through to larger items. Quote with store location or seller address and your delivery postcode.',
    serviceBullets: ['Collection from IKEA stores', 'Home delivery across Scotland', 'Clear online pricing'],
    faqs: [
      { q: 'Do you work with IKEA directly?', a: 'No. We are a separate UK removals company helping customers with their own IKEA purchases.' },
    ],
    extraRelated: [{ href: '/ikea-furniture-delivery', label: 'IKEA furniture delivery' }],
  },
  {
    path: '/ikea-bed-delivery',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'IKEA Bed Delivery',
    metaDescription:
      'Independent IKEA bed delivery in Scotland — mattresses, frames, and flat-pack beds. Not an official IKEA partner. Two-person delivery with ShiftMyHome.',
    heroTeaser: 'Bed and mattress delivery for IKEA orders.',
    intro:
      'Beds and mattresses from IKEA need careful two-person handling. ShiftMyHome can collect and deliver — we are an independent service, not linked to IKEA.',
    introSecondary:
      'Mention bed size, box count, and whether room placement is required when you quote.',
    serviceBullets: ['Mattress and bed frame delivery', 'Two-person crews', 'Scotland-wide coverage'],
    faqs: [
      { q: 'Can you carry a bed upstairs?', a: 'Yes where access allows — describe stairs and lifts in your quote.' },
    ],
    extraRelated: [{ href: '/ikea-assembly-service-glasgow', label: 'IKEA assembly Glasgow' }],
  },
  {
    path: '/ikea-assembly-service-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Furniture Delivery',
    h1: 'IKEA Assembly Service in Glasgow',
    metaDescription:
      'Help with IKEA flat-pack assembly in Glasgow after delivery. Independent service — not an official IKEA assembly partner. Quote delivery and assembly needs online.',
    heroTeaser: 'Delivery plus assembly help for IKEA flat-pack.',
    intro:
      'Need help getting IKEA flat-pack furniture assembled in Glasgow? We can combine delivery with assembly support where agreed — ShiftMyHome is independent and not authorised by IKEA.',
    introSecondary:
      'Describe items and rooms in your quote notes. Assembly scope is confirmed before booking.',
    serviceBullets: ['Flat-pack delivery', 'Assembly help where agreed', 'Greater Glasgow coverage'],
    faqs: [
      { q: 'Is this official IKEA assembly?', a: 'No. We are an independent moving company offering assembly help alongside delivery when requested.' },
    ],
    extraRelated: [{ href: '/flat-pack-assembly-scotland', label: 'Flat-pack assembly Scotland' }],
  },
  {
    path: '/flat-pack-furniture-delivery',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'Flat Pack Furniture Delivery',
    metaDescription:
      'Flat-pack furniture delivery across Scotland — IKEA, retailer collections, and private purchases. Two-person teams and instant online quotes from ShiftMyHome.',
    heroTeaser: 'Deliver flat-pack furniture safely across Scotland.',
    intro:
      'Flat-pack furniture delivery needs space in the van and careful handling to avoid damage to boxes and panels. We deliver across Scotland from retailer collections or private addresses.',
    introSecondary:
      'Quote with dimensions if known and whether you need room placement or assembly help.',
    serviceBullets: ['Retailer and private collections', 'Scotland-wide delivery', 'Two-person teams'],
    faqs: [
      { q: 'Do you only deliver IKEA flat-pack?', a: 'No — any flat-pack furniture from retailers or private sellers can be quoted the same way.' },
    ],
    extraRelated: [{ href: '/ikea-furniture-delivery', label: 'IKEA furniture delivery' }],
  },
  {
    path: '/flat-pack-assembly-scotland',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'Flat Pack Assembly in Scotland',
    metaDescription:
      'Flat-pack assembly help in Scotland after delivery. Independent service for IKEA and other flat-pack furniture — quote online with ShiftMyHome.',
    heroTeaser: 'Assembly support for flat-pack furniture.',
    intro:
      'After delivery, flat-pack furniture still needs assembly. We can help where agreed — describe items in your quote and we confirm scope before booking.',
    introSecondary:
      'Works alongside our delivery service for a single coordinated visit when schedules allow.',
    serviceBullets: ['Assembly where agreed', 'Works with delivery bookings', 'Scotland-wide'],
    faqs: [
      { q: 'Do you assemble all flat-pack brands?', a: 'We help with common flat-pack furniture — confirm item types in your quote notes.' },
    ],
    extraRelated: [{ href: '/flat-pack-furniture-delivery', label: 'Flat-pack delivery' }],
  },
  {
    path: '/furniture-collection-and-delivery',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'Furniture Collection and Delivery',
    metaDescription:
      'Furniture collection and delivery across Scotland — shops, warehouses, and private sellers. Insured two-person teams and instant quotes from ShiftMyHome.',
    heroTeaser: 'Collect and deliver furniture anywhere in Scotland.',
    intro:
      'Our furniture collection and delivery service covers retailer pickups, warehouse collections, and private seller addresses. You get one price from collection point to your door.',
    introSecondary:
      'Add both addresses, item list, and access notes for an accurate quote. Sofas, beds, tables, and multiple items are all handled regularly.',
    serviceBullets: ['Shop and private collections', 'Two-person delivery teams', 'Scotland and UK routes'],
    faqs: [
      { q: 'Can you collect from a retailer on my behalf?', a: 'Yes — provide the collection address and any reference numbers in your quote notes.' },
    ],
    extraRelated: [{ href: '/furniture-delivery-scotland', label: 'Furniture delivery Scotland' }],
  },
  {
    path: '/tk-maxx-furniture-delivery',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'TK Maxx Furniture Delivery',
    metaDescription:
      'Independent TK Maxx furniture delivery in Scotland — we can collect homeware and large items you purchased. Not affiliated with TK Maxx. Quote online.',
    heroTeaser: 'Delivery for TK Maxx homeware and furniture finds.',
    intro:
      'Found furniture or large homeware at TK Maxx and need it home? ShiftMyHome can collect and deliver — we are an independent company, not a TK Maxx partner or authorised courier.',
    introSecondary:
      'Quote with store location, item size, and delivery address. Two-person teams for heavier pieces.',
    serviceBullets: ['Store collection where agreed', 'Large item handling', 'Scotland-wide'],
    faqs: [
      { q: 'Are you connected to TK Maxx?', a: 'No. We provide independent delivery for customers who bought items themselves.' },
    ],
    extraRelated: [{ href: '/tk-maxx-home-delivery-edinburgh', label: 'TK Maxx delivery Edinburgh' }],
  },
  {
    path: '/tk-maxx-home-delivery-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'Furniture Delivery',
    h1: 'TK Maxx Home Delivery Edinburgh',
    metaDescription:
      'Independent TK Maxx home delivery in Edinburgh for furniture and homeware purchases. Not an official TK Maxx service. Instant quotes from ShiftMyHome.',
    heroTeaser: 'Get TK Maxx purchases delivered in Edinburgh.',
    intro:
      'We help Edinburgh customers get TK Maxx furniture and homeware home safely. ShiftMyHome is independent — not affiliated with TK Maxx.',
    introSecondary:
      'Mention item type, store, and access at your Edinburgh address when you quote.',
    serviceBullets: ['Edinburgh & Lothians', 'Two-person delivery', 'Careful handling'],
    faqs: [
      { q: 'Can you collect from TK Maxx Edinburgh?', a: 'We can quote collection from store or delivery between addresses — confirm in the wizard.' },
    ],
    extraRelated: [{ href: '/furniture-delivery-edinburgh', label: 'Furniture delivery Edinburgh' }],
  },
  {
    path: '/tk-maxx-collection-service',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'TK Maxx Collection Service',
    metaDescription:
      'Independent TK Maxx collection and delivery across Scotland. We transport items you purchased — not an official TK Maxx partner.',
    heroTeaser: 'Collect TK Maxx purchases and deliver home.',
    intro:
      'Our collection service helps when you have bought from TK Maxx and need transport. We are not authorised by TK Maxx — we provide professional movers for your items.',
    introSecondary:
      'Works for homeware, furniture, and bulky finds. Quote with full addresses and item details.',
    serviceBullets: ['Collection from store', 'Home delivery', 'Scotland-wide routes'],
    faqs: [
      { q: 'Is this an official TK Maxx service?', a: 'No. ShiftMyHome is a separate UK removals and delivery company.' },
    ],
    extraRelated: [{ href: '/tk-maxx-furniture-delivery', label: 'TK Maxx furniture delivery' }],
  },
  {
    path: '/same-day-homeware-delivery',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'Same Day Homeware Delivery',
    metaDescription:
      'Same day homeware and furniture delivery in Scotland when crews are available. Urgent collections and room-to-room moves — quote with today’s date on ShiftMyHome.',
    heroTeaser: 'Urgent homeware delivery when slots allow.',
    intro:
      'Same day homeware delivery depends on crew availability — quote with today’s date and full details for the fastest answer. Ideal for urgent retailer collections or room changes.',
    introSecondary:
      'Smaller loads may suit man with van; larger homeware sets use a removal van team.',
    serviceBullets: ['Quote with today’s date', 'Retailer and private collections', 'Scotland-wide when available'],
    faqs: [
      { q: 'Is same day guaranteed?', a: 'No — we confirm honestly after you quote based on crew schedules.' },
    ],
    extraRelated: [{ href: '/same-day-furniture-delivery-glasgow', label: 'Same day furniture Glasgow' }],
  },
  {
    path: '/furniture-collection-from-tk-maxx',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'Furniture Collection from TK Maxx',
    metaDescription:
      'We can collect furniture you bought from TK Maxx and deliver to your home across Scotland. Independent service — not affiliated with TK Maxx.',
    heroTeaser: 'Collect your TK Maxx furniture purchase.',
    intro:
      'Need furniture collected from TK Maxx after you have paid? We provide independent collection and delivery — ShiftMyHome is not a TK Maxx partner.',
    introSecondary:
      'Provide store location, purchase details in notes, and delivery address for a clear quote.',
    serviceBullets: ['Store collection', 'Two-person teams', 'Scotland-wide delivery'],
    faqs: [
      { q: 'Do I need to collect from TK Maxx myself?', a: 'We can quote collection on your behalf when store handover is arranged — confirm in your quote notes.' },
    ],
    extraRelated: [{ href: '/tk-maxx-furniture-delivery', label: 'TK Maxx delivery' }],
  },
  {
    path: '/tk-maxx-large-item-delivery',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'TK Maxx Large Item Delivery',
    metaDescription:
      'Large item delivery for TK Maxx furniture and homeware in Scotland. Independent two-person teams — not an official TK Maxx courier.',
    heroTeaser: 'Two-person delivery for large TK Maxx items.',
    intro:
      'Large TK Maxx items need two people and proper equipment. We deliver independently — not as an authorised TK Maxx service.',
    introSecondary:
      'Describe item size and access at delivery address when you quote online.',
    serviceBullets: ['Bulky item specialists', 'Two-person crews', 'Scotland-wide'],
    faqs: [
      { q: 'What counts as a large item?', a: 'Sofas, wardrobes, tables, and multi-box furniture — describe items in the wizard.' },
    ],
    extraRelated: [{ href: '/large-item-delivery-glasgow', label: 'Large item delivery Glasgow' }],
  },
  {
    path: '/ebay-furniture-collection-delivery',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'eBay Furniture Collection and Delivery',
    metaDescription:
      'eBay furniture collection and delivery across Scotland. We pick up from sellers and deliver to your address — independent service, instant online quotes.',
    heroTeaser: 'Collect eBay furniture purchases safely.',
    intro:
      'Bought furniture on eBay and need it transported? We collect from sellers across Scotland and deliver to your home with two-person teams and careful handling.',
    introSecondary:
      'Share seller address, item details, and your delivery postcode in the quote wizard.',
    serviceBullets: ['Seller collection', 'Scotland-wide delivery', 'Two-person handling'],
    faqs: [
      { q: 'Can you collect from an eBay seller I have not met?', a: 'Yes — provide the seller address and agreed collection window in your quote notes.' },
    ],
    extraRelated: [{ href: '/gumtree-delivery-glasgow', label: 'Gumtree delivery Glasgow' }],
  },
  {
    path: '/gumtree-furniture-movers-scotland',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'Gumtree Furniture Movers Scotland',
    metaDescription:
      'Gumtree furniture movers across Scotland — collection from sellers and delivery to your door. Sofa delivery for Gumtree buyers from ShiftMyHome.',
    heroTeaser: 'Move Gumtree furniture purchases safely.',
    intro:
      'Found furniture on Gumtree and need movers? We provide collection and delivery for private sales across Scotland — professional teams, not marketplace couriers.',
    introSecondary:
      'Quote with seller location, item size, and your address. Same-day help when crews are free.',
    serviceBullets: ['Private seller collections', 'Sofa and bed delivery', 'Scotland-wide'],
    faqs: [
      { q: 'Do you only move Gumtree items?', a: 'No — we also help with Facebook Marketplace, eBay, and retailer purchases.' },
    ],
    extraRelated: [{ href: '/facebook-marketplace-delivery-glasgow', label: 'Facebook Marketplace Glasgow' }],
  },
  {
    path: '/sofa-delivery-from-facebook-marketplace',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'Furniture Delivery',
    h1: 'Sofa Delivery from Facebook Marketplace',
    metaDescription:
      'Sofa delivery for Facebook Marketplace purchases in Scotland. We collect from sellers and deliver to your home — independent furniture movers from ShiftMyHome.',
    heroTeaser: 'Marketplace sofa delivery with two-person crews.',
    intro:
      'Bought a sofa on Facebook Marketplace and need it moved? We collect from sellers and deliver with two-person teams across Scotland.',
    introSecondary:
      'Describe sofa size, seller address, and access at your property for an accurate quote.',
    serviceBullets: ['Marketplace collections', 'Two-person sofa teams', 'Scotland-wide'],
    faqs: [
      { q: 'Can you help if the seller is not home at a fixed time?', a: 'Mention flexibility in quote notes — we coordinate collection windows with you and the seller where possible.' },
    ],
    extraRelated: [{ href: '/facebook-marketplace-delivery-glasgow', label: 'Marketplace delivery Glasgow' }],
  },
  {
    path: '/removal-companies-glasgow-prices',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'House Removals',
    h1: 'Removal Companies Glasgow Prices',
    metaDescription:
      'Understand removal company prices in Glasgow before you book. ShiftMyHome explains how quotes work — volume, distance, access, and crew — with instant online pricing.',
    heroTeaser: 'How Glasgow removal prices are calculated.',
    intro:
      'Removal companies in Glasgow price jobs from volume, distance, access, and date — not a single flat rate. ShiftMyHome shows your price online from your addresses and inventory so you can compare fairly.',
    introSecondary:
      'Cheap removals can still be fully insured on booked jobs. The quote wizard breaks down what affects your final figure before you commit.',
    serviceBullets: [
      'Instant online pricing',
      'No obligation quotes',
      'Insured crews on booked moves',
    ],
    faqs: [
      {
        q: 'What affects removal prices in Glasgow?',
        a: 'Volume, mileage, stairs, parking, crew size, and date all feed into your live quote.',
      },
      {
        q: 'How do I compare removal companies in Glasgow?',
        a: 'Compare like-for-like scope — same inventory, addresses, and access — then check insurance and reviews.',
      },
    ],
    extraRelated: [
      { href: '/cheap-removals-glasgow', label: 'Affordable removals Glasgow' },
      { href: '/glasgow-removals', label: 'Glasgow removals' },
    ],
  },
  {
    path: '/moving-company',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'House Removals',
    h1: 'Moving Company Scotland',
    metaDescription:
      'ShiftMyHome is a Scotland moving company for house removals, man with van, and furniture delivery. Instant quotes, insured crews, and UK-wide routes.',
    heroTeaser: 'Professional moving company across Scotland.',
    intro:
      'As a Scotland moving company, ShiftMyHome handles house removals, office relocations, student moves, and furniture delivery with transparent online pricing.',
    introSecondary:
      'Based in Glasgow with crews across Scottish cities and UK routes when you need to go further.',
    serviceBullets: ['House and flat removals', 'Man with van', 'Furniture delivery'],
    faqs: [
      { q: 'What areas does your moving company cover?', a: 'Scotland-wide with regular UK routes — quote with your postcodes for coverage confirmation.' },
    ],
    extraRelated: [{ href: '/movers-near-me', label: 'Movers near me' }],
  },
  {
    path: '/local-removal-company',
    cityName: 'Scotland',
    regionLabel: 'Scotland',
    serviceType: 'House Removals',
    h1: 'Local Removal Company',
    metaDescription:
      'Local removal company services across Scotland — Glasgow, Edinburgh, Aberdeen, and towns nationwide. Instant online quotes from ShiftMyHome.',
    heroTeaser: 'Local crews with Scotland-wide reach.',
    intro:
      'A good local removal company knows parking, access, and street layouts. ShiftMyHome combines local crews with Scotland-wide and UK coverage from our Glasgow base.',
    introSecondary:
      'Quote for your town — we serve cities and communities across Scotland with the same transparent process.',
    serviceBullets: ['Local knowledge', 'Scotland-wide coverage', 'Online quotes in minutes'],
    faqs: [
      { q: 'Do you only work locally?', a: 'We handle local moves daily and longer Scottish and UK routes from the same quote wizard.' },
    ],
    extraRelated: [{ href: '/removal-company-near-me', label: 'Removal company near me' }],
  },
]
