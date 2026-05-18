import DesktopServiceGrid from './mobile/DesktopServiceGrid'
import MobileServiceGrid from './mobile/MobileServiceGrid'

export default function HeroServiceGrid() {
  return (
    <>
      <div className="block md:hidden">
        <MobileServiceGrid />
      </div>
      <div className="hidden md:block">
        <DesktopServiceGrid />
      </div>
    </>
  )
}
