/**
 * Long-tail / search-intent SEO page definitions.
 * Consumed by seoPages.js — do not register routes here.
 */

/** @typedef {import('./seoPages.js').SeoPageConfig} SeoPageConfig */

/**
 * @typedef {object} IntentPageDef
 * @property {string} path
 * @property {string} cityName
 * @property {string} regionLabel
 * @property {string} serviceType
 * @property {string} h1
 * @property {string} metaDescription
 * @property {string} heroTeaser
 * @property {string} intro
 * @property {string} introSecondary
 * @property {string[]} serviceBullets
 * @property {{ q: string, a: string }[]} faqs
 * @property {{ href: string, label: string }[]} [extraRelated]
 */

/** @type {IntentPageDef[]} */
export const INTENT_PAGE_DEFINITIONS = [
  // —— Removals keywords ——
  {
    path: '/cheap-removals-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'House Removals',
    h1: 'Cheap Removals in Glasgow',
    metaDescription:
      'Affordable house and flat removals in Glasgow with clear online pricing. ShiftMyHome offers insured crews and instant quotes — no hidden fees when scope is agreed.',
    heroTeaser: 'Straightforward Glasgow removals at a fair price.',
    intro:
      'If you are comparing cheap removals in Glasgow, price only matters when the job is still done properly. ShiftMyHome quotes online from your addresses and inventory so you see a real figure before booking — not a vague estimate that changes on the day.',
    introSecondary:
      'We cover tenements, flats, and family homes across Greater Glasgow. Choose the van size and crew you need, add packing if required, and move locally or UK-wide with goods-in-transit cover on booked jobs.',
    serviceBullets: [
      'Online quote based on your actual move details',
      'House, flat, and partial-load removals',
      'Local Glasgow routes and UK-wide delivery',
    ],
    faqs: [
      {
        q: 'How can I keep removal costs down in Glasgow?',
        a: 'Declutter before the move, book mid-week if possible, and list accurate items in the quote wizard so we assign the right van first time.',
      },
      {
        q: 'Are cheap quotes still insured?',
        a: 'Yes — goods-in-transit cover applies on confirmed bookings. Tell us about fragile or high-value pieces in your quote.',
      },
      {
        q: 'Do you serve all Glasgow postcodes?',
        a: 'We cover Greater Glasgow and can quote moves to Edinburgh, the Central Belt, and UK destinations.',
      },
    ],
    extraRelated: [
      { href: '/small-removals-glasgow', label: 'Small removals Glasgow' },
      { href: '/flat-removals-glasgow', label: 'Flat removals Glasgow' },
    ],
  },
  {
    path: '/affordable-removals-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'House Removals',
    h1: 'Affordable Removals in Edinburgh',
    metaDescription:
      'Affordable removals in Edinburgh and the Lothians. Instant online quotes, professional movers, and insured transport from ShiftMyHome.',
    heroTeaser: 'Fair pricing for Edinburgh moves, large or small.',
    intro:
      'Affordable removals in Edinburgh should still mean careful loading, clear timing, and a crew that knows city access. We quote from your pickup, delivery, and item list so the price reflects the work — not a one-size-fits-all tariff.',
    introSecondary:
      'From Leith flats to family homes in the suburbs, we plan parking, stairs, and lift access in advance. You can book a full move or a smaller load with the same transparent process.',
    serviceBullets: [
      'Edinburgh & Lothian postcodes',
      'Flats, maisonettes, and full-house moves',
      'Upfront pricing via the quote wizard',
    ],
    faqs: [
      {
        q: 'What affects removal prices in Edinburgh?',
        a: 'Distance, volume, parking, stairs, and date all play a part. The wizard calculates a live estimate from the details you enter.',
      },
      {
        q: 'Can you move from Edinburgh to Glasgow?',
        a: 'Yes — we regularly run Central Belt routes. Enter both addresses for an accurate quote.',
      },
      {
        q: 'Is weekend moving available?',
        a: 'Weekend slots are popular — book early. Mid-week moves can be easier to schedule at shorter notice.',
      },
    ],
    extraRelated: [
      { href: '/apartment-moves-edinburgh', label: 'Apartment moves Edinburgh' },
      { href: '/moving-company-edinburgh', label: 'Moving company Edinburgh' },
    ],
  },
  {
    path: '/house-movers-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'House Removals',
    h1: 'House Movers in Glasgow',
    metaDescription:
      'Professional house movers in Glasgow. ShiftMyHome provides insured crews, careful handling, and instant online quotes for local and UK moves.',
    heroTeaser: 'Experienced house movers for Glasgow homes.',
    intro:
      'Our house movers in Glasgow handle everything from single rooms to full properties. We assign the right vehicle and team based on what you list online, and we confirm access notes before arrival.',
    introSecondary:
      'Whether you are moving within the city or relocating elsewhere in Scotland, you get one point of contact, a clear price, and movers who protect furniture with blankets and straps as standard.',
    serviceBullets: [
      'Full and partial house moves',
      'Furniture wrapping and careful loading',
      'Glasgow local and long-distance routes',
    ],
    faqs: [
      {
        q: 'Do your house movers bring packing materials?',
        a: 'We can supply materials or work with your own boxes. Add requirements in the quote notes.',
      },
      {
        q: 'How many movers will I get?',
        a: 'Crew size follows the job — larger homes or heavy items may need a bigger team. The wizard suggests options from your inventory.',
      },
      {
        q: 'Can you dismantle beds and wardrobes?',
        a: 'Yes, where agreed in advance. Mention assembly needs when you quote.',
      },
    ],
    extraRelated: [{ href: '/local-removal-company-glasgow', label: 'Local removal company Glasgow' }],
  },
  {
    path: '/moving-company-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'House Removals',
    h1: 'Moving Company in Edinburgh',
    metaDescription:
      'Trusted moving company in Edinburgh. ShiftMyHome offers insured removals, man with van, and furniture delivery with instant online quotes.',
    heroTeaser: 'A moving company that puts clarity first.',
    intro:
      'Choosing a moving company in Edinburgh is easier when pricing and scope are clear upfront. ShiftMyHome is Glasgow-based with regular Edinburgh work — we know tenement stairs, permit parking, and tight access.',
    introSecondary:
      'Use our quote wizard for house removals, smaller loads, or delivery-only jobs. You will see pricing before you commit, and our team confirms details before move day.',
    serviceBullets: [
      'Residential and small office moves',
      'Man with van for lighter loads',
      'Edinburgh ↔ Glasgow and UK routes',
    ],
    faqs: [
      {
        q: 'Are you a registered moving company?',
        a: 'ShiftMyHome Ltd provides professional removals with insured transport on booked jobs. Your quote confirmation outlines what is included.',
      },
      {
        q: 'Do you offer surveys for large Edinburgh moves?',
        a: 'For most homes the online wizard is enough. For very large or complex moves, note details in your quote and we will follow up.',
      },
      {
        q: 'What payment options are available?',
        a: 'Payment is handled securely online when you confirm a booking through our quote flow.',
      },
    ],
  },
  {
    path: '/local-removal-company-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'House Removals',
    h1: 'Local Removal Company in Glasgow',
    metaDescription:
      'Local removal company in Glasgow for flats, houses, and small moves. Instant quotes, insured crews, and same-week availability when possible.',
    heroTeaser: 'Glasgow-based crews who know the city.',
    intro:
      'As a local removal company in Glasgow, we focus on moves where local knowledge matters — parking, close times, and tenement access. You deal directly with ShiftMyHome rather than a national call centre.',
    introSecondary:
      'We also cover Paisley, East Renfrewshire, North Lanarkshire, and wider Central Scotland. Quote online in minutes or call if you prefer to talk through a trickier access job.',
    serviceBullets: [
      'Greater Glasgow specialists',
      'Short-notice slots when available',
      'Flat, house, and man-with-van options',
    ],
    faqs: [
      {
        q: 'How local is your Glasgow coverage?',
        a: 'We cover the city and surrounding towns daily. Enter your postcode in the quote wizard to confirm.',
      },
      {
        q: 'Can I get a same-day Glasgow removal?',
        a: 'Sometimes — see our same-day removals page and quote with today’s date if crews are free.',
      },
      {
        q: 'Do you dispose of unwanted items?',
        a: 'Clearance services are available separately. Mention extra items in your quote notes.',
      },
    ],
    extraRelated: [{ href: '/same-day-removals-glasgow', label: 'Same day removals Glasgow' }],
  },
  {
    path: '/flat-removals-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'House Removals',
    h1: 'Flat Removals in Glasgow',
    metaDescription:
      'Flat removals in Glasgow — tenements, high-rises, and new builds. Careful movers, lift access planning, and instant online quotes.',
    heroTeaser: 'Flat moves with access planned in advance.',
    intro:
      'Flat removals in Glasgow often mean stairs, narrow landings, or busy lifts. Tell us your floor level and lift access in the quote wizard so we bring the right crew and equipment.',
    introSecondary:
      'We move studio flats through to large multi-bedroom homes. For smaller loads, man-with-van can be more cost-effective — the wizard will reflect the service you choose.',
    serviceBullets: [
      'Tenement and high-rise experience',
      'Studio to large flat moves',
      'Careful protection for hallways and lifts',
    ],
    faqs: [
      {
        q: 'Do you move sofas through tight Glasgow stairwells?',
        a: 'We assess access from your notes and photos if needed. Mention awkward items when quoting.',
      },
      {
        q: 'Is there a minimum charge for flat removals?',
        a: 'Pricing follows distance, time, and volume. Small flats with few items are often suited to man-with-van.',
      },
      {
        q: 'Can you help with packing a flat?',
        a: 'Yes — request packing support in your quote and we will include it where offered.',
      },
    ],
    extraRelated: [{ href: '/cheap-removals-glasgow', label: 'Cheap removals Glasgow' }],
  },
  {
    path: '/apartment-moves-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'House Removals',
    h1: 'Apartment Moves in Edinburgh',
    metaDescription:
      'Apartment moves in Edinburgh — Old Town, New Town, and modern developments. Professional movers and instant quotes from ShiftMyHome.',
    heroTeaser: 'Apartment relocations across Edinburgh.',
    intro:
      'Apartment moves in Edinburgh can involve historic staircases, resident parking permits, or underground car parks. We collect these details when you quote so move day runs smoothly.',
    introSecondary:
      'From student lets to family apartments, we scale the crew and van to your inventory. Longer moves to Glasgow or elsewhere in the UK are quoted the same way — one clear price.',
    serviceBullets: [
      'City-centre and suburban apartments',
      'Lift and stair access planning',
      'Student and family apartment moves',
    ],
    faqs: [
      {
        q: 'Do you move between Edinburgh apartment blocks?',
        a: 'Yes — local apartment-to-apartment moves are common. Add both addresses for pricing.',
      },
      {
        q: 'Can you store furniture between apartments?',
        a: 'We can discuss short-term options in your quote notes if you need a gap between addresses.',
      },
      {
        q: 'What if my building has move-in restrictions?',
        a: 'Share building rules or time windows when quoting — we schedule around them where possible.',
      },
    ],
  },
  {
    path: '/small-removals-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Man with Van',
    h1: 'Small Removals in Glasgow',
    metaDescription:
      'Small removals in Glasgow — few rooms, single items, or light loads. Man with van and small crew options with instant online quotes.',
    heroTeaser: 'Right-sized vans for smaller Glasgow moves.',
    intro:
      'Small removals in Glasgow do not need a full removal lorry. Our man-with-van service covers partial flat moves, furniture-only jobs, and quick local runs with a price matched to the load.',
    introSecondary:
      'If your move grows beyond a van load, we can switch to a larger vehicle and crew — start honest in the quote wizard and we will recommend the right setup.',
    serviceBullets: [
      'Partial flat and room moves',
      'Single-item and few-item jobs',
      'Cost-effective van and crew',
    ],
    faqs: [
      {
        q: 'What counts as a small removal?',
        a: 'Typically a van load or less — a few large items or the contents of one or two rooms. The wizard prices from your list.',
      },
      {
        q: 'Is man with van cheaper for small moves?',
        a: 'Often yes. We will show options based on volume and access.',
      },
      {
        q: 'How quickly can you do a small Glasgow move?',
        a: 'Short-notice slots appear when crews are available — quote with your preferred date.',
      },
    ],
    extraRelated: [{ href: '/cheap-man-with-van-glasgow', label: 'Cheap man with van Glasgow' }],
  },
  {
    path: '/same-day-removals-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'House Removals',
    h1: 'Same Day Removals in Glasgow',
    metaDescription:
      'Same day removals in Glasgow when crews are available. Urgent flat and house moves — quote online with today’s date for live availability.',
    heroTeaser: 'Urgent Glasgow moves when timing is tight.',
    intro:
      'Need same day removals in Glasgow? Availability depends on crew and vehicle schedules — the fastest way to check is to run a quote with today’s date and your full addresses.',
    introSecondary:
      'We prioritise safe, properly staffed jobs over rushing an understaffed move. If we cannot do same day, we will often offer the next available slot rather than overpromise.',
    serviceBullets: [
      'Quote with today’s move date',
      'Flats, houses, and urgent loads',
      'Man with van for smaller same-day jobs',
    ],
    faqs: [
      {
        q: 'Can you guarantee same day removal in Glasgow?',
        a: 'We confirm after you quote — it is not guaranteed until a slot is accepted. Morning enquiries improve success rates.',
      },
      {
        q: 'Is same day more expensive?',
        a: 'Short-notice dates can affect price. Your online quote shows the live figure.',
      },
      {
        q: 'What information speeds up a same day booking?',
        a: 'Complete addresses, item list, floor access, and a reachable phone number help us approve quickly.',
      },
    ],
    extraRelated: [{ href: '/emergency-man-with-van-glasgow', label: 'Emergency man with van Glasgow' }],
  },
  // —— Man with van keywords ——
  {
    path: '/cheap-man-with-van-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Man with Van',
    h1: 'Cheap Man with Van in Glasgow',
    metaDescription:
      'Cheap man with van in Glasgow for small moves and deliveries. Transparent online quotes and insured transport from ShiftMyHome.',
    heroTeaser: 'Van and crew priced for lighter Glasgow jobs.',
    intro:
      'A cheap man with van in Glasgow still needs to be reliable. We price from your route and items so you pay for the time and space you use — not a padded flat rate.',
    introSecondary:
      'Ideal for Gumtree buys, flat reshuffles, and small office runs. Add stairs or long carries in your quote so the crew arrives prepared.',
    serviceBullets: [
      'Small moves and single items',
      'Marketplace and shop collections',
      'Glasgow and Central Belt routes',
    ],
    faqs: [
      {
        q: 'How is man with van priced in Glasgow?',
        a: 'Distance, time on site, and load size drive the quote. Enter accurate items for the best price.',
      },
      {
        q: 'Do you help carry items upstairs?',
        a: 'Yes — note floors and lift access when quoting.',
      },
      {
        q: 'Can one man with van move a whole flat?',
        a: 'Larger flats may need two movers or a bigger van. The wizard flags sensible options.',
      },
    ],
  },
  {
    path: '/same-day-man-with-van-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'Man with Van',
    h1: 'Same Day Man with Van in Edinburgh',
    metaDescription:
      'Same day man with van in Edinburgh for urgent small moves and deliveries. Check live availability with an instant ShiftMyHome quote.',
    heroTeaser: 'Urgent van hire with a helper in Edinburgh.',
    intro:
      'When you need a same day man with van in Edinburgh, start with an online quote using today’s date. We will show if a crew can reach you and what the move will cost.',
    introSecondary:
      'This service suits furniture pickups, small flat moves, and business deliveries — not full house removals unless volume is modest.',
    serviceBullets: [
      'Urgent small loads',
      'Edinburgh and Lothian coverage',
      'Two-person crews when required',
    ],
    faqs: [
      {
        q: 'How late can I book same day van hire?',
        a: 'Earlier is better. Afternoon jobs depend on remaining crew hours.',
      },
      {
        q: 'Do you cover Edinburgh outskirts?',
        a: 'Yes — include full postcodes in your quote for accuracy.',
      },
      {
        q: 'Can you wait while I load at a shop?',
        a: 'Waiting time can affect cost. Mention expected wait in your notes.',
      },
    ],
  },
  {
    path: '/local-man-with-van-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Man with Van',
    h1: 'Local Man with Van in Glasgow',
    metaDescription:
      'Local man with van in Glasgow for quick jobs across the city. Instant quotes, insured drivers, and flexible scheduling.',
    heroTeaser: 'Glasgow van runs without national call centres.',
    intro:
      'Our local man with van service in Glasgow is built for short routes — collecting furniture, shifting between flats, or helping family with a few heavy pieces.',
    introSecondary:
      'Because we work in Glasgow daily, we understand common access issues and can suggest realistic time windows for your street.',
    serviceBullets: [
      'City and suburban Glasgow',
      'Hourly-style pricing via online quote',
      'Help loading and unloading',
    ],
    faqs: [
      {
        q: 'What areas count as local Glasgow?',
        a: 'The city plus nearby towns such as Paisley, Clydebank, and East Renfrewshire — quote with postcodes to confirm.',
      },
      {
        q: 'Do you provide blankets and straps?',
        a: 'Yes for booked jobs — mention fragile items in advance.',
      },
      {
        q: 'Can I book regular van runs?',
        a: 'Business repeat work is welcome — contact us via the quote form with details.',
      },
    ],
  },
  {
    path: '/emergency-man-with-van-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Man with Van',
    h1: 'Emergency Man with Van in Glasgow',
    metaDescription:
      'Emergency man with van in Glasgow when you need a fast response. Quote online for the quickest confirmation — subject to crew availability.',
    heroTeaser: 'Fast-response van help when plans change.',
    intro:
      'Emergency man with van in Glasgow covers last-minute situations — a buyer collecting today, a broken-down move, or sudden access changes. Quote immediately with your phone number for the fastest callback if needed.',
    introSecondary:
      'We cannot promise every emergency slot, but we will confirm honestly rather than leave you waiting. Smaller loads have the best chance of same-day cover.',
    serviceBullets: [
      'Last-minute collections',
      'Rapid quote confirmation',
      'Glasgow-wide coverage',
    ],
    faqs: [
      {
        q: 'What qualifies as an emergency move?',
        a: 'Typically same-day or next-morning jobs where normal lead time is not possible. Quote with your real deadline.',
      },
      {
        q: 'Is there an emergency surcharge?',
        a: 'Short-notice pricing is reflected in your online quote — no separate hidden fee.',
      },
      {
        q: 'Should I call instead of quoting online?',
        a: 'Quote online first for price; call if the job is complex and time-critical.',
      },
    ],
    extraRelated: [{ href: '/same-day-removals-glasgow', label: 'Same day removals Glasgow' }],
  },
  // —— Delivery keywords ——
  {
    path: '/sofa-delivery-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Furniture Delivery',
    h1: 'Sofa Delivery in Glasgow',
    metaDescription:
      'Sofa delivery in Glasgow — shop collections and private sales. Two-person crew, straps, and instant quotes from ShiftMyHome.',
    heroTeaser: 'Two-person sofa moves done safely.',
    intro:
      'Sofa delivery in Glasgow needs space planning and often two people. We collect from stores or sellers and deliver to your room of choice when access allows.',
    introSecondary:
      'Measure doorways and note stair flights in your quote. For corner sofas, mention dimensions so we send a suitable van.',
    serviceBullets: [
      'Shop and private seller pickup',
      'Stair and lift access',
      'Wrapping and careful handling',
    ],
    faqs: [
      {
        q: 'Do you deliver sofas bought online?',
        a: 'Yes — provide seller address and delivery postcode in the wizard.',
      },
      {
        q: 'Can you remove an old sofa?',
        a: 'Disposal may be possible — note it in your quote for options.',
      },
      {
        q: 'What if the sofa does not fit?',
        a: 'We assess access from your description. Extremely tight access may need disassembly or cannot be guaranteed.',
      },
    ],
  },
  {
    path: '/furniture-delivery-scotland',
    cityName: 'Scotland',
    regionLabel: 'Scotland-wide',
    serviceType: 'Furniture Delivery',
    h1: 'Furniture Delivery Across Scotland',
    metaDescription:
      'Furniture delivery across Scotland — single items to full room sets. Insured transport and instant online quotes from ShiftMyHome.',
    heroTeaser: 'Scotland-wide furniture transport.',
    intro:
      'Furniture delivery in Scotland spans short urban runs and longer Highland routes. ShiftMyHome quotes from collection and delivery postcodes with your item list so routing and vehicle size are right first time.',
    introSecondary:
      'We move sofas, beds, wardrobes, and marketplace purchases between cities and rural addresses. Share access restrictions early for accurate scheduling.',
    serviceBullets: [
      'Glasgow, Edinburgh, Aberdeen, and beyond',
      'Retail and private collections',
      'Careful two-person handling',
    ],
    faqs: [
      {
        q: 'Do you deliver furniture outside central Scotland?',
        a: 'Yes — quote both postcodes. Remote areas may need longer lead times.',
      },
      {
        q: 'Can you deliver multiple items in one trip?',
        a: 'Yes. List all pieces so we allocate van space correctly.',
      },
      {
        q: 'Is assembly included?',
        a: 'Basic assembly can be arranged when agreed in your booking notes.',
      },
    ],
    extraRelated: [{ href: '/removals-scotland', label: 'Removals Scotland' }],
  },
  {
    path: '/ikea-delivery-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Furniture Delivery',
    h1: 'IKEA Delivery in Glasgow',
    metaDescription:
      'IKEA delivery help in Glasgow — collect from IKEA Glasgow or sellers and deliver home with assembly on request. Instant ShiftMyHome quotes.',
    heroTeaser: 'From IKEA to your room — we handle the heavy lifting.',
    intro:
      'IKEA delivery in Glasgow often means flat-pack volume and tight stairwells. We collect from IKEA Glasgow, C&C points, or private sellers and deliver with care.',
    introSecondary:
      'List approximate box counts or main items in the quote. Request assembly in notes if you want help building after delivery.',
    serviceBullets: [
      'IKEA store and collection point pickup',
      'Flat-pack friendly vans',
      'Optional assembly support',
    ],
    faqs: [
      {
        q: 'Can you collect from IKEA Glasgow without me there?',
        a: 'Collection rules vary — share your order details and collection authorisation in the quote.',
      },
      {
        q: 'Do you charge per box or per trip?',
        a: 'Pricing reflects overall volume and time. Accurate lists keep quotes fair.',
      },
      {
        q: 'Can you take packaging away?',
        a: 'Mention disposal needs when quoting — we will confirm if offered.',
      },
    ],
  },
  {
    path: '/gumtree-delivery-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Furniture Delivery',
    h1: 'Gumtree Delivery in Glasgow',
    metaDescription:
      'Gumtree delivery in Glasgow — collect marketplace furniture and appliances safely. Two-person crews and instant online quotes.',
    heroTeaser: 'Collect Gumtree buys without hiring a random van.',
    intro:
      'Gumtree delivery in Glasgow is a popular way to buy locally — we collect from sellers and deliver to your address with a proper crew and insurance on booked jobs.',
    introSecondary:
      'Share seller postcode, item size, and whether you need help upstairs. We do not handle payment to sellers; we focus on transport.',
    serviceBullets: [
      'Private seller collections',
      'Sofas, tables, and white goods',
      'Careful loading and securing',
    ],
    faqs: [
      {
        q: 'Can you wait while I inspect the Gumtree item?',
        a: 'Short waits are possible — note expected time in your quote.',
      },
      {
        q: 'What if the seller cancels?',
        a: 'Cancellation terms follow your booking confirmation — contact us as soon as plans change.',
      },
      {
        q: 'Do you cover items outside Glasgow?',
        a: 'Yes if quoted — include both postcodes.',
      },
    ],
    extraRelated: [{ href: '/facebook-marketplace-delivery-glasgow', label: 'Facebook Marketplace delivery' }],
  },
  {
    path: '/facebook-marketplace-delivery-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Furniture Delivery',
    h1: 'Facebook Marketplace Delivery in Glasgow',
    metaDescription:
      'Facebook Marketplace delivery in Glasgow. Insured furniture collections with instant quotes — safer than unverified private vans.',
    heroTeaser: 'Marketplace collections with a proper removals crew.',
    intro:
      'Facebook Marketplace delivery in Glasgow helps you buy locally without struggling to fit a wardrobe into a car. We quote from seller and buyer addresses plus item type.',
    introSecondary:
      'Photos and dimensions in your quote notes help us send the right van. Evening collections may be possible where sellers allow.',
    serviceBullets: [
      'Furniture and appliance pickup',
      'Glasgow and nearby towns',
      'Two movers for heavy pieces',
    ],
    faqs: [
      {
        q: 'Is Marketplace delivery insured?',
        a: 'Goods-in-transit cover applies on confirmed bookings. Declare value for delicate items.',
      },
      {
        q: 'Can you deliver to a storage unit?',
        a: 'Yes — use the storage address as delivery in the wizard.',
      },
      {
        q: 'How do I share seller details?',
        a: 'Add collection postcode and contact notes in the quote form.',
      },
    ],
    extraRelated: [{ href: '/gumtree-delivery-glasgow', label: 'Gumtree delivery Glasgow' }],
  },
  {
    path: '/single-item-delivery-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'Furniture Delivery',
    h1: 'Single Item Delivery in Edinburgh',
    metaDescription:
      'Single item delivery in Edinburgh — one sofa, bed, or appliance moved safely. Man with van and delivery crews with instant quotes.',
    heroTeaser: 'One item, one clear price.',
    intro:
      'Single item delivery in Edinburgh is ideal when you only need a sofa, fridge, or desk moved. You pay for a focused job rather than a full home removal.',
    introSecondary:
      'We handle shop collections, private sales, and donations to family — always with careful wrapping and secure transport.',
    serviceBullets: [
      'One-off furniture and appliances',
      'Stair and lift access in Edinburgh',
      'Quick online booking',
    ],
    faqs: [
      {
        q: 'What is the smallest job you take?',
        a: 'There is no strict minimum — very small items may still need two people for stairs.',
      },
      {
        q: 'Can you collect from IKEA Edinburgh?',
        a: 'Yes — include collection point and item details.',
      },
      {
        q: 'Do you offer evening delivery?',
        a: 'Mention preferred times in notes — we confirm if feasible.',
      },
    ],
  },
  // —— Student / office ——
  {
    path: '/student-removals-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Student Moves',
    h1: 'Student Removals in Glasgow',
    metaDescription:
      'Student removals in Glasgow for halls, flats, and term moves. Budget-friendly options and instant quotes from ShiftMyHome.',
    heroTeaser: 'Term moves for Glasgow students.',
    intro:
      'Student removals in Glasgow peak around September and June. Booking early secures better dates; man-with-van is often enough for a room or shared flat.',
    introSecondary:
      'We move to and from Glasgow universities, private halls, and family homes across Scotland and the UK.',
    serviceBullets: [
      'Halls and shared flats',
      'Smaller vans for tighter budgets',
      'UK term-time routes',
    ],
    faqs: [
      {
        q: 'Do you offer student discounts?',
        a: 'Pricing is quote-based — smaller loads naturally cost less. Accurate item lists help.',
      },
      {
        q: 'Can parents book on a student’s behalf?',
        a: 'Yes — use the student’s addresses and contact details in the wizard.',
      },
      {
        q: 'Do you help with storage between terms?',
        a: 'Note storage needs in your quote for options.',
      },
    ],
    extraRelated: [{ href: '/cheap-student-moves-edinburgh', label: 'Cheap student moves Edinburgh' }],
  },
  {
    path: '/cheap-student-moves-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'Student Moves',
    h1: 'Cheap Student Moves in Edinburgh',
    metaDescription:
      'Cheap student moves in Edinburgh — affordable van hire for halls and flats. Instant online quotes from ShiftMyHome.',
    heroTeaser: 'Student-friendly moves in Edinburgh.',
    intro:
      'Cheap student moves in Edinburgh work best when you only move what you need. Share a van with a friend’s items only if agreed in advance — we quote per booking.',
    introSecondary:
      'We cover central Edinburgh, Marchmont, Newington, and commuter towns. Label boxes before collection to unload faster.',
    serviceBullets: [
      'Room and flat moves',
      'Term-start and term-end slots',
      'Man with van for light loads',
    ],
    faqs: [
      {
        q: 'How do I keep student move costs low?',
        a: 'Move fewer items, book mid-week, and use accurate inventory in the quote.',
      },
      {
        q: 'Can you collect from storage?',
        a: 'Yes — use the storage site as pickup or delivery.',
      },
      {
        q: 'Do you move to other cities for university?',
        a: 'Yes — quote full UK addresses.',
      },
    ],
  },
  {
    path: '/office-movers-glasgow',
    cityName: 'Glasgow',
    regionLabel: 'Greater Glasgow',
    serviceType: 'Office Moves',
    h1: 'Office Movers in Glasgow',
    metaDescription:
      'Office movers in Glasgow for desks, IT, and workplace furniture. Planned business moves with instant quotes from ShiftMyHome.',
    heroTeaser: 'Business moves with minimal downtime.',
    intro:
      'Office movers in Glasgow need labelling, timing, and often out-of-hours access. Tell us your floor, lift, and whether IT desks must stay connected until last.',
    introSecondary:
      'From single office suites to multi-room relocations, we coordinate crew size and vehicles to match your inventory list.',
    serviceBullets: [
      'Desks, chairs, and filing',
      'Evening and weekend slots',
      'Glasgow business districts',
    ],
    faqs: [
      {
        q: 'Can you move servers or specialist IT?',
        a: 'Standard office furniture and PCs yes — specialist IT may need your technician; note requirements.',
      },
      {
        q: 'Do you provide crate hire?',
        a: 'Mention packing needs in your quote for available options.',
      },
      {
        q: 'How far ahead should offices book?',
        a: 'Two to four weeks is ideal; short notice possible when capacity allows.',
      },
    ],
    extraRelated: [{ href: '/office-removals-glasgow', label: 'Office removals Glasgow' }],
  },
  {
    path: '/business-relocation-edinburgh',
    cityName: 'Edinburgh',
    regionLabel: 'Edinburgh & the Lothians',
    serviceType: 'Office Moves',
    h1: 'Business Relocation in Edinburgh',
    metaDescription:
      'Business relocation in Edinburgh — office and studio moves with careful planning. ShiftMyHome quotes online for transparent pricing.',
    heroTeaser: 'Relocate Edinburgh workplaces smoothly.',
    intro:
      'Business relocation in Edinburgh can mean Old Town offices with stairs or modern parks with loading bays. We capture access details up front to avoid surprises.',
    introSecondary:
      'Retail stock, professional studios, and conventional offices are all quoted from your inventory. We can stage moves over multiple days if needed.',
    serviceBullets: [
      'Office and studio relocations',
      'Labelled packing for setup',
      'Edinburgh and Lothian coverage',
    ],
    faqs: [
      {
        q: 'Can you relocate over a weekend?',
        a: 'Weekend slots are popular — book early and confirm building access.',
      },
      {
        q: 'Do you handle employee desk moves only?',
        a: 'Yes for smaller jobs — list desks and personal storage in the wizard.',
      },
      {
        q: 'Can you move to Glasgow from Edinburgh?',
        a: 'Central Belt business moves are routine — quote both addresses.',
      },
    ],
    extraRelated: [{ href: '/office-removals-edinburgh', label: 'Office removals Edinburgh' }],
  },
  // —— Search intent ——
  {
    path: '/movers-near-me',
    cityName: 'Scotland',
    regionLabel: 'Near you',
    serviceType: 'House Removals',
    h1: 'Movers Near Me in Scotland',
    metaDescription:
      'Looking for movers near you in Scotland? ShiftMyHome quotes online for Glasgow, Edinburgh, and UK moves with insured professional crews.',
    heroTeaser: 'Find movers near your postcode — quote online.',
    intro:
      'Searching “movers near me” usually means you want someone local, available, and fairly priced. ShiftMyHome is Glasgow-based with crews working across Scotland daily — start with your postcode in our quote wizard.',
    introSecondary:
      'Your live quote shows vehicle and crew suggestions from what you are moving, not a generic estimate. We cover house removals, man with van, and furniture delivery.',
    serviceBullets: [
      'Quote from your actual postcode',
      'House, flat, and single-item moves',
      'Scotland and UK destinations',
    ],
    faqs: [
      {
        q: 'How do I find movers near my postcode?',
        a: 'Enter pickup and delivery addresses in the wizard — we confirm coverage and price immediately.',
      },
      {
        q: 'Do you cover rural Scotland?',
        a: 'Yes — remote areas may need longer lead times. Quote for accuracy.',
      },
      {
        q: 'Are your movers employed or casual?',
        a: 'Booked jobs use professional crews vetted for ShiftMyHome work.',
      },
    ],
    extraRelated: [
      { href: '/removal-company-near-me', label: 'Removal company near me' },
      { href: '/glasgow-removals', label: 'Glasgow removals' },
    ],
  },
  {
    path: '/removal-company-near-me',
    cityName: 'Scotland',
    regionLabel: 'Near you',
    serviceType: 'House Removals',
    h1: 'Removal Company Near Me',
    metaDescription:
      'Removal company near you in Scotland. ShiftMyHome — insured moves, instant quotes, and local crews across Glasgow, Edinburgh, and the UK.',
    heroTeaser: 'A removal company you can quote in minutes.',
    intro:
      'A removal company near you should answer the phone, show clear pricing, and turn up prepared. ShiftMyHome handles quoting online so you see costs before you speak to us.',
    introSecondary:
      'We are not a lead-selling directory — you book ShiftMyHome directly. That means consistent service and one team accountable for your move.',
    serviceBullets: [
      'Direct booking with ShiftMyHome',
      'Instant online pricing',
      'Residential and small business moves',
    ],
    faqs: [
      {
        q: 'How is ShiftMyHome different from comparison sites?',
        a: 'You quote and book us directly — no auctioning your job to unknown firms.',
      },
      {
        q: 'What services does your removal company offer?',
        a: 'House removals, man with van, office moves, student moves, clearance, and furniture delivery.',
      },
      {
        q: 'Can I visit an office?',
        a: 'We operate online-first for quotes — contact us via phone or WhatsApp for complex jobs.',
      },
    ],
    extraRelated: [{ href: '/movers-near-me', label: 'Movers near me' }],
  },
  {
    path: '/moving-services-scotland',
    cityName: 'Scotland',
    regionLabel: 'Scotland-wide',
    serviceType: 'House Removals',
    h1: 'Moving Services in Scotland',
    metaDescription:
      'Moving services across Scotland — removals, man with van, office and student moves. One quote system, insured crews, ShiftMyHome.',
    heroTeaser: 'Full moving services across Scotland.',
    intro:
      'Moving services in Scotland range from a single wardrobe to a full house crossing the Highlands. ShiftMyHome groups everything under one quote flow so you pick the right service once.',
    introSecondary:
      'Glasgow and Edinburgh are our busiest hubs, but we quote Aberdeen, Dundee, Inverness, and UK routes the same way — enter addresses and items honestly for the best plan.',
    serviceBullets: [
      'House removals and man with van',
      'Office, student, and clearance',
      'Scotland ↔ UK routes',
    ],
    faqs: [
      {
        q: 'Which moving services do you offer?',
        a: 'House removals, man with van, furniture delivery, office moves, student moves, and clearance.',
      },
      {
        q: 'Do you move between Scottish cities?',
        a: 'Yes — inter-city Scotland moves are common. Quote both postcodes.',
      },
      {
        q: 'Can you store items temporarily?',
        a: 'Ask in quote notes — we will confirm storage options if available.',
      },
    ],
    extraRelated: [{ href: '/removals-scotland', label: 'Removals Scotland' }],
  },
  {
    path: '/removals-scotland',
    cityName: 'Scotland',
    regionLabel: 'Scotland-wide',
    serviceType: 'House Removals',
    h1: 'Removals in Scotland',
    metaDescription:
      'Removals in Scotland for homes and businesses. City-to-city and UK moves with instant online quotes from ShiftMyHome.',
    heroTeaser: 'Scotland removals with clear online quotes.',
    intro:
      'Removals in Scotland need planners who understand distance, ferries, and seasonal access in some areas. We quote from your route and inventory rather than a postcode table.',
    introSecondary:
      'Whether you move within one city or from Glasgow to the Highlands, you get insured transport and professional loading on booked jobs.',
    serviceBullets: [
      'All major Scottish cities',
      'Rural and island routes by arrangement',
      'House and flat specialists',
    ],
    faqs: [
      {
        q: 'How much do Scotland removals cost?',
        a: 'Volume and distance drive price — the wizard gives a live estimate from your details.',
      },
      {
        q: 'Do you cover the Highlands and islands?',
        a: 'Yes with advance planning. Quote early for Orkney, Shetland, or remote routes.',
      },
      {
        q: 'Can you move from Scotland to England?',
        a: 'UK-wide moves are available — include full addresses in your quote.',
      },
    ],
    extraRelated: [
      { href: '/moving-services-scotland', label: 'Moving services Scotland' },
      { href: '/edinburgh-removals', label: 'Edinburgh removals' },
    ],
  },
  {
    path: '/scotland-removal-company',
    cityName: 'Scotland',
    regionLabel: 'Scotland-wide',
    serviceType: 'House Removals',
    h1: 'Scotland Removal Company',
    metaDescription:
      'Scotland removal company for home and office moves. ShiftMyHome — Glasgow-based, UK-capable, instant quotes, insured crews.',
    heroTeaser: 'Your Scotland removal company — quote online.',
    intro:
      'As a Scotland removal company, ShiftMyHome combines Glasgow roots with nationwide reach. You get local crew knowledge plus the ability to move to England, Wales, or elsewhere in the UK.',
    introSecondary:
      'Our online quote system keeps quality consistent — every job lists items, addresses, and access so crews arrive with the right van and team.',
    serviceBullets: [
      'Scottish hubs: Glasgow & Edinburgh',
      'Business and residential',
      'Transparent booking online',
    ],
    faqs: [
      {
        q: 'Where is ShiftMyHome based?',
        a: 'We are Glasgow-based and work across Scotland and the UK.',
      },
      {
        q: 'Are you fully insured?',
        a: 'Goods-in-transit cover applies on booked jobs. Ask about high-value items when quoting.',
      },
      {
        q: 'How do I get a written quote?',
        a: 'Complete the online wizard — you receive pricing before confirming a booking.',
      },
    ],
    extraRelated: [
      { href: '/removals-scotland', label: 'Removals Scotland' },
      { href: '/glasgow-removals', label: 'Glasgow removals' },
    ],
  },
]
