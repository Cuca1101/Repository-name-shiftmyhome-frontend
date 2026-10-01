import { useEffect, useState } from 'react'
import DesktopHero from './mobile/DesktopHero'
import MobileHero from './mobile/MobileHero'

function useDesktopHero() {
  const query = '(min-width: 768px)'
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : true,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return desktop
}

export default function Hero() {
  const desktop = useDesktopHero()
  return desktop ? <DesktopHero /> : <MobileHero />
}
