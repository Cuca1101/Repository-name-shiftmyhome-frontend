/**
 * Public Trustpilot profile for www.shiftmyhome.co.uk.
 * The free Review Collector TrustBox is the only widget this business unit can read.
 * The browser cannot call it directly (CORS), so the site reads it here.
 */
const BUSINESS_UNIT_ID = '6a1db78718800ca879001e90'
const REVIEW_COLLECTOR_TEMPLATE = '56278e9abfbbba0bdcd568bc'
const WIDGET_URL =
  `https://widget.trustpilot.com/trustbox-data/${REVIEW_COLLECTOR_TEMPLATE}` +
  `?businessUnitId=${BUSINESS_UNIT_ID}&locale=en-GB`
const PAGE_URL = 'https://www.trustpilot.com/review/www.shiftmyhome.co.uk'

const FETCH_HEADERS = {
  accept: 'application/json,text/html;q=0.9',
  'accept-language': 'en-GB,en;q=0.9',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}

/**
 * @param {unknown} value
 */
function reviewCountOf(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && Number.isFinite(Number(value.total))) return Number(value.total)
  return 0
}

/**
 * @param {unknown} row
 * @param {number} index
 */
function mapReview(row, index) {
  if (!row || typeof row !== 'object') return null
  const item = /** @type {Record<string, any>} */ (row)
  const body = String(item.text || item.body || item.content || '').trim()
  const authorName = String(item.consumer?.displayName || item.authorName || '').trim()
  const rating = Number(item.rating ?? item.stars)
  const published = String(item.dates?.publishedDate || item.createdAt || item.date || '')
  if (!body || !authorName || !Number.isFinite(rating)) return null
  return {
    id: String(item.id || `trustpilot-${published || index}`),
    source: 'trustpilot',
    authorName,
    body,
    rating,
    date: published.slice(0, 10) || '1970-01-01',
  }
}

/**
 * @param {Record<string, any>} unit
 * @param {unknown[]} [reviews]
 */
function profileFromUnit(unit, reviews = []) {
  const reviewCount = reviewCountOf(unit.numberOfReviews)
  const rating = Number(unit.score?.trustScore ?? unit.trustScore ?? unit.stars)
  return {
    name: String(unit.displayName || 'ShiftMyHome'),
    rating: Number.isFinite(rating) ? rating : 0,
    reviewCount,
    profileUrl: 'https://www.trustpilot.com/review/www.shiftmyhome.co.uk',
    reviews: reviews.map(mapReview).filter(Boolean),
  }
}

/**
 * @param {string} html
 */
function profileFromHtml(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return null
  const json = JSON.parse(match[1])
  const page = json?.props?.pageProps
  if (!page?.businessUnit) return null
  const reviews = Array.isArray(page.reviews) ? page.reviews : []
  return profileFromUnit(page.businessUnit, reviews)
}

async function loadProfile() {
  const widgetResponse = await fetch(WIDGET_URL, { headers: { accept: 'application/json' } })
  if (!widgetResponse.ok) return null
  const data = await widgetResponse.json()
  const unit = data?.businessUnit
  if (!unit || typeof unit !== 'object') return null
  const profile = profileFromUnit(unit, [])
  if (profile.reviewCount < 1) return profile

  try {
    const pageResponse = await fetch(PAGE_URL, { headers: FETCH_HEADERS })
    if (pageResponse.ok) {
      const fromPage = profileFromHtml(await pageResponse.text())
      if (fromPage?.reviews?.length) profile.reviews = fromPage.reviews
    }
  } catch {
    /* The score and count are already live. Review text is optional. */
  }
  return profile
}

export async function onRequest() {
  try {
    const profile = await loadProfile()
    if (!profile) {
      return new Response(JSON.stringify({ message: 'Trustpilot profile is unavailable.' }), {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=1800',
      },
    })
  } catch {
    return new Response(JSON.stringify({ message: 'Trustpilot profile is unavailable.' }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
}
