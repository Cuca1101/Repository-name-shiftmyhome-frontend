import { useCallback, useEffect, useState } from 'react'
import {
  deleteWebsiteMedia,
  deleteWebsiteReview,
  deleteWebsiteServiceCard,
  fetchWebsiteCmsAdmin,
  saveWebsiteSettingsSection,
  upsertWebsiteReview,
  upsertWebsiteServiceCard,
} from '../../lib/data/websiteCmsRepository'
import { uploadWebsiteImage } from '../../lib/data/websiteCmsUpload'
import { getDefaultServiceCards } from '../../lib/websiteCmsDefaults'

const TABS = [
  { id: 'homepage', label: 'Homepage' },
  { id: 'service-cards', label: 'Service Cards' },
  { id: 'about', label: 'About Section' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'navbar-footer', label: 'Navbar & Footer' },
  { id: 'announcement', label: 'Announcement Bar' },
  { id: 'media', label: 'Media Library' },
]

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

function CmsBanner({ message, onClear }) {
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

function ImageUploadRow({ label, value, folder, onChange, uploading, setUploading, setMessage }) {
  return (
    <Field label={label} hint="JPEG/PNG/WebP. Uploads to Supabase website storage.">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          className={inputClass}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/assets/... or https://..."
        />
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          {uploading ? 'Uploading…' : 'Upload'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setUploading(true)
              try {
                const row = await uploadWebsiteImage(file, folder)
                onChange(row.public_url)
                setMessage({ type: 'success', text: 'Image uploaded.' })
              } catch (err) {
                setMessage({ type: 'error', text: err?.message || 'Upload failed.' })
              } finally {
                setUploading(false)
              }
            }}
          />
        </label>
      </div>
      {value ? (
        <img src={value} alt="" className="mt-2 h-24 w-auto max-w-full rounded-lg border object-cover" />
      ) : null}
    </Field>
  )
}

export default function WebsiteCmsAdmin() {
  const [tab, setTab] = useState('homepage')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [homepage, setHomepage] = useState({})
  const [about, setAbout] = useState({})
  const [coverage, setCoverage] = useState({})
  const [navbar, setNavbar] = useState({})
  const [footer, setFooter] = useState({})
  const [announcement, setAnnouncement] = useState({})
  const [serviceCards, setServiceCards] = useState([])
  const [reviews, setReviews] = useState([])
  const [media, setMedia] = useState([])
  const [editingCard, setEditingCard] = useState(null)
  const [editingReview, setEditingReview] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const data = await fetchWebsiteCmsAdmin()
      setHomepage(data.settings.homepage)
      setAbout(data.settings.about)
      setCoverage(data.settings.coverage)
      setNavbar(data.settings.navbar)
      setFooter(data.settings.footer)
      setAnnouncement(data.settings.announcement)
      setServiceCards(data.serviceCards)
      setReviews(data.reviews)
      setMedia(data.media)
    } catch (e) {
      setMessage({
        type: 'error',
        text: e?.message || 'Failed to load CMS. Run migrations 026 & 027 on Supabase.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function saveSection(key, data) {
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await saveWebsiteSettingsSection(key, data)
      setMessage({ type: 'success', text: 'Saved successfully.' })
      await load()
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  function seedServiceCards() {
    setServiceCards(getDefaultServiceCards().map((c) => ({ ...c, id: undefined })))
    setMessage({ type: 'success', text: 'Default cards loaded — click Save on each card to persist.' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Website CMS</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage public homepage content. If CMS data is missing, the site uses built-in defaults.
        </p>
      </div>

      <CmsBanner message={message} onClear={() => setMessage({ type: '', text: '' })} />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'homepage' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <Field label="Hero title part 1">
            <input className={inputClass} value={homepage.heroTitlePart1 || ''} onChange={(e) => setHomepage({ ...homepage, heroTitlePart1: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Highlight 1">
              <input className={inputClass} value={homepage.heroTitleHighlight1 || ''} onChange={(e) => setHomepage({ ...homepage, heroTitleHighlight1: e.target.value })} />
            </Field>
            <Field label="Part 2">
              <input className={inputClass} value={homepage.heroTitlePart2 || ''} onChange={(e) => setHomepage({ ...homepage, heroTitlePart2: e.target.value })} />
            </Field>
          </div>
          <Field label="Highlight 2">
            <input className={inputClass} value={homepage.heroTitleHighlight2 || ''} onChange={(e) => setHomepage({ ...homepage, heroTitleHighlight2: e.target.value })} />
          </Field>
          <Field label="Hero subtitle">
            <textarea className={inputClass} rows={2} value={homepage.heroSubtitle || ''} onChange={(e) => setHomepage({ ...homepage, heroSubtitle: e.target.value })} />
          </Field>
          <ImageUploadRow label="Hero image" folder="hero" value={homepage.heroImageUrl} onChange={(v) => setHomepage({ ...homepage, heroImageUrl: v })} uploading={uploading} setUploading={setUploading} setMessage={setMessage} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary CTA">
              <input className={inputClass} value={homepage.ctaPrimaryText || ''} onChange={(e) => setHomepage({ ...homepage, ctaPrimaryText: e.target.value })} />
            </Field>
            <Field label="Secondary CTA">
              <input className={inputClass} value={homepage.ctaSecondaryText || ''} onChange={(e) => setHomepage({ ...homepage, ctaSecondaryText: e.target.value })} />
            </Field>
          </div>
          <Field label="Trustpilot text">
            <input className={inputClass} value={homepage.trustpilotText || ''} onChange={(e) => setHomepage({ ...homepage, trustpilotText: e.target.value })} />
          </Field>
          <Field label="Services section heading">
            <input className={inputClass} value={homepage.servicesHeading || ''} onChange={(e) => setHomepage({ ...homepage, servicesHeading: e.target.value })} />
          </Field>
          <Field label="Services section subheading">
            <input className={inputClass} value={homepage.servicesSubheading || ''} onChange={(e) => setHomepage({ ...homepage, servicesSubheading: e.target.value })} />
          </Field>
          <button type="button" disabled={saving} onClick={() => saveSection('homepage', homepage)} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Homepage'}
          </button>
        </div>
      )}

      {tab === 'about' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <Field label="Heading">
            <input className={inputClass} value={about.heading || ''} onChange={(e) => setAbout({ ...about, heading: e.target.value })} />
          </Field>
          <Field label="Paragraph 1">
            <textarea className={inputClass} rows={3} value={about.paragraph1 || ''} onChange={(e) => setAbout({ ...about, paragraph1: e.target.value })} />
          </Field>
          <Field label="Paragraph 2">
            <textarea className={inputClass} rows={3} value={about.paragraph2 || ''} onChange={(e) => setAbout({ ...about, paragraph2: e.target.value })} />
          </Field>
          <ImageUploadRow label="About image" folder="about" value={about.imageUrl} onChange={(v) => setAbout({ ...about, imageUrl: v })} uploading={uploading} setUploading={setUploading} setMessage={setMessage} />
          <p className="text-sm font-medium text-slate-700">Trust cards (JSON array)</p>
          <textarea
            className={`${inputClass} font-mono text-xs`}
            rows={8}
            value={JSON.stringify(about.trustCards || [], null, 2)}
            onChange={(e) => {
              try {
                setAbout({ ...about, trustCards: JSON.parse(e.target.value) })
              } catch {
                /* ignore while typing */
              }
            }}
          />
          <button type="button" disabled={saving} onClick={() => saveSection('about', about)} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save About Section'}
          </button>
        </div>
      )}

      {tab === 'coverage' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <Field label="Heading"><input className={inputClass} value={coverage.heading || ''} onChange={(e) => setCoverage({ ...coverage, heading: e.target.value })} /></Field>
          <Field label="Subheading"><input className={inputClass} value={coverage.subheading || ''} onChange={(e) => setCoverage({ ...coverage, subheading: e.target.value })} /></Field>
          <Field label="Body text"><textarea className={inputClass} rows={3} value={coverage.bodyText || ''} onChange={(e) => setCoverage({ ...coverage, bodyText: e.target.value })} /></Field>
          <Field label="SEO text"><textarea className={inputClass} rows={2} value={coverage.seoText || ''} onChange={(e) => setCoverage({ ...coverage, seoText: e.target.value })} /></Field>
          <Field label="Cities (comma-separated)">
            <input className={inputClass} value={(coverage.cities || []).join(', ')} onChange={(e) => setCoverage({ ...coverage, cities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <ImageUploadRow label="Coverage image" folder="hero" value={coverage.imageUrl} onChange={(v) => setCoverage({ ...coverage, imageUrl: v })} uploading={uploading} setUploading={setUploading} setMessage={setMessage} />
          <button type="button" disabled={saving} onClick={() => saveSection('coverage', coverage)} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Coverage'}
          </button>
        </div>
      )}

      {tab === 'navbar-footer' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900">Navbar</h3>
            <Field label="CTA text"><input className={inputClass} value={navbar.ctaText || ''} onChange={(e) => setNavbar({ ...navbar, ctaText: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone display"><input className={inputClass} value={navbar.phoneDisplay || ''} onChange={(e) => setNavbar({ ...navbar, phoneDisplay: e.target.value })} /></Field>
              <Field label="Phone tel"><input className={inputClass} value={navbar.phoneTel || ''} onChange={(e) => setNavbar({ ...navbar, phoneTel: e.target.value })} /></Field>
            </div>
            <ImageUploadRow label="Logo" folder="logos" value={navbar.logoUrl} onChange={(v) => setNavbar({ ...navbar, logoUrl: v })} uploading={uploading} setUploading={setUploading} setMessage={setMessage} />
            <button type="button" disabled={saving} onClick={() => saveSection('navbar', navbar)} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              Save Navbar
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900">Footer</h3>
            <Field label="Tagline"><textarea className={inputClass} rows={2} value={footer.tagline || ''} onChange={(e) => setFooter({ ...footer, tagline: e.target.value })} /></Field>
            <Field label="Email"><input className={inputClass} value={footer.email || ''} onChange={(e) => setFooter({ ...footer, email: e.target.value })} /></Field>
            <Field label="CTA text"><input className={inputClass} value={footer.ctaText || ''} onChange={(e) => setFooter({ ...footer, ctaText: e.target.value })} /></Field>
            <ImageUploadRow label="Footer logo" folder="logos" value={footer.logoUrl} onChange={(v) => setFooter({ ...footer, logoUrl: v })} uploading={uploading} setUploading={setUploading} setMessage={setMessage} />
            <Field label="Social links (JSON)">
              <textarea className={`${inputClass} font-mono text-xs`} rows={4} value={JSON.stringify(footer.socialLinks || {}, null, 2)} onChange={(e) => { try { setFooter({ ...footer, socialLinks: JSON.parse(e.target.value) }) } catch { /* */ } }} />
            </Field>
            <button type="button" disabled={saving} onClick={() => saveSection('footer', footer)} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              Save Footer
            </button>
          </div>
        </div>
      )}

      {tab === 'announcement' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={!!announcement.enabled} onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })} />
            Announcement enabled
          </label>
          <Field label="Message text">
            <textarea className={inputClass} rows={2} value={announcement.messageText || ''} onChange={(e) => setAnnouncement({ ...announcement, messageText: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Button text (optional)"><input className={inputClass} value={announcement.buttonText || ''} onChange={(e) => setAnnouncement({ ...announcement, buttonText: e.target.value })} /></Field>
            <Field label="Button link (optional)"><input className={inputClass} value={announcement.buttonLink || ''} onChange={(e) => setAnnouncement({ ...announcement, buttonLink: e.target.value })} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date"><input type="date" className={inputClass} value={announcement.startDate?.slice(0, 10) || ''} onChange={(e) => setAnnouncement({ ...announcement, startDate: e.target.value })} /></Field>
            <Field label="End date"><input type="date" className={inputClass} value={announcement.endDate?.slice(0, 10) || ''} onChange={(e) => setAnnouncement({ ...announcement, endDate: e.target.value })} /></Field>
          </div>
          <Field label="Background style">
            <select className={inputClass} value={announcement.backgroundStyle || 'blue'} onChange={(e) => setAnnouncement({ ...announcement, backgroundStyle: e.target.value })}>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="christmas">Christmas</option>
              <option value="warning">Warning</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={announcement.showCloseButton !== false} onChange={(e) => setAnnouncement({ ...announcement, showCloseButton: e.target.checked })} />
            Show close button
          </label>
          <button type="button" disabled={saving} onClick={() => saveSection('announcement', announcement)} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Announcement'}
          </button>
        </div>
      )}

      {tab === 'service-cards' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={seedServiceCards} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Load defaults into editor
            </button>
            <button
              type="button"
              onClick={() =>
                setEditingCard({
                  slug: '',
                  title: '',
                  description: '',
                  starting_price: '',
                  image_url: '',
                  route_path: '/',
                  button_text: 'Get a Quote',
                  sort_order: serviceCards.length,
                  is_active: true,
                })
              }
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Add card
            </button>
          </div>
          {editingCard && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Slug"><input className={inputClass} value={editingCard.slug} onChange={(e) => setEditingCard({ ...editingCard, slug: e.target.value })} /></Field>
                <Field label="Route path"><input className={inputClass} value={editingCard.route_path} onChange={(e) => setEditingCard({ ...editingCard, route_path: e.target.value })} /></Field>
              </div>
              <Field label="Title"><input className={inputClass} value={editingCard.title} onChange={(e) => setEditingCard({ ...editingCard, title: e.target.value })} /></Field>
              <Field label="Description"><textarea className={inputClass} rows={2} value={editingCard.description} onChange={(e) => setEditingCard({ ...editingCard, description: e.target.value })} /></Field>
              <Field label="Starting price (display)"><input className={inputClass} value={editingCard.starting_price || ''} onChange={(e) => setEditingCard({ ...editingCard, starting_price: e.target.value })} /></Field>
              <ImageUploadRow label="Image" folder="services" value={editingCard.image_url} onChange={(v) => setEditingCard({ ...editingCard, image_url: v })} uploading={uploading} setUploading={setUploading} setMessage={setMessage} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingCard.is_active !== false} onChange={(e) => setEditingCard({ ...editingCard, is_active: e.target.checked })} /> Active</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await upsertWebsiteServiceCard(editingCard)
                      setEditingCard(null)
                      setMessage({ type: 'success', text: 'Service card saved.' })
                      await load()
                    } catch (e) {
                      setMessage({ type: 'error', text: e?.message || 'Save failed.' })
                    } finally {
                      setSaving(false)
                    }
                  }}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save card
                </button>
                <button type="button" onClick={() => setEditingCard(null)} className="rounded-xl border px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {serviceCards.map((c) => (
              <li key={c.id || c.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3 text-sm">
                <span className="font-semibold">{c.title}</span>
                <span className="text-slate-500">{c.route_path}</span>
                <div className="flex gap-2">
                  <button type="button" className="text-brand-600 font-semibold" onClick={() => setEditingCard(c)}>Edit</button>
                  {c.id && !String(c.id).startsWith('default') ? (
                    <button
                      type="button"
                      className="text-red-600 font-semibold"
                      onClick={async () => {
                        if (!window.confirm('Delete this card?')) return
                        await deleteWebsiteServiceCard(c.id)
                        await load()
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() =>
              setEditingReview({
                author_name: '',
                body: '',
                stars: 5,
                avatar_url: '',
                sort_order: reviews.length,
                is_active: true,
              })
            }
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Add review
          </button>
          {editingReview && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-4 space-y-3">
              <Field label="Name"><input className={inputClass} value={editingReview.author_name} onChange={(e) => setEditingReview({ ...editingReview, author_name: e.target.value })} /></Field>
              <Field label="Review"><textarea className={inputClass} rows={3} value={editingReview.body} onChange={(e) => setEditingReview({ ...editingReview, body: e.target.value })} /></Field>
              <Field label="Stars"><input type="number" min={1} max={5} className={inputClass} value={editingReview.stars} onChange={(e) => setEditingReview({ ...editingReview, stars: Number(e.target.value) })} /></Field>
              <ImageUploadRow label="Avatar" folder="reviews" value={editingReview.avatar_url} onChange={(v) => setEditingReview({ ...editingReview, avatar_url: v })} uploading={uploading} setUploading={setUploading} setMessage={setMessage} />
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true)
                  try {
                    await upsertWebsiteReview(editingReview)
                    setEditingReview(null)
                    setMessage({ type: 'success', text: 'Review saved.' })
                    await load()
                  } catch (e) {
                    setMessage({ type: 'error', text: e?.message || 'Save failed.' })
                  } finally {
                    setSaving(false)
                  }
                }}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Save review
              </button>
            </div>
          )}
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border bg-white p-3 text-sm">
                <strong>{r.author_name}</strong> — {r.body.slice(0, 80)}…
                <div className="mt-2 flex gap-2">
                  <button type="button" className="text-brand-600 font-semibold" onClick={() => setEditingReview(r)}>Edit</button>
                  <button
                    type="button"
                    className="text-red-600 font-semibold"
                    onClick={async () => {
                      if (!window.confirm('Delete review?')) return
                      await deleteWebsiteReview(r.id)
                      await load()
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'media' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600 mb-4">Uploaded website images. Copy URL into any CMS field.</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((m) => (
              <li key={m.id} className="rounded-xl border p-2 text-xs">
                <img src={m.public_url} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />
                <p className="font-semibold">{m.folder}</p>
                <p className="truncate text-slate-500">{m.public_url}</p>
                <button
                  type="button"
                  className="mt-2 text-red-600 font-semibold"
                  onClick={async () => {
                    if (!window.confirm('Delete from storage?')) return
                    await deleteWebsiteMedia(m.id)
                    await load()
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {!media.length ? <p className="text-sm text-slate-500">No uploads yet.</p> : null}
        </div>
      )}
    </div>
  )
}
