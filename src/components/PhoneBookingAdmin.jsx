import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import QuoteWizard from './quote-wizard/QuoteWizard'
import AdminPhoneBookingPendingList from './admin/AdminPhoneBookingPendingList'
import { SERVICE_TYPES } from '../constants/serviceTypes'

export default function PhoneBookingAdmin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const editQuoteId = searchParams.get('edit')
  const heldQuoteId = useRef(editQuoteId || '')
  const [wizardSession, setWizardSession] = useState(editQuoteId || 'new')
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0)
  const [createdBanner, setCreatedBanner] = useState('')

  useEffect(() => {
    const id = searchParams.get('edit') || ''
    if (!id || id === heldQuoteId.current) return
    heldQuoteId.current = id
    setWizardSession(id)
  }, [searchParams])

  function rememberQuote(saved) {
    heldQuoteId.current = saved.id
    const next = new URLSearchParams(searchParams)
    next.set('edit', saved.id)
    setSearchParams(next, { replace: true })
  }

  function startFreshWizard() {
    heldQuoteId.current = ''
    setSearchParams({}, { replace: true })
    setWizardSession(`new-${Date.now()}`)
    setCreatedBanner('')
  }

  function handleBookingSaved(saved, { updated = false } = {}) {
    setCreatedBanner(
      updated
        ? `Quote ${saved.quote_ref} updated. No email was sent.`
        : `Quote ${saved.quote_ref} saved as a draft under My jobs created. No email was sent.`,
    )
    setPendingRefreshKey((k) => k + 1)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">New phone booking</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Create a quote with the wizard, adjust the price, then email the customer a link to pay. It
            appears under <strong className="font-semibold text-slate-800">My jobs created</strong>. When
            the customer pays, it moves to Available Jobs automatically.
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

      <div className="admin-phone-quote quote-page-shell quote-flow-layout min-w-0 rounded-2xl bg-[#e7eef6] px-3 py-3 sm:px-4 sm:py-5">
        <QuoteWizard
          key={wizardSession}
          serviceType={SERVICE_TYPES[0]}
          allowServiceChange
          pageChrome
          titleTag="h2"
          showStep1Back={false}
          adminPhoneBooking={{
            editQuoteId: editQuoteId || heldQuoteId.current || null,
            onQuoteSaved: rememberQuote,
            onStartNew: startFreshWizard,
            onBookingCreated: (saved) => handleBookingSaved(saved, { updated: false }),
            onBookingUpdated: (saved) => handleBookingSaved(saved, { updated: true }),
          }}
        />
      </div>
    </div>
  )
}
