import { useMemo, useState } from 'react'
import {
  defaultServicePackages,
  quoteServicePackageTotals,
  validateServicePackageSettings,
} from '../../lib/servicePackages'

const FIELDS = [
  ['percentage', 'Percentage surcharge (%)', 'number', '0.1'],
  ['minimumFee', 'Minimum package fee (£)', 'number', '0.01'],
  ['maxForgottenItems', 'Maximum forgotten small items', 'number', '1'],
  ['maxForgottenVolumeM3', 'Maximum forgotten-item volume (m³)', 'number', '0.1'],
  ['wrappingItems', 'Extra protective wrapping (items)', 'number', '1'],
  ['dismantleItems', 'Dismantling / reassembly items included', 'number', '1'],
  ['waitingMinutes', 'Included waiting time (minutes)', 'number', '1'],
  ['displayOrder', 'Display order', 'number', '1'],
]

function setPackage(settings, id, patch) {
  return {
    ...settings,
    servicePackages: {
      ...(settings.servicePackages || {}),
      [id]: {
        ...((settings.servicePackages || {})[id] || {}),
        ...patch,
      },
    },
  }
}

function PackageCardEditor({ id, pkg, onChange }) {
  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

  function setField(key, value) {
    onChange({ [key]: value })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-base font-bold capitalize text-slate-900">{id}</h4>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={pkg.enabled !== false}
            onChange={(e) => setField('enabled', e.target.checked)}
          />
          Enabled
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Display name</span>
          <input className={inputClass} value={pkg.displayName || ''} onChange={(e) => setField('displayName', e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Badge text</span>
          <input className={inputClass} value={pkg.badge || ''} onChange={(e) => setField('badge', e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Description</span>
          <input className={inputClass} value={pkg.description || ''} onChange={(e) => setField('description', e.target.value)} />
        </label>
        {FIELDS.map(([key, label, , step]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">{label}</span>
            <input
              type="number"
              min="0"
              step={step}
              className={inputClass}
              value={pkg[key] ?? 0}
              onChange={(e) => setField(key, e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={Boolean(pkg.prioritySupport)}
            onChange={(e) => setField('prioritySupport', e.target.checked)}
          />
          Priority support
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Customer-facing terms</span>
          <textarea
            rows={3}
            className={inputClass}
            value={pkg.customerTerms || ''}
            onChange={(e) => setField('customerTerms', e.target.value)}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Customer-facing exclusions (one per line)</span>
          <textarea
            rows={4}
            className={inputClass}
            value={pkg.exclusionsText || ''}
            onChange={(e) => setField('exclusionsText', e.target.value)}
          />
        </label>
      </div>
    </div>
  )
}

export default function ServicePackagesAdminSection({ settings, onChange, dirty, saving, message }) {
  const [sampleBase, setSampleBase] = useState(85)
  const errors = useMemo(() => validateServicePackageSettings(settings), [settings])
  const preview = useMemo(
    () => quoteServicePackageTotals(sampleBase, settings),
    [sampleBase, settings],
  )
  const premium = settings.servicePackages?.premium || {}
  const platinum = settings.servicePackages?.platinum || {}

  return (
    <section className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Service Packages</h3>
          <p className="mt-1 text-sm text-slate-600">
            Premium and Platinum fees are a percentage of the date base quote, or the minimum fee, whichever is higher.
            Standard stays included.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Unsaved changes</span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Saved</span>
          )}
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            onClick={() => onChange({ ...settings, servicePackages: defaultServicePackages() })}
          >
            Reset to defaults
          </button>
          <button
            type="submit"
            disabled={saving || errors.length > 0}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {errors.length ? (
        <ul className="mt-3 list-disc space-y-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      {message?.text ? (
        <p
          className={`mt-3 rounded-xl px-4 py-3 text-sm ${
            message.type === 'error' ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <PackageCardEditor
          id="premium"
          pkg={premium}
          onChange={(patch) => onChange(setPackage(settings, 'premium', patch))}
        />
        <PackageCardEditor
          id="platinum"
          pkg={platinum}
          onChange={(patch) => onChange(setPackage(settings, 'platinum', patch))}
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-bold text-slate-900">Live pricing preview</h4>
        <label className="mt-2 block max-w-xs text-sm">
          <span className="mb-1 block font-medium text-slate-700">Sample base quote (£)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={sampleBase}
            onChange={(e) => setSampleBase(Number(e.target.value) || 0)}
          />
        </label>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {preview.map((row) => (
            <li key={row.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <p className="font-semibold text-slate-900">{row.name}</p>
              <p className="text-slate-600">Fee {row.fee > 0 ? `£${row.fee.toFixed(2)}` : 'Included'}</p>
              <p className="text-base font-bold tabular-nums text-slate-900">£{row.total.toFixed(2)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
