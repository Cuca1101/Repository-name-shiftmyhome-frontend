import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import QuoteWizard from './quote-wizard/QuoteWizard'
import AdminPhoneBookingPendingList from './admin/AdminPhoneBookingPendingList'
import { SERVICE_TYPES } from '../constants/serviceTypes'

export default function PhoneBookingAdmin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const editQuoteId = searchParams.get('edit')
  const creatingNew = searchParams.get('new') === '1'
  const heldQuoteId = useRef(editQuoteId || '')
  const [wizardSession, setWizardSession] = useState(editQuoteId || 'new')
  const [formOpen, setFormOpen] = useState(Boolean(editQuoteId || creatingNew))
  const [pendingRefreshKey, setPendingRefreshKey] = useState(0)
  const [createdBanner, setCreatedBanner] = useState('')

  useEffect(() => {
    const id = searchParams.get('edit') || ''
    if (searchParams.get('new') === '1') {
      setFormOpen(true)
      return
    }
    if (!id || id === heldQuoteId.current) return
    heldQuoteId.current = id
    setWizardSession(id)
    setFormOpen(true)
  }, [searchParams])

  function rememberQuote(saved) {
    heldQuoteId.current = saved.id
  }

  function closeForm() {
    heldQuoteId.current = ''
    setFormOpen(false)
    setSearchParams({}, { replace: true })
    window.requestAnimationFrame(() => {
      document.getElementById('admin-phone-booking-my-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function openNewQuote() {
    heldQuoteId.current = ''
    setWizardSession(`new-${Date.now()}`)
    setFormOpen(true)
    setSearchParams({ new: '1' }, { replace: true })
    window.requestAnimationFrame(() => {
      document.getElementById('admin-phone-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleBookingSaved(saved, { closeAfter = false } = {}) {
    setCreatedBanner(
      `Quote ${saved.quote_ref} saved in My saved quotes. Open it when you want. No email was sent.`,
    )
    setPendingRefreshKey((k) => k + 1)
    if (closeAfter) closeForm()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">New phone booking</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            My saved quotes is on this page. Create a new quote, press Save, and it stays in that list. Open a quote
            only when you want. The buttons under each quote send the payment link or move it in and out of Available
            Jobs.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewQuote}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Create a new quote
        </button>
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
          onCreateNew={openNewQuote}
        />
      </div>

      {formOpen ? (
      <div
        id="admin-phone-booking-form"
        className="admin-phone-quote quote-page-shell quote-flow-layout min-w-0 rounded-2xl bg-[#e7eef6] px-3 py-3 sm:px-4 sm:py-5"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-slate-900">
            {editQuoteId ? 'Open quote' : 'Create a new quote'}
          </h3>
          <button
            type="button"
            onClick={closeForm}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <QuoteWizard
          key={wizardSession}
          serviceType={SERVICE_TYPES[0]}
          allowServiceChange
          pageChrome
          titleTag="h2"
          showStep1Back={false}
          adminPhoneBooking={{
            editQuoteId: creatingNew ? null : editQuoteId || heldQuoteId.current || null,
            onQuoteSaved: rememberQuote,
            onStartNew: closeForm,
            onBookingCreated: (saved, meta) => handleBookingSaved(saved, meta),
            onBookingUpdated: (saved, meta) => handleBookingSaved(saved, meta),
          }}
        />
      </div>
      ) : null}
    </div>
  )
}
