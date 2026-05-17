/**
 * Public service landing pages: path, display title, and QuoteWizard service type bindings.
 * `serviceType` must match admin base price keys.
 */
export const SERVICE_PAGES = [
  {
    path: '/house-removals',
    slug: 'house-removals',
    title: 'House Removals',
    serviceType: 'House Removals',
    shortDescription:
      'Full and partial house moves — careful packing, loading, and delivery door to door. Tell us about your home and inventory for an accurate estimate.',
    heroTeaser: 'Full & partial moves — packed, loaded, delivered.',
    heroImage:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=80',
  },
  {
    path: '/man-with-van',
    slug: 'man-with-van',
    title: 'Man and Van',
    serviceType: 'Man with Van',
    shortDescription:
      'Flexible van and crew for smaller loads, single items, and quick local moves. Tell us what you need moved for a clear estimate.',
    heroTeaser: 'Van & crew for smaller loads and quick jobs.',
    heroImage:
      'https://images.unsplash.com/photo-1625805866449-3589fe3a71a9?auto=format&fit=crop&w=2000&q=80',
  },
  {
    path: '/furniture-delivery',
    slug: 'furniture-delivery',
    title: 'Furniture & Large Items',
    serviceType: 'Furniture Delivery',
    shortDescription:
      'Sofas, beds, and bulky pieces moved with care, straps, and the right vehicle. Share sizes and access details for an accurate quote.',
    heroTeaser: 'Bulky furniture moved safely with care.',
    heroImage:
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=2000&q=80',
  },
  {
    path: '/office-moves',
    slug: 'office-moves',
    title: 'Office Removals',
    serviceType: 'Office Moves',
    shortDescription:
      'Desks, IT, and office furniture relocated with minimal downtime. We plan around your business hours where possible.',
    heroTeaser: 'Office relocations planned around your business.',
    heroImage:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2000&q=80',
  },
  {
    path: '/student-moves',
    slug: 'student-moves',
    title: 'Student Moves',
    serviceType: 'Student Moves',
    shortDescription:
      'Budget-friendly moves for halls, flats, and term-time addresses — ideal for smaller loads and shared accommodation across Glasgow and beyond.',
    heroTeaser: 'Student & flat moves across Glasgow & beyond.',
    heroImage:
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=2000&q=80',
  },
  {
    path: '/clearance',
    slug: 'clearance',
    title: 'Clearance',
    serviceType: 'Clearance',
    shortDescription:
      'House, garage, and garden clearances with responsible disposal where possible. Get a clear price before we arrive.',
    heroTeaser: 'Clearances with upfront pricing & disposal.',
    heroImage:
      'https://images.unsplash.com/photo-1604187351574-c75a200351d0?auto=format&fit=crop&w=2000&q=80',
  },
]

/** @param {string} path */
export function getServicePageByPath(path) {
  return SERVICE_PAGES.find((p) => p.path === path) ?? null
}
