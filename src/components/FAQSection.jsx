import { useState } from 'react'

const FAQ_ITEMS = [
  {
    q: 'How much does it cost to move with ShiftMyHome?',
    a: 'Every move is different. Your price depends on distance, how much you’re moving (volume), floors and access, and any extras like packing. Use our online quote flow for a tailored estimate, or call us with your details.',
  },
  {
    q: 'Are my belongings insured during the move?',
    a: 'We operate with appropriate goods-in-transit cover for removals work. If you have especially high-value items, tell us when you book so we can confirm cover and handling.',
  },
  {
    q: 'How far in advance should I book?',
    a: 'Peak dates fill up fast — booking 2–4 weeks ahead is ideal. We also offer same-day and short-notice slots when crews are available; contact us and we’ll check the diary.',
  },
  {
    q: 'What areas do you cover?',
    a: 'We’re based in Glasgow and cover Scotland and UK-wide moves. Check our coverage map for regular hubs, or ask us about your postcode — we quote nationwide routes.',
  },
  {
    q: 'Are your movers trained?',
    a: 'Yes. Our team is experienced in loading, securing loads, and protecting furniture and fragile items with blankets and straps. We plan access and parking with you before arrival.',
  },
  {
    q: 'Do you move items like pianos or antiques?',
    a: 'Many specialist items can be moved with the right crew, equipment, and advance notice. Tell us the item, dimensions, and access when you enquire so we can quote and resource it properly.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We’ll confirm payment options when you book — typically bank transfer and card arrangements as agreed for your job. Invoices and receipts are provided for completed work.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <section id="faq" className="scroll-mt-20 border-t border-slate-200 bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-600">
          Quick answers about pricing, insurance, booking, and how we work.
        </p>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-card">
          {FAQ_ITEMS.map((item, index) => {
            const open = openIndex === index
            return (
              <div key={item.q} className="first:rounded-t-2xl last:rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6 sm:py-5"
                  aria-expanded={open}
                >
                  <span className="text-base font-semibold text-slate-900 sm:text-lg">{item.q}</span>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition ${
                      open ? 'rotate-180 border-brand-200 bg-brand-50 text-brand-700' : ''
                    }`}
                    aria-hidden
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {open && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-0 sm:px-6">
                    <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">{item.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
