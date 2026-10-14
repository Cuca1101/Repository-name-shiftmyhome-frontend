import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

type InventoryLine = { name: string; quantity: number; lineM3: number; weight: string }

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

export function recoveryLeadInventoryLines(lead: Record<string, unknown>): InventoryLine[] {
  const step2 = obj(obj(lead.wizard_data).step2)
  const raw = Array.isArray(step2.inventoryLines) ? step2.inventoryLines : []
  const out: InventoryLine[] = []
  for (const entry of raw) {
    const line = obj(entry)
    const baseName = String(line.name || '').trim()
    if (!baseName) continue
    const quantity = Math.max(1, Math.round(num(line.quantity)) || 1)
    const category = String(line.categoryLabel || '').trim()
    const perItem = num(line.m3)
    const mult = num(line.mult)
    const lineM3 = Number.isFinite(perItem) ? perItem * quantity * (Number.isFinite(mult) && mult > 0 ? mult : 1) : 0
    out.push({
      name: category ? `${baseName} [${category}]` : baseName,
      quantity,
      lineM3: Math.round(lineM3 * 100) / 100,
      weight: String(line.weightType || '').trim(),
    })
  }
  return out
}

export function recoveryLeadVolumeM3(lead: Record<string, unknown>, lines: InventoryLine[]): number {
  const fromLead = num(lead.total_volume_m3)
  if (fromLead > 0) return fromLead
  const fromWizard = num(obj(obj(lead.wizard_data).step2).totalVolumeM3)
  if (fromWizard > 0) return fromWizard
  return Math.round(lines.reduce((sum, l) => sum + l.lineM3, 0) * 100) / 100
}

function isEmptyInventory(v: unknown): boolean {
  if (v == null) return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'string') return !v.trim() || v.trim() === '[]'
  return false
}

/**
 * Quotes created by create-recovery-checkout only copy contact/route fields. Fill inventory,
 * volume and pricing from the customer lead so Available Jobs and the admin alert have the items.
 * Only fills empty fields; the inventory claim makes concurrent webhook + verify calls safe.
 */
export async function backfillRecoveryQuoteFromLead(
  supabase: SupabaseClient,
  quoteId: string,
  leadId: string,
): Promise<{ inventory: boolean; pricing: boolean }> {
  const result = { inventory: false, pricing: false }
  const [{ data: quote }, { data: lead }] = await Promise.all([
    supabase.from('quotes').select('id, inventory, pricing, crew_size').eq('id', quoteId).maybeSingle(),
    supabase.from('customer_leads').select('id, quote_id, total_volume_m3, wizard_data').eq('id', leadId).maybeSingle(),
  ])
  if (!quote?.id || !lead?.id) return result
  if (lead.quote_id && String(lead.quote_id) !== String(quote.id)) return result

  const lines = recoveryLeadInventoryLines(lead as Record<string, unknown>)
  const volume = recoveryLeadVolumeM3(lead as Record<string, unknown>, lines)

  if (lines.length && isEmptyInventory(quote.inventory)) {
    const { count } = await supabase
      .from('quote_inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', quoteId)
    if (!count) {
      const summary = lines
        .map((l) => `  • ${l.name} ×${l.quantity}  (~${l.lineM3} m³ line vol${l.weight ? `, ${l.weight}` : ''})`)
        .join('\n')
      const inventory = [{ summary }]
      const claim = (q: ReturnType<SupabaseClient['from']>) =>
        q.update({ inventory }).eq('id', quoteId)
      let { data: claimed } = await claim(supabase.from('quotes')).is('inventory', null).select('id')
      if (!claimed?.length) {
        ;({ data: claimed } = await claim(supabase.from('quotes')).eq('inventory', '[]').select('id'))
      }
      if (claimed?.length) {
        const { error } = await supabase.from('quote_inventory_items').insert(
          lines.map((l) => ({
            quote_id: quoteId,
            item_name: l.name,
            quantity: l.quantity,
            volume_m3: l.lineM3,
            notes: l.weight || null,
          })),
        )
        if (error) console.error('[recoveryQuoteBackfill] inventory items insert failed', error.message)
        result.inventory = !error
      }
    }
  }

  if (volume > 0 && !String(quote.pricing || '').trim()) {
    const { data: priced } = await supabase
      .from('quotes')
      .update({ pricing: `Volume: (total ${volume.toFixed(2)} m³)` })
      .eq('id', quoteId)
      .is('pricing', null)
      .select('id')
    result.pricing = Boolean(priced?.length)
  }

  return result
}
