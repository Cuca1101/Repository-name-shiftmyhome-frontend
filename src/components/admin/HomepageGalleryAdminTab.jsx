import { useState } from 'react'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import {
  deleteHomepageGalleryItem,
  reorderHomepageGalleryItem,
  upsertHomepageGalleryItem,
} from '../../lib/data/homepageGalleryRepository'
import { uploadHomepageGalleryImage } from '../../lib/data/homepageGalleryUpload'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

const emptyItem = (sortOrder) => ({
  title: '',
  city: '',
  service_type: 'House Removals',
  description: '',
  review_text: '',
  move_date: '',
  image_url: '',
  image_path: '',
  sort_order: sortOrder,
  is_active: true,
})

/**
 * @param {{
 *   galleryItems: Record<string, unknown>[],
 *   onReload: () => Promise<void>,
 *   setMessage: (m: { type: string, text: string }) => void,
 * }} props
 */
export default function HomepageGalleryAdminTab({ galleryItems, onReload, setMessage }) {
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(null)

  async function saveItem() {
    if (!editing) return
    if (!String(editing.title || '').trim()) {
      setMessage({ type: 'error', text: 'Title is required.' })
      return
    }
    if (!String(editing.image_url || '').trim()) {
      setMessage({ type: 'error', text: 'Upload an image before saving.' })
      return
    }
    setSaving(true)
    try {
      await upsertHomepageGalleryItem(editing)
      setEditing(null)
      setMessage({ type: 'success', text: 'Gallery item saved.' })
      await onReload()
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Manage homepage “Recent moves” photos. Only <strong>active</strong> items appear on the site,
        ordered by sort order (use ↑↓). Run migration <code className="rounded bg-slate-100 px-1">031_homepage_gallery.sql</code>{' '}
        on Supabase if the table is missing.
      </p>

      <button
        type="button"
        onClick={() => setEditing(emptyItem(galleryItems.length))}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Add gallery item
      </button>

      {editing ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-4 space-y-3">
          <Field label="Title" hint="e.g. 2 Bedroom House Move — Glasgow">
            <input
              className={inputClass}
              value={editing.title || ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City">
              <input
                className={inputClass}
                value={editing.city || ''}
                onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                placeholder="Glasgow"
              />
            </Field>
            <Field label="Service type">
              <select
                className={inputClass}
                value={editing.service_type || ''}
                onChange={(e) => setEditing({ ...editing, service_type: e.target.value })}
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Short description">
            <textarea
              className={inputClass}
              rows={2}
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
          </Field>
          <Field label="Customer review snippet (optional)">
            <textarea
              className={inputClass}
              rows={2}
              value={editing.review_text || ''}
              onChange={(e) => setEditing({ ...editing, review_text: e.target.value })}
            />
          </Field>
          <Field label="Move date (optional)">
            <input
              type="date"
              className={inputClass}
              value={editing.move_date?.slice?.(0, 10) || editing.move_date || ''}
              onChange={(e) => setEditing({ ...editing, move_date: e.target.value || null })}
            />
          </Field>
          <Field label="Photo" hint="JPEG/PNG/WebP. Uploads to homepage-gallery storage.">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                className={inputClass}
                value={editing.image_url || ''}
                onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                placeholder="Upload or paste image URL"
              />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {uploading ? 'Uploading…' : 'Upload image'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setUploading(true)
                    try {
                      const { publicUrl, storagePath } = await uploadHomepageGalleryImage(file)
                      setEditing((prev) => ({
                        ...prev,
                        image_url: publicUrl,
                        image_path: storagePath,
                      }))
                      setMessage({ type: 'success', text: 'Image uploaded.' })
                    } catch (err) {
                      setMessage({ type: 'error', text: err?.message || 'Upload failed.' })
                    } finally {
                      setUploading(false)
                    }
                  }}
                />
              </label>
            </div>
            {editing.image_url ? (
              <img
                src={editing.image_url}
                alt=""
                className="mt-2 h-32 w-auto max-w-full rounded-lg border object-cover"
              />
            ) : null}
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={editing.is_active !== false}
              onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
            />
            Active (show on homepage)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveItem()}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save item'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {galleryItems.map((item, index) => (
          <li
            key={String(item.id)}
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 text-sm"
          >
            {item.image_url ? (
              <img
                src={String(item.image_url)}
                alt=""
                className="h-14 w-20 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                No img
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">
                {[item.city, item.service_type].filter(Boolean).join(' · ')}
                {item.is_active === false ? ' · Hidden' : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                disabled={index === 0}
                className="rounded border px-2 py-0.5 text-xs font-semibold disabled:opacity-40"
                onClick={async () => {
                  await reorderHomepageGalleryItem(String(item.id), 'up', galleryItems)
                  await onReload()
                }}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === galleryItems.length - 1}
                className="rounded border px-2 py-0.5 text-xs font-semibold disabled:opacity-40"
                onClick={async () => {
                  await reorderHomepageGalleryItem(String(item.id), 'down', galleryItems)
                  await onReload()
                }}
              >
                ↓
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="font-semibold text-brand-600"
                onClick={() => setEditing({ ...item })}
              >
                Edit
              </button>
              {item.id ? (
                <button
                  type="button"
                  className="font-semibold text-red-600"
                  onClick={async () => {
                    if (!window.confirm('Delete this gallery item?')) return
                    await deleteHomepageGalleryItem(String(item.id), item.image_path)
                    setMessage({ type: 'success', text: 'Deleted.' })
                    await onReload()
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!galleryItems.length ? (
        <p className="text-sm text-slate-500">No gallery items yet. Add your first completed move photo.</p>
      ) : null}
    </div>
  )
}
