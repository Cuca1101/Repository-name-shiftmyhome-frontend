import { CONTACT } from '../config'

export default function TermsPage() {
  return (
    <div className="min-w-0 bg-white py-12 sm:py-16">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700 sm:text-[15px]">
          <p>
            These Terms &amp; Conditions (&quot;Terms&quot;) govern the use of the ShiftMyHome website, mobile
            applications, dashboards and related services (together, the &quot;Platform&quot;). By accessing or using the
            Platform, you agree to be bound by these Terms. If you do not agree, you must not use the Platform.
          </p>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">1. About ShiftMyHome</h2>
            <p className="mt-3">
              ShiftMyHome is operated by <strong className="font-semibold text-slate-800">ShiftMyHome Ltd</strong>, a
              company registered in England and Wales.
            </p>
            <ul className="mt-3 list-none space-y-2">
              <li>
                <strong className="font-semibold text-slate-800">Company number:</strong> as shown on the Companies
                House register for ShiftMyHome Ltd: 16730159.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Registered office:</strong> 128 City Road, London,
                United Kingdom, EC1V 2NX.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Support email:</strong>{' '}
                <a className="font-medium text-brand-700 hover:underline" href="mailto:support@shiftmyhome.co.uk">
                  support@shiftmyhome.co.uk
                </a>
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Privacy contact:</strong>{' '}
                <a className="font-medium text-brand-700 hover:underline" href="mailto:privacy@shiftmyhome.co.uk">
                  privacy@shiftmyhome.co.uk
                </a>
              </li>
            </ul>
            <p className="mt-3">
              For the purposes of these Terms, &quot;ShiftMyHome&quot;, &quot;we&quot;, &quot;us&quot;, and
              &quot;our&quot; refer to the Platform operator.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">2. Nature of the Platform (important)</h2>
            <p className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-3 text-slate-800">
              ShiftMyHome operates a digital marketplace that enables customers to book transport, removals and logistics
              services from <strong className="font-semibold">independent Transport Partners</strong>.
            </p>
            <p className="mt-3">
              <strong className="font-semibold text-slate-800">ShiftMyHome does not itself provide transport services,</strong>{' '}
              does not employ drivers, does not own vehicles used by partners, and does not take possession of goods.
              All transport services are provided by independent Transport Partners. Unless otherwise agreed in writing,
              the contract for performing the move is between the Customer and the Transport Partner. ShiftMyHome
              provides the Platform, booking tools, communications features, and related technology.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">3. Definitions</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-slate-800">Customer</strong> — a person or business booking a job
                through the Platform.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Transport Partner</strong> — an independent business or
                sole trader providing services via the Platform.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Driver</strong> — an individual operating under a
                Transport Partner.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Job</strong> — a booking for transport or removals.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Accepted Job</strong> — a Job confirmed by a Transport
                Partner.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Price</strong> — the total price shown or agreed for a
                Job.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Extra Charges</strong> — additional charges arising
                from extra work, access, waiting, or other agreed factors.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Platform</strong> — the ShiftMyHome website, apps,
                dashboards and related systems.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">4. Eligibility &amp; accounts</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Users must be 18 years or older.</li>
              <li>Users must provide accurate and complete information.</li>
              <li>Users are responsible for all activity under their accounts.</li>
              <li>
                ShiftMyHome may suspend or terminate accounts for misuse, fraud, breach of these Terms, or risk to the
                Platform or other users.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">5. Quotes, pricing &amp; estimates</h2>
            <p className="mt-3">
              Prices and quotes shown through the Platform (including online estimates) are subject to confirmation.
              Final pricing may depend on actual inventory, access (stairs, lifts, parking, walking distance), waiting
              time, distance, timing, and changes to job details. The Price will be confirmed as part of the booking
              flow or by agreement with the Transport Partner before or during the Job, in line with the information you
              provide.
            </p>
            <p className="mt-3">
              Material inaccuracies in addresses, volumes, access, or items may result in lawful Extra Charges,
              rescheduling, or refusal to proceed where safety or feasibility is affected.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">6. Payments</h2>
            <h3 className="mt-4 font-semibold text-slate-900">6.1 Card payments</h3>
            <p className="mt-2">
              Where the Platform processes payment, card payments are handled by approved third-party payment providers.
              ShiftMyHome does not store full card details on its own systems. Cash payments are not supported through
              the Platform.
            </p>
            <h3 className="mt-4 font-semibold text-slate-900">6.2 Deposits</h3>
            <p className="mt-2">
              Unless clearly stated at checkout or in a specific offer, ShiftMyHome does not require a separate
              &quot;deposit&quot; or booking fee beyond what is shown for confirming the Job — subject to product
              updates published on the Platform.
            </p>
            <h3 className="mt-4 font-semibold text-slate-900">6.3 Authorisation</h3>
            <p className="mt-2">
              By confirming a booking where card payment applies, you authorise the Platform (via its payment providers)
              to charge the agreed Price and any approved Extra Charges in accordance with these Terms and your booking
              confirmation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">7. Booking process &amp; acceptance</h2>
            <p className="mt-3">A booking typically becomes binding when:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>job details are submitted accurately;</li>
              <li>a Transport Partner accepts the Job (where applicable); and</li>
              <li>payment authorisation or confirmation steps required by the Platform are completed.</li>
            </ul>
            <p className="mt-3">
              An &quot;Accepted&quot; Job means the Transport Partner has agreed to perform the service based on the
              information provided. Acceptance remains conditional on accuracy; discrepancies may affect price or
              feasibility.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">8. Cancellations &amp; rescheduling</h2>
            <p className="mt-3">
              Cancellation and refund rules depend on timing, notice, work already undertaken, and partner
              availability. Where we publish specific cancellation windows (for example free cancellation within a stated
              period after confirmation, provided the move date is beyond a minimum notice period), those rules apply as
              shown at booking.
            </p>
            <p className="mt-3">
              Late cancellations or same-day / next-day confirmed bookings may be non-refundable or subject to fees as
              stated at booking. ShiftMyHome may help coordinate alternatives but cannot guarantee partner availability.
              Rescheduling may change the Price.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">9. Live tracking</h2>
            <p className="mt-3">
              Any live tracking or fleet visibility is for information and coordination only. Data may be delayed,
              estimated, or unavailable (signal, device limits, traffic, weather). Tracking does not guarantee arrival
              times and does not create a strict contractual obligation as to time unless expressly agreed in writing for
              your specific Job.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">10. Extra charges</h2>
            <p className="mt-3">
              Extra Charges may apply where additional work, time, risk, or access applies beyond the original booking.
              Examples include (without limitation): extra stairs or long carries; waiting beyond any free allowance;
              parking or access costs; assembly/disassembly; undeclared volume or heavy/specialist items.
            </p>
            <p className="mt-3">
              Transport Partners should explain reasons fairly and record charges on the Platform where possible.
              Customers are responsible for accurate job details; incomplete information may result in lawful Extra
              Charges.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">11. Time windows &amp; waiting time</h2>
            <p className="mt-3">
              Unless otherwise stated in your booking, a reasonable free waiting allowance may apply at collection and
              delivery (for example 15 minutes per stop). Waiting beyond that may be charged at the rate shown in your
              booking confirmation or on the Platform at the time of booking (for example per additional interval).
              Waiting may arise from access issues, packing not being ready, keys, lift availability, or customer delay.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">12. Customer responsibilities</h2>
            <p className="mt-3">You must:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>provide accurate addresses, inventory, and access information;</li>
              <li>ensure safe and lawful access and that items can be moved;</li>
              <li>declare stairs, lifts, restrictions, fragile or high-value items in advance;</li>
              <li>arrange parking or permits where required.</li>
            </ul>
            <p className="mt-3">Failure to do so may affect service quality, timing, and final Price.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">13. Transport Partner responsibilities</h2>
            <p className="mt-3">
              Transport Partners are independent contractors responsible for performing agreed services, appropriate
              insurance, and legal compliance. ShiftMyHome does not control day-to-day operations but may remove partners
              from the Platform for breach of standards or these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">14. Damage, loss &amp; claims</h2>
            <p className="mt-3">
              Claims for loss or damage to goods during transport should be raised with the Transport Partner in the
              first instance, in line with their insurance and policies. ShiftMyHome may help facilitate communication
              but <strong className="font-semibold text-slate-800">does not guarantee</strong> any particular outcome or
              compensation. Pack fragile and high-value items appropriately and declare them when booking.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">15. Dispute resolution</h2>
            <p className="mt-3">
              Issues should be reported through the Platform where possible. A typical workflow may include: reported →
              under review (evidence such as messages, photos, timestamps) → resolved. Late or incomplete evidence may
              affect outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">16. Chargebacks</h2>
            <p className="mt-3">
              Contact ShiftMyHome support before initiating a card chargeback. Unauthorised or abusive chargebacks may
              lead to account suspension, restriction of future bookings, and recovery of reasonable administrative
              costs where permitted. We may submit evidence (booking logs, chat, tracking metadata, timestamps, photos).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">17. Prohibited items &amp; safety</h2>
            <p className="mt-3">The Platform must not be used to arrange transport of illegal or stolen goods, weapons, explosives, or hazardous materials without lawful disclosure and compliance. You warrant that items are lawful and properly described.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">18. Reviews &amp; feedback</h2>
            <p className="mt-3">
              Reviews must be honest and relevant. We may remove fake, abusive, or misleading content. Reviews are not a
              guarantee of future service quality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">19. Intellectual property</h2>
            <p className="mt-3">
              Platform software, branding, and content (except your lawful uploads) belong to ShiftMyHome or its
              licensors. Unauthorised copying or misuse is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">20. Limitation of liability</h2>
            <p className="mt-3">
              Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or any
              liability that cannot be excluded under applicable law.
            </p>
            <p className="mt-3">
              Subject to the above, to the fullest extent permitted by law: ShiftMyHome is not liable for acts or
              omissions of Transport Partners or Drivers; is not liable for loss or damage to goods in transit (which is
              a matter between Customer and partner/insurance); and total liability of ShiftMyHome for Platform-related
              claims may be limited to fees paid to ShiftMyHome for that transaction (or a nominal cap such as £100,
              whichever is lower), except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">21. Indemnity</h2>
            <p className="mt-3">
              You agree to indemnify ShiftMyHome against reasonable losses arising from your misuse of the Platform or
              breach of these Terms, subject to applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">22. Suspension &amp; termination</h2>
            <p className="mt-3">
              We may suspend or terminate access where Terms are breached, fraud or abuse is suspected, or the integrity
              of the Platform is at risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">23. Privacy &amp; data protection</h2>
            <p className="mt-3">
              Personal data is processed in accordance with our{' '}
              <a className="font-medium text-brand-700 hover:underline" href="/privacy">
                Privacy Policy
              </a>{' '}
              (UK GDPR / Data Protection Act 2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">24. Use of the website</h2>
            <p className="mt-3">
              You agree not to use the Platform for unlawful purposes, to provide false or misleading information, or to
              interfere with security or operation of the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">25. Delays &amp; unforeseen circumstances</h2>
            <p className="mt-3">
              Delays may occur due to traffic, weather, access, or incorrect job details. ShiftMyHome will aim to minimise
              disruption but cannot guarantee exact timings except where expressly agreed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">26. Governing law &amp; jurisdiction</h2>
            <p className="mt-3">
              These Terms are governed by the laws of England and Wales. The courts of England and Wales have exclusive
              jurisdiction, subject to mandatory consumer protections where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">27. Changes to these Terms</h2>
            <p className="mt-3">
              We may update these Terms from time to time. Material changes will be indicated on the Platform.
              Continued use after the effective date may constitute acceptance; if you do not agree, you must stop using the
              Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">28. Contact</h2>
            <p className="mt-3">For questions about these Terms:</p>
            <ul className="mt-2 list-none space-y-2">
              <li>
                <strong className="font-semibold text-slate-800">Email:</strong>{' '}
                <a className="font-medium text-brand-700 hover:underline" href="mailto:support@shiftmyhome.co.uk">
                  support@shiftmyhome.co.uk
                </a>
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Phone:</strong>{' '}
                <a className="font-medium text-brand-700 hover:underline" href={`tel:${CONTACT.phoneTel}`}>
                  {CONTACT.phoneDisplay}
                </a>
              </li>
              <li>
                <strong className="font-semibold text-slate-800">General enquiries:</strong>{' '}
                <a className="font-medium text-brand-700 hover:underline" href="mailto:admin@shiftmyhome.co.uk">
                  admin@shiftmyhome.co.uk
                </a>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </div>
  )
}
