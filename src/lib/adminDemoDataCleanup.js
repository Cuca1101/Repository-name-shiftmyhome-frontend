import { cancelBookingForQuote } from './cancelDemoBooking'
import {
  filterJourneysForProductionInbox,
  filterQuotesForProductionInbox,
  isQuoteLaunchArchiveCandidate,
  isQuoteSafeForTestArchive,
  shouldHideJourneyFromAdminInbox,
  shouldHideQuoteFromAdminInbox,
} from './demoTestRecordDetection'
import {
  fetchLiveLaunchCleanupStats,
  runLiveLaunchCleanupBatch,
} from './data/adminLiveLaunchCleanupRepository'
import { fetchAllDriverCharges, updateDriverCharge } from './data/driverChargesRepository'
import { fetchAllJourneysForAdmin, updateJourneyRow } from './data/journeysRepository'
import { deleteJobPhotosForQuoteRef } from './data/jobPhotosRepository'
import { fetchAllJobs, updateJob } from './data/jobsRepository'
import { fetchQuotesForAdmin } from './data/quotesAdminRepository'
import { updateQuoteWorkflowAssignmentSilent } from './data/quotesAdminRepository'
import { runWebsiteFunnelCleanup } from './data/websiteFunnelCleanupRepository'
import { isSupabaseConfigured } from './supabase'

export const LIVE_LAUNCH_CONFIRMATION_TEXT = 'CLEAN LIVE ADMIN'

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} journeys
 * @param {Record<string, unknown>[]} [jobs]
 * @param {{ funnelEvents?: number, funnelLeads?: number, photos?: number, charges?: number }} [extra]
 */
export function buildAdminCleanupPreview(quotes, journeys, jobs = [], extra = {}) {
  const quoteRows = (Array.isArray(quotes) ? quotes : []).filter((q) =>
    isQuoteSafeForTestArchive(q),
  )
  const hiddenQuotes = (Array.isArray(quotes) ? quotes : []).filter((q) =>
    shouldHideQuoteFromAdminInbox(q),
  )
  const journeyRows = (Array.isArray(journeys) ? journeys : []).filter(
    (j) => !shouldHideJourneyFromAdminInbox(j),
  )
  const protectedQuotes = (Array.isArray(quotes) ? quotes : []).filter(
    (q) => isQuoteLaunchArchiveCandidate(q) === false,
  )

  const archiveRefs = new Set(quoteRows.map((q) => String(q.quote_ref || '').trim()).filter(Boolean))
  const linkedJobs = (Array.isArray(jobs) ? jobs : []).filter((j) => {
    const pi = j?.price_inputs
    const ref =
      pi && typeof pi === 'object' && pi.quoteRef != null ? String(pi.quoteRef).trim() : ''
    return ref && archiveRefs.has(ref)
  })

  return {
    archiveQuotes: quoteRows,
    archiveQuoteCount: quoteRows.length,
    hiddenInboxQuotes: hiddenQuotes.length,
    testJourneys: journeyRows,
    testJourneyCount: journeyRows.length,
    protectedQuotes: protectedQuotes.length,
    protectedSkipped: protectedQuotes.length,
    linkedJobCards: linkedJobs.length,
    funnelEvents: extra.funnelEvents ?? null,
    funnelLeads: extra.funnelLeads ?? null,
    testPhotos: extra.photos ?? null,
    testCharges: extra.charges ?? null,
  }
}

/**
 * @param {Record<string, unknown>[]} rows
 */
export function exportQuotesCleanupCsv(rows) {
  const header = [
    'id',
    'quote_ref',
    'full_name',
    'email',
    'payment_status',
    'status',
    'stripe_payment_intent_id',
  ]
  const lines = [header.join(',')]
  for (const q of rows) {
    lines.push(
      [
        q.id,
        q.quote_ref,
        q.full_name,
        q.email,
        q.payment_status,
        q.status,
        q.stripe_payment_intent_id,
      ]
        .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
  }
  return lines.join('\n')
}

/**
 * @param {string} csv
 * @param {string} filename
 */
export function downloadCleanupCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * @param {Record<string, unknown>[]} archiveQuotes
 */
async function archiveQuotesClientSide(archiveQuotes) {
  let archived = 0
  /** @type {string[]} */
  const errors = []

  for (const q of archiveQuotes) {
    const id = String(q.id || '').trim()
    if (!id) continue
    try {
      const op = String(q.operational_status || '').toLowerCase()
      const cancelled = q.cancelled_at || op === 'cancelled'
      if (!cancelled) {
        await cancelBookingForQuote(id, q, { reason: 'PRE-LAUNCH TEST DATA ARCHIVED' })
      } else if (isSupabaseConfigured) {
        await updateQuoteWorkflowAssignmentSilent(id, { is_test: true })
      }
      archived += 1
    } catch (e) {
      errors.push(`${q.quote_ref || id}: ${e?.message || 'failed'}`)
    }
  }
  return { archived, errors }
}

/**
 * @param {Record<string, unknown>[]} journeys
 */
async function archiveJourneysClientSide(journeys) {
  let journeysHidden = 0
  if (!isSupabaseConfigured) return journeysHidden

  for (const j of journeys) {
    const id = String(j.id || '').trim()
    if (!id) continue
    try {
      await updateJourneyRow(id, {
        marketplace_visibility: 'hidden_from_partners',
        status: 'cancelled',
      })
      journeysHidden += 1
    } catch {
      /* skip */
    }
  }
  return journeysHidden
}

/**
 * @param {Set<string>} archiveRefs
 * @param {Record<string, unknown>[]} jobs
 */
async function cancelLinkedJobCards(archiveRefs, jobs) {
  let updated = 0
  for (const j of jobs) {
    const pi = j?.price_inputs
    const ref =
      pi && typeof pi === 'object' && pi.quoteRef != null ? String(pi.quoteRef).trim() : ''
    if (!ref || !archiveRefs.has(ref)) continue
    const id = String(j.id || '').trim()
    if (!id) continue
    try {
      await updateJob(id, { status: 'Cancelled' })
      updated += 1
    } catch {
      /* skip */
    }
  }
  return updated
}

/**
 * @param {string[]} quoteIds
 */
async function waiveChargesForQuoteIds(quoteIds) {
  if (!quoteIds.length || !isSupabaseConfigured) return 0
  const all = await fetchAllDriverCharges()
  let waived = 0
  const idSet = new Set(quoteIds)
  for (const c of all) {
    if (!c.quoteId || !idSet.has(c.quoteId)) continue
    if (c.status === 'waived' || c.status === 'cancelled') continue
    try {
      await updateDriverCharge(c.id, { status: 'waived', notes: 'Waived — pre-launch test cleanup' })
      waived += 1
    } catch {
      /* skip */
    }
  }
  return waived
}

/**
 * @param {string[]} quoteRefs
 */
async function deletePhotosForQuoteRefs(quoteRefs) {
  let deleted = 0
  for (const ref of quoteRefs) {
    try {
      const r = await deleteJobPhotosForQuoteRef(ref)
      deleted += r.deleted
    } catch {
      /* skip */
    }
  }
  return deleted
}

/**
 * @param {{
 *   archiveQuotes?: boolean,
 *   hideTestJourneys?: boolean,
 *   clearFunnel?: boolean,
 *   clearJobPhotos?: boolean,
 *   waiveCharges?: boolean,
 *   cancelJobCards?: boolean,
 *   useServerBatch?: boolean,
 *   onProgress?: (msg: string) => void,
 * }} opts
 */
export async function runAdminTestDataCleanup(opts = {}) {
  const onProgress = opts.onProgress || (() => {})

  const [quotes, journeys, jobs] = await Promise.all([
    fetchQuotesForAdmin('all', ''),
    fetchAllJourneysForAdmin(),
    fetchAllJobs(),
  ])

  let serverStats = null
  try {
    serverStats = await fetchLiveLaunchCleanupStats()
  } catch {
    serverStats = null
  }

  const preview = buildAdminCleanupPreview(quotes, journeys, jobs, {
    photos: previewPhotoEstimate(quotes),
    charges: previewChargeEstimate(quotes),
  })

  /** @type {string[]} */
  const errors = []
  let archived = 0
  let journeysHidden = 0
  let jobCardsCancelled = 0
  let photosDeleted = 0
  let chargesWaived = 0
  let funnelEvents = 0
  let funnelLeads = 0

  const stamp = new Date().toISOString().slice(0, 10)
  downloadCleanupCsv(exportQuotesCleanupCsv(preview.archiveQuotes), `smh-prelaunch-quotes-${stamp}.csv`)

  const archiveRefs = new Set(
    preview.archiveQuotes.map((q) => String(q.quote_ref || '').trim()).filter(Boolean),
  )
  const archiveIds = preview.archiveQuotes.map((q) => String(q.id || '').trim()).filter(Boolean)

  if (opts.archiveQuotes !== false) {
    if (opts.useServerBatch !== false && isSupabaseConfigured) {
      onProgress('Archiving quotes (server)…')
      let pass = 0
      while (pass < 80) {
        pass += 1
        try {
          const batch = await runLiveLaunchCleanupBatch(200)
          archived += batch.quotesArchived
          journeysHidden += batch.journeysArchived
          if (batch.quotesArchived === 0 && batch.journeysArchived === 0) break
        } catch (e) {
          if (pass === 1) {
            onProgress('Server batch unavailable — using client archive…')
            const client = await archiveQuotesClientSide(preview.archiveQuotes)
            archived = client.archived
            errors.push(...client.errors)
          } else {
            errors.push(e?.message || 'Server batch failed')
          }
          break
        }
      }
    } else {
      onProgress('Archiving quotes…')
      const client = await archiveQuotesClientSide(preview.archiveQuotes)
      archived = client.archived
      errors.push(...client.errors)
    }
  }

  if (opts.hideTestJourneys !== false && journeysHidden === 0) {
    onProgress('Archiving journeys…')
    const toArchive = preview.testJourneys
    journeysHidden = await archiveJourneysClientSide(toArchive)
  }

  if (opts.cancelJobCards !== false) {
    onProgress('Cancelling linked job cards…')
    jobCardsCancelled = await cancelLinkedJobCards(archiveRefs, jobs)
  }

  if (opts.waiveCharges !== false) {
    onProgress('Waiving test driver charges…')
    chargesWaived = await waiveChargesForQuoteIds(archiveIds)
  }

  if (opts.clearJobPhotos !== false) {
    onProgress('Removing test job photos…')
    photosDeleted = await deletePhotosForQuoteRefs([...archiveRefs])
  }

  if (opts.clearFunnel !== false) {
    onProgress('Clearing website funnel test data…')
    try {
      const funnel = await runWebsiteFunnelCleanup({
        olderThanDays: 7,
        clearEvents: true,
        clearAbandoned: true,
        clearDemo: true,
        onProgress,
      })
      funnelEvents = funnel.eventsDeleted
      funnelLeads = funnel.leadsDeleted
    } catch (e) {
      errors.push(`Funnel: ${e?.message || 'failed'}`)
    }
  }

  const quotesAfter = filterQuotesForProductionInbox(await fetchQuotesForAdmin('all', ''))
  const journeysAfter = filterJourneysForProductionInbox(await fetchAllJourneysForAdmin())

  return {
    preview,
    serverStats,
    archived,
    journeysHidden,
    jobCardsCancelled,
    photosDeleted,
    chargesWaived,
    funnelEvents,
    funnelLeads,
    errors,
    quotesAfter,
    journeysAfter,
  }
}

/**
 * @param {Record<string, unknown>[]} quotes
 */
function previewPhotoEstimate(quotes) {
  return quotes.filter((q) => isQuoteSafeForTestArchive(q)).length
}

/**
 * @param {Record<string, unknown>[]} quotes
 */
function previewChargeEstimate(quotes) {
  return quotes.filter((q) => isQuoteSafeForTestArchive(q)).length
}
