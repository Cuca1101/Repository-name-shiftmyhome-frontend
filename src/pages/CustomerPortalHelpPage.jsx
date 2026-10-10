import { Link } from 'react-router-dom'
import PortalShell, { usePortalAccess } from '../components/customer-portal/PortalShell'
import { COMPANY_EMAIL, COMPANY_PHONE_DISPLAY, COMPANY_PHONE_TEL, WHATSAPP_SUPPORT_URL } from '../constants/companyContact'

export default function CustomerPortalHelpPage() {
  const { portalTo } = usePortalAccess()
  return (
    <PortalShell
      title="Help & support | ShiftMyHome"
      description="Contact ShiftMyHome about a booking."
      path="/portal/help"
    >
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Help & support</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
        Our team can help with a booking, a payment, or a move day question.
      </p>
      <div className="mt-5 max-w-xl space-y-3">
        <a href={`tel:${COMPANY_PHONE_TEL}`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm">
          <span className="block font-semibold text-slate-900">Call the team</span>
          <span className="mt-1 block font-bold text-brand-700">{COMPANY_PHONE_DISPLAY}</span>
        </a>
        <a href={`mailto:${COMPANY_EMAIL}`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm">
          <span className="block font-semibold text-slate-900">Email</span>
          <span className="mt-1 block font-bold text-brand-700">{COMPANY_EMAIL}</span>
        </a>
        <a href={WHATSAPP_SUPPORT_URL} className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-brand-700 shadow-sm">
          WhatsApp
        </a>
      </div>
      <Link to={portalTo('/portal/bookings')} className="mt-6 inline-block text-sm font-semibold text-brand-700">Back to bookings</Link>
    </PortalShell>
  )
}
