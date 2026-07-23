import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import { trackingClient } from '../lib/jobCustomerTracking'

export default function JobFeedbackPage() {
  const { token } = useParams()
  const [rating, setRating] = useState(5)
  const [driverRating, setDriverRating] = useState(5)
  const [review, setReview] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const client = trackingClient()
      if (!client) throw new Error('Unavailable')
      const { data, error } = await client.functions.invoke('submit-job-feedback', {
        body: {
          token,
          rating,
          driver_rating: driverRating,
          review_text: review,
          customer_name: name,
        },
      })
      if (error) throw error
      if (data?.already) {
        setDone(true)
        setMsg('Feedback was already submitted for this booking.')
        return
      }
      if (data?.ok === false) throw new Error(data.error || 'Submit failed')
      setDone(true)
      setMsg('Thank you — your feedback has been submitted.')
    } catch (ex) {
      setErr(ex?.message || 'Could not submit feedback.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SeoHead title="Leave Feedback | ShiftMyHome" path={`/track/${token}/feedback`} robots="noindex, nofollow" />
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <Link to={`/track/${token}`} className="text-sm font-semibold text-brand-700 hover:underline">
          ← Back to booking
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Leave feedback</h1>
        <p className="mt-2 text-sm text-slate-600">Tell us how your move went. You can submit feedback once.</p>

        {done ? (
          <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{msg}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Overall rating</span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Driver rating</span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                value={driverRating}
                onChange={(e) => setDriverRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Your name</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Review</span>
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                rows={4}
                value={review}
                onChange={(e) => setReview(e.target.value)}
              />
            </label>
            {err ? <p className="text-sm text-red-700">{err}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit feedback'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
