import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { fetchAllJobs } from '../lib/data/jobsRepository'
import { fetchAllDriverCharges } from '../lib/data/driverChargesRepository'
import { fetchAllDriverPayoutAudits } from '../lib/data/driverPayoutAuditRepository'
import { loadFleetDriversForAdmin } from '../lib/adminFleetDrivers'
import DriverPaymentsDriverLedger from '../components/admin-driver-payments/DriverPaymentsDriverLedger'
import DriverChargesList from '../components/admin-driver-charges/DriverChargesList'
import DriverChargeModal from '../components/admin-driver-charges/DriverChargeModal'

const card =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5'

export default function DriverPaymentsAdmin() {
  const [searchParams] = useSearchParams()
  const filterDriverId = searchParams.get('driver') || ''
  const filterQuoteRef = searchParams.get('ref') || ''
  const [quotes, setQuotes] = useState([])
  const [jobs, setJobs] = useState([])
  const [charges, setCharges] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addChargeDriver, setAddChargeDriver] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [q, j, c, a, d] = await Promise.all([
        fetchQuotesForAdmin('all', ''),
        fetchAllJobs(),
        fetchAllDriverCharges(),
        fetchAllDriverPayoutAudits(),
        loadFleetDriversForAdmin(),
      ])
      setQuotes(Array.isArray(q) ? q : [])
      setJobs(Array.isArray(j) ? j : [])
      setCharges(Array.isArray(c) ? c : [])
      setAuditLogs(Array.isArray(a) ? a : [])
      setDrivers(Array.isArray(d) ? d : [])
    } catch (e) {
      setError(e?.message || 'Failed to load driver payments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className={card}>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Driver payments</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Driver-first payout ledger and platform accounting evidence. Expand a driver to see every job,
          platform profit, payout overrides, and settlement actions. Customer totals and Stripe are never
          changed here.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <DriverPaymentsDriverLedger
            quotes={quotes}
            charges={charges}
            jobs={jobs}
            drivers={drivers}
            auditLogs={auditLogs}
            onUpdated={load}
            initialDriverId={filterDriverId}
            initialQuoteRef={filterQuoteRef}
          />

          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">Recent driver charges</h2>
              <button
                type="button"
                onClick={() => setAddChargeDriver('pick')}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900"
              >
                Add charge
              </button>
            </div>
            <DriverChargesList
              charges={charges}
              onUpdated={load}
              showFilters
              maxItems={50}
            />
          </div>
        </>
      )}

      <DriverChargeModal
        open={Boolean(addChargeDriver)}
        onClose={() => setAddChargeDriver('')}
        onSaved={load}
        initialDriverId={addChargeDriver === 'pick' ? '' : addChargeDriver}
      />
    </div>
  )
}
