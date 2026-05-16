export default function CookiePreferencesPage() {
  return (
    <div className="min-w-0 bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Cookie preferences</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {new Date().getFullYear()}</p>
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700">
          <p>
            We may use essential cookies so the site functions correctly. Where we add analytics or marketing tools in
            future, we will update this page and, where required, ask for your consent before non-essential cookies are
            set.
          </p>
          <p className="mt-4">
            You can control cookies through your browser settings. Blocking some cookies may affect how parts of the site
            work.
          </p>
          <p className="mt-6">
            Questions?{' '}
            <a className="font-medium text-brand-700 hover:underline" href="mailto:admin@shiftmyhome.co.uk">
              admin@shiftmyhome.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
