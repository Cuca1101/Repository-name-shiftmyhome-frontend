import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
    if (!id) {
      setFormOpen(false)
      return
    }
    if (id === heldQuoteId.current) {
      setFormOpen(true)
      return
    }
    heldQuoteId.current = id
    setWizardSession(id)
    setFormOpen(true)
  }, [searchParams])

  function rememberQuote(saved) {
    heldQuoteId.current = saved.id
  }

  useEffect(() => {
    if (!formOpen) return undefined
    const y = window.scrollY
    const body = document.body
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    }
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.left = previous.left
      body.style.right = previous.right
      body.style.width = previous.width
      window.scrollTo(0, y)
    }
  }, [formOpen])

  useEffect(() => {
    if (!formOpen) return undefined
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('admin-phone-booking-overlay')?.scrollTo(0, 0)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [formOpen, wizardSession])

  function closeForm() {
    heldQuoteId.current = ''
    setFormOpen(false)
    setSearchParams({}, { replace: true })
  }

  function openNewQuote() {
    heldQuoteId.current = ''
    setWizardSession(`new-${Date.now()}`)
    setFormOpen(true)
    setSearchParams({ new: '1' }, { replace: true })
  }

  function handleBookingSaved(saved, { closeAfter = false, applyPrice = false } = {}) {
    if (!applyPrice) {
      setCreatedBanner(
        `Quote ${saved.quote_ref} saved in My saved quotes. Open it when you want. No email was sent.`,
      )
    }
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

      {formOpen
        ? createPortal(
            <div
              id="admin-phone-booking-overlay"
              className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#e7eef6]"
              role="dialog"
              aria-modal="true"
              aria-label="View and edit quote"
            >
              <div
                id="admin-phone-booking-form"
                className="admin-phone-quote quote-page-shell quote-flow-layout min-w-0 px-3 py-3 sm:px-4 sm:py-5"
                data-quote-flow
              >
                <div className="sticky top-0 z-10 -mx-3 mb-2 flex justify-end border-b border-slate-200/80 bg-[#e7eef6]/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
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
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
