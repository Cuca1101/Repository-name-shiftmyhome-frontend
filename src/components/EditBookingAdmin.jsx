import { Link, useLocation, useParams } from 'react-router-dom'
import AdminEditBookingForm from './admin/AdminEditBookingForm'
import CustomerAmendmentAdminBanner from './customer-portal/CustomerAmendmentAdminBanner'

/**
 * Admin → Edit Booking (from Available / Active job details).
 */
export default function EditBookingAdmin() {
  const { id } = useParams()
  const location = useLocation()
  const fromActive = /\/admin\/active-jobs\//.test(location.pathname)
  const backHref = fromActive ? `/admin/active-jobs/${id}` : `/admin/available-jobs/${id}`
  const backLabel = fromActive ? 'Back to job accepted' : 'Back to job details'

  if (!id) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-slate-600">Missing booking id.</p>
        <Link to="/admin/available-jobs" className="mt-4 inline-block font-semibold text-brand-700 hover:underline">
          Available jobs
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <CustomerAmendmentAdminBanner quoteId={id} />
      <AdminEditBookingForm
        key={id}
        quoteId={id}
        backHref={backHref}
        backLabel={backLabel}
      />
    </div>
  )
}
