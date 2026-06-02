/**
 * Estimate extra charge for driver app (Items Library + access/time charges).
 * POST {
 *   items?: [{ name, quantity, volume_m3?, library_item_id? }],
 *   operational?: {
 *     extra_floors?, lift_available?: 'yes'|'no'|'na', stairs_flights?,
 *     long_walking_distance?, parking_issue?, waiting_time_hours?,
 *     dismantling_items?, reassembly_items?, extra_helpers?
 *   }
 * }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  getDriverRatesDebugSnapshot,
  resolveDriverExtraChargePricing,
} from '../_shared/driverExtraChargePricing.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function money(n: number) {
  return Math.round(n * 100) / 100
}

function normName(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

type LibRow = {
  id: string
  name: string
  cubic_metres: number
  weight_type: string
  handling_multiplier: number
}

type LineItem = {
  name: string
  quantity: number
  volumePerUnitM3: number
  handlingMultiplier: number
  weightType: string
}

function resolveVolumeMultiplier(settings: Record<string, unknown>, totalM3: number) {
  const bands = [
    { min: 25, key: 'volumeMultiplier25PlusM3', label: '25 m³+' },
    { min: 15, key: 'volumeMultiplier15To25M3', label: '15–25 m³' },
    { min: 8, key: 'volumeMultiplier8To15M3', label: '8–15 m³' },
    { min: 3, key: 'volumeMultiplier3To8M3', label: '3–8 m³' },
    { min: 0, key: 'volumeMultiplier0To3M3', label: '0–3 m³' },
  ]
  const v = Math.max(0, totalM3)
  for (const b of bands) {
    if (v >= b.min) {
      const mult = Number(settings[b.key]) || 1
      return { multiplier: mult, bandLabel: b.label }
    }
  }
  return { multiplier: 1, bandLabel: '0–3 m³' }
}

function sumVolume(items: LineItem[]) {
  let t = 0
  for (const row of items) {
    const q = Number(row.quantity) || 0
    const v = Number(row.volumePerUnitM3) || 0
    const m = Number(row.handlingMultiplier) > 0 ? Number(row.handlingMultiplier) : 1
    t += q * v * m
  }
  return money(t)
}

function resolveItems(raw: unknown[], library: LibRow[]) {
  const byName = new Map<string, LibRow>()
  const byId = new Map<string, LibRow>()
  for (const row of library) {
    byId.set(row.id, row)
    const n = normName(row.name)
    if (n) byName.set(n, row)
  }

  return (Array.isArray(raw) ? raw : []).map((item) => {
    const rec = item as Record<string, unknown>
    const qty = Math.max(1, Math.round(Number(rec.quantity) || 1))
    const libId = String(rec.library_item_id || rec.catalog_id || '').trim()
    const matched = (libId && byId.get(libId)) || byName.get(normName(String(rec.name || ''))) || null
    let vol = Number(rec.volume_m3)
    if (!Number.isFinite(vol) || vol <= 0) {
      vol = matched?.cubic_metres > 0 ? Number(matched.cubic_metres) : 0.5
    }
    return {
      name: String(rec.name || matched?.name || 'Item'),
      quantity: qty,
      volumePerUnitM3: Math.max(0.01, vol),
      handlingMultiplier: matched?.handling_multiplier > 0 ? Number(matched.handling_multiplier) : 1,
      weightType: String(rec.weight_type || matched?.weight_type || 'medium'),
      matched,
    }
  })
}

function formatGbp(amount: number) {
  return `£${money(amount).toFixed(2)}`
}

function calculate(settings: Record<string, unknown>, lineItems: LineItem[]) {
  const totalM3 = sumVolume(lineItems)
  const rate = Number(settings.pricePerCubicMetre) || 0
  const base = money(totalM3 * rate)
  const { multiplier, bandLabel } = resolveVolumeMultiplier(settings, totalM3)
  const scaled = money(base * multiplier)
  let heavy = 0
  for (const row of lineItems) {
    if (String(row.weightType).toLowerCase() === 'heavy') heavy += Number(row.quantity) || 0
  }
  const heavyTotal = money(heavy * (Number(settings.heavyItemHandlingCharge) || 0))
  const estimatedAmount = money(scaled + heavyTotal)

  const itemLines = lineItems.map((row) => {
    const qty = Math.max(0, Number(row.quantity) || 0)
    const volUnit = Number(row.volumePerUnitM3) || 0
    const mult = Number(row.handlingMultiplier) > 0 ? Number(row.handlingMultiplier) : 1
    const lineVolumeM3 = money(qty * volUnit * mult)
    const share = totalM3 > 0 ? lineVolumeM3 / totalM3 : 0
    const lineAmountGbp = money(share * scaled)
    return {
      name: row.name,
      quantity: qty,
      line_volume_m3: lineVolumeM3,
      line_amount_gbp: lineAmountGbp,
      line_price_label: formatGbp(lineAmountGbp),
    }
  })

  return {
    estimatedAmount,
    totalM3,
    scaled,
    base,
    multiplier,
    bandLabel,
    heavyTotal,
    heavy,
    itemLines,
  }
}

type OperationalInput = {
  extra_floors?: number
  lift_available?: string
  stairs_flights?: number
  long_walking_distance?: boolean
  parking_issue?: boolean
  waiting_time_hours?: number
  dismantling_items?: number
  reassembly_items?: number
  extra_helpers?: number
}

type BreakdownLine = { label: string; amount: number; amount_label: string }

function operationalHasAny(op: OperationalInput): boolean {
  const floors = Math.max(0, Math.round(Number(op.extra_floors) || 0))
  const stairs = Math.max(0, Math.round(Number(op.stairs_flights) || 0))
  const lift = String(op.lift_available || 'na').toLowerCase()
  const waitH = Math.max(0, Number(op.waiting_time_hours) || 0)
  const dismantle = Math.max(0, Math.round(Number(op.dismantling_items) || 0))
  const reassembly = Math.max(0, Math.round(Number(op.reassembly_items) || 0))
  const helpers = Math.max(0, Math.round(Number(op.extra_helpers) || 0))
  return (
    floors > 0 ||
    stairs > 0 ||
    lift === 'no' ||
    lift === 'yes' ||
    Boolean(op.long_walking_distance) ||
    Boolean(op.parking_issue) ||
    waitH > 0 ||
    dismantle > 0 ||
    reassembly > 0 ||
    helpers > 0
  )
}

function calculateOperationalCharges(
  settings: Record<string, unknown>,
  op: OperationalInput,
): { total: number; lines: BreakdownLine[] } {
  const lines: BreakdownLine[] = []
  const floors = Math.max(0, Math.round(Number(op.extra_floors) || 0))
  const perFloor = Number(settings.floorChargePerFloor) || 0
  if (floors > 0 && perFloor > 0) {
    const amt = money(floors * perFloor)
    lines.push({
      label: `Extra floors (${floors})`,
      amount: amt,
      amount_label: formatGbp(amt),
    })
  }

  const lift = String(op.lift_available || 'na').toLowerCase()
  const noLift = Number(settings.noLiftCharge) || 0
  if (lift === 'no' && noLift > 0) {
    const amt = money(noLift)
    lines.push({ label: 'No lift supplement', amount: amt, amount_label: formatGbp(amt) })
  }
  const yesLift = Number(settings.yesLiftChargePerEnd) || 0
  if (lift === 'yes' && floors > 0 && yesLift > 0) {
    const amt = money(yesLift)
    lines.push({ label: 'Lift access', amount: amt, amount_label: formatGbp(amt) })
  }

  const stairs = Math.max(0, Math.round(Number(op.stairs_flights) || 0))
  const stairsRate = Number(settings.stairsChargePerFlight) || 0
  if (stairs > 0 && stairsRate > 0) {
    const amt = money(stairs * stairsRate)
    lines.push({
      label: `Stairs (${stairs} flight${stairs === 1 ? '' : 's'})`,
      amount: amt,
      amount_label: formatGbp(amt),
    })
  }

  if (op.long_walking_distance) {
    const w = Number(settings.longWalkingDistanceCharge) || 0
    if (w > 0) {
      const amt = money(w)
      lines.push({ label: 'Long walking distance', amount: amt, amount_label: formatGbp(amt) })
    }
  }

  if (op.parking_issue) {
    const p = Number(settings.parkingCharge) || 0
    if (p > 0) {
      const amt = money(p)
      lines.push({ label: 'Parking / access', amount: amt, amount_label: formatGbp(amt) })
    }
  }

  const waitH = Math.max(0, Number(op.waiting_time_hours) || 0)
  const waitRate = Number(settings.waitingTimePricePerHour) || 0
  if (waitH > 0 && waitRate > 0) {
    const amt = money(waitH * waitRate)
    lines.push({
      label: `Waiting time (${waitH} hr${waitH === 1 ? '' : 's'})`,
      amount: amt,
      amount_label: formatGbp(amt),
    })
  }

  const dismantleN = Math.max(0, Math.round(Number(op.dismantling_items) || 0))
  const dismantleRate =
    Number(settings.dismantlingPricePerItem ?? settings.dismantlingPrice) || 0
  if (dismantleN > 0 && dismantleRate > 0) {
    const amt = money(dismantleN * dismantleRate)
    lines.push({
      label: `Dismantling (${dismantleN} item${dismantleN === 1 ? '' : 's'})`,
      amount: amt,
      amount_label: formatGbp(amt),
    })
  }

  const reassemblyN = Math.max(0, Math.round(Number(op.reassembly_items) || 0))
  const reassembleRate =
    Number(settings.reassemblyPricePerItem ?? settings.reassemblyPrice) || 0
  if (reassemblyN > 0 && reassembleRate > 0) {
    const amt = money(reassemblyN * reassembleRate)
    lines.push({
      label: `Reassembly (${reassemblyN} item${reassemblyN === 1 ? '' : 's'})`,
      amount: amt,
      amount_label: formatGbp(amt),
    })
  }

  const helpers = Math.max(0, Math.round(Number(op.extra_helpers) || 0))
  const helperRate = Number(settings.extraHelperPrice) || 0
  if (helpers > 0 && helperRate > 0) {
    const amt = money(helpers * helperRate)
    lines.push({
      label: `Extra helper${helpers === 1 ? '' : 's'} (${helpers})`,
      amount: amt,
      amount_label: formatGbp(amt),
    })
  }

  const total = money(lines.reduce((sum, l) => sum + l.amount, 0))
  return { total, lines }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!url || !serviceKey) return json({ ok: false, error: 'server_misconfigured' }, 503)

    const admin = createClient(url, serviceKey)
    const body = (await req.json().catch(() => ({}))) as {
      items?: unknown[]
      operational?: OperationalInput
      access_charges?: OperationalInput
    }
    const rawItems = Array.isArray(body.items) ? body.items : []
    const operational =
      body.operational && typeof body.operational === 'object'
        ? body.operational
        : body.access_charges && typeof body.access_charges === 'object'
          ? body.access_charges
          : {}

    if (rawItems.length === 0 && !operationalHasAny(operational)) {
      return json({
        ok: true,
        engine_price_gbp: 0,
        price_label: '£0.00',
        estimated_amount: 0,
        added_volume_m3: 0,
        total_volume_label: '0 m³',
        added_items: [],
        breakdown: [],
      })
    }

    const [{ data: settingsRow }, { data: library }] = await Promise.all([
      admin.from('pricing_settings').select('data, updated_at').eq('id', 1).maybeSingle(),
      rawItems.length > 0
        ? admin.from('items_library').select('id, name, cubic_metres, weight_type, handling_multiplier')
        : Promise.resolve({ data: [] as LibRow[] }),
    ])

    const pricingData =
      settingsRow?.data && typeof settingsRow.data === 'object'
        ? (settingsRow.data as Record<string, unknown>)
        : null
    const settings = resolveDriverExtraChargePricing(pricingData)
    const pricingSource = 'main_engine'

    let itemsAmount = 0
    let totalM3 = 0
    let bandLabel = '0–3 m³'
    let multiplier = 1
    let added_items: Record<string, unknown>[] = []
    const breakdown: BreakdownLine[] = []

    if (rawItems.length > 0) {
      const resolved = resolveItems(rawItems, (library || []) as LibRow[])
      const lineItems: LineItem[] = resolved.map((r) => ({
        name: r.name,
        quantity: r.quantity,
        volumePerUnitM3: r.volumePerUnitM3,
        handlingMultiplier: r.handlingMultiplier,
        weightType: r.weightType,
      }))

      const calc = calculate(settings, lineItems)
      itemsAmount = calc.estimatedAmount
      totalM3 = calc.totalM3
      bandLabel = calc.bandLabel
      multiplier = calc.multiplier
      const lineByName = new Map(calc.itemLines.map((l) => [normName(l.name), l]))

      added_items = resolved.map((r) => {
        const line = lineByName.get(normName(r.name))
        return {
          name: r.name,
          quantity: r.quantity,
          volume_m3: r.volumePerUnitM3,
          volume_per_unit_m3: r.volumePerUnitM3,
          weight_type: r.weightType,
          library_item_id: r.matched?.id ?? null,
          matched_library: Boolean(r.matched),
          line_volume_m3: line?.line_volume_m3 ?? null,
          line_amount_gbp: line?.line_amount_gbp ?? null,
          line_price_label: line?.line_price_label ?? null,
        }
      })

      if (calc.scaled > 0) {
        breakdown.push({
          label: `Volume (${calc.totalM3} m³)`,
          amount: calc.scaled,
          amount_label: formatGbp(calc.scaled),
        })
      }
      if (calc.heavyTotal > 0) {
        breakdown.push({
          label: `Heavy handling (${calc.heavy})`,
          amount: calc.heavyTotal,
          amount_label: formatGbp(calc.heavyTotal),
        })
      }
    }

    const opCalc = calculateOperationalCharges(settings, operational)
    breakdown.push(...opCalc.lines)
    const estimatedAmount = money(itemsAmount + opCalc.total)

    return json({
      ok: true,
      engine_price_gbp: estimatedAmount,
      price_label: formatGbp(estimatedAmount),
      estimated_amount: estimatedAmount,
      added_volume_m3: totalM3,
      total_volume_label: `${totalM3} m³`,
      added_items,
      breakdown,
      volume_band: bandLabel,
      volume_multiplier: multiplier,
      items_subtotal_gbp: itemsAmount,
      operational_subtotal_gbp: opCalc.total,
      pricing_source: pricingSource,
      rates_used: getDriverRatesDebugSnapshot(settings, pricingData),
      pricing_settings_updated_at: settingsRow?.updated_at ?? null,
    })
  } catch (e) {
    console.error('[estimate-extra-charge]', e)
    return json({ ok: false, error: 'internal_error' }, 500)
  }
})
