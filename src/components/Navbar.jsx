import MobileNavbar from './mobile/MobileNavbar'
import DesktopNavbar from './mobile/DesktopNavbar'

export default function Navbar({ showSlogan } = {}) {
  return (
    <>
      <div className="sticky top-0 z-50 block lg:hidden">
        <MobileNavbar showSlogan={showSlogan} />
      </div>
      <div className="sticky top-0 z-50 hidden lg:block">
        <DesktopNavbar showSlogan={showSlogan} />
      </div>
    </>
  )
}
