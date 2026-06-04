import { useCallback, useEffect, useMemo, useState } from 'react'
import SeoGooglePreview from './SeoGooglePreview'
import {
  SEO_DASHBOARD_HOMEPAGE,
  SEO_DASHBOARD_ALL_PAGES,
  SEO_DASHBOARD_CATEGORIES,
  SEO_SITE_ORIGIN_DEFAULT,
  buildSeoSettingsFallback,
  formStateToSeoRow,
  mergeSeoSettingsForDef,
  seoRowToFormState,
  validateSeoForm,
} from '../../lib/seoSettingsDefaults'
import {
  fetchSeoSettingsAdminMap,
  getSitemapLastGenerated,
  saveSitemapGeneratedAt,
  upsertSeoSettingsRow,
} from '../../lib/data/seoSettingsRepository'
import { buildSitemapXml } from '../../lib/generateSitemapXml'

const TABS = [
  { id: 'homepage', label: 'Homepage' },
  { id: 'pages', label: 'All SEO pages' },
  { id: 'sitemap', label: 'Sitemap' },
  { id: 'search-console', label: 'Search Console' },
  { id: 'structured-data', label: 'Structured Data' },
]

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

function Field({ label, children, hint, count, max }) {
  const over = typeof count === 'number' && typeof max === 'number' && count > max
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-slate-700">
        <span>{label}</span>
        {typeof count === 'number' && typeof max === 'number' ? (
          <span className={`text-xs tabular-nums ${over ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
            {count}/{max}
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

function Banner({ message, onClear }) {
  if (!message?.text) return null
  const ok = message.type === 'success'
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      <span>{message.text}</span>
      <button type="button" onClick={onClear} className="shrink-0 font-semibold underline">
        Dismiss
      </button>
    </div>
  )
}

function FaqEditor({ faqs, onChange }) {
  const items = faqs.length ? faqs : [{ q: '', a: '' }]
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <Field label={`Question ${idx + 1}`}>
            <input
              className={inputClass}
              value={item.q}
              onChange={(e) => {
                const next = [...items]
                next[idx] = { ...next[idx], q: e.target.value }
                onChange(next)
              }}
            />
          </Field>
          <Field label="Answer">
            <textarea
              className={`${inputClass} min-h-[72px]`}
              value={item.a}
              onChange={(e) => {
                const next = [...items]
                next[idx] = { ...next[idx], a: e.target.value }
                onChange(next)
              }}
            />
          </Field>
          <button
            type="button"
            className="text-xs font-semibold text-red-600 hover:underline"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
          >
            Remove FAQ
          </button>
        </div>
      ))}
      <button
        type="button"
        className="rounded-xl border border-dashed border-brand-300 bg-brand-50/50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        onClick={() => onChange([...items, { q: '', a: '' }])}
      >
        + Add FAQ
      </button>
    </div>
  )
}

function PageEditorForm({ def, form, setForm, issues }) {
  const previewUrl = form.canonicalUrl || `${SEO_SITE_ORIGIN_DEFAULT}${def.path === '/' ? '/' : `${def.path}/`}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="rounded-xl bg-gradient-to-r from-brand-600 to-cyan-600 px-4 py-3 text-white">
          <h3 className="text-lg font-semibold">{def.label}</h3>
          <p className="text-sm text-white/85">{def.path}</p>
          {def.category ? <p className="mt-1 text-xs text-white/70">{def.category}</p> : null}
        </div>

        {issues.length > 0 ? (
          <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.level === 'error' ? 'Required: ' : 'Tip: '}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}

        <Field label="SEO title" count={form.seoTitle.length} max={60}>
          <input className={inputClass} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
        </Field>
        <Field label="Meta description" count={form.metaDescription.length} max={160}>
          <textarea
            className={`${inputClass} min-h-[88px]`}
            value={form.metaDescription}
            onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
          />
        </Field>
        <Field label="OG title">
          <input className={inputClass} value={form.ogTitle} onChange={(e) => setForm({ ...form, ogTitle: e.target.value })} />
        </Field>
        <Field label="OG description">
          <textarea
            className={`${inputClass} min-h-[72px]`}
            value={form.ogDescription}
            onChange={(e) => setForm({ ...form, ogDescription: e.target.value })}
          />
        </Field>
        <Field label="Canonical URL">
          <input className={inputClass} value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} />
        </Field>

        {def.pageType === 'homepage' ? (
          <>
            <Field label="Hero headline" hint="Optional single-line override for the main H1.">
              <input className={inputClass} value={form.heroHeadline} onChange={(e) => setForm({ ...form, heroHeadline: e.target.value })} />
            </Field>
            <Field label="Hero subheadline">
              <textarea className={`${inputClass} min-h-[72px]`} value={form.heroSubheadline} onChange={(e) => setForm({ ...form, heroSubheadline: e.target.value })} />
            </Field>
            <Field label="Trust badges text" hint="One badge per line.">
              <textarea className={`${inputClass} min-h-[72px]`} value={form.trustBadgesText} onChange={(e) => setForm({ ...form, trustBadgesText: e.target.value })} />
            </Field>
            <Field label="CTA button text">
              <input className={inputClass} value={form.ctaButtonText} onChange={(e) => setForm({ ...form, ctaButtonText: e.target.value })} />
            </Field>
            <Field label="Service section heading">
              <input className={inputClass} value={form.serviceSectionHeading} onChange={(e) => setForm({ ...form, serviceSectionHeading: e.target.value })} />
            </Field>
          </>
        ) : (
          <>
            <Field label="H1">
              <input className={inputClass} value={form.h1} onChange={(e) => setForm({ ...form, h1: e.target.value })} />
            </Field>
            <Field label="Intro paragraph">
              <textarea className={`${inputClass} min-h-[96px]`} value={form.introText} onChange={(e) => setForm({ ...form, introText: e.target.value })} />
            </Field>
            <Field label="CTA text">
              <input className={inputClass} value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} />
            </Field>
            {def.pageType === 'city' ? (
              <Field label="Nearby service areas" hint="Comma-separated labels (reference for editors).">
                <textarea className={`${inputClass} min-h-[72px]`} value={form.nearbyAreas} onChange={(e) => setForm({ ...form, nearbyAreas: e.target.value })} />
              </Field>
            ) : null}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">FAQ</p>
              <FaqEditor faqs={form.faqJson} onChange={(faqJson) => setForm({ ...form, faqJson })} />
            </div>
          </>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <SeoGooglePreview title={form.seoTitle} url={previewUrl} description={form.metaDescription} />
        {def.path !== '/' ? (
          <a
            href={`${SEO_SITE_ORIGIN_DEFAULT}${def.path}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
          >
            View live page ↗
          </a>
        ) : (
          <a
            href={SEO_SITE_ORIGIN_DEFAULT}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
          >
            View live homepage ↗
          </a>
        )}
      </div>
    </div>
  )
}

function SeoPagePicker({ pages, selectedSlug, onSelect, category, onCategoryChange, search, onSearchChange }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pages.filter((p) => {
      if (p.pageSlug === 'home') return false
      if (category && category !== 'all' && p.category !== category) return false
      if (!q) return true
      return (
        p.label.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        p.pageSlug.toLowerCase().includes(q)
      )
    })
  }, [pages, category, search])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Search pages" hint={`${filtered.length} of ${pages.length - 1} SEO URLs`}>
          <input
            className={inputClass}
            placeholder="Search by title, path, or slug…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </Field>
        <Field label="Category">
          <select className={inputClass} value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="all">All categories</option>
            {SEO_DASHBOARD_CATEGORIES.filter((c) => c !== 'Homepage').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2">
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-slate-500">No pages match your search.</li>
        ) : (
          filtered.map((p) => (
            <li key={p.pageSlug}>
              <button
                type="button"
                onClick={() => onSelect(p.pageSlug)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  selectedSlug === p.pageSlug
                    ? 'bg-brand-600 font-semibold text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white hover:shadow-sm'
                }`}
              >
                <span className="block font-medium">{p.label}</span>
                <span className={`block truncate text-xs ${selectedSlug === p.pageSlug ? 'text-white/80' : 'text-slate-500'}`}>
                  {p.path}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

export default function SeoDashboardAdmin() {
  const [tab, setTab] = useState('homepage')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [settingsMap, setSettingsMap] = useState(() => new Map())
  const [homepageForm, setHomepageForm] = useState(() => seoRowToFormState(buildSeoSettingsFallback(SEO_DASHBOARD_HOMEPAGE)))
  const [selectedPageSlug, setSelectedPageSlug] = useState(SEO_DASHBOARD_ALL_PAGES.find((p) => p.pageSlug !== 'home')?.pageSlug || 'glasgow-removals')
  const [pageForm, setPageForm] = useState(null)
  const [pageSearch, setPageSearch] = useState('')
  const [pageCategory, setPageCategory] = useState('all')
  const [sitemapInfo, setSitemapInfo] = useState({ lastGenerated: null, urlCount: 0 })

  const editablePages = useMemo(
    () => SEO_DASHBOARD_ALL_PAGES.filter((p) => p.pageSlug !== 'home'),
    [],
  )

  const activePageDef = useMemo(
    () => SEO_DASHBOARD_ALL_PAGES.find((p) => p.pageSlug === selectedPageSlug) || editablePages[0],
    [selectedPageSlug, editablePages],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const map = await fetchSeoSettingsAdminMap()
      setSettingsMap(map)
      const homeRow = mergeSeoSettingsForDef(map, SEO_DASHBOARD_HOMEPAGE)
      setHomepageForm(seoRowToFormState(homeRow))
      const { urlCount } = buildSitemapXml()
      setSitemapInfo({ lastGenerated: getSitemapLastGenerated(map), urlCount })
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load SEO settings.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!activePageDef) return
    const row = mergeSeoSettingsForDef(settingsMap, activePageDef)
    setPageForm(seoRowToFormState(row))
  }, [activePageDef, settingsMap])

  const homepageIssues = useMemo(() => validateSeoForm(homepageForm), [homepageForm])
  const pageIssues = useMemo(() => (pageForm ? validateSeoForm(pageForm) : []), [pageForm])

  async function saveDef(def, form) {
    const issues = validateSeoForm(form)
    if (issues.some((i) => i.level === 'error')) {
      setMessage({ type: 'error', text: 'Fix required fields before saving.' })
      return
    }
    setSaving(true)
    try {
      const row = formStateToSeoRow(form, def)
      await upsertSeoSettingsRow(row)
      window.dispatchEvent(new Event('seo-settings-updated'))
      setMessage({ type: 'success', text: `Saved ${def.label}.` })
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Save failed.' })
    } finally {
      setSaving(false)
      setShowPreviewModal(false)
    }
  }

  function handleRegenerateSitemap() {
    const { xml, urlCount } = buildSitemapXml()
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sitemap.xml'
    a.click()
    URL.revokeObjectURL(url)
    const iso = new Date().toISOString()
    saveSitemapGeneratedAt(iso)
    setSitemapInfo((s) => ({ ...s, lastGenerated: iso, urlCount }))
    setMessage({
      type: 'success',
      text: `Sitemap generated (${urlCount} URLs). Download started — commit public/sitemap.xml on deploy.`,
    })
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading SEO dashboard…</p>
  }

  const previewForm =
    tab === 'homepage' ? homepageForm : tab === 'pages' && pageForm ? pageForm : homepageForm

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">SEO Dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/90">
          Edit SEO titles, descriptions, H1, intro, FAQs, and canonicals for all {editablePages.length} public SEO URLs.
          Payments, quotes, pricing, and routes are not editable here.
        </p>
      </div>

      <Banner message={message} onClear={() => setMessage(null)} />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'homepage' ? (
        <>
          <PageEditorForm def={SEO_DASHBOARD_HOMEPAGE} form={homepageForm} setForm={setHomepageForm} issues={homepageIssues} />
          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setShowPreviewModal(true)}>
              Preview before save
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
              onClick={() => saveDef(SEO_DASHBOARD_HOMEPAGE, homepageForm)}
            >
              {saving ? 'Saving…' : 'Save homepage SEO'}
            </button>
          </div>
        </>
      ) : null}

      {tab === 'pages' && activePageDef && pageForm ? (
        <>
          <SeoPagePicker
            pages={SEO_DASHBOARD_ALL_PAGES}
            selectedSlug={selectedPageSlug}
            onSelect={setSelectedPageSlug}
            category={pageCategory}
            onCategoryChange={setPageCategory}
            search={pageSearch}
            onSearchChange={setPageSearch}
          />
          <PageEditorForm def={activePageDef} form={pageForm} setForm={setPageForm} issues={pageIssues} />
          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setShowPreviewModal(true)}>
              Preview before save
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
              onClick={() => saveDef(activePageDef, pageForm)}
            >
              {saving ? 'Saving…' : `Save ${activePageDef.label}`}
            </button>
          </div>
        </>
      ) : null}

      {tab === 'sitemap' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-lg font-semibold text-slate-900">Sitemap & robots</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Sitemap URL</dt>
                <dd className="mt-0.5 break-all text-brand-700">{SEO_SITE_ORIGIN_DEFAULT}/sitemap.xml</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">robots.txt URL</dt>
                <dd className="mt-0.5 break-all text-brand-700">{SEO_SITE_ORIGIN_DEFAULT}/robots.txt</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">URLs in sitemap</dt>
                <dd className="mt-0.5 text-slate-800">{sitemapInfo.urlCount}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Last generated (admin)</dt>
                <dd className="mt-0.5 text-slate-800">
                  {sitemapInfo.lastGenerated ? new Date(sitemapInfo.lastGenerated).toLocaleString('en-GB') : 'Not recorded yet'}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={handleRegenerateSitemap}
              className="mt-5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Regenerate sitemap
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Build pipeline also regenerates sitemap on deploy. Download and commit to public/ if updating manually.
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'search-console' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Impressions', value: '—', hint: 'Connect Google Search Console later' },
            { label: 'Clicks', value: '—', hint: 'Placeholder' },
            { label: 'Average position', value: '—', hint: 'Placeholder' },
            { label: 'Top keywords', value: '—', hint: 'Placeholder' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-300">{card.value}</p>
              <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'structured-data' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'LocalBusiness schema', status: 'Active on homepage & SEO pages', tone: 'emerald' },
            { title: 'Service schema', status: 'Active on service quote pages', tone: 'emerald' },
            { title: 'FAQ schema', status: 'Active where FAQs exist on SEO landing pages', tone: 'emerald' },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <p className="font-semibold text-slate-900">{card.title}</p>
              <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                {card.status}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {showPreviewModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Preview before save</h3>
            <div className="mt-4">
              <SeoGooglePreview
                title={previewForm.seoTitle}
                url={previewForm.canonicalUrl}
                description={previewForm.metaDescription}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600" onClick={() => setShowPreviewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
