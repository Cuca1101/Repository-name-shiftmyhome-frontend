import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  deleteCustomerLeadById,
  dismissCustomerLeadCallback,
  fetchCustomerLeadById,
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
import CustomerLeadRouteMap from './admin/CustomerLeadRouteMap'

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
  'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-2 text-xs font-semibold disabled:opacity-50'
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
  const [previewHtml, setPreviewHtml] = useState('')
  const [pricePanelOpen, setPricePanelOpen] = useState(false)
  const [pricingPanelOpen, setPricingPanelOpen] = useState(false)
  const [agreedPriceInput, setAgreedPriceInput] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [pricingSettings, setPricingSettings] = useState(null)
  const [pricingSettingsLoading, setPricingSettingsLoading] = useState(true)
  const [driveSeconds, setDriveSeconds] = useState(null)
  const [callNote, setCallNote] = useState('')
  const [callbackInput, setCallbackInput] = useState('')

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
          ? `Price saved: ${formatGbp(parsed.amount)}. Old payment links for a different amount are invalidated.`
          : `Price saved: ${formatGbp(parsed.amount)}.`,
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

  async function handleSavePrice() {
    const parsed = parseAdminAgreedPriceInput(agreedPriceInput)
    if (!parsed.ok) {
      setPricePanelOpen(true)
      if (!agreedPriceInput && lead.agreed_price != null && Number.isFinite(Number(lead.agreed_price))) {
        setAgreedPriceInput(String(Number(lead.agreed_price).toFixed(2)))
      } else if (!agreedPriceInput && calculated != null) {
        setAgreedPriceInput(String(calculated.toFixed(2)))
      }
      setActionMsg('Enter the agreed price, then press Save. This only saves the price.')
      return
    }
    await handleSetCustomPrice()
  }

  async function handleCreateUnpaidJob() {
    setBusy('job')
    setActionMsg('')
    try {
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
          if (
            !window.confirm(
              `${confirmMsg}\n\nThen create a Paid job and send it to Available Jobs. Undo convert is available while unassigned.`,
            )
          ) {
            return
          }
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
        setActionMsg(parsed.error || 'Set a custom price before creating the job.')
        setPricePanelOpen(true)
        return
      } else if (
        !window.confirm(
          [
            `Create paid job at ${formatGbp(resolveChargeableTotal(lead))}?`,
            '',
            'Uses the saved lead details (addresses, inventory, date).',
            'Job goes to Available Jobs as Paid (same as card-paid).',
            'Lead marked Converted. You can Undo convert later if still unassigned.',
          ].join('\n'),
        )
      ) {
        return
      }

      const adminLabel = await resolveAdminCreatorLabel()
      const result = await convertCustomerLeadToUnpaidJob({
        lead: workingLead,
        createdBy: adminLabel,
        releaseToAvailableJobs: true,
      })
      setActionMsg(
        `Paid job ${result.quoteRef} created from this lead and sent to Available Jobs. Lead marked Converted.`,
      )
      await load()
      navigate(`/admin/available-jobs/${encodeURIComponent(result.quoteId)}`)
    } catch (e) {
      setActionMsg(e?.message || 'Failed to create paid job.')
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
    if (previewHtml) {
      setPreviewHtml('')
      return
    }
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
          <h2 className="mt-2 font-mono text-2xl font-bold text-slate-900">
            {customerLeadBookingRef(lead) || lead.lead_ref}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>{statusLabel}</span>
            {moveBadge ? (
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                  moveBadge.tone === 'expired'
                    ? 'bg-red-100 text-red-800 ring-red-200'
                    : moveBadge.highlight
                      ? 'bg-amber-100 text-amber-950 ring-amber-300'
                      : 'bg-slate-100 text-slate-700 ring-slate-200'
                }`}
              >
                {moveBadge.label}
              </span>
            ) : null}
            {lead.quote_ref && lead.lead_ref && lead.quote_ref !== lead.lead_ref ? (
              <>
                {' '}
                · Internal lead id <span className="font-mono text-slate-500">{lead.lead_ref}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {trashed ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-semibold">In Trash</p>
          <p className="mt-1">
            Deleted {formatDateTimeUK(lead.deleted_at)}. Restore puts this lead back on Customer Leads.
            The booking is unchanged.
          </p>
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
          <p className="font-semibold">Converted — job marked Paid</p>
          <p className="mt-1">
            This lead is Converted and the booking appears in Available Jobs as Paid. Use{' '}
            <strong>Undo convert</strong> to put the lead back and remove the job while it is still
            unassigned. Real card-paid bookings cannot be undone.
          </p>
        </div>
      ) : null}

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

      <section className="grid w-full min-w-0 grid-cols-1 items-stretch gap-3 sm:gap-4 md:grid-cols-2 min-[1500px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <article className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:col-span-2 min-[1500px]:col-span-1 min-[1500px]:row-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">Route</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tabular-nums text-slate-600">
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
          />
        </article>

        <aside className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

        <aside className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Actions</h3>
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Job</p>
              <div className="mt-2 space-y-2">
                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void handleCreateUnpaidJob()}
                    className={`${actionPrimary} w-full shrink-0 sm:w-28`}
                  >
                    {busy === 'job' ? 'Creating…' : isConverted ? 'Resend job' : 'Create job'}
                  </button>
                  <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                    {isConverted
                      ? 'Sends this paid job to Available Jobs again. Addresses stay as saved on the lead.'
                      : 'Creates a paid job from the saved details and sends it to Available Jobs. The lead becomes Converted.'}
                  </p>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void handleSavePrice()}
                    className={`${actionSecondary} w-full shrink-0 sm:w-28`}
                  >
                    {busy === 'price' ? 'Saving…' : 'Save'}
                  </button>
                  <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                    Saves the agreed price and confirms it is saved. It does not send the job to Available Jobs.
                  </p>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void handleSendPaymentLink()}
                    className={`${actionEmerald} w-full shrink-0 sm:w-28`}
                  >
                    {busy === 'pay' ? 'Creating…' : 'Pay link'}
                  </button>
                  <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                    Creates a Stripe payment link for the chargeable price and copies it. This does not create the job.
                  </p>
                </div>
                {isConverted && convertHref ? (
                  <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                    <Link to={convertHref} className={`${actionEmerald} w-full shrink-0 sm:w-28`}>
                      Open job
                    </Link>
                    <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                      Opens this booking in Available Jobs.
                    </p>
                  </div>
                ) : null}
                {isConverted ? (
                  <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void handleUndoConvert()}
                      className={`${actionAmber} w-full shrink-0 sm:w-28`}
                    >
                      {busy === 'revert' ? 'Undoing…' : 'Undo'}
                    </button>
                    <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                      Puts the lead back and removes the admin-created job while it is still unassigned. A card-paid booking stays.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              {emailHref ? (
                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                  <a href={emailHref} className={`${actionSecondary} w-full shrink-0 sm:w-28`}>
                    Email
                  </a>
                  <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                    Opens your email app to write to the customer.
                  </p>
                </div>
              ) : null}
              {trashed ? (
                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                  <button type="button" disabled={deleting} onClick={() => void handleRestore()} className={`${actionEmerald} w-full shrink-0 sm:w-28`}>
                    {deleting ? '…' : 'Restore'}
                  </button>
                  <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                    Puts this lead back on Customer Leads. The booking is unchanged.
                  </p>
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                  <button type="button" disabled={deleting} onClick={() => void handleDelete()} className={`${actionDanger} w-full shrink-0 sm:w-28`}>
                    {deleting ? '…' : 'Delete'}
                  </button>
                  <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                    Moves the lead to Trash. The booking stays in Available Jobs or Active Jobs.
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <aside className={pricePanelOpen || pricingPanelOpen ? detailCardOn : detailCardIdle}>
          <h3 className="text-sm font-bold text-slate-900">Price</h3>
          <div className="mt-3 space-y-2">
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <button
                type="button"
                disabled={Boolean(busy)}
                aria-pressed={pricePanelOpen}
                onClick={() => {
                  if (pricePanelOpen) {
                    setPricePanelOpen(false)
                    return
                  }
                  setPricePanelOpen(true)
                  if (!agreedPriceInput && calculated != null) {
                    setAgreedPriceInput(String(calculated.toFixed(2)))
                  }
                }}
                className={`${pricePanelOpen ? actionOn : actionSecondary} w-full shrink-0 sm:w-28`}
              >
                Price
              </button>
              <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                Opens the form to set the agreed price. Press again to close it. Stripe charges that amount when it is set.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <button
                type="button"
                disabled={Boolean(busy)}
                aria-pressed={pricingPanelOpen}
                onClick={() => setPricingPanelOpen((open) => !open)}
                className={`${pricingPanelOpen ? actionOn : actionSecondary} w-full shrink-0 sm:w-28`}
              >
                Payments
              </button>
              <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                Shows the price breakdown and the payment record. Press again to close it.
              </p>
            </div>
          </div>
        </aside>

        <aside className={previewHtml ? detailCardOn : detailCardIdle}>
          <h3 className="text-sm font-bold text-slate-900">Quote</h3>
          <div className="mt-3 space-y-2">
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <button
                type="button"
                disabled={Boolean(busy) || !lead.customer_email}
                onClick={() => void handleSendQuoteEmail()}
                className={`${actionPrimary} w-full shrink-0 sm:w-28`}
              >
                {busy === 'email' ? 'Sending…' : 'Quote'}
              </button>
              <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                Emails the quote to the customer. The agreed price is shown when one is saved.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <button
                type="button"
                disabled={Boolean(busy)}
                aria-pressed={Boolean(previewHtml)}
                onClick={handlePreviewEmail}
                className={`${previewHtml ? actionOn : actionSecondary} w-full shrink-0 sm:w-28`}
              >
                Preview
              </button>
              <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                Shows the email on this page. Press again to close it. Nothing is sent.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void handleCopyResume()}
                className={`${actionSecondary} w-full shrink-0 sm:w-28`}
              >
                Resume
              </button>
              <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                Copies the link so the customer can continue the quote.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void handleCopyPayment()}
                className={`${actionSecondary} w-full shrink-0 sm:w-28`}
              >
                Copy pay
              </button>
              <p className="min-w-0 text-xs leading-snug text-slate-600 sm:pt-1.5">
                Copies the customer pay page. It charges the agreed price when one is set.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className={`rounded-xl border p-4 shadow-sm ${callDue || firstCall ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Call</h3>
          {lead.called_at ? (
            <p className="text-xs font-semibold text-slate-600">
              Called {formatDateTimeUK(lead.called_at)}
              {lead.called_by ? ` by ${lead.called_by}` : ''}
            </p>
          ) : firstCall ? (
            <p className="text-xs font-semibold text-emerald-800">To call — new lead, not paid yet</p>
          ) : (
            <p className="text-xs text-slate-500">Not called yet</p>
          )}
        </div>
        <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="lead-call-note">
          What they said
        </label>
        <textarea
          id="lead-call-note"
          rows={3}
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
          className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Leave this empty if there is no reminder. A notice appears on Customer Leads when this time is reached.
        </p>
        <button
          type="button"
          disabled={busy === 'call'}
          onClick={() => void handleSaveCall()}
          className="mt-3 inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === 'call' ? 'Saving…' : 'Mark as called'}
        </button>
      </section>

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
                className={`${actionPrimary} px-3`}
              >
                {busy === 'price' ? 'Saving…' : 'Save price'}
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={() => setPricePanelOpen(false)} className={actionSecondary}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

      </DetailBlock>

      {pricingPanelOpen ? (
      <DetailBlock title="Pricing & payments">
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
            <Row label="Payment status" value={statusLabel} />
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

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={() => setPricingPanelOpen(false)} className={actionSecondary}>
            Close
          </button>
        </div>
      </DetailBlock>
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
        <DetailBlock title="Email preview">
          <p className="mb-2 text-xs text-slate-500">
            Preview only — Pay Now / Resume open in a new tab. Checkout never loads inside this
            preview.
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <RecoveryEmailPreviewFrame html={previewHtml} />
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
