import { useEffect, useMemo, useState } from 'react'
import { formatGbp } from '../../lib/adminAgreedPrice'
import { saveCustomerLeadMoveEdits } from '../../lib/customerLeadBookingConvert'
import {
  diffInventorySelection,
  previewLeadInventoryPriceChange,
  resolveInventoryLineVolumeM3,
} from '../../lib/customerLeadAgreedInventoryAdjust'
import { applyInventoryLineQuantityDelta } from '../../lib/inventoryLineQuantity'
import SpecialInstructionBlocks from '../admin-workflow/SpecialInstructionBlocks'
import { editsFromLead, normalizeAdminInventoryLine } from '../../lib/customerLeadMoveSync'
import { fetchPricingSettings } from '../../lib/data/pricingSettingsRepository'
import InlineInventoryQtyControl from '../quote-wizard/InlineInventoryQtyControl'
import Step2Inventory from '../quote-wizard/steps/Step2Inventory'

/**
 * @param {Record<string, unknown>} line
 * @param {number} index
 */
function normalizeEditorLine(line, index) {
  const normalized = normalizeAdminInventoryLine(line, index)
  if (!normalized.name) return normalized
  if (normalized.m3 != null && Number.isFinite(Number(normalized.m3))) return normalized
  const m3 = resolveInventoryLineVolumeM3(normalized)
  return {
    ...normalized,
    m3,
    volumePerUnitM3: m3,
  }
}

/**
 * Add, remove, or rewrite items and special instructions on a customer lead.
 * Item search matches Quote / New phone booking. Saved agreed stays fixed on save;
 * only the calculated total refreshes from the engine.
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
  const [pricingSettings, setPricingSettings] = useState(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  useEffect(() => {
    if (dirty) return
    setLines(saved.inventoryLines.map((line, index) => normalizeEditorLine(line, index)))
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
        if (!cancelled) setPricingSettings(settings || null)
      } catch {
        if (!cancelled) setPricingSettings(null)
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
      setLines(nextLines.map((line, index) => normalizeEditorLine(line, index)).filter((line) => line.name))
    }
    if (nextInstructions != null) setInstructions(nextInstructions)
  }

  function bumpCurrentItem(lineId, delta) {
    markDirty(applyInventoryLineQuantityDelta(lines, lineId, delta))
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
  const customSizeM3 = pricingSettings?.customSizeM3 ?? null

  const selectionDiff = useMemo(
    () => (editing ? diffInventorySelection(saved.inventoryLines, lines) : { added: [], removed: [] }),
    [editing, saved.inventoryLines, lines],
  )
  const removedUnitCount = useMemo(
    () => selectionDiff.removed.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
    [selectionDiff.removed],
  )
  const addedUnitCount = useMemo(
    () => selectionDiff.added.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
    [selectionDiff.added],
  )
  const savedItemCount = useMemo(
    () => saved.inventoryLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
    [saved.inventoryLines],
  )
  const currentItemCount = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
    [lines],
  )

  const pricePreview = useMemo(() => {
    if (!editing || !pricingSettings) return null
    return previewLeadInventoryPriceChange({
      pricingSettings,
      lead,
      previousInventoryLines: saved.inventoryLines,
      nextInventoryLines: lines,
    })
  }, [editing, pricingSettings, lead, saved.inventoryLines, lines])

  function startEdit() {
    const ok = window.confirm('Are you sure you want to edit the items and special instructions?')
    if (!ok) return
    setLines(saved.inventoryLines.map((line, index) => normalizeEditorLine(line, index)))
    setInstructions(saved.adminInstructions)
    setMessage('')
    setEditing(true)
  }

  function cancelEdit() {
    setLines(saved.inventoryLines.map((line, index) => normalizeEditorLine(line, index)))
    setInstructions(saved.adminInstructions)
    setDirty(false)
    setMessage('')
    setEditing(false)
  }

  function formatSignedGbp(amount) {
    if (amount == null || !Number.isFinite(Number(amount))) return '—'
    const n = Number(amount)
    if (Math.abs(n) < 0.009) return formatGbp(0)
    const abs = formatGbp(Math.abs(n))
    return n > 0 ? `+${abs}` : `−${abs}`
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
      ) : (
        <ul className="mt-1 grid grid-cols-1 sm:grid-cols-3">
          {shownLines.map((line) => (
            <li
              key={line.lineId}
              className={`min-w-0 border-b border-slate-100 py-1.5 pr-3 text-sm leading-snug text-slate-700 ${
                editing ? 'flex items-center gap-2' : ''
              }`}
            >
              <span className={`break-words ${editing ? 'min-w-0 flex-1' : ''}`}>{line.name}</span>
              {editing ? (
                <InlineInventoryQtyControl
                  catalog
                  compact
                  quantity={line.quantity}
                  onAdd={() => bumpCurrentItem(line.lineId, 1)}
                  onDecrement={() => bumpCurrentItem(line.lineId, -1)}
                  onIncrement={() => bumpCurrentItem(line.lineId, 1)}
                />
              ) : (
                <>
                  {' '}
                  <span className="whitespace-nowrap font-semibold text-slate-900">×{line.quantity}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div
          className={`mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2 ${
            disabled || saving ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <div className="min-w-0">
            <p className="mb-3 text-sm font-bold text-slate-900">Add items</p>
            {settingsLoading ? (
              <p className="text-sm text-slate-600">Loading item catalogue…</p>
            ) : (
              <div className="max-h-[min(70vh,42rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50/40 p-3">
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
              </div>
            )}
          </div>

          <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Job total</p>
              <p className="mt-1 text-xs text-slate-500">
                Live summary for this edit. Save updates the item list and calculated total —
                Saved agreed only changes if you edit it separately.
              </p>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Items now
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
                  {currentItemCount === 1 ? '1 item' : `${currentItemCount} items`}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Was {savedItemCount === 1 ? '1 item' : `${savedItemCount} items`}
                  {removedUnitCount > 0 ? ` · removed ${removedUnitCount}` : ''}
                  {addedUnitCount > 0 ? ` · added ${addedUnitCount}` : ''}
                </p>
              </div>

              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                  {pricePreview?.usesAgreed ? 'Saved agreed total' : 'Checkout total'}
                </p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-blue-950">
                    {formatGbp(pricePreview?.checkoutAfter)}
                  </span>
                  {pricePreview?.checkoutDelta != null &&
                  Math.abs(pricePreview.checkoutDelta) >= 0.009 ? (
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        pricePreview.checkoutDelta > 0 ? 'text-emerald-700' : 'text-amber-800'
                      }`}
                    >
                      {pricePreview.checkoutDelta > 0
                        ? `up ${formatGbp(pricePreview.checkoutDelta)}`
                        : `down ${formatGbp(Math.abs(pricePreview.checkoutDelta))}`}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">No price change yet</span>
                  )}
                </p>
                {pricePreview?.checkoutBefore != null ? (
                  <p className="mt-1 text-xs text-blue-800/90">
                    Was {formatGbp(pricePreview.checkoutBefore)}
                    {pricePreview.checkoutDelta != null &&
                    Math.abs(pricePreview.checkoutDelta) >= 0.009
                      ? ` → now ${formatGbp(pricePreview.checkoutAfter)}`
                      : ''}
                  </p>
                ) : null}
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Calculated total
                </p>
                <p className="mt-0.5 flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-bold tabular-nums text-slate-900">
                    {formatGbp(pricePreview?.calculatedAfter)}
                  </span>
                  {pricePreview?.calculatedDelta != null &&
                  Math.abs(pricePreview.calculatedDelta) >= 0.009 ? (
                    <span
                      className={`font-semibold tabular-nums ${
                        pricePreview.calculatedDelta > 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {formatSignedGbp(pricePreview.calculatedDelta)}
                    </span>
                  ) : null}
                </p>
                {pricePreview?.calculatedBefore != null &&
                pricePreview?.calculatedDelta != null &&
                Math.abs(pricePreview.calculatedDelta) >= 0.009 ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Was {formatGbp(pricePreview.calculatedBefore)}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3">
                <p className="text-sm font-bold text-amber-950">
                  Removed
                  {removedUnitCount > 0
                    ? ` · ${removedUnitCount === 1 ? '1 item' : `${removedUnitCount} items`}`
                    : ''}
                </p>
                {removedUnitCount === 0 ? (
                  <p className="mt-1 text-sm text-amber-900/80">Nothing removed yet.</p>
                ) : (
                  <>
                    {pricePreview?.calculatedDelta != null &&
                    pricePreview.calculatedDelta < -0.009 ? (
                      <p className="mt-1 text-sm font-semibold tabular-nums text-amber-900">
                        Calculated down {formatGbp(Math.abs(pricePreview.calculatedDelta))}
                        <span className="mt-0.5 block text-xs font-medium text-amber-800/90">
                          Was {formatGbp(pricePreview.calculatedBefore)} → now{' '}
                          {formatGbp(pricePreview.calculatedAfter)}
                        </span>
                      </p>
                    ) : null}
                    <ul className="mt-2 max-h-44 space-y-1.5 overflow-y-auto border-t border-amber-200/80 pt-2">
                      {selectionDiff.removed.map((row) => (
                        <li
                          key={`rm-${row.name}`}
                          className="flex items-baseline justify-between gap-2 text-sm text-amber-950"
                        >
                          <span className="min-w-0 break-words">{row.name}</span>
                          <span className="shrink-0 font-semibold">−{row.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-3">
                <p className="text-sm font-bold text-emerald-950">
                  Added
                  {addedUnitCount > 0
                    ? ` · ${addedUnitCount === 1 ? '1 item' : `${addedUnitCount} items`}`
                    : ''}
                </p>
                {addedUnitCount === 0 ? (
                  <p className="mt-1 text-sm text-emerald-900/80">Nothing added yet — pick from the left.</p>
                ) : (
                  <>
                    {pricePreview?.calculatedDelta != null &&
                    pricePreview.calculatedDelta > 0.009 ? (
                      <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-900">
                        Calculated up {formatGbp(pricePreview.calculatedDelta)}
                        <span className="mt-0.5 block text-xs font-medium text-emerald-800/90">
                          Was {formatGbp(pricePreview.calculatedBefore)} → now{' '}
                          {formatGbp(pricePreview.calculatedAfter)}
                        </span>
                      </p>
                    ) : null}
                    <ul className="mt-2 max-h-44 space-y-1.5 overflow-y-auto border-t border-emerald-200/80 pt-2">
                      {selectionDiff.added.map((row) => (
                        <li
                          key={`add-${row.name}`}
                          className="flex items-baseline justify-between gap-2 text-sm text-emerald-950"
                        >
                          <span className="min-w-0 break-words">{row.name}</span>
                          <span className="shrink-0 font-semibold">+{row.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </aside>
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
