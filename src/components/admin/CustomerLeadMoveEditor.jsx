import { useEffect, useMemo, useState } from 'react'
import { saveCustomerLeadMoveEdits } from '../../lib/customerLeadBookingConvert'
import { applyInventoryLineQuantityDelta } from '../../lib/inventoryLineQuantity'
import SpecialInstructionBlocks from '../admin-workflow/SpecialInstructionBlocks'
import { editsFromLead, normalizeAdminInventoryLine } from '../../lib/customerLeadMoveSync'
import { fetchPricingSettings } from '../../lib/data/pricingSettingsRepository'
import InlineInventoryQtyControl from '../quote-wizard/InlineInventoryQtyControl'
import Step2Inventory from '../quote-wizard/steps/Step2Inventory'

/**
 * Add, remove, or rewrite items and special instructions on a customer lead.
 * Item search matches Quote / New phone booking. When an agreed price is set,
 * saving items adjusts that price by the engine delta.
 * @param {{
 *   lead: Record<string, unknown>,
 *   disabled?: boolean,
 *   onSaved: (lead: Record<string, unknown>, quoteUpdated: boolean) => void,
 * }} props
 */
export default function CustomerLeadMoveEditor({ lead, disabled = false, onSaved }) {
  const saved = useMemo(() => editsFromLead(lead), [lead])
  const [lines, setLines] = useState(saved.inventoryLines)
  const [instructions, setInstructions] = useState(saved.adminInstructions)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(false)
  const [customSizeM3, setCustomSizeM3] = useState(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  useEffect(() => {
    if (dirty) return
    setLines(saved.inventoryLines)
    setInstructions(saved.adminInstructions)
  }, [saved, dirty])

  useEffect(() => {
    setEditing(false)
    setDirty(false)
    setMessage('')
  }, [lead?.id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setSettingsLoading(true)
      try {
        const settings = await fetchPricingSettings()
        if (!cancelled) setCustomSizeM3(settings?.customSizeM3 ?? null)
      } catch {
        if (!cancelled) setCustomSizeM3(null)
      } finally {
        if (!cancelled) setSettingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function markDirty(nextLines, nextInstructions) {
    setDirty(true)
    setMessage('')
    if (nextLines) {
      setLines(
        nextLines
          .map((line, index) => normalizeAdminInventoryLine(line, index))
          .filter((line) => line.name),
      )
    }
    if (nextInstructions != null) setInstructions(nextInstructions)
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
    setInstructions(saved.adminInstructions)
    setDirty(false)
    setMessage('')
    setEditing(false)
  }

  const shownLines = editing ? lines : saved.inventoryLines
  const customerBlock = saved.instructionBlocks.find((block) => block.author === 'customer')
  const adminBlock = saved.instructionBlocks.find((block) => block.author === 'admin')
  const adminSupply =
    saved.supplyAuthor === 'admin'
      ? String(adminBlock?.text || '')
          .split('\n')
          .map((line) => line.trim())
          .find((line) => /^Supply:\s/i.test(line)) || ''
      : ''
  const itemTotal = shownLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
  const itemTotalLabel = itemTotal === 1 ? '1 item' : `${itemTotal} items`
  const priceNote = String(lead?.price_override_reason || '').trim()

  function startEdit() {
    const ok = window.confirm('Are you sure you want to edit the items and special instructions?')
    if (!ok) return
    setLines(saved.inventoryLines)
    setInstructions(saved.adminInstructions)
    setMessage('')
    setEditing(true)
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-bold text-slate-900">Items and special instructions</h3>
        {editing ? null : (
          <button
            type="button"
            disabled={disabled}
            onClick={startEdit}
            className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Edit
          </button>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-slate-900">{editing ? 'Current items' : 'Inventory'}</p>
        {shownLines.length > 0 ? (
          <p className="text-sm font-bold text-blue-700">{itemTotalLabel}</p>
        ) : null}
      </div>
      {shownLines.length === 0 ? (
        <p className="mt-2 text-sm text-slate-700">No items yet.</p>
      ) : editing ? (
        <ul className={`mt-2 space-y-2 ${disabled || saving ? 'pointer-events-none opacity-60' : ''}`}>
          {shownLines.map((line) => (
            <li
              key={line.lineId}
              className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
            >
              <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-slate-800">
                {line.name}
              </p>
              <InlineInventoryQtyControl
                catalog
                compact
                quantity={line.quantity}
                onAdd={() => markDirty(applyInventoryLineQuantityDelta(lines, line.lineId, 1))}
                onDecrement={() => markDirty(applyInventoryLineQuantityDelta(lines, line.lineId, -1))}
                onIncrement={() => markDirty(applyInventoryLineQuantityDelta(lines, line.lineId, 1))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-1 grid grid-cols-1 sm:grid-cols-3">
          {shownLines.map((line) => (
            <li
              key={line.lineId}
              className="min-w-0 border-b border-slate-100 py-1.5 pr-3 text-sm leading-snug text-slate-700"
            >
              <span className="break-words">{line.name}</span>{' '}
              <span className="whitespace-nowrap font-semibold text-slate-900">×{line.quantity}</span>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className={`mt-4 border-t border-slate-100 pt-4 ${disabled || saving ? 'pointer-events-none opacity-60' : ''}`}>
          <p className="mb-3 text-sm font-bold text-slate-900">Add items</p>
          {settingsLoading ? (
            <p className="text-sm text-slate-600">Loading item catalogue…</p>
          ) : (
            <Step2Inventory
              layoutVariant="admin"
              hideCrew
              lines={lines}
              onLinesChange={(inventoryLines) => markDirty(inventoryLines)}
              customSizeM3={customSizeM3}
              crewSize={2}
              onCrewSizeChange={() => {}}
              crewSettings={null}
              crewRestrictions={{ oneManAllowed: true }}
              showContact={false}
            />
          )}
        </div>
      ) : null}

      {editing ? (
        <>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-sm font-bold text-slate-900">Special instructions</p>
            {customerBlock ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-bold text-slate-500">Added by customer:</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                  {customerBlock.text}
                </p>
              </div>
            ) : null}
            <label className="mt-2 block text-xs font-bold text-slate-500" htmlFor="lead-special-instructions">
              Added by admin:
            </label>
            <textarea
              id="lead-special-instructions"
              rows={3}
              value={instructions}
              disabled={disabled || saving}
              onChange={(event) => markDirty(null, event.target.value)}
              placeholder="Please bring extra blankets."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {adminSupply ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                {adminSupply}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              Customer instructions stay as the customer wrote them. A price note shows under this
              section as Included in price.
            </p>
          </div>
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
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-sm font-bold text-slate-900">Special instructions</p>
            <SpecialInstructionBlocks
              customer={customerBlock?.text || ''}
              admin={adminBlock?.text || ''}
              emptyLabel={priceNote ? '' : 'None'}
            />
            {priceNote ? (
              <div className={customerBlock || adminBlock ? 'mt-3 border-t border-slate-100 pt-3' : 'mt-2'}>
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  Included in price
                </span>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                  {priceNote}
                </p>
              </div>
            ) : null}
          </div>
          {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
        </>
      )}
    </section>
  )
}
