import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  deleteCustomerLeadById,
  fetchCustomerLeadById,
} from '../lib/data/customerLeadsRepository'
import { CUSTOMER_LEAD_STATUS_LABELS } from '../lib/customerLeadStatus'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import {
  buildPayQuoteUrl,
  buildResumeQuoteUrl,
  copyTextToClipboard,
  createLeadRecoveryCheckoutUrl,
  ensureLeadResumeToken,
  sendCustomerLeadRecoveryEmail,
} from '../lib/quoteRecoveryAdminApi'
import {
  buildQuoteRecoveryEmailPreview,
  recoveryContentFromLead,
} from '../lib/quoteRecoveryEmailPreview'
import {
  buildPriceOverrideConfirmMessage,
  formatGbp,
  parseAdminAgreedPriceInput,
  resolveCalculatedTotal,
  resolveChargeableTotal,
} from '../lib/adminAgreedPrice'
import {
  convertCustomerLeadToBooking,
  saveCustomerLeadAgreedPrice,
} from '../lib/customerLeadBookingConvert'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

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

async function resolveAdminCreatorLabel() {
  if (!isSupabaseConfigured || !supabase) return 'admin'
  try {
    const { data } = await supabase.auth.getSession()
    return String(data.session?.user?.email || '').trim() || 'admin'
  } catch {
    return 'admin'
  }
}

export default function CustomerLeadDetailAdmin() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [pricePanelOpen, setPricePanelOpen] = useState(false)
  const [agreedPriceInput, setAgreedPriceInput] = useState('')
  const [overrideReason, setOverrideReason] = useState('')

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
        if (row.agreed_price != null && Number.isFinite(Number(row.agreed_price))) {
          setAgreedPriceInput(String(Number(row.agreed_price).toFixed(2)))
        }
        setOverrideReason(String(row.price_override_reason || ''))
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

  const calculated = useMemo(() => resolveCalculatedTotal(lead), [lead])
  const chargeable = useMemo(() => resolveChargeableTotal(lead), [lead])
  const hasOverride =
    calculated != null &&
    chargeable != null &&
    Math.abs(calculated - chargeable) > 0.009 &&
    lead?.agreed_price != null

  async function withToken() {
    if (!lead?.id) throw new Error('No lead')
    const token = lead.resume_token || (await ensureLeadResumeToken(String(lead.id)))
    return token
  }

  async function handleSetCustomPrice() {
    setBusy('price')
    setActionMsg('')
    try {
      const parsed = parseAdminAgreedPriceInput(agreedPriceInput)
      if (!parsed.ok) {
        setActionMsg(parsed.error)
        return
      }
      const confirmMsg = buildPriceOverrideConfirmMessage({
        calculated,
        agreed: parsed.amount,
        reason: overrideReason,
      })
      if (!window.confirm(confirmMsg)) return

      const adminLabel = await resolveAdminCreatorLabel()
      await saveCustomerLeadAgreedPrice({
        leadId: String(lead.id),
        agreedPrice: parsed.amount,
        reason: overrideReason,
        adminLabel,
        currentLead: lead,
      })
      setActionMsg(
        `Admin agreed price saved: ${formatGbp(parsed.amount)}. Old payment links for a different amount are invalidated.`,
      )
      setPricePanelOpen(false)
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to save custom price.')
    } finally {
      setBusy('')
    }
  }

  async function handleSaveAndConvert() {
    setBusy('convert')
    setActionMsg('')
    try {
      // If admin typed a new price but hasn't saved yet, require save first via confirm.
      const parsed = parseAdminAgreedPriceInput(agreedPriceInput)
      let workingLead = lead
      if (parsed.ok) {
        const currentAgreed = lead.agreed_price != null ? Number(lead.agreed_price) : null
        if (currentAgreed == null || Math.abs(currentAgreed - parsed.amount) > 0.009) {
          const confirmMsg = buildPriceOverrideConfirmMessage({
            calculated,
            agreed: parsed.amount,
            reason: overrideReason,
          })
          if (!window.confirm(`${confirmMsg}\n\nThen convert this lead into a booking.`)) return
          const adminLabel = await resolveAdminCreatorLabel()
          const saved = await saveCustomerLeadAgreedPrice({
            leadId: String(lead.id),
            agreedPrice: parsed.amount,
            reason: overrideReason,
            adminLabel,
            currentLead: lead,
          })
          workingLead = saved.lead
        }
      } else if (resolveChargeableTotal(lead) == null) {
        setActionMsg(parsed.error || 'Set a custom price before converting.')
        setPricePanelOpen(true)
        return
      } else if (
        !window.confirm(
          `Convert this lead to a booking at ${formatGbp(resolveChargeableTotal(lead))}?`,
        )
      ) {
        return
      }

      const adminLabel = await resolveAdminCreatorLabel()
      const result = await convertCustomerLeadToBooking({
        lead: workingLead,
        createdBy: adminLabel,
      })
      setActionMsg(
        `Booking saved (${result.quoteRef}). Chargeable total: ${formatGbp(resolveChargeableTotal(result.lead || workingLead))}. You can send a payment link next.`,
      )
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to convert to booking.')
    } finally {
      setBusy('')
    }
  }

  async function handleSendQuoteEmail() {
    setBusy('email')
    setActionMsg('')
    try {
      await sendCustomerLeadRecoveryEmail(String(lead.id), {
        kind: lead.status === 'payment_failed' ? 'payment_failed' : undefined,
        force: true,
      })
      setActionMsg('Recovery email sent (shows admin agreed price when set).')
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to send email.')
    } finally {
      setBusy('')
    }
  }

  async function handleSendPaymentLink() {
    setBusy('pay')
    setActionMsg('')
    try {
      const charge = resolveChargeableTotal(lead)
      if (charge == null || charge < 1) {
        setActionMsg('Set an admin agreed price (or ensure a calculated quote exists) before creating a payment link.')
        setPricePanelOpen(true)
        return
      }
      const result = await createLeadRecoveryCheckoutUrl(String(lead.id))
      await copyTextToClipboard(result.url)
      setActionMsg(
        `Payment link created for ${formatGbp(result.amount ?? charge)} and copied to clipboard.${
          hasOverride || result.agreed_price != null
            ? ` (Calculated ${formatGbp(result.calculated_total ?? calculated)} → Agreed ${formatGbp(result.agreed_price ?? charge)})`
            : ''
        }`,
      )
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to create payment link.')
    } finally {
      setBusy('')
    }
  }

  async function handleCopyResume() {
    setBusy('resume')
    setActionMsg('')
    try {
      const token = await withToken()
      await copyTextToClipboard(buildResumeQuoteUrl(token))
      setActionMsg('Resume link copied.')
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Copy failed.')
    } finally {
      setBusy('')
    }
  }

  async function handleCopyPayment() {
    setBusy('copypay')
    setActionMsg('')
    try {
      const token = await withToken()
      await copyTextToClipboard(buildPayQuoteUrl(token))
      setActionMsg('Customer pay page link copied (charges admin agreed price when set).')
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Copy failed.')
    } finally {
      setBusy('')
    }
  }

  function handlePreviewEmail() {
    const content = recoveryContentFromLead(lead)
    const token = lead.resume_token || 'preview-token'
    const built = buildQuoteRecoveryEmailPreview({
      kind: lead.status === 'payment_failed' ? 'payment_failed' : 'abandoned',
      ...content,
      resumeUrl: buildResumeQuoteUrl(token),
      payUrl: buildPayQuoteUrl(token),
      siteUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
    })
    setPreviewHtml(built.html)
  }

  async function handleDelete() {
    if (!lead?.id) return
    const status = lead.effective_status || lead.status
    const isConverted = status === 'converted_to_booking'
    const msg = isConverted
      ? `Delete lead ${lead.lead_ref}? The booking/quote (${lead.quote_ref || 'linked record'}) stays in the system — only this lead row is removed.`
      : `Delete lead ${lead.lead_ref}? This cannot be undone.`
    if (!window.confirm(msg)) return

    setDeleting(true)
    setError('')
    try {
      await deleteCustomerLeadById(String(lead.id))
      navigate('/admin/customer-leads', { replace: true })
    } catch (e) {
      setError(e?.message || 'Failed to delete lead.')
      setDeleting(false)
    }
  }

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
    : null
  const isConverted = eff === 'converted_to_booking'

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
          {isConverted && convertHref ? (
            <Link
              to={convertHref}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              View booking / quote
            </Link>
          ) : null}
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete lead'}
          </button>
        </div>
      </div>

      {actionMsg ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{actionMsg}</p>
      ) : null}

      <DetailBlock title="Price & booking">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Calculated price</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatGbp(calculated)}</p>
            <p className="mt-1 text-xs text-slate-500">Pricing Engine total (preserved for audit)</p>
          </div>
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Admin agreed price</p>
            <p className="mt-1 text-xl font-bold text-brand-900">
              {lead.agreed_price != null ? formatGbp(Number(lead.agreed_price)) : 'Not set'}
            </p>
            <p className="mt-1 text-xs text-brand-800/80">
              Stripe Checkout charges this amount when set
            </p>
          </div>
        </div>

        {hasOverride ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Override active: {formatGbp(calculated)} → {formatGbp(chargeable)}
            {lead.price_override_by
              ? ` · by ${lead.price_override_by}${
                  lead.price_override_at ? ` · ${formatDateTimeUK(lead.price_override_at)}` : ''
                }`
              : ''}
            {lead.price_override_reason ? ` · ${lead.price_override_reason}` : ''}
          </p>
        ) : null}

        {pricePanelOpen ? (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
            <label className="block text-sm font-semibold text-slate-800" htmlFor="admin-agreed-price">
              Final / agreed price (£)
            </label>
            <input
              id="admin-agreed-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={agreedPriceInput}
              onChange={(e) => setAgreedPriceInput(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. 250.00"
            />
            <label className="block text-sm font-semibold text-slate-800" htmlFor="override-reason">
              Reason / note (optional)
            </label>
            <textarea
              id="override-reason"
              rows={2}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Agreed with customer on phone…"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void handleSetCustomPrice()}
                className="inline-flex min-h-[40px] items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy === 'price' ? 'Saving…' : 'Confirm & save custom price'}
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setPricePanelOpen(false)}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              setPricePanelOpen(true)
              if (!agreedPriceInput && calculated != null) {
                setAgreedPriceInput(String(calculated.toFixed(2)))
              }
            }}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Set custom price
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void handleSaveAndConvert()}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === 'convert'
              ? 'Saving…'
              : isConverted
                ? 'Update booking price'
                : 'Save & convert to booking'}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void handleSendPaymentLink()}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          >
            {busy === 'pay' ? 'Creating…' : 'Send payment link'}
          </button>
        </div>
      </DetailBlock>

      <DetailBlock title="Quote recovery">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy) || !lead.customer_email}
            onClick={() => void handleSendQuoteEmail()}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === 'email' ? 'Sending…' : 'Send Quote Email'}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void handleCopyResume()}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Copy Resume Link
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void handleCopyPayment()}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Copy Payment Link
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={handlePreviewEmail}
            className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Preview Email
          </button>
        </div>
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Row
            label="Last email sent"
            value={lead.last_recovery_email_at ? formatDateTimeUK(lead.last_recovery_email_at) : null}
          />
          <Row label="Email kind" value={lead.last_recovery_email_kind} />
          <Row
            label="Email opened"
            value={
              lead.recovery_email_opened
                ? `Yes${lead.recovery_email_opened_at ? ` · ${formatDateTimeUK(lead.recovery_email_opened_at)}` : ''}`
                : 'No'
            }
          />
          <Row
            label="Resume link clicked"
            value={
              lead.resume_link_clicked
                ? `Yes (${lead.resume_link_click_count || 1})${
                    lead.resume_link_clicked_at ? ` · ${formatDateTimeUK(lead.resume_link_clicked_at)}` : ''
                  }`
                : 'No'
            }
          />
          <Row
            label="Payment link clicked"
            value={
              lead.payment_link_clicked
                ? `Yes (${lead.payment_link_click_count || 1})${
                    lead.payment_link_clicked_at ? ` · ${formatDateTimeUK(lead.payment_link_clicked_at)}` : ''
                  }`
                : 'No'
            }
          />
          <Row label="Recovery emails sent" value={lead.recovery_emails_sent_count ?? 0} />
          <Row
            label="Live checkout amount"
            value={
              lead.stripe_payment_link_amount != null
                ? formatGbp(Number(lead.stripe_payment_link_amount))
                : null
            }
          />
          <Row
            label="Next recovery email"
            value={lead.next_recovery_email_at ? formatDateTimeUK(lead.next_recovery_email_at) : null}
          />
          {lead.payment_failed_at ? (
            <Row label="Payment failed at" value={formatDateTimeUK(lead.payment_failed_at)} />
          ) : null}
        </div>
      </DetailBlock>

      {previewHtml ? (
        <DetailBlock title="Email preview">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <iframe title="Recovery email preview" className="h-[480px] w-full bg-white" srcDoc={previewHtml} />
          </div>
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-brand-700 hover:underline"
            onClick={() => setPreviewHtml('')}
          >
            Close preview
          </button>
        </DetailBlock>
      ) : null}

      <DetailBlock title="Summary">
        <Row label="Name" value={lead.customer_name} />
        <Row label="Phone" value={lead.customer_phone} />
        <Row label="Email" value={lead.customer_email} />
        <Row label="Service" value={lead.service_type} />
        <Row label="Route" value={lead.route_label} />
        <Row label="Calculated price" value={formatGbp(calculated)} />
        <Row
          label="Admin agreed price"
          value={lead.agreed_price != null ? formatGbp(Number(lead.agreed_price)) : '—'}
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
        <Row label="Move date" value={s1.moveDate ? formatDateUK(s1.moveDate) : null} />
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
