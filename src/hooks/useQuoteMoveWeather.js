import { useEffect, useState } from 'react'
import { fetchMoveWeatherForecastByCoords } from '../lib/moveDateWeather'

/**
 * 14-day pickup-location forecast for quote calendar cards (Open-Meteo, free).
 * @param {number | null | undefined} lat
 * @param {number | null | undefined} lng
 */
export function useQuoteMoveWeather(lat, lng) {
  const [byDate, setByDate] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const plat = Number(lat)
    const plng = Number(lng)
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) {
      setByDate(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    fetchMoveWeatherForecastByCoords(plat, plng)
      .then((data) => {
        if (!cancelled) setByDate(data)
      })
      .catch(() => {
        if (!cancelled) setByDate(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [lat, lng])

  return { byDate, loading }
}
