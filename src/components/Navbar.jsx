import MobileNavbar from './mobile/MobileNavbar'
import DesktopNavbar from './mobile/DesktopNavbar'

export default function Navbar() {
  return (
    <>
      <div className="block lg:hidden">
        <MobileNavbar />
      </div>
      <div className="hidden lg:block">
        <DesktopNavbar />
      </div>
    </>
  )
}
