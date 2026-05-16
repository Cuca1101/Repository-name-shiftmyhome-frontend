import { CONTACT, WHATSAPP_SUPPORT_URL } from '../config'

export default function SupportCTASection() {
  return (
    <section className="border-t border-slate-200 bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-violet-700 px-4 py-8 shadow-xl shadow-brand-900/20 ring-1 ring-white/15 sm:px-10 sm:py-12">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-3xl">Still have questions?</h2>
            <p className="mt-3 text-base leading-relaxed text-brand-100 sm:text-lg">
              Our friendly support team is here to help — call, WhatsApp, or use the form below.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <a
                href={`tel:${CONTACT.phoneTel}`}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-brand-800 shadow-lg transition hover:bg-brand-50 hover:shadow-xl sm:min-h-[52px] sm:w-auto sm:px-8 sm:text-base"
              >
                Call Us: {CONTACT.phoneDisplay}
              </a>
              <a
                href={WHATSAPP_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg ring-2 ring-white/25 transition hover:bg-[#20bd5a] hover:shadow-xl sm:min-h-[52px] sm:w-auto sm:px-8 sm:text-base"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
