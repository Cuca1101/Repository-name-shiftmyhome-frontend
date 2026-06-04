import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCustomerLeadById } from '../lib/data/customerLeadsRepository'
import { CUSTOMER_LEAD_STATUS_LABELS } from '../lib/customerLeadStatus'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'

function DetailBlock({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  )
}

function Row({ label, value }) {
  const text = value == null || value === '' ? '—' : String(value)
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="break-words">{text}</span>
    </div>
  )
}

function telHref(phone) {
  const p = String(phone || '').replace(/\s+/g, '')
  return p ? `tel:${p}` : null
}

function mailHref(email) {
  const e = String(email || '').trim()
  return e ? `mailto:${e}` : null
}

export default function CustomerLeadDetailAdmin() {
  const { id } = useParams()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const row = await fetchCustomerLeadById(id)
      if (!row) {
        setError('Lead not found.')
        setLead(null)
      } else {
        setLead(row)
      }
    } catch (e) {
      setError(e?.message || 'Failed to load lead.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <p className="p-8 text-center text-slate-500">Loading…</p>
  }

  if (error || !lead) {
    return (
      <div className="space-y-4">
        <Link to="/admin/customer-leads" className="text-sm font-semibold text-brand-700 hover:underline">
          ← Customer Leads
        </Link>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || 'Lead not found.'}
        </p>
      </div>
    )
  }

  const eff = lead.effective_status || lead.status
  const statusLabel = CUSTOMER_LEAD_STATUS_LABELS[eff] || eff
  const wd = lead.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s1 = wd.step1 || {}
  const s2 = wd.step2 || {}
  const s3 = wd.step3 || {}
  const callHref = telHref(lead.customer_phone)
  const emailHref = mailHref(lead.customer_email)
  const convertHref = lead.quote_id
    ? `/admin/quote-requests/${lead.quote_id}`
    : '/admin/new-phone-booking'

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/customer-leads" className="text-sm font-semibold text-brand-700 hover:underline">
            ← Customer Leads
          </Link>
          <h2 className="mt-2 font-mono text-2xl font-bold text-slate-900">{lead.lead_ref}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {statusLabel}
            {lead.quote_ref ? (
              <>
                {' '}
                · Quote <span className="font-mono">{lead.quote_ref}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {callHref ? (
            <a
              href={callHref}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Call customer
            </a>
          ) : null}
          {emailHref ? (
            <a
              href={emailHref}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Email customer
            </a>
          ) : null}
          {eff !== 'converted_to_booking' ? (
            <Link
              to={convertHref}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Convert to booking
            </Link>
          ) : (
            <Link
              to={convertHref}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              View booking / quote
            </Link>
          )}
        </div>
      </div>

      <DetailBlock title="Summary">
        <Row label="Name" value={lead.customer_name} />
        <Row label="Phone" value={lead.customer_phone} />
        <Row label="Email" value={lead.customer_email} />
        <Row label="Service" value={lead.service_type} />
        <Row label="Route" value={lead.route_label} />
        <Row
          label="Quote price"
          value={
            lead.estimated_total != null && Number.isFinite(Number(lead.estimated_total))
              ? `£${Number(lead.estimated_total).toFixed(2)}`
              : null
          }
        />
        <Row label="Volume (m³)" value={lead.total_volume_m3} />
        <Row label="Move date" value={lead.move_date ? formatDateUK(lead.move_date) : null} />
        <Row label="Source page" value={lead.source_page_url} />
        <Row label="Entry" value={lead.entry_point} />
        <Row label="Wizard step" value={lead.wizard_step} />
        <Row label="Created" value={formatDateTimeUK(lead.created_at)} />
        <Row label="Last activity" value={formatDateTimeUK(lead.last_activity_at)} />
        {lead.abandoned_at ? <Row label="Abandoned" value={formatDateTimeUK(lead.abandoned_at)} /> : null}
        {lead.converted_at ? <Row label="Converted" value={formatDateTimeUK(lead.converted_at)} /> : null}
      </DetailBlock>

      <DetailBlock title="Step 1 — Move details">
        <Row label="Service" value={s1.serviceType || lead.service_type} />
        <Row label="Pickup" value={s1.pickupAddress || lead.pickup_address} />
        <Row label="Delivery" value={s1.deliveryAddress || lead.delivery_address} />
        <Row label="Move date" value={s1.moveDate} />
        <Row label="Arrival" value={s1.arrivalSummary} />
        <Row label="Distance (mi)" value={s1.distanceMiles} />
      </DetailBlock>

      <DetailBlock title="Step 2 — Contact & inventory">
        <Row label="Name" value={s2.fullName || lead.customer_name} />
        <Row label="Phone" value={s2.phone || lead.customer_phone} />
        <Row label="Email" value={s2.email || lead.customer_email} />
        <Row label="Crew" value={s2.crewSize} />
        <Row label="Volume (m³)" value={s2.totalVolumeM3 ?? lead.total_volume_m3} />
        {Array.isArray(s2.inventoryLines) && s2.inventoryLines.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory</p>
            <ul className="mt-2 list-inside list-disc text-sm">
              {s2.inventoryLines.map((line, i) => (
                <li key={i}>
                  {line.quantity}× {line.name} ({line.m3} m³ each)
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Row label="Inventory" value={null} />
        )}
      </DetailBlock>

      <DetailBlock title="Step 3 — Quote & extras">
        <Row label="Selected date" value={s3.selectedMoveDate} />
        <Row
          label="Selected quote"
          value={
            s3.estimatedTotal != null
              ? `£${Number(s3.estimatedTotal).toFixed(2)}`
              : lead.estimated_total != null
                ? `£${Number(lead.estimated_total).toFixed(2)}`
                : null
          }
        />
        <Row label="Package" value={s3.packageTier} />
        <Row label="Notes" value={s3.specialInstructions} />
        <Row label="Heavy items" value={s3.heavyNotes} />
        <Row label="Packing" value={s3.packing ? s3.packingWhat || 'Yes' : 'No'} />
        <Row
          label="Materials"
          value={s3.packingMaterials ? s3.packingMaterialsDetail || 'Yes' : 'No'}
        />
        <Row
          label="Dismantling"
          value={s3.dismantling ? `${s3.dismantlingItemCount || 0} — ${s3.dismantlingWhat || ''}` : 'No'}
        />
        <Row
          label="Reassembly"
          value={s3.reassembly ? `${s3.reassemblyItemCount || 0} — ${s3.reassemblyWhat || ''}` : 'No'}
        />
        <Row label="Pickup contact" value={`${s3.pickupContactName || ''} ${s3.pickupContactPhone || ''}`.trim()} />
        <Row
          label="Delivery contact"
          value={`${s3.deliveryContactName || ''} ${s3.deliveryContactPhone || ''}`.trim()}
        />
        <Row label="Promo" value={s3.promoCode} />
      </DetailBlock>

      {wd.homepageDetails ? (
        <DetailBlock title="Homepage form">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{wd.homepageDetails}</p>
        </DetailBlock>
      ) : null}
    </div>
  )
}
