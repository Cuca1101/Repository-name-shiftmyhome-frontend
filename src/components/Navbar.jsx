import MobileNavbar from './mobile/MobileNavbar'
import DesktopNavbar from './mobile/DesktopNavbar'

export default function Navbar({ showSlogan, onLogoClick } = {}) {
  return (
    <>
      <div className="sticky top-0 z-50 block lg:hidden" data-site-nav>
        <MobileNavbar showSlogan={showSlogan} onLogoClick={onLogoClick} />
      </div>
      <div className="sticky top-0 z-50 hidden lg:block" data-site-nav>
        <DesktopNavbar showSlogan={showSlogan} onLogoClick={onLogoClick} />
      </div>
    </>
  )
}
