import { useEffect, useMemo, useState } from 'react'
import { SERVICE_PAGES, getServicePageByPath } from '../constants/servicePages'

function serviceTypeForPath(path) {
  return getServicePageByPath(path)?.serviceType ?? ''
}
import { HOME_SERVICE_CARD_IMAGES } from '../constants/homeServiceCardImages'
import { fetchPricingSettings } from '../lib/data/pricingSettingsRepository'
import { buildServiceCardPriceBySlug } from '../lib/serviceCardDisplayPrice'
import { useWebsiteCms } from '../context/WebsiteCmsContext'

/** Shared service card data for homepage desktop + mobile grids. */
export function useServiceGridCards() {
  const { serviceCards, hasCmsServiceCards } = useWebsiteCms()
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetchPricingSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setSettings(null)
      } finally {
        // no loading UI — cards render with optional prices
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const priceBySlug = useMemo(() => buildServiceCardPriceBySlug(settings), [settings])

  const cards = useMemo(() => {
    if (hasCmsServiceCards) {
      return serviceCards
        .filter((c) => c.is_active !== false)
        .map((c) => ({
          key: c.id || c.slug,
          slug: c.slug,
          title: c.title,
          description: c.description,
          imageSrc: c.image_url,
          path: c.route_path,
          serviceType: serviceTypeForPath(c.route_path) || '',
          buttonText: c.button_text || 'Get a Quote',
          price: c.starting_price || priceBySlug[c.slug] || null,
        }))
    }
    return SERVICE_PAGES.map((service) => ({
      key: service.path,
      slug: service.slug,
      title: service.slug === 'office-moves' ? 'Office Move' : service.title,
      description:
        {
          'house-removals': 'Full or partial moves of any size.',
          'man-with-van': 'Van & crew for smaller loads and quick jobs.',
          'furniture-delivery': 'Bulky furniture moved safely with care.',
          'office-moves': 'Office relocations planned around your business.',
          'student-moves': 'Student & flat moves across Glasgow & beyond.',
          clearance: 'Clearances with upfront pricing & disposal.',
        }[service.slug] ?? service.heroTeaser,
      imageSrc: HOME_SERVICE_CARD_IMAGES[service.slug] ?? service.heroImage,
      path: service.path,
      serviceType: service.serviceType,
      buttonText: 'Get a Quote',
      price: priceBySlug[service.slug] || null,
    }))
  }, [hasCmsServiceCards, serviceCards, priceBySlug])

  return cards
}
