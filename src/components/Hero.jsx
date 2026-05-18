import DesktopHero from './mobile/DesktopHero'
import MobileHero from './mobile/MobileHero'

export default function Hero() {
  return (
    <>
      <div className="block md:hidden">
        <MobileHero />
      </div>
      <div className="hidden md:block">
        <DesktopHero />
      </div>
    </>
  )
}
