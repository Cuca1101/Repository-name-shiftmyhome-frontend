/**
 * Build customer_leads payloads from quote wizard / homepage form (no pricing changes).
 */
import { maxCustomerLeadStatus } from './customerLeadStatus'
import { formatWizardArrivalSummary } from './emailQuotePayload'

/**
 * @param {{
 *   step: number,
 *   wizard: Record<string, unknown>,
 *   currentStatus?: string,
 *   paymentPhase?: 'none' | 'started' | 'converted',
 * }} params
 */
export function deriveCustomerLeadStatus({ step, wizard, currentStatus = 'new_lead', paymentPhase = 'none' }) {
  if (paymentPhase === 'converted') return maxCustomerLeadStatus(currentStatus, 'converted_to_booking')
  if (paymentPhase === 'started') return maxCustomerLeadStatus(currentStatus, 'payment_started')

  const s = Math.max(1, Number(step) || 1)
  const hasStep1 =
    String(wizard?.pickupAddress || '').trim().length > 2 ||
    String(wizard?.deliveryAddress || '').trim().length > 2 ||
    Boolean(wizard?.moveDate)

  let next = 'new_lead'
  if (s >= 3) next = 'quote_viewed'
  else if (hasStep1 || s >= 2) next = 'quote_started'

  return maxCustomerLeadStatus(currentStatus, next)
}

/**
 * @param {Record<string, unknown>} wizard
 */
function buildStep1Snapshot(wizard) {
  return {
    serviceType: wizard.serviceType ?? null,
    pickupAddress: wizard.pickupAddress ?? '',
    deliveryAddress: wizard.deliveryAddress ?? '',
    pickupPropertyType: wizard.pickupPropertyType ?? '',
    deliveryPropertyType: wizard.deliveryPropertyType ?? '',
    pickupFloor: wizard.pickupFloor ?? null,
    deliveryFloor: wizard.deliveryFloor ?? null,
    pickupLift: wizard.pickupLift ?? null,
    deliveryLift: wizard.deliveryLift ?? null,
    distanceMiles: wizard.distanceMiles ?? null,
    moveDate: wizard.moveDate ?? '',
    arrivalWindow: wizard.arrivalWindow ?? '',
    exactArrivalTime: wizard.exactArrivalTime ?? '',
    flexibleArrivalFrom: wizard.flexibleArrivalFrom ?? '',
    flexibleArrivalUntil: wizard.flexibleArrivalUntil ?? '',
    arrivalSummary: formatWizardArrivalSummary(wizard),
  }
}

/**
 * @param {Record<string, unknown>} wizard
 * @param {number} totalM3
 */
function buildStep2Snapshot(wizard, totalM3) {
  return {
    fullName: wizard.fullName ?? '',
    phone: wizard.phone ?? '',
    email: wizard.email ?? '',
    crewSize: wizard.crewSize ?? null,
    inventoryLines: Array.isArray(wizard.inventoryLines) ? wizard.inventoryLines : [],
    totalVolumeM3: totalM3 ?? null,
  }
}

/**
 * @param {Record<string, unknown>} wizard
 */
function buildStep3Snapshot(wizard, extras = {}) {
  return {
    selectedMoveDate: wizard.moveDate ?? '',
    estimatedTotal: extras.estimatedTotal ?? null,
    packageTier: wizard.packageTier ?? '',
    crewSize: wizard.crewSize ?? null,
    specialInstructions: wizard.specialInstructions ?? '',
    heavyNotes: wizard.heavyNotes ?? '',
    packing: wizard.packing ?? false,
    packingWhat: wizard.packingWhat ?? '',
    packingMaterials: wizard.packingMaterials ?? false,
    packingMaterialsDetail: wizard.packingMaterialsDetail ?? '',
    dismantling: wizard.dismantling ?? false,
    dismantlingItemCount: wizard.dismantlingItemCount ?? 0,
    dismantlingWhat: wizard.dismantlingWhat ?? '',
    reassembly: wizard.reassembly ?? false,
    reassemblyItemCount: wizard.reassemblyItemCount ?? 0,
    reassemblyWhat: wizard.reassemblyWhat ?? '',
    pickupContactName: wizard.pickupContactName ?? '',
    pickupContactPhone: wizard.pickupContactPhone ?? '',
    deliveryContactName: wizard.deliveryContactName ?? '',
    deliveryContactPhone: wizard.deliveryContactPhone ?? '',
    promoCode: wizard.promoCode ?? '',
  }
}

/**
 * @param {{
 *   step: number,
 *   quoteRef: string,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   sourcePageUrl: string,
 *   entryPoint?: string,
 *   estimatedTotal?: number | null,
 *   totalM3?: number | null,
 *   quoteId?: string | null,
 *   currentStatus?: string,
 *   paymentPhase?: 'none' | 'started' | 'converted',
 * }} params
 */
export function buildCustomerLeadUpsertPayload({
  step,
  quoteRef,
  serviceType,
  wizard,
  sourcePageUrl,
  entryPoint = 'quote_wizard',
  estimatedTotal = null,
  totalM3 = null,
  quoteId = null,
  currentStatus = 'new_lead',
  paymentPhase = 'none',
}) {
  const w = { ...wizard, serviceType: serviceType || wizard.serviceType }
  const pickup = String(w.pickupAddress || '').trim()
  const delivery = String(w.deliveryAddress || '').trim()
  const routeLabel =
    pickup && delivery
      ? `${pickup.length > 42 ? `${pickup.slice(0, 42)}…` : pickup} → ${
          delivery.length > 42 ? `${delivery.slice(0, 42)}…` : delivery
        }`
      : pickup || delivery || ''

  const status = deriveCustomerLeadStatus({
    step,
    wizard: w,
    currentStatus,
    paymentPhase,
  })

  return {
    quote_ref: String(quoteRef || '').trim() || null,
    quote_id: quoteId ? String(quoteId).trim() : null,
    status,
    entry_point: entryPoint,
    source_page_url: sourcePageUrl || null,
    service_type: String(serviceType || '').trim() || null,
    customer_name: String(w.fullName || '').trim() || null,
    customer_phone: String(w.phone || '').trim() || null,
    customer_email: String(w.email || '').trim() || null,
    pickup_address: pickup || null,
    delivery_address: delivery || null,
    move_date: String(w.moveDate || '').trim() || null,
    route_label: routeLabel || null,
    estimated_total:
      estimatedTotal != null && Number.isFinite(Number(estimatedTotal))
        ? Number(estimatedTotal)
        : null,
    total_volume_m3:
      totalM3 != null && Number.isFinite(Number(totalM3)) ? Number(totalM3) : null,
    wizard_step: Math.max(1, Number(step) || 1),
    wizard_data: {
      step1: buildStep1Snapshot(w),
      step2: buildStep2Snapshot(w, totalM3),
      step3: buildStep3Snapshot(w, { estimatedTotal }),
      capturedAt: new Date().toISOString(),
    },
  }
}

/**
 * Homepage contact form → customer lead row.
 * @param {{
 *   name: string,
 *   email: string,
 *   phone: string,
 *   service: string,
 *   pickup: string,
 *   delivery: string,
 *   move_date: string,
 *   details: string,
 *   quote_ref: string,
 *   source_page_url?: string,
 * }} form
 */
export function buildHomePageCustomerLeadPayload(form) {
  const pickup = String(form.pickup || '').trim()
  const delivery = String(form.delivery || '').trim()
  return {
    quote_ref: String(form.quote_ref || '').trim() || null,
    status: 'quote_started',
    entry_point: 'home_page_form',
    source_page_url: form.source_page_url || '/',
    service_type: String(form.service || '').trim() || null,
    customer_name: String(form.name || '').trim() || null,
    customer_phone: String(form.phone || '').trim() || null,
    customer_email: String(form.email || '').trim() || null,
    pickup_address: pickup || null,
    delivery_address: delivery || null,
    move_date: String(form.move_date || '').trim() || null,
    route_label:
      pickup && delivery ? `${pickup} → ${delivery}` : pickup || delivery || null,
    wizard_step: 1,
    wizard_data: {
      step1: {
        pickupAddress: pickup,
        deliveryAddress: delivery,
        moveDate: form.move_date || '',
        serviceType: form.service || '',
      },
      homepageDetails: String(form.details || '').trim() || '',
      capturedAt: new Date().toISOString(),
    },
  }
}
