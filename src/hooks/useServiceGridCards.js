import { useEffect, useMemo, useState } from 'react'
import { SERVICE_PAGES, getServicePageByPath } from '../constants/servicePages'
import { HOME_SERVICE_CARD_IMAGES } from '../constants/homeServiceCardImages'
import { fetchPricingSettings } from '../lib/data/pricingSettingsRepository'
import { onPricingSettingsUpdated } from '../lib/pricingSettingsEvents'
import { buildServiceCardPriceBySlug, formatServiceCardDisplayPrice } from '../lib/serviceCardDisplayPrice'
import { useWebsiteCms } from '../context/WebsiteCmsContext'

function serviceTypeForPath(path) {
  return getServicePageByPath(path)?.serviceType ?? ''
}

/** @type {Record<string, string>} */
export const SERVICE_TYPE_TO_SLUG = {
  'House Removals': 'house-removals',
  'Man with Van': 'man-with-van',
  'Furniture Delivery': 'furniture-delivery',
  'Office Moves': 'office-moves',
  'Student Moves': 'student-moves',
  Clearance: 'clearance',
}

/** @param {string} serviceType */
export function serviceTypeToSlug(serviceType) {
  return SERVICE_TYPE_TO_SLUG[String(serviceType || '').trim()] ?? 'house-removals'
}

/** @param {string} slug */
export function fallbackServiceCardImage(slug) {
  return HOME_SERVICE_CARD_IMAGES[slug] ?? HOME_SERVICE_CARD_IMAGES['house-removals']
}

/** Shared service card data for homepage desktop + mobile grids. */
export function useServiceGridCards() {
  const { serviceCards, hasCmsServiceCards } = useWebsiteCms()
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      try {
        const s = await fetchPricingSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setSettings(null)
      }
    }

    void loadSettings()
    const unsubscribe = onPricingSettingsUpdated(() => {
      void loadSettings()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const priceBySlug = useMemo(() => buildServiceCardPriceBySlug(settings), [settings])

  const cards = useMemo(() => {
    if (hasCmsServiceCards) {
      return serviceCards
        .filter((c) => c.is_active !== false)
        .map((c) => {
          const serviceType = serviceTypeForPath(c.route_path) || ''
          // Always use Admin homepageDisplayPrice (`displayPriceByService`) — never CMS starting_price
          // or quote minimumServiceThreshold (`basePriceByService`).
          const price =
            formatServiceCardDisplayPrice(settings, serviceType) ||
            priceBySlug[c.slug] ||
            null
          return {
            key: c.id || c.slug,
            slug: c.slug,
            title: c.title,
            description: c.description,
            imageSrc: c.image_url,
            path: `/quote?service=${encodeURIComponent(c.slug)}`,
            seoPath: c.route_path,
            serviceType,
            buttonText: c.button_text || 'Get a Quote',
            price,
          }
        })
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
      path: `/quote?service=${encodeURIComponent(service.slug)}`,
      seoPath: service.path,
      serviceType: service.serviceType,
      buttonText: 'Get a Quote',
      price: priceBySlug[service.slug] || null,
    }))
  }, [hasCmsServiceCards, serviceCards, priceBySlug, settings])

  return cards
}

/**
 * Resolve service card images from CMS (admin) with static fallbacks.
 * Same source as homepage — SEO pages stay in sync when admin images change.
 */
export function useServiceCardImageBySlug() {
  const cards = useServiceGridCards()

  return useMemo(() => {
    /** @type {Record<string, string>} */
    const bySlug = {}
    for (const card of cards) {
      if (card.slug && card.imageSrc) bySlug[card.slug] = card.imageSrc
    }

    /** @param {string} slug */
    return (slug) => bySlug[slug] ?? fallbackServiceCardImage(slug)
  }, [cards])
}
