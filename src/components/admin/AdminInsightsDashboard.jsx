import { Link } from 'react-router-dom'

function money(value) {
  return `£${Number(value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function signed(current, previous, suffix = '', invert = false) {
  if (current == null || previous == null) return null
  const diff = current - previous
  if (Math.abs(diff) < (suffix === '%' ? 0.5 : 0.005)) {
    return { text: 'Same as last month', tone: 'text-slate-500', last: previous }
  }
  const up = diff > 0
  const amount = suffix === '%'
    ? `${Math.abs(Math.round(diff))}%`
    : suffix === '£'
      ? money(Math.abs(diff))
      : Math.abs(diff) >= 1
        ? String(Math.abs(Math.round(diff)))
        : Math.abs(diff).toFixed(1)
  const improved = invert ? !up : up
  return {
    text: `${up ? '+' : '−'}${amount}`,
    tone: improved ? 'text-emerald-600' : 'text-red-600',
    last: previous,
  }
}

function InsightCard({ label, value, current, previous, suffix = '', lastText, hint, invert = false }) {
  const delta = signed(current, previous, suffix, invert)
  const last = delta?.last
  const lastLabel = lastText
    || (last == null
      ? ''
      : suffix === '£'
        ? `Last month ${money(last)}`
        : suffix === '%'
          ? `Last month ${Math.round(last)}%`
          : `Last month ${last}`)
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
      {delta ? <p className={`mt-1 text-xs font-semibold ${delta.tone}`}>{delta.text}</p> : null}
      {lastLabel ? <p className="mt-0.5 text-[11px] text-slate-400">{lastLabel}</p> : null}
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </article>
  )
}

function pctText(value) {
  return value == null ? '—' : `${value}%`
}

function Timing({ result }) {
  if (!result) return <span className="text-slate-400">—</span>
  const tone = result.state === 'late' ? 'text-red-600' : 'text-emerald-700'
  return (
    <span className={`font-semibold ${tone}`}>
      {result.label}
      {result.detail ? <span className="ml-1 font-normal text-slate-500">{result.detail}</span> : null}
    </span>
  )
}

function Sparkline({ points, color }) {
  const values = points.map((point) => point.value).filter((value) => value != null)
  const max = Math.max(...values, 1)
  const width = 320
  const height = 72
  const step = points.length > 1 ? width / (points.length - 1) : width
  let path = ''
  let open = false
  points.forEach((point, index) => {
    if (point.value == null) {
      open = false
      return
    }
    const x = index * step
    const y = height - 6 - (point.value / max) * (height - 16)
    path += `${open ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `
    open = true
  })
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-20 w-full" role="img">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function dayLabel(ymd) {
  if (!ymd) return '—'
  const date = new Date(`${ymd}T12:00:00Z`)
  return date.toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' })
}

export default function AdminInsightsDashboard({ model }) {
  const { current, previous, driverRows, jobRows, days } = model
  const pickupHint = current.pickupJudged
    ? `${current.pickupJudged} pickup${current.pickupJudged === 1 ? '' : 's'} with a booked time`
    : 'No arrival time against a booked slot yet'
  const deliveryHint = current.deliveryJudged
    ? `${current.deliveryJudged} deliver${current.deliveryJudged === 1 ? 'y' : 'ies'} with an arrival saved`
    : 'No delivery arrival saved yet'
  const ratedHint = current.jobs ? `${current.ratedCount} of ${current.jobs} rated` : 'No paid bookings this month'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">This month</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Paid bookings whose move date is this month. On-time pickup uses the booked arrival slot.
          A delivery is on time when the van arrival is saved on the move day.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InsightCard label="Jobs" value={String(current.jobs)} current={current.jobs} previous={previous.jobs} />
        <InsightCard
          label="On-time pickup"
          value={pctText(current.pickupPct)}
          current={current.pickupPct}
          previous={previous.pickupPct}
          suffix="%"
          hint={pickupHint}
        />
        <InsightCard
          label="Delivered on the day"
          value={pctText(current.deliveryPct)}
          current={current.deliveryPct}
          previous={previous.deliveryPct}
          suffix="%"
          hint={deliveryHint}
        />
        <InsightCard
          label="Rated jobs"
          value={pctText(current.ratedPct)}
          current={current.ratedPct}
          previous={previous.ratedPct}
          suffix="%"
          hint={ratedHint}
        />
        <InsightCard
          label="Average rating"
          value={current.rating == null ? '—' : current.rating.toFixed(1)}
          current={current.rating}
          previous={previous.rating}
          lastText={previous.rating == null ? '' : `Last month ${previous.rating.toFixed(1)}`}
        />
        <InsightCard
          label="Collected"
          value={money(current.collected)}
          current={current.collected}
          previous={previous.collected}
          suffix="£"
        />
        <InsightCard
          label="Cancelled on the day"
          value={pctText(current.cancelledPct)}
          current={current.cancelledPct}
          previous={previous.cancelledPct}
          suffix="%"
          hint={`${current.cancelledOnDay} bookings`}
          invert
        />
        <InsightCard
          label="Still open"
          value={String(current.open)}
          current={current.open}
          previous={previous.open}
          hint="Not finished and not cancelled"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Drivers</h3>
          <p className="text-xs text-slate-500">Jobs, ratings, and arrival times for this month.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Driver</th>
                <th className="px-3 py-2">Jobs</th>
                <th className="px-3 py-2">Rated</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">On-time pickup</th>
                <th className="px-3 py-2">On-time delivery</th>
              </tr>
            </thead>
            <tbody>
              {driverRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-sm text-slate-500">No assigned driver on this month’s bookings.</td>
                </tr>
              ) : driverRows.map((driver) => (
                <tr key={driver.name} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{driver.name}</td>
                  <td className="px-3 py-2.5 tabular-nums">{driver.jobs}</td>
                  <td className="px-3 py-2.5 tabular-nums">{driver.rated}</td>
                  <td className="px-3 py-2.5 tabular-nums">{driver.rating == null ? '—' : driver.rating.toFixed(1)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{driver.pickupPct == null ? '—' : `${driver.pickupPct}%`}</td>
                  <td className="px-3 py-2.5 tabular-nums">{driver.deliveryPct == null ? '—' : `${driver.deliveryPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Jobs</h3>
          <p className="text-xs text-slate-500">Latest bookings this month. Early and on time both count as on time.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Job</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">Pickup</th>
                <th className="px-3 py-2">Planned</th>
                <th className="px-3 py-2">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {jobRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-slate-500">No paid bookings with a move date this month.</td>
                </tr>
              ) : jobRows.map((job) => (
                <tr key={job.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">
                    <Link to={job.href} className="font-mono text-xs font-semibold text-brand-700 hover:underline">{job.ref}</Link>
                    <p className="max-w-[10rem] truncate text-xs text-slate-500">{job.customer}</p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-800">{job.driver}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{dayLabel(job.day)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{job.rating == null ? '—' : job.rating.toFixed(1)}</td>
                  <td className="px-3 py-2.5"><Timing result={job.pickup} /></td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-700">{job.planned}</td>
                  <td className="px-3 py-2.5"><Timing result={job.delivery} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Trends · last 30 days</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Jobs</p>
            <Sparkline points={days.map((day) => ({ value: day.jobs }))} color="#0f766e" />
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">On-time pickup</p>
            <Sparkline points={days.map((day) => ({ value: day.pickupPct }))} color="#2563eb" />
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Collected</p>
            <Sparkline points={days.map((day) => ({ value: day.collected }))} color="#7c3aed" />
          </article>
        </div>
      </section>
    </div>
  )
}
