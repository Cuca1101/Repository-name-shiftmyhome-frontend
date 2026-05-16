import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchItemsLibrary,
  insertLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
} from '../lib/data/itemsLibraryRepository'
import { WEIGHT_TYPES } from '../constants/weightTypes'

export default function ItemsLibraryAdmin() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    category: 'General',
    cubic_metres: 0.5,
    weight_type: 'medium',
    handling_multiplier: 1,
    default_quantity: 0,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchItemsLibrary()
      setItems(data)
    } catch (e) {
      setError(e?.message || 'Failed to load items.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    const m = new Map()
    for (const row of items) {
      const c = row.category || 'General'
      if (!m.has(c)) m.set(c, [])
      m.get(c).push(row)
    }
    return m
  }, [items])

  function startCreate() {
    setEditingId('new')
    setForm({
      name: '',
      category: 'General',
      cubic_metres: 0.5,
      weight_type: 'medium',
      handling_multiplier: 1,
      default_quantity: 0,
    })
  }

  function startEdit(row) {
    setEditingId(row.id)
    setForm({
      name: row.name,
      category: row.category,
      cubic_metres: row.cubic_metres,
      weight_type: row.weight_type,
      handling_multiplier: row.handling_multiplier,
      default_quantity: row.default_quantity ?? 0,
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editingId === 'new') {
        await insertLibraryItem(form)
      } else if (editingId) {
        await updateLibraryItem(editingId, form)
      }
      await load()
      setEditingId(null)
    } catch (err) {
      setError(err?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this item from the library?')) return
    setError('')
    try {
      await deleteLibraryItem(id)
      await load()
      if (editingId === id) setEditingId(null)
    } catch (e) {
      setError(e?.message || 'Delete failed.')
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Items Library</h2>
          <p className="mt-1 text-sm text-slate-600">
            Catalogue used on the customer quote form for volumes and handling.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Add item
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
          <h3 className="text-lg font-semibold text-slate-900">
            {editingId === 'new' ? 'New item' : 'Edit item'}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                required
                className={`mt-1 ${inputClass}`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Cubic metres (m³)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className={`mt-1 ${inputClass}`}
                value={form.cubic_metres}
                onChange={(e) => setForm((f) => ({ ...f, cubic_metres: parseFloat(e.target.value) || 0 }))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Weight type</span>
              <select
                className={`mt-1 ${inputClass}`}
                value={form.weight_type}
                onChange={(e) => setForm((f) => ({ ...f, weight_type: e.target.value }))}
              >
                {WEIGHT_TYPES.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Handling multiplier</span>
              <input
                type="number"
                step="0.01"
                min="0.1"
                className={`mt-1 ${inputClass}`}
                value={form.handling_multiplier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, handling_multiplier: parseFloat(e.target.value) || 1 }))
                }
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Default quantity (admin hint)</span>
              <input
                type="number"
                min="0"
                className={`mt-1 ${inputClass}`}
                value={form.default_quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_quantity: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading items…</p>
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([category, rows]) => (
            <div key={category} className="rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h3 className="font-semibold text-slate-900">{category}</h3>
              </div>
              <ul className="divide-y divide-slate-100 lg:hidden">
                {rows.map((row) => (
                  <li key={row.id} className="min-w-0 p-4">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {Number(row.cubic_metres).toFixed(2)} m³ · {row.weight_type} · ×
                      {Number(row.handling_multiplier).toFixed(2)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="min-h-[44px] rounded-lg bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="min-h-[44px] rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[640px] text-left text-sm lg:min-w-0">
                  <thead className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">m³</th>
                      <th className="px-4 py-3">Weight</th>
                      <th className="px-4 py-3">Multiplier</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr key={row.id} className="text-slate-800">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 tabular-nums">{Number(row.cubic_metres).toFixed(2)}</td>
                        <td className="px-4 py-3 capitalize">{row.weight_type}</td>
                        <td className="px-4 py-3 tabular-nums">{Number(row.handling_multiplier).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="mr-2 font-semibold text-brand-700 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            className="font-semibold text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
              No items yet. Add your catalogue or seed defaults by clearing local storage key{' '}
              <code className="rounded bg-slate-100 px-1">smh_items_library_v1</code> in dev.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
