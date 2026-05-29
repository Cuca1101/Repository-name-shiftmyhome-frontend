/**
 * Estimate extra charge for driver "Add item" list (Items Library + pricing settings).
 * POST { items: [{ name, quantity, volume_m3?, library_item_id? }], quote_id?: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!url || !serviceKey) return json({ ok: false, error: 'server_misconfigured' }, 503)

    const admin = createClient(url, serviceKey)
    const body = (await req.json().catch(() => ({}))) as { items?: unknown[] }
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (rawItems.length === 0) {
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
      admin.from('pricing_settings').select('data').eq('id', 1).maybeSingle(),
      admin.from('items_library').select('id, name, cubic_metres, weight_type, handling_multiplier'),
    ])

    const settings =
      settingsRow?.data && typeof settingsRow.data === 'object'
        ? (settingsRow.data as Record<string, unknown>)
        : {}

    const resolved = resolveItems(rawItems, (library || []) as LibRow[])
    const lineItems: LineItem[] = resolved.map((r) => ({
      name: r.name,
      quantity: r.quantity,
      volumePerUnitM3: r.volumePerUnitM3,
      handlingMultiplier: r.handlingMultiplier,
      weightType: r.weightType,
    }))

    const calc = calculate(settings, lineItems)
    const lineByName = new Map(calc.itemLines.map((l) => [normName(l.name), l]))

    const added_items = resolved.map((r) => {
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

    const breakdown = [
      {
        label: `Volume (${calc.totalM3} m³)`,
        amount: calc.scaled,
        amount_label: formatGbp(calc.scaled),
      },
      ...(calc.heavyTotal > 0
        ? [
            {
              label: `Heavy handling (${calc.heavy})`,
              amount: calc.heavyTotal,
              amount_label: formatGbp(calc.heavyTotal),
            },
          ]
        : []),
    ]

    return json({
      ok: true,
      /** Show this on Add Item screen (large text). */
      engine_price_gbp: calc.estimatedAmount,
      price_label: formatGbp(calc.estimatedAmount),
      estimated_amount: calc.estimatedAmount,
      added_volume_m3: calc.totalM3,
      total_volume_label: `${calc.totalM3} m³`,
      added_items,
      breakdown,
      volume_band: calc.bandLabel,
      volume_multiplier: calc.multiplier,
    })
  } catch (e) {
    console.error('[estimate-extra-charge]', e)
    return json({ ok: false, error: 'internal_error' }, 500)
  }
})
