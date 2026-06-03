/**
 * Long-form SEO content for the six main service quote pages.
 * Meta titles/descriptions, body copy, FAQs, and city internal links.
 */

/** @typedef {{ q: string, a: string }} ServiceFaqItem */

/** @typedef {{ heading: string, paragraphs: string[] }} ServiceBodySection */

/**
 * @typedef {object} ServicePageSeoContent
 * @property {string} seoTitle
 * @property {string} metaDescription
 * @property {string} introHeading
 * @property {string} intro
 * @property {string} introSecondary
 * @property {ServiceBodySection[]} bodySections
 * @property {ServiceFaqItem[]} faqs
 * @property {{ href: string, label: string }[]} cityLinks
 * @property {string} ctaHeading
 * @property {string} ctaText
 */

/** @type {Record<string, ServicePageSeoContent>} */
export const SERVICE_PAGE_SEO_CONTENT = {
  'house-removals': {
    seoTitle: 'House Removals Scotland | Instant Quote | ShiftMyHome',
    metaDescription:
      'Professional house removals across Scotland — full and partial home moves with insured crews. Instant online quotes for Glasgow, Edinburgh and UK routes.',
    introHeading: 'Professional house removals across Scotland',
    intro:
      'ShiftMyHome provides full and partial house removals across Scotland, from studio flats to multi-bedroom family homes. Tell us your pickup and delivery addresses, list your furniture and boxes, and receive a live price before you book.',
    introSecondary:
      'Our removal crews plan access, parking, and loading in advance — whether you are moving within Glasgow, Edinburgh, Aberdeen, or relocating further across Scotland and the UK.',
    bodySections: [
      {
        heading: 'Full and partial home moves',
        paragraphs: [
          'House removals cover everything from a single room through to a complete home. We assign the right vehicle and crew from your inventory, protect furniture with blankets and straps, and confirm timing before move day.',
          'Partial moves suit customers who only need certain rooms or bulky items transported — the quote wizard reflects exactly what you list, so you are not paying for unused space.',
        ],
      },
      {
        heading: 'Packing, dismantling, and access',
        paragraphs: [
          'Add packing materials, fragile wrapping, or dismantling in your online quote when you need extra help. We can supply boxes and protective materials, or work with what you have already packed.',
          'Tell us about stairs, narrow hallways, lift access, or parking restrictions at either address. That helps us send the right crew size and avoid surprises on the day.',
        ],
      },
      {
        heading: 'Local and long-distance routes',
        paragraphs: [
          'Local house removals within Scottish cities are booked daily. We also run inter-city and UK-wide routes when you are relocating further — distance, volume, and date all feed into your live quote.',
          'Common routes include Glasgow to Edinburgh, Aberdeen, Dundee, and Inverness, as well as moves into England and Wales when you need to go further.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How much do house removals cost in Scotland?',
        a: 'Pricing depends on volume, distance, access, and your move date. Use our instant quote wizard with pickup and delivery postcodes for a live estimate — there is no obligation to book.',
      },
      {
        q: 'Do you cover Glasgow, Edinburgh, and other Scottish cities?',
        a: 'Yes. We provide house removals across Scotland including Glasgow, Edinburgh, Aberdeen, Dundee, Inverness, and Paisley, plus UK-wide routes when you are moving further.',
      },
      {
        q: 'Are house removals fully insured?',
        a: 'Goods-in-transit cover applies on confirmed bookings. Share high-value or fragile items in your quote so we can confirm the right approach before move day.',
      },
      {
        q: 'How far in advance should I book a house move?',
        a: 'Two to four weeks is ideal for full house moves, especially at month-end and summer peaks. We also accommodate shorter notice when crews are available.',
      },
      {
        q: 'Can I book a man with van instead of a full removal?',
        a: 'Yes. Smaller loads often suit a man-with-van crew. Select the service in the quote wizard or mention it in your notes — we recommend the right option from your inventory.',
      },
    ],
    cityLinks: [
      { href: '/glasgow-removals', label: 'Glasgow removals' },
      { href: '/edinburgh-removals', label: 'Edinburgh removals' },
      { href: '/aberdeen-removals', label: 'Aberdeen removals' },
      { href: '/dundee-removals', label: 'Dundee removals' },
      { href: '/inverness-removals', label: 'Inverness removals' },
      { href: '/paisley-removals', label: 'Paisley removals' },
    ],
    ctaHeading: 'Ready to book your house removal?',
    ctaText: 'Get a clear price in minutes — start the quote wizard above with your addresses and inventory.',
  },
  'man-with-van': {
    seoTitle: 'Man With Van Scotland | Instant Quote | ShiftMyHome',
    metaDescription:
      'Flexible man with van service across Scotland — single items, flat moves and quick local jobs. Get a clear online price from ShiftMyHome in minutes.',
    introHeading: 'Man with van service across Scotland',
    intro:
      'Our man with van service suits smaller loads — single items, partial flat moves, marketplace collections, and quick local runs. You get a van and experienced crew sized to your job, not a full removal team you do not need.',
    introSecondary:
      'Quote with pickup and delivery addresses, item sizes, and any stairs or parking constraints. We confirm honestly whether a van load or larger removal vehicle is the better fit for your move.',
    bodySections: [
      {
        heading: 'When a man with van is the right choice',
        paragraphs: [
          'A man-with-van crew works well for studio and one-bedroom flat moves, furniture-only jobs, and same-area collections. It is often the most cost-effective option when you do not need a full removal lorry.',
          'Tell us what you are moving — sofas, beds, white goods, boxes, or a partial room — and we match vehicle size and crew to the load.',
        ],
      },
      {
        heading: 'Collections and marketplace deliveries',
        paragraphs: [
          'We collect from private sellers, retailers, and marketplace purchases across Scotland. Add collection and delivery postcodes, dimensions if you know them, and whether two-person handling is required.',
          'Gumtree, Facebook Marketplace, and flat-pack furniture collections are quoted the same transparent way as any other man-with-van job.',
        ],
      },
      {
        heading: 'Same-day and short-notice moves',
        paragraphs: [
          'Same-day man with van slots depend on crew availability — quote with your preferred date for an honest answer. Early booking secures better times, especially at weekends.',
          'Short local runs within Glasgow, Edinburgh, and surrounding towns are common. Enter both addresses in the wizard for an accurate price before you commit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How much does a man with van cost in Scotland?',
        a: 'Pricing follows distance, time, and volume. Small loads with few items are often suited to man with van. Use the quote wizard for a live price based on your addresses and inventory.',
      },
      {
        q: 'Is man with van cheaper than full house removals?',
        a: 'For smaller loads, yes — a van crew is usually more efficient than a full removal team. The wizard recommends the right service from what you list.',
      },
      {
        q: 'Do you offer man with van in Glasgow and Edinburgh?',
        a: 'Yes. We cover Glasgow, Edinburgh, Aberdeen, Dundee, Inverness, Paisley, and surrounding towns. Select your addresses in the quote wizard for local pricing.',
      },
      {
        q: 'Can you help with stairs and tight access?',
        a: 'Yes. Note stairs, lifts, and parking in your quote so the crew arrives with the right equipment and enough hands for safe handling.',
      },
      {
        q: 'Can I get a same-day man with van?',
        a: 'Same-day availability depends on crew schedules. Quote with your date and we confirm honestly if we can help.',
      },
    ],
    cityLinks: [
      { href: '/man-with-van-glasgow', label: 'Man with van Glasgow' },
      { href: '/man-with-van-edinburgh', label: 'Man with van Edinburgh' },
      { href: '/man-with-van-aberdeen', label: 'Man with van Aberdeen' },
      { href: '/man-with-van-dundee', label: 'Man with van Dundee' },
      { href: '/man-with-van-inverness', label: 'Man with van Inverness' },
      { href: '/man-with-van-paisley', label: 'Man with van Paisley' },
    ],
    ctaHeading: 'Need a van and crew today?',
    ctaText: 'Start the quote wizard above — enter your items and addresses for an instant man-with-van price.',
  },
  'furniture-delivery': {
    seoTitle: 'Furniture Delivery Scotland | Item Removals | ShiftMyHome',
    metaDescription:
      'Furniture delivery and item removals across Scotland — sofas, beds and bulky pieces moved with care. Instant quotes with insured two-person crews.',
    introHeading: 'Furniture delivery and item removals',
    intro:
      'We move sofas, beds, wardrobes, and other bulky furniture across Scotland with two-person crews, straps, and blankets. Collections from shops, private sellers, and marketplace purchases are all quoted the same transparent way.',
    introSecondary:
      'Share item dimensions if you know them, and note stairs, lift access, or assembly requirements. Our furniture delivery teams work locally and on longer Scottish and UK routes.',
    bodySections: [
      {
        heading: 'Sofas, beds, and bulky furniture',
        paragraphs: [
          'Large furniture needs proper handling — we use blankets, straps, and two-person crews as standard. Tell us about corner turns, narrow doorways, and whether disassembly is required.',
          'Single-item deliveries and multi-piece collections are priced from your inventory list, not a vague estimate on the day.',
        ],
      },
      {
        heading: 'Retailer and marketplace collections',
        paragraphs: [
          'We collect from IKEA, TK Maxx, department stores, and private sellers across Scotland. Add the collection address, delivery postcode, and item details for an accurate quote.',
          'Flat-pack furniture can include delivery-only or delivery plus assembly — mention your preference in the quote notes.',
        ],
      },
      {
        heading: 'Room-to-room and property moves',
        paragraphs: [
          'Furniture removals between rooms, floors, or properties are booked daily. Whether you are refurnishing one room or moving several pieces between addresses, the wizard captures the scope clearly.',
          'Inter-city furniture delivery — for example Glasgow to Edinburgh — is quoted from both postcodes and item sizes.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How much does furniture delivery cost in Scotland?',
        a: 'Pricing depends on item size, distance, access, and crew time. List your furniture in the quote wizard with both addresses for a live estimate.',
      },
      {
        q: 'Do you deliver single items like sofas or beds?',
        a: 'Yes. Single-item and multi-item furniture delivery is a core service. Two-person crews handle bulky pieces with proper equipment.',
      },
      {
        q: 'Can you collect from a shop and deliver to my home?',
        a: 'Yes. Add the retailer or seller address as pickup and your delivery postcode. Include dimensions and stairs if known.',
      },
      {
        q: 'Do you assemble flat-pack furniture?',
        a: 'Assembly can be arranged when agreed in advance. Mention flat-pack or assembly needs in your quote notes.',
      },
      {
        q: 'Is furniture delivery insured?',
        a: 'Goods-in-transit cover applies on confirmed bookings. Note fragile or high-value items when you quote.',
      },
    ],
    cityLinks: [
      { href: '/furniture-delivery-glasgow', label: 'Furniture delivery Glasgow' },
      { href: '/furniture-delivery-edinburgh', label: 'Furniture delivery Edinburgh' },
      { href: '/furniture-delivery-scotland', label: 'Furniture delivery Scotland' },
      { href: '/glasgow-removals', label: 'Glasgow removals' },
      { href: '/edinburgh-removals', label: 'Edinburgh removals' },
    ],
    ctaHeading: 'Need furniture moved?',
    ctaText: 'Quote above with item details and both addresses — get an instant furniture delivery price.',
  },
  'office-moves': {
    seoTitle: 'Office Removals Scotland | Business Moves | ShiftMyHome',
    metaDescription:
      'Office removals and business relocations across Scotland — desks, IT and furniture with minimal downtime. Out-of-hours moves where possible. Quote online.',
    introHeading: 'Office removals and business relocations',
    intro:
      'ShiftMyHome relocates offices, studios, and commercial spaces across Scotland with careful planning around your business hours. Desks, filing, meeting room furniture, and IT equipment are handled with labelled packing where agreed.',
    introSecondary:
      'Tell us your floor, lift access, parking arrangements, and whether desks must stay connected until last. We coordinate crew size and vehicles to match your inventory and timing.',
    bodySections: [
      {
        heading: 'Desks, IT, and office furniture',
        paragraphs: [
          'Office moves include desks, chairs, filing cabinets, meeting tables, and standard IT setups. Specialist server or cabling work may need your IT team — note requirements in your quote.',
          'Labelled packing helps teams set up faster at the new premises. Mention if you need crates, protective wrapping, or dismantling.',
        ],
      },
      {
        heading: 'Minimal downtime planning',
        paragraphs: [
          'We schedule evening and weekend office moves where availability allows. Share your preferred window in the quote notes so we can match crew availability to your business needs.',
          'Multi-room and multi-floor relocations are quoted from your inventory and access details — not a hidden add-on on move day.',
        ],
      },
      {
        heading: 'Local and inter-city office relocations',
        paragraphs: [
          'Office removals within Glasgow, Edinburgh, Aberdeen, and other Scottish cities are booked regularly. We also handle inter-city business moves when you are relocating premises.',
          'From single office suites to larger floor moves, the quote wizard captures scope so pricing stays transparent.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How much do office removals cost in Scotland?',
        a: 'Pricing reflects volume, distance, access, crew size, and timing. Use the quote wizard with both addresses and your office inventory for a live estimate.',
      },
      {
        q: 'Can you move our office outside business hours?',
        a: 'We schedule evening or weekend slots where availability allows. Mention your preferred window in the quote notes.',
      },
      {
        q: 'Do you move IT equipment and servers?',
        a: 'Standard office furniture and PCs yes. Specialist IT or server moves may need your technician — note requirements when you quote.',
      },
      {
        q: 'Do you cover Glasgow and Edinburgh offices?',
        a: 'Yes. We provide office removals in Glasgow, Edinburgh, and across Scotland. See our city office pages for local details.',
      },
      {
        q: 'How far ahead should we book an office move?',
        a: 'Two to four weeks is ideal for larger offices. Short-notice moves are sometimes possible when crews are free.',
      },
    ],
    cityLinks: [
      { href: '/office-removals-glasgow', label: 'Office removals Glasgow' },
      { href: '/office-removals-edinburgh', label: 'Office removals Edinburgh' },
      { href: '/business-relocation-edinburgh', label: 'Business relocation Edinburgh' },
      { href: '/glasgow-removals', label: 'Glasgow removals' },
      { href: '/edinburgh-removals', label: 'Edinburgh removals' },
    ],
    ctaHeading: 'Planning an office relocation?',
    ctaText: 'Start the quote wizard above with your office inventory and both addresses.',
  },
  'student-moves': {
    seoTitle: 'Student Moves Scotland | Affordable Removals | ShiftMyHome',
    metaDescription:
      'Budget-friendly student moves across Scotland — halls, flats and term-time addresses. Smaller loads, clear pricing. Instant quotes from ShiftMyHome.',
    introHeading: 'Student moves across Scotland',
    intro:
      'Student moves peak around September and June — booking early secures better dates. Our service suits halls, shared flats, and term-time addresses across Glasgow, Edinburgh, and other Scottish university cities.',
    introSecondary:
      'Man-with-van is often enough for a room or shared flat. Tell us what you are moving, both addresses, and any stairs or parking notes for a clear price before term changeover.',
    bodySections: [
      {
        heading: 'Halls, flats, and shared accommodation',
        paragraphs: [
          'We help students move between halls, private flats, and family homes. Smaller vans keep costs down when you are moving a room rather than a full household.',
          'Shared flat moves are common — list each item in the wizard so crew size matches what you actually need moved.',
        ],
      },
      {
        heading: 'Term changeover and summer storage',
        paragraphs: [
          'Book early for September and June peaks when demand is highest. We can handle moves to storage, back to campus, or between cities for placements and holidays.',
          'Flexible timing around term dates helps avoid clashes with handover days — add your preferred date in the quote.',
        ],
      },
      {
        heading: 'Budget-friendly options',
        paragraphs: [
          'Student moves are priced from volume and distance like any other job — there are no hidden fees on move day. Choose man with van for smaller loads or house removals for larger shared flats.',
          'Glasgow and Edinburgh student areas including the West End, Cowgate, and city-centre flats are moves we handle regularly.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How much do student moves cost in Scotland?',
        a: 'Pricing depends on volume, distance, and date. A room or partial flat often suits man with van. Quote online for a live price.',
      },
      {
        q: 'Do you help with student moves in Glasgow and Edinburgh?',
        a: 'Yes. We cover university cities across Scotland including Glasgow and Edinburgh. Book early around term changeover.',
      },
      {
        q: 'Can you move a single room or partial flat?',
        a: 'Yes. Man with van is often the best fit for smaller student loads. List your items in the quote wizard.',
      },
      {
        q: 'When should students book their move?',
        a: 'As early as possible before September and June peaks. Last-minute slots depend on crew availability.',
      },
      {
        q: 'Do you offer storage drop-offs?',
        a: 'Yes. Add storage as the delivery address in the quote wizard, or mention it in your notes.',
      },
    ],
    cityLinks: [
      { href: '/student-moves-glasgow', label: 'Student moves Glasgow' },
      { href: '/student-moves-edinburgh', label: 'Student moves Edinburgh' },
      { href: '/student-removals-glasgow', label: 'Student removals Glasgow' },
      { href: '/cheap-student-moves-edinburgh', label: 'Cheap student moves Edinburgh' },
      { href: '/glasgow-removals', label: 'Glasgow removals' },
      { href: '/edinburgh-removals', label: 'Edinburgh removals' },
    ],
    ctaHeading: 'Moving for the new term?',
    ctaText: 'Get your student move price above — enter both addresses and what you are taking with you.',
  },
  clearance: {
    seoTitle: 'Clearance Services Scotland | House Clearances | ShiftMyHome',
    metaDescription:
      'House, garage and garden clearances across Scotland with responsible disposal where possible. Upfront pricing before we arrive. Get your quote today.',
    introHeading: 'House and property clearances',
    intro:
      'ShiftMyHome handles house, garage, loft, and garden clearances across Scotland with upfront pricing before we arrive. You tell us what needs removed — furniture, appliances, bags, and general items — and we quote from the scope.',
    introSecondary:
      'Responsible disposal and recycling are used where possible. Share photos or a detailed list in your quote notes if access is awkward or the volume is hard to estimate.',
    bodySections: [
      {
        heading: 'House and flat clearances',
        paragraphs: [
          'Full and partial property clearances suit landlords, executors, downsizers, and pre-sale tidy-ups. We remove furniture, white goods, and general household items with agreed disposal.',
          'Tell us about stairs, parking, and whether you need items sorted for donation, recycling, or landfill.',
        ],
      },
      {
        heading: 'Garage, loft, and garden clearances',
        paragraphs: [
          'Garage and shed clearances often mix furniture, tools, and general waste — list what you can in the wizard and add photos in the notes for accuracy.',
          'Garden clearances include bulky items and bagged waste where agreed in advance. Access paths and gate widths help us plan the right vehicle.',
        ],
      },
      {
        heading: 'End-of-tenancy and pre-sale clearances',
        paragraphs: [
          'Landlords and agents use our clearance service between tenancies or before viewings. Fixed-scope quotes avoid surprise charges on the day.',
          'We work across Glasgow, Edinburgh, and Scotland-wide — enter the property postcode and describe the volume for a live estimate.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How much does a house clearance cost in Scotland?',
        a: 'Pricing depends on volume, access, and disposal requirements. Describe what needs cleared in the quote wizard for a live estimate.',
      },
      {
        q: 'Do you recycle or donate cleared items?',
        a: 'We dispose of items responsibly where possible, including recycling and donation routes when suitable. Mention preferences in your quote notes.',
      },
      {
        q: 'Can you clear a garage or loft only?',
        a: 'Yes. Partial clearances are quoted from the items and volume you describe — you do not need a full house clearance.',
      },
      {
        q: 'Do you cover Glasgow and Edinburgh clearances?',
        a: 'Yes. We provide clearance services across Scotland including Glasgow, Edinburgh, and surrounding towns.',
      },
      {
        q: 'How do I book a clearance?',
        a: 'Use the quote wizard above, select Clearance, describe what needs removed, and receive a live price before booking.',
      },
    ],
    cityLinks: [
      { href: '/glasgow-removals', label: 'Glasgow removals' },
      { href: '/edinburgh-removals', label: 'Edinburgh removals' },
      { href: '/aberdeen-removals', label: 'Aberdeen removals' },
      { href: '/dundee-removals', label: 'Dundee removals' },
      { href: '/house-removals', label: 'House removals' },
      { href: '/coverage', label: 'Coverage map' },
    ],
    ctaHeading: 'Need a property cleared?',
    ctaText: 'Start the clearance quote above — describe what needs removed for an upfront price.',
  },
}

/** @param {string} slug */
export function getServicePageSeoContent(slug) {
  return SERVICE_PAGE_SEO_CONTENT[slug] ?? null
}
