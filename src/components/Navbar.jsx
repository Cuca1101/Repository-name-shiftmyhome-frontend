import MobileNavbar from './mobile/MobileNavbar'
import DesktopNavbar from './mobile/DesktopNavbar'

export default function Navbar() {
  return (
    <>
      <div className="block md:hidden">
        <MobileNavbar />
      </div>
      <div className="hidden md:block">
        <DesktopNavbar />
      </div>
    </>
  )
}
