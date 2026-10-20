import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  deleteCustomerLeadById,
  dismissCustomerLeadCallback,
  fetchCustomerLeadById,
  markCustomerLeadRead,
  purgeCustomerLeadById,
  restoreCustomerLeadById,
  saveCustomerLeadCall,
} from '../lib/data/customerLeadsRepository'
import { CUSTOMER_LEAD_STATUS_LABELS, customerLeadBookingRef } from '../lib/customerLeadStatus'
import {
  convertedLeadVisibleInCustomerLeads,
  customerLeadCallbackDue,
  customerLeadIsTrashed,
  customerLeadMoveCountdown,
  customerLeadNeedsFirstCall,
} from '../lib/customerLeadList'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import LeadCallButton from './admin/LeadCallButton'
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
  convertCustomerLeadToUnpaidJob,
  revertCustomerLeadConversion,
  saveCustomerLeadAgreedPrice,
} from '../lib/customerLeadBookingConvert'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { formatFloorLabel } from './quote-wizard/FloorSelect'
import { formatAccessLiftLabel } from '../lib/floorAccess'
import RecoveryEmailPreviewFrame from './admin/RecoveryEmailPreviewFrame'
import AdminJobEmailsSentPanel from './admin-workflow/AdminJobEmailsSentPanel'
import AdminQuotePriceBreakdown from './admin/AdminQuotePriceBreakdown'
import AdminQuotePricingSumTable from './admin/AdminQuotePricingSumTable'
import { fetchPricingSettings } from '../lib/data/pricingSettingsRepository'
import { onPricingSettingsUpdated } from '../lib/pricingSettingsEvents'
import { calculateQuote } from '../lib/pricingCalculator'
import { buildQuoteEngineInput } from '../lib/buildQuoteEngineInput'
import { wizardStateFromCustomerLeadData } from '../lib/quoteRecoveryResume'
import { resolveServiceLabel } from '../lib/normalizeServiceType'
import { formatQuoteBreakdownLines } from '../lib/emailQuotePayload'
import {
  buildQuotePricingSumTableRows,
  collectInventoryRowsForHeavyFee,
  resolveServicePackageDisplayName,
} from '../lib/quoteJobAdminModel'
import { listSpecialistHeavyItemDetails } from '../lib/inventoryPricing'
import { resolveCustomerLeadVolumeM3 } from '../lib/customerLeadCapture'
import { resolveCustomerPaymentSummary } from '../lib/customerPaymentSummary'
import CustomerLeadRouteMap from './admin/CustomerLeadRouteMap'
import CustomerLeadOffersSection from './admin/CustomerLeadOffersSection'

function ScreenModal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-3 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[min(92dvh,52rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className={actionSecondary}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

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

function formatDriveTime(seconds) {
  const total = Math.round(Number(seconds) / 60)
  if (!Number.isFinite(total) || total <= 0) return ''
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours <= 0) return `${minutes} min`
  if (minutes === 0) return hours === 1 ? '1 hr' : `${hours} hr`
  return `${hours} hr ${minutes} min`
}

function floorDisplay(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? formatFloorLabel(n) : String(value)
}

function datetimeLocalValue(value) {
  const ms = Date.parse(String(value || ''))
  if (!Number.isFinite(ms)) return ''
  const date = new Date(ms)
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function mailHref(email) {
  const e = String(email || '').trim()
  return e ? `mailto:${e}` : null
}

const actionBtn =
  'inline-flex min-h-10 max-w-full items-center justify-center whitespace-normal rounded-lg px-3 py-2 text-left text-sm font-semibold disabled:opacity-50'
const actionPrimary = `${actionBtn} bg-brand-600 text-white hover:bg-brand-700`
const actionSecondary = `${actionBtn} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`
const actionEmerald = `${actionBtn} border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`
const actionAmber = `${actionBtn} border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100`
const actionDanger = `${actionBtn} border border-red-200 bg-white text-red-800 hover:bg-red-50`
const actionOn = `${actionBtn} border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`
const detailCard = 'w-full min-w-0 rounded-xl border p-4 shadow-sm'
const detailCardIdle = `${detailCard} border-slate-200 bg-white`
const detailCardOn = `${detailCard} border-emerald-500 bg-emerald-50`

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
  const [purging, setPurging] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [pricePanelOpen, setPricePanelOpen] = useState(false)
  const [pricingPanelOpen, setPricingPanelOpen] = useState(false)
  const [agreedPriceInput, setAgreedPriceInput] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [pricingSettings, setPricingSettings] = useState(null)
  const [pricingSettingsLoading, setPricingSettingsLoading] = useState(true)
  const [driveSeconds, setDriveSeconds] = useState(null)
  const [callOpen, setCallOpen] = useState(false)
  const [callNote, setCallNote] = useState('')
  const [callbackInput, setCallbackInput] = useState('')
  const [linkedQuote, setLinkedQuote] = useState(null)
  const [morePaymentOpen, setMorePaymentOpen] = useState(false)
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)

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
        if (!row.admin_read_at) void markCustomerLeadRead(String(row.id))
        if (row.agreed_price != null && Number.isFinite(Number(row.agreed_price))) {
          setAgreedPriceInput(String(Number(row.agreed_price).toFixed(2)))
        }
        setOverrideReason(String(row.price_override_reason || ''))
        setCallNote(String(row.call_note || ''))
        setCallbackInput(datetimeLocalValue(row.callback_at))
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

  useEffect(() => {
    const quoteId = lead?.quote_id ? String(lead.quote_id) : ''
    if (!quoteId || !supabase) {
      setLinkedQuote(null)
      return
    }
    let cancelled = false
    supabase
      .from('quotes')
      .select(
        'id, payment_status, payment_type, amount_paid, remaining_balance, agreed_price, calculated_total, estimated_total, stripe_payment_intent_id, paid_at',
      )
      .eq('id', quoteId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLinkedQuote(data || null)
      })
    return () => {
      cancelled = true
    }
  }, [lead?.quote_id, lead?.updated_at])

  useEffect(() => {
    const step1 = lead?.wizard_data?.step1
    const saved = Number(step1?.mapboxRouteDurationSeconds)
    setDriveSeconds(Number.isFinite(saved) && saved > 0 ? saved : null)
  }, [lead?.id, lead?.wizard_data])

  useEffect(() => {
    let cancelled = false
    async function loadSettings() {
      setPricingSettingsLoading(true)
      try {
        const s = await fetchPricingSettings()
        if (!cancelled) setPricingSettings(s)
      } catch {
        if (!cancelled) setPricingSettings(null)
      } finally {
        if (!cancelled) setPricingSettingsLoading(false)
      }
    }
    void loadSettings()
    const unsubscribe = onPricingSettingsUpdated(() => {
      void loadSettings()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const calculated = useMemo(() => resolveCalculatedTotal(lead), [lead])
  const chargeable = useMemo(() => resolveChargeableTotal(lead), [lead])
  const hasOverride =
    calculated != null &&
    chargeable != null &&
    Math.abs(calculated - chargeable) > 0.009 &&
    lead?.agreed_price != null
  const paymentSummary = useMemo(() => {
    const agreed = lead?.agreed_price != null ? Number(lead.agreed_price) : null
    return resolveCustomerPaymentSummary({
      ...(linkedQuote || {}),
      id: linkedQuote?.id || lead?.quote_id || lead?.id,
      agreed_price: Number.isFinite(agreed) ? agreed : linkedQuote?.agreed_price ?? chargeable,
      calculated_total: calculated ?? linkedQuote?.calculated_total,
      estimated_total: calculated ?? linkedQuote?.estimated_total,
      payment_status: linkedQuote?.payment_status || 'unpaid',
      amount_paid: linkedQuote?.amount_paid ?? 0,
    })
  }, [linkedQuote, lead, calculated, chargeable])

  const leadWizard = useMemo(
    () => (lead ? wizardStateFromCustomerLeadData(lead.wizard_data) : null),
    [lead],
  )

  const leadServiceType = useMemo(() => {
    if (!lead) return ''
    return (
      resolveServiceLabel(lead.service_type) ||
      resolveServiceLabel(leadWizard?.serviceType) ||
      'House Removals'
    )
  }, [lead, leadWizard])

  const leadLineItems = useMemo(() => {
    const lines = Array.isArray(leadWizard?.inventoryLines) ? leadWizard.inventoryLines : []
    return lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      volumePerUnitM3: l.m3,
      handlingMultiplier: l.mult ?? 1,
      weightType: l.weightType,
      heavyFee: l.heavyFee,
      appliesHeavyHandlingFee: l.heavyFee,
      isCustom: l.isCustom,
    }))
  }, [leadWizard])

  const leadHeavyItemCount = useMemo(() => {
    const lines = Array.isArray(leadWizard?.inventoryLines) ? leadWizard.inventoryLines : []
    let n = 0
    for (const l of lines) {
      if (l.weightType === 'heavy') n += Number(l.quantity) || 0
    }
    return n
  }, [leadWizard])

  const liveBreakdown = useMemo(() => {
    if (!pricingSettings || !leadWizard) return null
    const hasInventory = leadLineItems.length > 0
    const hasDistance = Number(leadWizard.distanceMiles) > 0
    if (!hasInventory && !hasDistance) return null
    return calculateQuote(
      pricingSettings,
      buildQuoteEngineInput({
        serviceType: leadServiceType,
        wizard: leadWizard,
        lineItems: leadLineItems,
        heavyItemCount: leadHeavyItemCount,
      }),
    )
  }, [
    pricingSettings,
    leadWizard,
    leadLineItems,
    leadHeavyItemCount,
    leadServiceType,
  ])

  const liveEngineTotal =
    liveBreakdown?.estimatedTotal != null && Number.isFinite(liveBreakdown.estimatedTotal)
      ? Math.round(Number(liveBreakdown.estimatedTotal) * 100) / 100
      : null

  const liveDiffersFromSaved =
    liveEngineTotal != null &&
    calculated != null &&
    Math.abs(liveEngineTotal - calculated) > 0.009

  const livePricingSumRows = useMemo(() => {
    if (!liveBreakdown) return []
    const packageSnapshot =
      liveBreakdown.servicePackageSnapshot ||
      (lead?.wizard_data &&
      typeof lead.wizard_data === 'object' &&
      lead.wizard_data.step3 &&
      typeof lead.wizard_data.step3 === 'object'
        ? lead.wizard_data.step3.servicePackage
        : null)
    const inventoryRows = collectInventoryRowsForHeavyFee({
      wizardLines: Array.isArray(leadWizard?.inventoryLines) ? leadWizard.inventoryLines : [],
    })
    return buildQuotePricingSumTableRows(formatQuoteBreakdownLines(liveBreakdown), {
      packageSnapshot,
      packageLabel:
        resolveServicePackageDisplayName(packageSnapshot) ||
        (leadWizard?.packageTier === 'platinum'
          ? 'Platinum'
          : leadWizard?.packageTier === 'premium'
            ? 'Premium'
            : leadWizard?.packageTier === 'standard'
              ? 'Standard'
              : null),
      specialistHeavyItems: listSpecialistHeavyItemDetails(inventoryRows),
    })
  }, [liveBreakdown, lead, leadWizard])

  const livePackageLabel = useMemo(() => {
    const fromRows = livePricingSumRows.find((r) => r.isPackage)?.valueText
    if (fromRows) return fromRows
    const snap =
      liveBreakdown?.servicePackageSnapshot ||
      (lead?.wizard_data &&
      typeof lead.wizard_data === 'object' &&
      lead.wizard_data.step3 &&
      typeof lead.wizard_data.step3 === 'object'
        ? lead.wizard_data.step3.servicePackage
        : null)
    return (
      resolveServicePackageDisplayName(snap) ||
      (leadWizard?.packageTier === 'platinum'
        ? 'Platinum'
        : leadWizard?.packageTier === 'premium'
          ? 'Premium'
          : leadWizard?.packageTier === 'standard'
            ? 'Standard'
            : null)
    )
  }, [livePricingSumRows, liveBreakdown, lead, leadWizard])

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
      const saved = await saveCustomerLeadAgreedPrice({
        leadId: String(lead.id),
        agreedPrice: parsed.amount,
        reason: overrideReason,
        adminLabel,
        currentLead: lead,
      })
      setActionMsg(
        saved.previousSessionId
          ? 'Price saved. Older Stripe links for a different amount no longer apply.'
          : 'Price saved',
      )
      setPricePanelOpen(false)
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to save custom price.')
    } finally {
      setBusy('')
    }
  }

  async function handleSaveCall() {
    if (!lead?.id) return
    setBusy('call')
    setActionMsg('')
    try {
      const calledBy = await resolveAdminCreatorLabel()
      await saveCustomerLeadCall({
        id: String(lead.id),
        note: callNote,
        callbackAt: callbackInput || null,
        calledBy,
      })
      setActionMsg(
        callbackInput
          ? 'Marked as called. A notice appears when it is time to call again.'
          : 'Marked as called.',
      )
      setCallOpen(false)
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to save the call.')
    } finally {
      setBusy('')
    }
  }

  async function handleDismissCallback() {
    if (!lead?.id) return
    setBusy('call')
    setActionMsg('')
    try {
      await dismissCustomerLeadCallback(String(lead.id))
      setActionMsg('Callback notice closed.')
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to close the callback notice.')
    } finally {
      setBusy('')
    }
  }

  function openPriceEditor() {
    if (lead?.agreed_price != null && Number.isFinite(Number(lead.agreed_price))) {
      setAgreedPriceInput(String(Number(lead.agreed_price).toFixed(2)))
    } else if (calculated != null) {
      setAgreedPriceInput(String(calculated.toFixed(2)))
    } else {
      setAgreedPriceInput('')
    }
    setOverrideReason(String(lead?.price_override_reason || ''))
    setPricePanelOpen(true)
  }

  function discardPriceEdits() {
    if (lead?.agreed_price != null && Number.isFinite(Number(lead.agreed_price))) {
      setAgreedPriceInput(String(Number(lead.agreed_price).toFixed(2)))
    } else {
      setAgreedPriceInput('')
    }
    setOverrideReason(String(lead?.price_override_reason || ''))
    setPricePanelOpen(false)
  }

  async function handleCreateUnpaidJob() {
    if (
      lead?.status === 'converted_to_booking' ||
      lead?.effective_status === 'converted_to_booking' ||
      lead?.converted_at
    ) {
      if (lead.quote_id) navigate(`/admin/available-jobs/${encodeURIComponent(String(lead.quote_id))}`)
      return
    }
    if (pricePanelOpen) {
      setActionMsg('Save the agreed price, or cancel those edits, before converting.')
      return
    }
    const charge = resolveChargeableTotal(lead)
    if (charge == null || charge < 1) {
      setActionMsg('Save an agreed price, or keep a calculated quote, before converting.')
      openPriceEditor()
      return
    }
    if (
      !window.confirm(
        [
          `Convert this lead to a booking at ${formatGbp(charge)}?`,
          '',
          'The booking appears in Available Jobs.',
          `Payment stays ${paymentSummary.label}. This does not record a payment.`,
          'The lead is marked Converted.',
        ].join('\n'),
      )
    ) {
      return
    }

    setBusy('job')
    setActionMsg('')
    try {
      const adminLabel = await resolveAdminCreatorLabel()
      const result = await convertCustomerLeadToUnpaidJob({
        lead,
        createdBy: adminLabel,
        releaseToAvailableJobs: true,
      })
      setActionMsg(
        result.alreadyConverted
          ? `Booking ${result.quoteRef} is already in Available Jobs.`
          : `Booking ${result.quoteRef} created. Payment stays ${paymentSummary.label}.`,
      )
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to convert this lead.')
    } finally {
      setBusy('')
    }
  }

  async function handleUndoConvert() {
    setBusy('revert')
    setActionMsg('')
    try {
      if (
        !window.confirm(
          [
            'Undo convert?',
            '',
            'Lead goes back to how it was (not converted).',
            'Admin-created job is removed from Available Jobs (only if unassigned, not card-paid).',
          ].join('\n'),
        )
      ) {
        return
      }
      const result = await revertCustomerLeadConversion({ lead })
      setActionMsg(
        `Lead restored to ${CUSTOMER_LEAD_STATUS_LABELS[result.previousStatus] || result.previousStatus}.` +
          (result.quoteDeleted
            ? ' Job removed.'
            : result.quoteCancelled
              ? ' Job cancelled and removed from Available Jobs.'
              : result.quoteUnreleased
                ? ' Job pulled out of Available Jobs.'
                : ''),
      )
      await load()
    } catch (e) {
      setActionMsg(e?.message || 'Failed to undo convert.')
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
      setActionMsg('Quote sent')
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
      setActionMsg(`Link copied. Stripe checkout is for ${formatGbp(result.amount ?? charge)}.`)
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
      setActionMsg('Link copied')
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
      setActionMsg('Link copied')
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
      ? `Move lead ${lead.lead_ref} to Trash? The booking (${lead.quote_ref || 'linked record'}) stays in Available Jobs or Active Jobs. You can restore this lead from Trash.`
      : `Move lead ${lead.lead_ref} to Trash? You can restore it later. The booking, if one exists, stays in the system.`
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

  async function handleRestore() {
    if (!lead?.id) return
    setDeleting(true)
    setError('')
    try {
      await restoreCustomerLeadById(String(lead.id))
      await load()
      setActionMsg('Lead restored to Customer Leads.')
    } catch (e) {
      setError(e?.message || 'Failed to restore lead.')
    } finally {
      setDeleting(false)
    }
  }

  async function handlePurge() {
    if (!lead?.id || !customerLeadIsTrashed(lead)) return
    const ok = window.confirm(
      `Delete ${lead.lead_ref || 'this lead'} permanently? It leaves Trash and cannot be restored. A linked booking stays in Available Jobs or Active Jobs.`,
    )
    if (!ok) return

    setPurging(true)
    setError('')
    try {
      await purgeCustomerLeadById(String(lead.id))
      navigate('/admin/customer-leads', { replace: true })
    } catch (e) {
      setError(e?.message || 'Failed to delete lead permanently.')
      setPurging(false)
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
  const volumeM3 = resolveCustomerLeadVolumeM3({
    totalVolumeM3: s2.totalVolumeM3 ?? lead.total_volume_m3,
    inventoryLines: s2.inventoryLines,
  })
  const volumeLabel = volumeM3 == null ? null : volumeM3.toFixed(2)
  const emailHref = mailHref(lead.customer_email)
  const convertHref = lead.quote_id
    ? `/admin/available-jobs/${lead.quote_id}`
    : null
  const isConverted =
    eff === 'converted_to_booking' ||
    lead.status === 'converted_to_booking' ||
    Boolean(lead.converted_at)
  const trashed = customerLeadIsTrashed(lead)
  const hiddenAfterConvert = isConverted && !trashed && !convertedLeadVisibleInCustomerLeads(lead)
  const moveBadge = isConverted ? null : customerLeadMoveCountdown(lead.move_date)
  const callDue = customerLeadCallbackDue(lead)
  const firstCall = customerLeadNeedsFirstCall(lead)
  const pickupAddress = String(s1.pickupAddress || lead.pickup_address || '').trim()
  const deliveryAddress = String(s1.deliveryAddress || lead.delivery_address || '').trim()
  const distanceMiles = Number(s1.distanceMiles)
  const distanceLabel = Number.isFinite(distanceMiles) && distanceMiles > 0 ? `${distanceMiles.toFixed(1)} miles` : ''
  const driveLabel = formatDriveTime(driveSeconds)

  return (
    <div className="space-y-6 pb-10">
      <div>
        <div className="min-w-0">
          <Link to="/admin/customer-leads" className="text-sm font-semibold text-brand-700 hover:underline">
            ← Customer Leads
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-900">{lead.customer_name || 'Customer'}</h2>
              <p className="mt-1 font-mono text-sm text-slate-600">
                {customerLeadBookingRef(lead) || lead.lead_ref}
              </p>
            </div>
            <details
              className="relative"
              open={moreActionsOpen}
              onToggle={(event) => setMoreActionsOpen(event.currentTarget.open)}
            >
              <summary className={`${actionSecondary} cursor-pointer list-none`}>More actions</summary>
              <div className="z-20 mt-2 w-full min-w-[16rem] max-w-full space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:absolute sm:right-0">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void handleCopyResume()}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy === 'resume' ? 'Copying…' : 'Copy link to continue quote'}
                </button>
                {emailHref ? (
                  <a
                    href={emailHref}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Write email to customer
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Opens your email app. This is separate from the quote email.
                    </span>
                  </a>
                ) : null}
                {trashed ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleRestore()}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {deleting ? 'Restoring…' : 'Restore lead'}
                  </button>
                ) : null}
                {trashed ? (
                  <button
                    type="button"
                    disabled={purging}
                    onClick={() => void handlePurge()}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {purging ? 'Deleting…' : 'Delete permanently'}
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Removes this lead from Trash. A linked booking stays.
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting ? 'Moving…' : 'Move lead to Trash'}
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Hides this lead. A linked booking and its payments stay.
                    </span>
                  </button>
                )}
              </div>
            </details>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-800">Lead: {statusLabel}</span>
            <span
              className={`rounded-full px-2.5 py-1 ${
                paymentSummary.label === 'Paid in full'
                  ? 'bg-emerald-100 text-emerald-900'
                  : paymentSummary.label === 'Unpaid'
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-orange-100 text-orange-900'
              }`}
            >
              Payment: {paymentSummary.label}
            </span>
            {lead.pending_offer ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-950">Pending customer offer</span>
            ) : null}
            {moveBadge ? (
              <span
                className={`rounded-full px-2.5 py-1 ${
                  moveBadge.tone === 'expired'
                    ? 'bg-red-100 text-red-800'
                    : moveBadge.highlight
                      ? 'bg-amber-100 text-amber-950'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                {moveBadge.label}
              </span>
            ) : null}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Move date</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {lead.move_date ? formatDateUK(lead.move_date) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quote total</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatGbp(calculated)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Agreed total</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                {lead.agreed_price != null ? formatGbp(Number(lead.agreed_price)) : 'Not saved'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
              <dd className="mt-1">
                <LeadCallButton phone={lead.customer_phone || ''} />
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {trashed ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-semibold">In Trash</p>
          <p className="mt-1">
            Deleted {formatDateTimeUK(lead.deleted_at)}. Restore puts this lead back on Customer Leads.
            Delete permanently removes it from Trash. The booking is unchanged.
          </p>
          <button
            type="button"
            disabled={purging}
            onClick={() => void handlePurge()}
            className="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {purging ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      ) : null}

      {hiddenAfterConvert ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          This converted lead is older than 12 hours, so it is hidden from the Customer Leads list. The
          booking stays in Available Jobs or Active Jobs.
        </div>
      ) : null}

      {isConverted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">Converted to a booking</p>
          <p className="mt-1">
            The booking is in Available Jobs or Active Jobs. Payment stays {paymentSummary.label}.
          </p>
        </div>
      ) : null}

      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <CustomerLeadOffersSection leadId={lead.id} quoteRef={lead.quote_ref || ''} />

        <section className={`flex h-fit flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm ${callDue || firstCall ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Call</h3>
            {lead.called_at ? (
              <p className="text-xs font-semibold text-slate-600">
                Called {formatDateTimeUK(lead.called_at)}
                {lead.called_by ? ` by ${lead.called_by}` : ''}
              </p>
            ) : firstCall ? (
              <p className="text-xs font-semibold text-emerald-800">To call</p>
            ) : (
              <p className="text-xs text-slate-500">Not called yet</p>
            )}
          </div>
          <button type="button" onClick={() => setCallOpen(true)} className={`${actionSecondary} w-full`}>
            Record call
          </button>
        </section>
      </div>

      {actionMsg ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{actionMsg}</p>
      ) : null}

      {callDue ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p>
            <span className="font-semibold">Time to call.</span> The reminder was{' '}
            {formatDateTimeUK(lead.callback_at)}.
            {lead.called_by ? ` Marked by ${lead.called_by}.` : ''}
            {lead.call_note ? ` Last note: ${lead.call_note}` : ''}
          </p>
          <button
            type="button"
            disabled={busy === 'call'}
            onClick={() => void handleDismissCallback()}
            className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Close notice
          </button>
        </div>
      ) : null}

      <section className="grid w-full min-w-0 grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(17rem,0.78fr)] lg:items-stretch">
        <article className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Route</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tabular-nums text-slate-600">
              <span>{lead.move_date ? formatDateUK(lead.move_date) : 'No move date'}</span>
              {distanceLabel ? <span>{distanceLabel}</span> : null}
              {driveLabel ? <span>{driveLabel} to delivery</span> : null}
            </div>
          </div>
          <div className="grid gap-3 border-b border-slate-100 px-4 py-3 sm:grid-cols-2 sm:gap-4 sm:py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Collection</p>
              <p className="mt-1 text-sm font-medium leading-snug text-slate-900">{pickupAddress || '—'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Delivery</p>
              <p className="mt-1 text-sm font-medium leading-snug text-slate-900">{deliveryAddress || '—'}</p>
            </div>
          </div>
          <CustomerLeadRouteMap
            pickupAddress={pickupAddress}
            deliveryAddress={deliveryAddress}
            pickupLng={s1.pickupLng}
            pickupLat={s1.pickupLat}
            deliveryLng={s1.deliveryLng}
            deliveryLat={s1.deliveryLat}
            onDriveTime={setDriveSeconds}
            frameClass="relative h-[200px] min-h-[200px] w-full min-w-0 overflow-hidden sm:h-[220px] sm:min-h-[220px] lg:h-[240px] lg:min-h-[240px]"
          />
        </article>

        <aside className="h-full w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Customer</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-800">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name</p>
              <p className="mt-0.5 font-medium">{lead.customer_name || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</p>
              <div className="mt-1">
                <LeadCallButton phone={lead.customer_phone || ''} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-0.5 break-all">{lead.customer_email || '—'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Service</p>
                <p className="mt-0.5">{lead.service_type || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Move date</p>
                <p className="mt-0.5">{lead.move_date ? formatDateUK(lead.move_date) : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Volume</p>
                <p className="mt-0.5 tabular-nums">{volumeLabel ? `${volumeLabel} m³` : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Price</p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatGbp(calculated)}</p>
              </div>
            </div>
          </div>
        </aside>

      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900">Quote &amp; price</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Calculated total</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{formatGbp(calculated)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saved agreed total</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {lead.agreed_price != null ? formatGbp(Number(lead.agreed_price)) : 'Not saved'}
              </p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Checkout uses</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-brand-900">{formatGbp(chargeable)}</p>
              <p className="mt-1 text-xs text-brand-800">
                {lead.agreed_price != null ? 'The saved agreed total.' : 'The calculated total. No agreed price is saved.'}
              </p>
            </div>
          </div>
          {lead.pending_offer ? (
            <p className="mt-3 text-xs text-slate-600">
              A customer offer is still open. Saving a price does not accept, decline, or email that offer.
            </p>
          ) : null}
          {pricePanelOpen ? (
            <div className="mt-4 space-y-3 rounded-lg border border-slate-200 p-3">
              <label className="block text-sm font-semibold text-slate-800" htmlFor="admin-agreed-price">
                Agreed price (£)
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
              />
              <label className="block text-sm font-semibold text-slate-800" htmlFor="override-reason">
                Note (optional)
              </label>
              <textarea
                id="override-reason"
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={Boolean(busy)} onClick={() => void handleSetCustomPrice()} className={actionPrimary}>
                  {busy === 'price' ? 'Saving…' : 'Save agreed price'}
                </button>
                <button type="button" disabled={Boolean(busy)} onClick={discardPriceEdits} className={actionSecondary}>
                  Cancel
                </button>
              </div>
              <p className="text-xs text-slate-500">Saving stores the price only. It does not email the customer, create a booking, or record a payment.</p>
            </div>
          ) : (
            <>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={openPriceEditor} className={actionSecondary}>
                Edit agreed price
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || !lead.customer_email}
                onClick={() => void handleSendQuoteEmail()}
                className={actionPrimary}
              >
                {busy === 'email' ? 'Sending…' : 'Send quote by email'}
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={handlePreviewEmail} className={actionSecondary}>
                Preview quote email
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Preview quote email only shows the message. Send quote by email sends the saved checkout total.
            </p>
            </>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Payment</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Applicable total</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{formatGbp(paymentSummary.total ?? chargeable)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Confirmed amount paid</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{formatGbp(paymentSummary.paid)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Outstanding balance</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{formatGbp(paymentSummary.remaining)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Payment status</dt>
              <dd className="mt-0.5 text-lg font-bold text-slate-900">{paymentSummary.label}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setPricingPanelOpen((open) => !open)}
              className={actionSecondary}
            >
              View payment details
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => void handleSendPaymentLink()} className={actionPrimary}>
              {busy === 'pay' ? 'Creating…' : 'Create & copy Stripe payment link'}
            </button>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setMorePaymentOpen((open) => !open)}
              className="text-sm font-semibold text-slate-700 underline-offset-2 hover:underline"
            >
              More payment options
            </button>
            {morePaymentOpen ? (
              <div className="mt-2 space-y-2">
                <button type="button" disabled={Boolean(busy)} onClick={() => void handleCopyPayment()} className={actionSecondary}>
                  {busy === 'copypay' ? 'Copying…' : 'Copy customer payment page'}
                </button>
                <p className="text-xs text-slate-600">
                  The Stripe link starts a checkout for the saved total. The customer payment page is the quote pay link; it does not create a new Stripe session.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Booking</h3>
          <p className="mt-2 text-sm text-slate-700">
            {isConverted
              ? 'This lead is already a booking in Available Jobs or Active Jobs. Open it from here. Converting again is not available.'
              : 'Convert to booking creates the job in Available Jobs and marks this lead Converted. It keeps the current payment status and does not record a payment.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isConverted && convertHref ? (
              <Link to={convertHref} className={actionPrimary}>
                Open booking
              </Link>
            ) : (
              <button type="button" disabled={Boolean(busy) || isConverted} onClick={() => void handleCreateUnpaidJob()} className={actionPrimary}>
                {busy === 'job' ? 'Converting…' : 'Convert to booking'}
              </button>
            )}
            {isConverted ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => void handleUndoConvert()} className={actionSecondary}>
                {busy === 'revert' ? 'Undoing…' : 'Undo convert'}
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {pricingPanelOpen ? (
      <ScreenModal title="Payment details" wide onClose={() => setPricingPanelOpen(false)}>
      <div className="space-y-3 text-sm text-slate-700">
        <p className="text-xs leading-relaxed text-slate-500">
          Pricing Engine line items rebuilt from this lead&apos;s saved move details — same layout as
          Available Jobs.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Saved calculated
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
              {formatGbp(calculated)}
            </p>
          </div>
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Chargeable now
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-brand-900">
              {formatGbp(chargeable)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live engine total
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
              {pricingSettingsLoading ? '…' : formatGbp(liveEngineTotal)}
            </p>
          </div>
        </div>

        {liveDiffersFromSaved ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Live engine total ({formatGbp(liveEngineTotal)}) differs from the saved calculated price
            ({formatGbp(calculated)}). Rates or rules may have changed since this quote was captured —
            the saved total is what the customer was shown / charged unless you override.
          </p>
        ) : null}

        {pricingSettingsLoading ? (
          <p className="text-sm text-slate-500">Loading pricing engine…</p>
        ) : livePricingSumRows.length > 0 ? (
          <div className="space-y-3">
            <AdminQuotePricingSumTable
              rows={livePricingSumRows}
              packageBadge={livePackageLabel}
            />
            <details className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">
                Technical pricing detail
              </summary>
              <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                <AdminQuotePriceBreakdown
                  breakdown={liveBreakdown}
                  serviceType={leadServiceType}
                  wizard={leadWizard}
                  crewSettings={pricingSettings}
                  compact
                />
              </div>
            </details>
          </div>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Not enough saved details to rebuild a line-item breakdown (need inventory and/or route
            distance on the lead). Totals above still come from the stored quote.
          </p>
        )}

        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment record</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Row label="Payment status" value={paymentSummary.label} />
            <Row label="Chargeable total" value={formatGbp(chargeable)} />
            <Row
              label="Live checkout amount"
              value={
                lead.stripe_payment_link_amount != null
                  ? formatGbp(Number(lead.stripe_payment_link_amount))
                  : null
              }
            />
            <Row
              label="Payment link clicked"
              value={
                lead.payment_link_clicked
                  ? `Yes (${lead.payment_link_click_count || 1})${
                      lead.payment_link_clicked_at
                        ? ` · ${formatDateTimeUK(lead.payment_link_clicked_at)}`
                        : ''
                    }`
                  : 'No'
              }
            />
            {lead.payment_failed_at ? (
              <Row label="Payment failed at" value={formatDateTimeUK(lead.payment_failed_at)} />
            ) : null}
            {lead.stripe_payment_link_url ? (
              <Row label="Checkout link" value={lead.stripe_payment_link_url} />
            ) : null}
            {isConverted && convertHref ? (
              <div className="sm:col-span-2">
                <Link
                  to={`${convertHref}?tab=pricing`}
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  Open full Pricing & payments on the booking →
                </Link>
              </div>
            ) : null}
          </div>
        </div>

      </div>
      </ScreenModal>
      ) : null}

      <DetailBlock title="Quote recovery">
        <div className="grid gap-2 sm:grid-cols-2">
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
        <ScreenModal title="Preview quote email" wide onClose={() => setPreviewHtml('')}>
          <p className="mb-2 text-xs text-slate-500">
            Preview only. Nothing is sent. Pay Now and Resume open in a new tab.
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <RecoveryEmailPreviewFrame html={previewHtml} className="h-[min(60dvh,28rem)] w-full bg-white" />
          </div>
        </ScreenModal>
      ) : null}

      {callOpen ? (
        <ScreenModal title="Call" onClose={() => setCallOpen(false)}>
          {lead.called_at ? (
            <p className="text-xs font-semibold text-slate-600">
              Called {formatDateTimeUK(lead.called_at)}
              {lead.called_by ? ` by ${lead.called_by}` : ''}
            </p>
          ) : null}
          <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="lead-call-note">
            What they said
          </label>
          <textarea
            id="lead-call-note"
            rows={4}
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="What the customer said…"
          />
          <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="lead-callback-at">
            Call again
          </label>
          <input
            id="lead-callback-at"
            type="datetime-local"
            value={callbackInput}
            onChange={(e) => setCallbackInput(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Leave this empty if there is no reminder.
          </p>
          <button
            type="button"
            disabled={busy === 'call'}
            onClick={() => void handleSaveCall()}
            className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === 'call' ? 'Saving…' : 'Mark as called'}
          </button>
        </ScreenModal>
      ) : null}

      <DetailBlock title="Email History">
        <AdminJobEmailsSentPanel
          customerLeadId={lead.id}
          quoteId={lead.quote_id || undefined}
        />
      </DetailBlock>

      <div className="grid items-start gap-6 xl:grid-cols-2">
      <DetailBlock title="Record">
        <Row label="Source page" value={lead.source_page_url} />
        <Row label="Entry" value={lead.entry_point} />
        <Row label="Wizard step" value={lead.wizard_step} />
        <Row label="Created" value={formatDateTimeUK(lead.created_at)} />
        <Row label="Last activity" value={formatDateTimeUK(lead.last_activity_at)} />
        {lead.abandoned_at ? <Row label="Abandoned" value={formatDateTimeUK(lead.abandoned_at)} /> : null}
        {lead.converted_at ? <Row label="Converted" value={formatDateTimeUK(lead.converted_at)} /> : null}
      </DetailBlock>

      <DetailBlock title="Move details">
        <Row label="Service" value={s1.serviceType || lead.service_type} />
        <Row label="Pickup" value={s1.pickupAddress || lead.pickup_address} />
        <Row label="Pickup property" value={s1.pickupPropertyType} />
        <Row label="Pickup floor" value={floorDisplay(s1.pickupFloor)} />
        <Row label="Pickup lift" value={formatAccessLiftLabel(s1.pickupFloor, s1.pickupLift)} />
        <Row label="Delivery" value={s1.deliveryAddress || lead.delivery_address} />
        <Row label="Delivery property" value={s1.deliveryPropertyType} />
        <Row label="Delivery floor" value={floorDisplay(s1.deliveryFloor)} />
        <Row label="Delivery lift" value={formatAccessLiftLabel(s1.deliveryFloor, s1.deliveryLift)} />
        <Row label="Move date" value={s1.moveDate ? formatDateUK(s1.moveDate) : null} />
        <Row label="Arrival" value={s1.arrivalSummary} />
        <Row label="Distance (mi)" value={distanceLabel || null} />
      </DetailBlock>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
      <DetailBlock title="Contact & inventory">
        <Row label="Name" value={s2.fullName || lead.customer_name} />
        <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
          <LeadCallButton phone={s2.phone || lead.customer_phone || ''} />
        </div>
        <Row label="Email" value={s2.email || lead.customer_email} />
        <Row label="Crew" value={s2.crewSize} />
        <Row label="Volume (m³)" value={volumeLabel} />
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

      <DetailBlock title="Quote & extras">
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
        <Row label="Package" value={s3.servicePackage?.display_name || s3.packageTier} />
        <Row
          label="Package fee"
          value={
            s3.servicePackage?.service_package_fee != null
              ? `£${Number(s3.servicePackage.service_package_fee).toFixed(2)}`
              : null
          }
        />
        <Row
          label="Forgotten items allowance"
          value={
            s3.servicePackage
              ? `${s3.servicePackage.forgotten_item_allowance ?? 0} items · ${s3.servicePackage.forgotten_volume_m3 ?? 0} m³ (used ${s3.servicePackage.used_forgotten_items ?? 0} / ${s3.servicePackage.used_forgotten_volume_m3 ?? 0} m³)`
              : null
          }
        />
        <Row
          label="Included waiting"
          value={s3.servicePackage ? `${s3.servicePackage.included_waiting_minutes ?? 0} minutes` : null}
        />
        <Row
          label="Wrapping / dismantling"
          value={
            s3.servicePackage
              ? `${s3.servicePackage.included_wrapping_items ?? 0} wrapping · ${s3.servicePackage.included_dismantle_items ?? 0} dismantle/reassembly`
              : null
          }
        />
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
      </div>

      {wd.homepageDetails ? (
        <DetailBlock title="Homepage form">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{wd.homepageDetails}</p>
        </DetailBlock>
      ) : null}
    </div>
  )
}
