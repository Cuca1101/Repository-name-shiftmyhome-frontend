import HomeTrustRow from '../HomeTrustRow'
import { useWebsiteCms } from '../../context/WebsiteCmsContext'
import { DEFAULT_HOMEPAGE } from '../../lib/websiteCmsDefaults'

/** Standalone trust strip on mobile homepage (between services and quote). */
export default function MobileTrustBand() {
  const { homepage } = useWebsiteCms()
  const h = homepage ?? DEFAULT_HOMEPAGE

  return (
    <section className="border-y border-slate-100 bg-white py-3">
      <div className="home-container">
        <HomeTrustRow embedded trustpilotText={h.trustpilotText} />
      </div>
    </section>
  )
}
