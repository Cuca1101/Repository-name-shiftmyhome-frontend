import { useEffect, useState } from 'react'
import { saveCustomerLeadQuoteExtras } from '../../lib/customerLeadBookingConvert'
import { applyInstructionEdit } from '../../lib/instructionAuthors'
import { leadWizardSteps, quoteExtrasFormFromLead } from '../../lib/customerLeadMoveSync'
import SpecialInstructionBlocks from '../admin-workflow/SpecialInstructionBlocks'
import { formatDateUK } from '../../lib/formatDateDisplay'

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal'
const labelClass = 'block text-sm font-semibold text-slate-800'
const checkClass = 'flex items-center gap-2 text-sm font-semibold text-slate-800'
const secondaryBtn =
  'inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50'
const primaryBtn =
  'inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50'

function InfoRow({ label, value }) {
  const text = value == null || value === '' ? '—' : String(value)
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="whitespace-pre-wrap break-words">{text}</span>
    </div>
  )
}

function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `£${n.toFixed(2)}` : null
}

/**
 * @param {{
 *   lead: Record<string, unknown>,
 *   disabled?: boolean,
 *   onSaved: (lead: Record<string, unknown>) => void,
 * }} props
 */
export default function CustomerLeadQuoteExtrasEditor({ lead, disabled = false, onSaved }) {
  const { step1, step3 } = leadWizardSteps(lead)
  const saved = quoteExtrasFormFromLead(lead)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setEditing(false)
    setMessage('')
    setForm(quoteExtrasFormFromLead(lead))
  }, [lead?.id])

  function patch(next) {
    setForm((current) => ({ ...current, ...next }))
    setMessage('')
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const result = await saveCustomerLeadQuoteExtras({ lead, form })
      setEditing(false)
      setMessage(
        result.quoteUpdated
          ? 'Saved on this lead and on the booking. The saved price is unchanged.'
          : 'Saved on this lead. The saved price is unchanged.',
      )
      onSaved(result.lead)
    } catch (error) {
      setMessage(error?.message || 'Could not save the quote extras.')
    } finally {
      setSaving(false)
    }
  }

  const packageSnap = step3.servicePackage && typeof step3.servicePackage === 'object' ? step3.servicePackage : null
  const instructionRecord = applyInstructionEdit(step3, { priceNote: lead?.price_override_reason })
  const selectedQuote =
    step3.estimatedTotal != null
      ? money(step3.estimatedTotal)
      : lead.estimated_total != null
        ? money(lead.estimated_total)
        : null

  return (
    <section className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Quote &amp; extras</h3>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        {editing ? (
          <label className={labelClass}>
            Selected date
            <input type="date" className={fieldClass} value={form.selectedMoveDate} disabled={saving} onChange={(event) => patch({ selectedMoveDate: event.target.value })} />
          </label>
        ) : (
          <InfoRow
            label="Selected date"
            value={
              (step3.selectedMoveDate || step1.moveDate || lead.move_date)
                ? formatDateUK(step3.selectedMoveDate || step1.moveDate || lead.move_date)
                : null
            }
          />
        )}
        <InfoRow label="Selected quote" value={selectedQuote} />
        <InfoRow label="Package" value={packageSnap?.display_name || step3.packageTier} />
        <InfoRow label="Package fee" value={packageSnap?.service_package_fee != null ? money(packageSnap.service_package_fee) : null} />
        <InfoRow
          label="Forgotten items allowance"
          value={
            packageSnap
              ? `${packageSnap.forgotten_item_allowance ?? 0} items · ${packageSnap.forgotten_volume_m3 ?? 0} m³ (used ${packageSnap.used_forgotten_items ?? 0} / ${packageSnap.used_forgotten_volume_m3 ?? 0} m³)`
              : null
          }
        />
        <InfoRow label="Included waiting" value={packageSnap ? `${packageSnap.included_waiting_minutes ?? 0} minutes` : null} />
        <InfoRow
          label="Wrapping / dismantling"
          value={
            packageSnap
              ? `${packageSnap.included_wrapping_items ?? 0} wrapping · ${packageSnap.included_dismantle_items ?? 0} dismantle/reassembly`
              : null
          }
        />
        <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Special instructions</span>
          <SpecialInstructionBlocks
            customer={instructionRecord.blocks.find((block) => block.author === 'customer')?.text || ''}
            admin={instructionRecord.blocks.find((block) => block.author === 'admin')?.text || ''}
          />
        </div>
        {editing ? (
          <>
            <label className={labelClass}>
              Heavy items
              <textarea className={fieldClass} rows={2} value={form.heavyNotes} disabled={saving} onChange={(event) => patch({ heavyNotes: event.target.value })} />
            </label>
            <label className={checkClass}>
              <input type="checkbox" checked={form.packing} disabled={saving} onChange={(event) => patch({ packing: event.target.checked })} />
              Packing
            </label>
            {form.packing ? (
              <label className={labelClass}>
                Packing details
                <input className={fieldClass} value={form.packingWhat} disabled={saving} onChange={(event) => patch({ packingWhat: event.target.value })} />
              </label>
            ) : null}
            <label className={checkClass}>
              <input type="checkbox" checked={form.packingMaterials} disabled={saving} onChange={(event) => patch({ packingMaterials: event.target.checked })} />
              Materials
            </label>
            {form.packingMaterials ? (
              <label className={labelClass}>
                Materials
                <textarea className={fieldClass} rows={3} value={form.packingMaterialsDetail} disabled={saving} onChange={(event) => patch({ packingMaterialsDetail: event.target.value })} placeholder="Small moving box: 4 boxes" />
                <span className="mt-1 block text-xs font-normal text-slate-500">Box lines in the items update from this text and are marked Boxes supplied by us.</span>
              </label>
            ) : null}
            <label className={checkClass}>
              <input type="checkbox" checked={form.dismantling} disabled={saving} onChange={(event) => patch({ dismantling: event.target.checked })} />
              Dismantling
            </label>
            {form.dismantling ? (
              <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
                <label className={labelClass}>
                  Count
                  <input type="number" min="0" className={fieldClass} value={form.dismantlingItemCount} disabled={saving} onChange={(event) => patch({ dismantlingItemCount: event.target.value })} />
                </label>
                <label className={labelClass}>
                  Details
                  <input className={fieldClass} value={form.dismantlingWhat} disabled={saving} onChange={(event) => patch({ dismantlingWhat: event.target.value })} />
                </label>
              </div>
            ) : null}
            <label className={checkClass}>
              <input type="checkbox" checked={form.reassembly} disabled={saving} onChange={(event) => patch({ reassembly: event.target.checked })} />
              Reassembly
            </label>
            {form.reassembly ? (
              <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
                <label className={labelClass}>
                  Count
                  <input type="number" min="0" className={fieldClass} value={form.reassemblyItemCount} disabled={saving} onChange={(event) => patch({ reassemblyItemCount: event.target.value })} />
                </label>
                <label className={labelClass}>
                  Details
                  <input className={fieldClass} value={form.reassemblyWhat} disabled={saving} onChange={(event) => patch({ reassemblyWhat: event.target.value })} />
                </label>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Pickup contact
                <input className={fieldClass} value={form.pickupContactName} disabled={saving} onChange={(event) => patch({ pickupContactName: event.target.value })} />
              </label>
              <label className={labelClass}>
                Pickup phone
                <input className={fieldClass} value={form.pickupContactPhone} disabled={saving} onChange={(event) => patch({ pickupContactPhone: event.target.value })} />
              </label>
              <label className={labelClass}>
                Delivery contact
                <input className={fieldClass} value={form.deliveryContactName} disabled={saving} onChange={(event) => patch({ deliveryContactName: event.target.value })} />
              </label>
              <label className={labelClass}>
                Delivery phone
                <input className={fieldClass} value={form.deliveryContactPhone} disabled={saving} onChange={(event) => patch({ deliveryContactPhone: event.target.value })} />
              </label>
            </div>
            <label className={labelClass}>
              Promo
              <input className={fieldClass} value={form.promoCode} disabled={saving} onChange={(event) => patch({ promoCode: event.target.value })} />
            </label>
            <p className="text-xs text-slate-500">Saving does not email the customer or change the saved price. Special instructions stay in Items and special instructions.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={disabled || saving} onClick={() => void handleSave()} className={primaryBtn}>
                {saving ? 'Saving…' : 'Save quote and extras'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setForm(quoteExtrasFormFromLead(lead))
                  setEditing(false)
                  setMessage('')
                }}
                className={secondaryBtn}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <InfoRow label="Heavy items" value={step3.heavyNotes} />
            <InfoRow label="Packing" value={step3.packing ? step3.packingWhat || 'Yes' : 'No'} />
            <InfoRow label="Materials" value={step3.packingMaterials ? step3.packingMaterialsDetail || 'Yes' : 'No'} />
            <InfoRow label="Dismantling" value={step3.dismantling ? `${step3.dismantlingItemCount || 0} — ${step3.dismantlingWhat || ''}` : 'No'} />
            <InfoRow label="Reassembly" value={step3.reassembly ? `${step3.reassemblyItemCount || 0} — ${step3.reassemblyWhat || ''}` : 'No'} />
            <InfoRow label="Pickup contact" value={`${step3.pickupContactName || ''} ${step3.pickupContactPhone || ''}`.trim()} />
            <InfoRow label="Delivery contact" value={`${step3.deliveryContactName || ''} ${step3.deliveryContactPhone || ''}`.trim()} />
            <InfoRow label="Promo" value={step3.promoCode} />
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setForm(quoteExtrasFormFromLead(lead))
                  setMessage('')
                  setEditing(true)
                }}
                className={secondaryBtn}
              >
                Edit
              </button>
              {message ? <p className="text-sm text-slate-700">{message}</p> : null}
            </div>
          </>
        )}
        {editing && message ? <p className="text-sm text-slate-700">{message}</p> : null}
      </div>
    </section>
  )
}
