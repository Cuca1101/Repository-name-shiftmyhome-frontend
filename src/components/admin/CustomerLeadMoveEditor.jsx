import { useEffect, useMemo, useState } from 'react'
import { saveCustomerLeadMoveEdits } from '../../lib/customerLeadBookingConvert'
import { editsFromLead, normalizeAdminInventoryLine, notesForCustomerEmail } from '../../lib/customerLeadMoveSync'
import { useQuoteInventoryCatalog } from '../quote-wizard/useQuoteInventoryCatalog'
import { filterAndSortInventorySearchResults } from '../quote-wizard/inventorySearchUtils'

/**
 * Add, remove, or rewrite items and special instructions on a customer lead.
 * A linked booking receives the same list and notes. The saved price is left as it is.
 * @param {{
 *   lead: Record<string, unknown>,
 *   disabled?: boolean,
 *   onSaved: (lead: Record<string, unknown>, quoteUpdated: boolean) => void,
 * }} props
 */
export default function CustomerLeadMoveEditor({ lead, disabled = false, onSaved }) {
  const catalog = useQuoteInventoryCatalog()
  const saved = useMemo(() => editsFromLead(lead), [lead])
  const noteLabels = useMemo(() => notesForCustomerEmail(lead), [lead])
  const [lines, setLines] = useState(saved.inventoryLines)
  const [instructions, setInstructions] = useState(saved.specialInstructions)
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (dirty) return
    setLines(saved.inventoryLines)
    setInstructions(saved.specialInstructions)
  }, [saved, dirty])

  useEffect(() => {
    setEditing(false)
    setDirty(false)
    setMessage('')
    setQuery('')
    setCustomName('')
  }, [lead?.id])

  const matches = useMemo(() => {
    const q = query.trim()
    if (q.length < 1) return []
    return filterAndSortInventorySearchResults(catalog.getFlattenedCatalogEntries(), q, 8)
  }, [catalog, query])

  function markDirty(nextLines, nextInstructions) {
    setDirty(true)
    setMessage('')
    if (nextLines) setLines(nextLines)
    if (nextInstructions != null) setInstructions(nextInstructions)
  }

  function addCatalogItem(entry) {
    const item = entry.item
    const name = String(item?.name || '').trim()
    if (!name) return
    setLines((current) => {
      const existing = current.find((line) => String(line.name).trim().toLowerCase() === name.toLowerCase())
      if (existing) {
        return current.map((line) =>
          line.lineId === existing.lineId ? { ...line, quantity: Number(line.quantity || 1) + 1 } : line,
        )
      }
      return [
        ...current,
        normalizeAdminInventoryLine(
          {
            lineId: `cat-${item.id || name}-${Date.now()}`,
            catalogId: item.id || null,
            name,
            quantity: 1,
            m3: item.m3,
            weightType: item.weightType || 'std',
            mult: item.mult || 1,
            categoryLabel: entry.categoryLabel || '',
            isCustom: false,
          },
          current.length,
        ),
      ]
    })
    setDirty(true)
    setMessage('')
    setQuery('')
  }

  function addCustomItem() {
    const name = customName.trim()
    if (!name) {
      setMessage('Type the item name to add.')
      return
    }
    setLines((current) => [
      ...current,
      normalizeAdminInventoryLine(
        {
          lineId: `custom-${Date.now()}`,
          name,
          quantity: 1,
          m3: 0.2,
          isCustom: true,
          weightType: 'std',
        },
        current.length,
      ),
    ])
    setDirty(true)
    setMessage('')
    setCustomName('')
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const result = await saveCustomerLeadMoveEdits({
        lead,
        inventoryLines: lines,
        specialInstructions: instructions,
      })
      setDirty(false)
      setEditing(false)
      setMessage(
        result.quoteUpdated
          ? 'Saved on this lead and on the booking.'
          : 'Saved on this lead. It is copied onto the booking when you convert.',
      )
      onSaved(result.lead, result.quoteUpdated)
    } catch (error) {
      setMessage(error?.message || 'Could not save the list.')
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setLines(saved.inventoryLines)
    setInstructions(saved.specialInstructions)
    setQuery('')
    setCustomName('')
    setDirty(false)
    setMessage('')
    setEditing(false)
  }

  const shownLines = editing ? lines : saved.inventoryLines
  const shownInstructions = editing ? instructions : saved.specialInstructions
  const itemTotal = shownLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
  const itemTotalLabel = itemTotal === 1 ? '1 item' : `${itemTotal} items`

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Items and special instructions</h3>
        {shownLines.length > 0 ? (
          <p className="text-sm font-bold text-slate-900">{itemTotalLabel}</p>
        ) : null}
      </div>

      {shownLines.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">No items yet.</p>
      ) : (
        <ul className={`mt-3 grid grid-cols-1 gap-2 md:grid-cols-3 ${editing ? '' : 'text-sm text-slate-700'}`}>
          {shownLines.map((line) => (
            <li
              key={line.lineId}
              className={editing ? 'min-w-0 rounded-md border border-slate-200 px-2 py-1.5' : 'min-w-0'}
            >
              <p className="flex items-baseline justify-between gap-2 text-sm text-slate-900">
                <span className="min-w-0 truncate" title={line.name}>{line.name}</span>
                <span className="shrink-0 font-bold">×{line.quantity}</span>
              </p>
              {editing ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <label className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-500">
                    Qty
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      aria-label={`Quantity for ${line.name}`}
                      value={line.quantity}
                      disabled={disabled || saving}
                      onChange={(event) => {
                        const quantity = Math.max(1, Math.round(Number(event.target.value) || 1))
                        markDirty(lines.map((row) => (row.lineId === line.lineId ? { ...row, quantity } : row)))
                      }}
                      className="w-14 rounded border border-slate-300 px-1.5 py-1 text-sm"
                    />
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {Number.isFinite(Number(line.m3)) ? `${Number(line.m3)} m³` : '—'}
                  </span>
                  <button
                    type="button"
                    disabled={disabled || saving}
                    onClick={() => markDirty(lines.filter((row) => row.lineId !== line.lineId))}
                    className="ml-auto rounded px-1.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <>
          <div className="relative mt-4">
            <label className="block text-sm font-semibold text-slate-800" htmlFor="lead-item-search">
              Add an item
            </label>
            <input
              id="lead-item-search"
              value={query}
              disabled={disabled || saving}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search items, e.g. sofa, bed, table"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoComplete="off"
            />
            {matches.length > 0 ? (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {matches.map((entry) => (
                  <li key={`${entry.categoryLabel}-${entry.item.id || entry.item.name}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => addCatalogItem(entry)}
                    >
                      <span className="font-medium text-slate-900">{entry.item.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{entry.categoryLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm font-semibold text-slate-800">
              Item not in the list
              <input
                value={customName}
                disabled={disabled || saving}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Custom item name"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
              />
            </label>
            <button
              type="button"
              disabled={disabled || saving}
              onClick={addCustomItem}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Add custom item
            </button>
          </div>

          <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="lead-special-instructions">
            Special instructions
          </label>
          <p className="mt-1 text-xs text-slate-500">
            {noteLabels.customer
              ? 'Special instructions are the customer’s words. A price note stays separate and shows under them as Included in price.'
              : 'Special instructions are for the customer. A price note shows under them in the email as Included in price.'}
            {' '}The saved price does not change.
          </p>
          <textarea
            id="lead-special-instructions"
            rows={3}
            value={instructions}
            disabled={disabled || saving}
            onChange={(event) => markDirty(null, event.target.value)}
            placeholder="Access notes, extra items, or anything the crew should know"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || saving || !dirty}
              onClick={() => void handleSave()}
              className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save items and instructions'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelEdit}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            {message ? <p className="text-sm text-slate-700">{message}</p> : null}
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 grid gap-1 sm:grid-cols-[140px_1fr] text-sm text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Special instructions</span>
            <span className="whitespace-pre-wrap break-words">{shownInstructions.trim() || '—'}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                const ok = window.confirm('Are you sure you want to edit the items and special instructions?')
                if (!ok) return
                setLines(saved.inventoryLines)
                setInstructions(saved.specialInstructions)
                setMessage('')
                setEditing(true)
              }}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Edit
            </button>
            {message ? <p className="text-sm text-slate-700">{message}</p> : null}
          </div>
        </>
      )}
    </section>
  )
}
