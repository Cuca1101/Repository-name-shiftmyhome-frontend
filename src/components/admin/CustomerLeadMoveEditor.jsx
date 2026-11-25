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
  const [customM3, setCustomM3] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (dirty) return
    setLines(saved.inventoryLines)
    setInstructions(saved.specialInstructions)
  }, [saved, dirty])

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
    const m3 = customM3.trim() === '' ? 0.2 : Number(customM3)
    if (!Number.isFinite(m3) || m3 < 0) {
      setMessage('Volume needs to be a number, for example 0.5.')
      return
    }
    setLines((current) => [
      ...current,
      normalizeAdminInventoryLine(
        {
          lineId: `custom-${Date.now()}`,
          name,
          quantity: 1,
          m3,
          isCustom: true,
          weightType: 'std',
        },
        current.length,
      ),
    ])
    setDirty(true)
    setMessage('')
    setCustomName('')
    setCustomM3('')
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

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Items and special instructions</h3>
          <p className="mt-1 text-xs text-slate-600">
            Add or remove items when the customer calls. Write the special instructions yourself.
            The saved price does not change.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            No items yet.
          </p>
        ) : (
          lines.map((line) => (
            <div
              key={line.lineId}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 sm:flex-row sm:items-center"
            >
              <p className="min-w-0 flex-1 text-sm font-medium text-slate-900">{line.name}</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                  Qty
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={line.quantity}
                    disabled={disabled || saving}
                    onChange={(event) => {
                      const quantity = Math.max(1, Math.round(Number(event.target.value) || 1))
                      markDirty(lines.map((row) => (row.lineId === line.lineId ? { ...row, quantity } : row)))
                    }}
                    className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                  m³
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={line.m3 ?? ''}
                    disabled={disabled || saving}
                    onChange={(event) => {
                      const raw = event.target.value
                      const m3 = raw === '' ? null : Number(raw)
                      markDirty(
                        lines.map((row) =>
                          row.lineId === line.lineId
                            ? { ...row, m3: Number.isFinite(m3) ? m3 : null, volumePerUnitM3: Number.isFinite(m3) ? m3 : null }
                            : row,
                        ),
                      )
                    }}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={disabled || saving}
                  onClick={() => markDirty(lines.filter((row) => row.lineId !== line.lineId))}
                  className="inline-flex min-h-10 items-center rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end">
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
        <label className="block text-sm font-semibold text-slate-800">
          m³ each
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={customM3}
            disabled={disabled || saving}
            onChange={(event) => setCustomM3(event.target.value)}
            placeholder="0.2"
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
      </p>
      <textarea
        id="lead-special-instructions"
        rows={4}
        value={instructions}
        disabled={disabled || saving}
        onChange={(event) => markDirty(null, event.target.value)}
        placeholder="Access notes, extra items, or anything the crew should know"
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled || saving || !dirty}
          onClick={() => void handleSave()}
          className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save items and instructions'}
        </button>
        {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
    </section>
  )
}
