import { useCallback, useEffect, useMemo, useState } from 'react'
import { CATEGORY_ORDER, INVENTORY_BY_CATEGORY } from './quote-wizard/inventoryCatalog'
import {
  fetchItemsLibrary,
  getItemsLibraryStorageKind,
  insertLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
} from '../lib/data/itemsLibraryRepository'
import {
  cleanupLegacyItemsLibraryCategories,
  planLegacyCategoryCleanup,
} from '../lib/data/cleanupLegacyItemsLibraryCategories'
import {
  importMissingCatalogToItemsLibrary,
  isBrokenLibraryRow,
  isValidLibraryRow,
  planCatalogImport,
} from '../lib/data/importItemsLibraryFromCatalog'
import { WEIGHT_TYPES } from '../constants/weightTypes'

const CATEGORY_LABEL_ORDER = new Map(
  CATEGORY_ORDER.map((key, index) => [INVENTORY_BY_CATEGORY[key]?.label, index]),
)

const LIBRARY_CATEGORY_OPTIONS = [
  ...CATEGORY_ORDER.map((key) => INVENTORY_BY_CATEGORY[key]?.label).filter(Boolean),
  'General',
]

const DEFAULT_LIBRARY_CATEGORY = 'Bedrooms'

/** @param {unknown} category */
function normalizeFormCategory(category) {
  const label = String(category ?? '').trim()
  if (LIBRARY_CATEGORY_OPTIONS.includes(label)) return label
  return DEFAULT_LIBRARY_CATEGORY
}

/** @param {unknown} category */
function isValidCategoryLabel(category) {
  if (category === null || category === undefined) return false
  const label = String(category).trim()
  if (!label) return false
  if (/^\d+$/.test(label)) return false
  return true
}

/** @param {unknown} row */
function isValidLibraryRowForDisplay(row) {
  return isValidLibraryRow(row) && isValidCategoryLabel(row?.category)
}

/** @param {unknown} n */
function formatLibraryNumber(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toFixed(2) : '—'
}

export default function ItemsLibraryAdmin() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [sessionCategory, setSessionCategory] = useState(DEFAULT_LIBRARY_CATEGORY)
  const [form, setForm] = useState({
    name: '',
    category: DEFAULT_LIBRARY_CATEGORY,
    cubic_metres: 0.5,
    weight_type: 'medium',
    handling_multiplier: 1,
    default_quantity: 0,
  })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [cleaningLegacy, setCleaningLegacy] = useState(false)
  const [importMessage, setImportMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchItemsLibrary()
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('items library storage', getItemsLibraryStorageKind())
        // eslint-disable-next-line no-console
        console.log('items library rows', data)
        // eslint-disable-next-line no-console
        console.log(
          'items library invalid rows',
          data.filter((row) => isBrokenLibraryRow(row)),
        )
      }
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

  const { validItems, invalidItems } = useMemo(() => {
    const valid = []
    const invalid = []
    for (const row of items) {
      if (isValidLibraryRowForDisplay(row)) valid.push(row)
      else invalid.push(row)
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('valid rows', valid)
      // eslint-disable-next-line no-console
      console.log('invalid rows filtered', invalid)
    }
    return { validItems: valid, invalidItems: invalid }
  }, [items])

  const legacyCleanupPlan = useMemo(() => planLegacyCategoryCleanup(items), [items])

  const grouped = useMemo(() => {
    const m = new Map()
    for (const row of validItems) {
      const c = String(row.category ?? '').trim()
      if (!isValidCategoryLabel(c)) continue
      if (!m.has(c)) m.set(c, [])
      m.get(c).push(row)
    }
    return [...m.entries()].sort(([a], [b]) => {
      const ia = CATEGORY_LABEL_ORDER.has(a) ? CATEGORY_LABEL_ORDER.get(a) : 999
      const ib = CATEGORY_LABEL_ORDER.has(b) ? CATEGORY_LABEL_ORDER.get(b) : 999
      if (ia !== ib) return ia - ib
      return a.localeCompare(b)
    })
  }, [validItems])

  function setFormCategory(category) {
    const normalized = normalizeFormCategory(category)
    setSessionCategory(normalized)
    setForm((f) => ({ ...f, category: normalized }))
  }

  function startCreate() {
    const category = sessionCategory || DEFAULT_LIBRARY_CATEGORY
    setEditingId('new')
    setForm({
      name: '',
      category,
      cubic_metres: 0.5,
      weight_type: 'medium',
      handling_multiplier: 1,
      default_quantity: 0,
    })
  }

  function startEdit(row) {
    const category = normalizeFormCategory(row.category)
    setSessionCategory(category)
    setEditingId(row.id)
    setForm({
      name: row.name,
      category,
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

  async function handleCleanLegacyCategories() {
    setCleaningLegacy(true)
    setError('')
    setImportMessage('')
    try {
      const current = await fetchItemsLibrary()
      const plan = planLegacyCategoryCleanup(current)

      if (plan.legacyRowCount === 0) {
        setImportMessage('No legacy duplicate categories found.')
        return
      }

      const confirmLines = [
        `Process ${plan.legacyRowCount} item(s) in old categories (Appliances, Bedroom, Boxes, Living).`,
        `Delete ${plan.deletedCount} duplicate(s) that already exist in the target category.`,
        `Move ${plan.movedCount} unique item(s) to the correct category.`,
        'Saved quotes and jobs are not changed.',
      ]
      if (!window.confirm(`${confirmLines.join('\n')}`)) return

      const result = await cleanupLegacyItemsLibraryCategories(current)
      await load()
      setImportMessage(
        `Legacy cleanup (${result.storage}): deleted ${result.deleted} duplicate(s), moved ${result.moved} unique item(s).`,
      )
    } catch (e) {
      setError(e?.message || 'Legacy category cleanup failed.')
    } finally {
      setCleaningLegacy(false)
    }
  }

  async function handleImportCatalog() {
    setImporting(true)
    setError('')
    setImportMessage('')
    try {
      const current = await fetchItemsLibrary()
      const brokenCount = current.filter(isBrokenLibraryRow).length
      const validOnly = current.filter(isValidLibraryRow)
      const { toImport, skipped, catalogTotal } = planCatalogImport(validOnly)

      const confirmLines = []
      if (brokenCount > 0) {
        confirmLines.push(`Remove ${brokenCount} invalid row(s) from ${getItemsLibraryStorageKind()}.`)
      }
      if (toImport.length > 0) {
        confirmLines.push(`Import ${toImport.length} missing item(s) from the catalogue (${catalogTotal} total).`)
      } else if (brokenCount === 0) {
        confirmLines.push(`All ${skipped} catalogue item(s) are already in the library.`)
      }
      if (brokenCount === 0 && toImport.length === 0) {
        setImportMessage(confirmLines[0])
        return
      }
      if (!window.confirm(`${confirmLines.join(' ')}\n\nValid existing items are kept.`)) {
        return
      }

      const result = await importMissingCatalogToItemsLibrary(current)
      await load()

      const parts = []
      if (result.cleaned > 0) {
        parts.push(`Removed ${result.cleaned} invalid row(s) from ${result.storage}`)
      }
      if (result.imported > 0) parts.push(`imported ${result.imported} item(s)`)
      if (result.imported === 0 && result.skipped > 0) {
        parts.push(`${result.skipped} catalogue item(s) already present`)
      }
      setImportMessage(parts.length ? `${parts.join('; ')}.` : 'Done.')
    } catch (e) {
      setError(e?.message || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25'

  const categoryBtnBase =
    'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 sm:py-2 sm:text-sm'
  const categoryBtnActive = 'border-brand-600 bg-brand-600 text-white shadow-sm'
  const categoryBtnInactive =
    'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Items Library</h2>
          <p className="mt-1 text-sm text-slate-600">
            Catalogue used on the customer quote form for volumes and handling.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            m³ is per unit. Quantity is applied later in the quote calculator.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCleanLegacyCategories}
            disabled={
              cleaningLegacy || importing || loading || legacyCleanupPlan.legacyRowCount === 0
            }
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {cleaningLegacy ? 'Cleaning…' : 'Clean duplicate legacy categories'}
          </button>
          <button
            type="button"
            onClick={handleImportCatalog}
            disabled={importing || cleaningLegacy || loading}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-200 bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import default removals catalogue'}
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Add item
          </button>
        </div>
      </div>

      {legacyCleanupPlan.legacyRowCount > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {legacyCleanupPlan.legacyRowCount} item(s) use old categories (Appliances, Bedroom, Boxes,
          Living). Click <strong>Clean duplicate legacy categories</strong> to merge into the
          catalogue labels without affecting saved quotes.
        </p>
      ) : null}

      {invalidItems.length > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {invalidItems.length} invalid row(s) are hidden. Use import to remove them from{' '}
          {getItemsLibraryStorageKind()} and refresh the catalogue.
        </p>
      ) : null}

      {importMessage && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {importMessage}
        </p>
      )}

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
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700">Category</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick select category">
              {LIBRARY_CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormCategory(cat)}
                  aria-pressed={form.category === cat}
                  className={`${categoryBtnBase} ${
                    form.category === cat ? categoryBtnActive : categoryBtnInactive
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
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
              <select
                className={`mt-1 ${inputClass}`}
                value={form.category}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {LIBRARY_CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
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
          {grouped.map(([category, rows]) => (
            <div key={category} className="rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h3 className="font-semibold text-slate-900">{category}</h3>
              </div>
              <ul className="divide-y divide-slate-100 lg:hidden">
                {rows.map((row) => (
                  <li key={row.id} className="min-w-0 p-4">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatLibraryNumber(row.cubic_metres)} m³ · {row.weight_type} · ×
                      {formatLibraryNumber(row.handling_multiplier)}
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
                        <td className="px-4 py-3 tabular-nums">{formatLibraryNumber(row.cubic_metres)}</td>
                        <td className="px-4 py-3 capitalize">{row.weight_type}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatLibraryNumber(row.handling_multiplier)}
                        </td>
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
          {validItems.length === 0 && (
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
