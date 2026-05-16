import { useCallback, useEffect, useState } from 'react'
import {
  fetchAllReviewsForAdmin,
  upsertReview,
  deleteReview,
} from '../lib/data/reviewsRepository'

export default function ReviewsAdmin() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    author_name: '',
    body: '',
    rating: 5,
    is_published: true,
    sort_order: 0,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAllReviewsForAdmin()
      setReviews(data)
    } catch (e) {
      setError(e?.message || 'Failed to load reviews.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function startCreate() {
    setEditingId('new')
    setForm({
      author_name: '',
      body: '',
      rating: 5,
      is_published: true,
      sort_order: reviews.length,
    })
  }

  function startEdit(row) {
    setEditingId(row.id)
    setForm({
      author_name: row.author_name,
      body: row.body,
      rating: row.rating,
      is_published: row.is_published,
      sort_order: row.sort_order ?? 0,
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload =
        editingId === 'new'
          ? { ...form }
          : { id: editingId, ...form }
      await upsertReview(payload)
      await load()
      setEditingId(null)
    } catch (err) {
      setError(err?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this review?')) return
    setError('')
    try {
      await deleteReview(id)
      await load()
    } catch (e) {
      setError(e?.message || 'Delete failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reviews</h2>
          <p className="mt-1 text-sm text-slate-600">
            Published reviews can feed the public homepage when Supabase is connected.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Add review
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {editingId && (
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        >
          <h3 className="text-lg font-semibold">{editingId === 'new' ? 'New review' : 'Edit review'}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Author name</span>
              <input
                required
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.author_name}
                onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Text</span>
              <textarea
                required
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Rating (1–5)</span>
              <input
                type="number"
                min="1"
                max="5"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.rating}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating: parseInt(e.target.value, 10) || 5 }))
                }
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Sort order</span>
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={form.sort_order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
              />
              <span className="text-sm font-medium text-slate-700">Published on website</span>
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{r.author_name}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">&ldquo;{r.body}&rdquo;</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Rating {r.rating}/5 · Sort {r.sort_order} ·{' '}
                    {r.is_published ? (
                      <span className="text-emerald-700">Published</span>
                    ) : (
                      <span className="text-amber-700">Draft</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="text-sm font-semibold text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
          {reviews.length === 0 && !loading && (
            <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-600">
              No reviews in database yet.
            </p>
          )}
        </ul>
      )}
    </div>
  )
}
