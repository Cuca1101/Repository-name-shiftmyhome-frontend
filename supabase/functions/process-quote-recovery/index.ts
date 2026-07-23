import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  kindForAbandonedCount,
  sendRecoveryEmailForLead,
  type LeadLike,
  type RecoveryEmailKind,
} from '../_shared/quoteRecoveryEmail.ts'

/**
 * Cron / admin batch processor for abandoned quote + payment recovery emails.
 *
 * Auth: Authorization Bearer <CRON_SECRET or service role>
 * Body (optional): { lead_id?: string, kind?: string, force?: boolean }
 *
 * Cron: every 10 minutes → POST this function with CRON_SECRET.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOG = '[process-quote-recovery]'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function authorized(req: Request) {
  const cronSecret = (Deno.env.get('CRON_SECRET') || Deno.env.get('QUOTE_RECOVERY_CRON_SECRET') || '').trim()
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const auth = req.headers.get('Authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (cronSecret && bearer === cronSecret) return 'cron'
  if (serviceKey && bearer === serviceKey) return 'service'
  if (bearer && bearer.length > 40) return 'jwt'
  return false
}

Deno.serve(async (req) => {
  const started = Date.now()
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  const auth = authorized(req)
  if (!auth) {
    console.error(LOG, 'unauthorized request')
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const siteUrl = (Deno.env.get('SITE_URL') || '').trim()
  const resendConfigured = Boolean((Deno.env.get('RESEND_API_KEY') || '').trim())

  if (!supabaseUrl || !serviceKey) {
    console.error(LOG, 'server_misconfigured: missing SUPABASE_URL or SERVICE_ROLE_KEY')
    return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)
  }
  if (!resendConfigured) {
    console.error(LOG, 'RESEND_API_KEY missing — emails cannot send')
  }
  if (!siteUrl) {
    console.warn(LOG, 'SITE_URL missing — resume/pay links may be wrong')
  }

  console.log(LOG, 'start', {
    auth,
    siteUrl: siteUrl || null,
    resendConfigured,
    elapsed_ms_so_far: Date.now() - started,
  })

  try {
    const supabase = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({}))

    // Manual single-lead send (admin)
    if (typeof body?.lead_id === 'string' && body.lead_id.trim()) {
      const leadId = body.lead_id.trim()
      console.log(LOG, 'manual send', { leadId, kind: body.kind || null, force: Boolean(body.force) })
      const { data: lead, error } = await supabase
        .from('customer_leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle()
      if (error || !lead) {
        console.error(LOG, 'lead_not_found', { leadId, error: error?.message })
        return jsonResponse({ ok: false, error: 'lead_not_found' }, 404)
      }
      if (lead.status === 'converted_to_booking' || lead.recovery_stopped_at) {
        console.warn(LOG, 'already_converted', { leadId, status: lead.status })
        return jsonResponse({ ok: false, error: 'already_converted' }, 400)
      }

      let kind = (typeof body.kind === 'string' ? body.kind : '') as RecoveryEmailKind | ''
      if (!kind) {
        if (lead.status === 'payment_failed') kind = 'payment_failed'
        else kind = kindForAbandonedCount(Number(lead.recovery_emails_sent_count || 0)) || 'abandoned'
      }

      const result = await sendRecoveryEmailForLead({
        supabase,
        lead: lead as LeadLike,
        kind,
        force: Boolean(body.force),
      })
      if (!result.ok) {
        console.error(LOG, 'manual send failed', { leadId, kind, error: result.error })
      } else {
        console.log(LOG, 'manual send ok', { leadId, kind, resendId: result.resendId })
      }
      return jsonResponse(result, result.ok ? 200 : 500)
    }

    // Batch: mark stale → send due emails
    const { data: markedCount, error: markErr } = await supabase.rpc(
      'mark_stale_customer_leads_abandoned',
      { p_inactive_minutes: 15 },
    )
    if (markErr) {
      console.error(LOG, 'mark_stale failed', markErr.message)
    } else {
      console.log(LOG, 'mark_stale ok', { marked: markedCount })
    }

    const nowIso = new Date().toISOString()
    const { data: dueRows, error: dueErr } = await supabase
      .from('customer_leads')
      .select('*')
      .in('status', ['abandoned', 'payment_failed'])
      .is('recovery_stopped_at', null)
      .not('customer_email', 'is', null)
      .lte('next_recovery_email_at', nowIso)
      .order('next_recovery_email_at', { ascending: true })
      .limit(40)

    if (dueErr) {
      console.error(LOG, 'due query failed', dueErr.message)
      return jsonResponse({ ok: false, error: dueErr.message }, 500)
    }

    console.log(LOG, 'due leads', { count: (dueRows || []).length })

    const results: Array<{ id: string; ok: boolean; kind?: string; error?: string; skipped?: boolean }> = []

    for (const row of dueRows || []) {
      const lead = row as LeadLike & {
        status?: string
        recovery_emails_sent_count?: number
        last_recovery_email_kind?: string | null
      }
      let kind: RecoveryEmailKind | null = null
      const lastKind = String(lead.last_recovery_email_kind || '')
      // One payment-failed retry email, even if abandoned emails were already sent.
      if (lead.status === 'payment_failed' && lastKind !== 'payment_failed') {
        kind = 'payment_failed'
      } else if (lead.status === 'abandoned') {
        kind = kindForAbandonedCount(Number(lead.recovery_emails_sent_count || 0))
      }
      if (!kind) {
        await supabase
          .from('customer_leads')
          .update({ next_recovery_email_at: null, updated_at: nowIso })
          .eq('id', lead.id)
        results.push({ id: lead.id, ok: true, kind: 'done', skipped: true })
        continue
      }

      try {
        const result = await sendRecoveryEmailForLead({ supabase, lead, kind, force: false })
        if (!result.ok) {
          console.error(LOG, 'send failed', {
            leadId: lead.id,
            kind,
            error: result.error,
            email: lead.customer_email,
          })
        } else if (result.skipped) {
          console.warn(LOG, 'send skipped duplicate', { leadId: lead.id, kind })
        } else {
          console.log(LOG, 'send ok', {
            leadId: lead.id,
            kind,
            resendId: result.resendId,
            sentCount: Number(lead.recovery_emails_sent_count || 0) + 1,
          })
        }
        results.push({
          id: lead.id,
          ok: result.ok,
          kind,
          error: result.error,
          skipped: Boolean(result.skipped),
        })
      } catch (sendErr) {
        const message = sendErr instanceof Error ? sendErr.message : String(sendErr)
        console.error(LOG, 'send threw', { leadId: lead.id, kind, message })
        results.push({ id: lead.id, ok: false, kind, error: message })
      }
    }

    const summary = {
      ok: true,
      processed: results.length,
      sent: results.filter((r) => r.ok && !r.skipped).length,
      failed: results.filter((r) => !r.ok).length,
      elapsed_ms: Date.now() - started,
      results,
    }
    console.log(LOG, 'complete', summary)
    return jsonResponse(summary)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(LOG, 'fatal', message)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
