import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminPhoneBookingForm from './admin/AdminPhoneBookingForm'
import AdminPhoneBookingPendingList from './admin/AdminPhoneBookingPendingList'

export default function PhoneBookingAdmin() {
  const [searchParams] = useSearchParams()
  const editQuoteId = searchParams.get('edit')
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0)
  const [createdBanner, setCreatedBanner] = useState('')

  function handleBookingSaved(saved, { updated = false } = {}) {
    setCreatedBanner(
      updated
        ? `Booking ${saved.quote_ref} updated. It remains under My jobs created until you send it to Available Jobs.`
        : `Booking ${saved.quote_ref} saved under My jobs created (Waiting to send).`,
    )
    setPendingRefreshKey((k) => k + 1)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">New phone booking</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Create a booking with the quote wizard. It appears under{' '}
            <strong className="font-semibold text-slate-800">My jobs created</strong> first — not in
            Available Jobs until you send it there.
          </p>
        </div>
        <Link
          to="/admin/available-jobs"
          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Available jobs
        </Link>
      </div>

      {createdBanner ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {createdBanner}
        </p>
      ) : null}

      <div>
        <AdminPhoneBookingPendingList
          refreshKey={pendingRefreshKey}
          onReleased={() => setCreatedBanner('')}
        />
      </div>

      <AdminPhoneBookingForm
        key={editQuoteId || 'new'}
        editQuoteId={editQuoteId}
        onBookingCreated={(saved) => handleBookingSaved(saved, { updated: false })}
        onBookingUpdated={(saved) => handleBookingSaved(saved, { updated: true })}
      />
    </div>
  )
}
