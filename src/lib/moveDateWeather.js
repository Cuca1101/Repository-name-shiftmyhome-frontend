import { getLocalDateYYYYMMDD } from './moveDateLocal'

/** Open-Meteo free tier — show weather on calendar cards within this window only. */
export const WEATHER_FORECAST_MAX_DAYS = 14

const FORECAST_CACHE_TTL_MS = 60 * 60 * 1000
const forecastCache = new Map()

/**
 * @param {string} isoDate YYYY-MM-DD
 * @returns {number | null}
 */
export function daysFromToday(isoDate) {
  const t = String(isoDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const [y, m, d] = t.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const todayIso = getLocalDateYYYYMMDD()
  const [ty, tm, td] = todayIso.split('-').map(Number)
  const today = new Date(ty, tm - 1, td)
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (24 * 60 * 60 * 1000))
}

/**
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isDateWithinWeatherForecast(isoDate) {
  const days = daysFromToday(isoDate)
  return days != null && days >= 0 && days <= WEATHER_FORECAST_MAX_DAYS
}

/**
 * @param {number} code WMO weather code
 * @param {number | null} tempMaxC
 * @returns {{ kind: string, label: string, tempLabel: string | null }}
 */
export function describeWmoWeather(code, tempMaxC) {
  const temp =
    tempMaxC != null && Number.isFinite(tempMaxC) ? `${Math.round(tempMaxC)}°` : null
  const hot = tempMaxC != null && tempMaxC >= 22

  if (code === 0) {
    return { kind: hot ? 'hot' : 'sunny', label: hot ? 'Hot' : 'Sunny', tempLabel: temp }
  }
  if (code === 1 || code === 2) {
    return { kind: hot ? 'hot' : 'partly-cloudy', label: hot ? 'Warm' : 'Partly cloudy', tempLabel: temp }
  }
  if (code === 3) {
    return { kind: 'overcast', label: 'Overcast', tempLabel: temp }
  }
  if (code === 45 || code === 48) {
    return { kind: 'fog', label: 'Foggy', tempLabel: temp }
  }
  if (code >= 51 && code <= 57) {
    return { kind: 'drizzle', label: 'Drizzle', tempLabel: temp }
  }
  if (code >= 61 && code <= 67) {
    return { kind: 'rain', label: 'Rain', tempLabel: temp }
  }
  if (code >= 71 && code <= 77) {
    return { kind: 'snow', label: 'Snow', tempLabel: temp }
  }
  if (code >= 80 && code <= 82) {
    return { kind: 'showers', label: 'Showers', tempLabel: temp }
  }
  if (code >= 95) {
    return { kind: 'storm', label: 'Storm', tempLabel: temp }
  }
  return { kind: 'overcast', label: 'Overcast', tempLabel: temp }
}

/** Emoji icons for calendar price cards (selected date). */
export const WEATHER_EMOJI_BY_KIND = {
  sunny: '☀️',
  hot: '☀️',
  'partly-cloudy': '🌤️',
  cloudy: '⛅',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  showers: '🌦️',
  snow: '❄️',
  storm: '⛈️',
  windy: '💨',
}

/**
 * @param {Record<string, { code: number, tempMaxC: number | null }> | null | undefined} byDate
 * @param {string} isoDate
 * @returns {{ emoji: string, label: string, tempLabel: string | null } | null}
 */
export function weatherEmojiForMoveDate(byDate, isoDate) {
  const hint = weatherHintForMoveDate(byDate, isoDate)
  if (!hint) return null
  return {
    emoji: WEATHER_EMOJI_BY_KIND[hint.kind] || '⛅',
    label: hint.label,
    tempLabel: hint.tempLabel,
  }
}

function cacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<Record<string, { code: number, tempMaxC: number | null }>>}
 */
export async function fetchMoveWeatherForecastByCoords(lat, lng) {
  const key = cacheKey(lat, lng)
  const cached = forecastCache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.byDate
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'weather_code,temperature_2m_max',
    forecast_days: String(WEATHER_FORECAST_MAX_DAYS + 1),
    timezone: 'auto',
  })

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) {
    throw new Error(`Weather forecast unavailable (${res.status})`)
  }

  const json = await res.json()
  const times = json?.daily?.time || []
  const codes = json?.daily?.weather_code || []
  const temps = json?.daily?.temperature_2m_max || []
  /** @type {Record<string, { code: number, tempMaxC: number | null }>} */
  const byDate = {}

  for (let i = 0; i < times.length; i += 1) {
    const iso = String(times[i] || '')
    if (!iso) continue
    const code = Number(codes[i])
    const tempMaxC = temps[i] != null ? Number(temps[i]) : null
    byDate[iso] = {
      code: Number.isFinite(code) ? code : 3,
      tempMaxC: Number.isFinite(tempMaxC) ? tempMaxC : null,
    }
  }

  forecastCache.set(key, { expires: Date.now() + FORECAST_CACHE_TTL_MS, byDate })
  return byDate
}

/**
 * @param {Record<string, { code: number, tempMaxC: number | null }> | null | undefined} byDate
 * @param {string} isoDate
 * @returns {{ kind: string, label: string, tempLabel: string | null } | null}
 */
export function weatherHintForMoveDate(byDate, isoDate) {
  if (!byDate || !isDateWithinWeatherForecast(isoDate)) return null
  const row = byDate[isoDate]
  if (!row) return null
  return describeWmoWeather(row.code, row.tempMaxC)
}
