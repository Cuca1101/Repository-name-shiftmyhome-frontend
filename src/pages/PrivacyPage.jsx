export default function PrivacyPage() {
  return (
    <div className="min-w-0 bg-white py-12 sm:py-16">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700 sm:text-[15px]">
          <p>
            ShiftMyHome (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy and is committed to
            protecting personal data in accordance with the UK GDPR and the Data Protection Act 2018.
          </p>
          <p>
            This Privacy Policy explains how we collect, use, store, and protect personal data when you use the
            ShiftMyHome website, applications, and related services (together, the &quot;Platform&quot;).
          </p>
          <p className="font-medium text-slate-800">This policy applies only within the United Kingdom.</p>

          <section className="pt-2">
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">1. Who We Are</h2>
            <p className="mt-3">
              ShiftMyHome operates a digital platform that connects customers with independent transport partners and
              drivers for removals, logistics, and transport services across the UK.
            </p>
            <p className="mt-3">
              For data protection purposes, ShiftMyHome is the <strong className="font-semibold text-slate-800">data controller</strong> of
              personal data collected through the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">2. Personal Data We Collect</h2>
            <p className="mt-3">We may collect and process the following categories of personal data:</p>

            <h3 className="mt-4 font-semibold text-slate-900">a) Identity &amp; Contact Information</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Full name</li>
              <li>Email address</li>
              <li>Telephone number</li>
            </ul>

            <h3 className="mt-4 font-semibold text-slate-900">b) Account Information</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Login details</li>
              <li>Account status</li>
              <li>User preferences</li>
            </ul>

            <h3 className="mt-4 font-semibold text-slate-900">c) Booking &amp; Service Information</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Collection and delivery addresses</li>
              <li>Job descriptions and item details</li>
              <li>Booking history</li>
              <li>Messages exchanged via the Platform</li>
            </ul>

            <h3 className="mt-4 font-semibold text-slate-900">d) Payment &amp; Transaction Information</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Payment references</li>
              <li>Invoices and payout records</li>
            </ul>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-slate-800">
              <span aria-hidden>⚠️</span> ShiftMyHome does not store full card details. Payments are handled by secure
              third-party payment providers.
            </p>

            <h3 className="mt-4 font-semibold text-slate-900">e) Technical Information</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>IP address</li>
              <li>Device and browser data</li>
              <li>Usage logs and diagnostic data</li>
            </ul>

            <h3 className="mt-4 font-semibold text-slate-900">f) Transport Partner &amp; Driver Information (where applicable)</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Vehicle details</li>
              <li>Insurance and compliance documents</li>
              <li>Performance and service-related records</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">3. How We Use Personal Data</h2>
            <p className="mt-3">We use personal data only where permitted by law, including to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide and manage access to the Platform</li>
              <li>Process bookings, payments, and payouts</li>
              <li>Enable communication between customers and transport partners</li>
              <li>Verify identity and eligibility</li>
              <li>Monitor service quality and handle complaints or disputes</li>
              <li>Prevent fraud and misuse of the Platform</li>
              <li>Meet legal and regulatory obligations</li>
              <li>Improve our services and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">4. Lawful Basis for Processing</h2>
            <p className="mt-3">We process personal data based on one or more of the following lawful bases under UK GDPR:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Performance of a contract</li>
              <li>Legal obligation</li>
              <li>Legitimate interests (platform operation, security, service improvement)</li>
              <li>Consent, where required (e.g. marketing)</li>
            </ul>
            <p className="mt-3">Where consent is used, it may be withdrawn at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">5. Sharing Personal Data</h2>
            <p className="mt-3">We may share personal data only where necessary, including with:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Customers and transport partners (to complete a booking)</li>
              <li>Payment processors</li>
              <li>IT, hosting, and platform service providers</li>
              <li>Professional advisers (legal, accounting, compliance)</li>
              <li>Public authorities where required by law</li>
            </ul>
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800">
              <span aria-hidden>🚫</span> We do not sell personal data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">6. Data Security</h2>
            <p className="mt-3">
              We implement appropriate technical and organisational measures to protect personal data against
              unauthorised access, loss, alteration, or disclosure. Access is restricted to authorised personnel and
              trusted service providers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">7. Data Retention</h2>
            <p className="mt-3">Personal data is retained only for as long as necessary to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Deliver services</li>
              <li>Meet legal, tax, and accounting requirements</li>
              <li>Resolve disputes and enforce agreements</li>
            </ul>
            <p className="mt-3">Retention periods depend on the type and purpose of the data.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">8. Your Rights (UK GDPR)</h2>
            <p className="mt-3">You have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request erasure (where applicable)</li>
              <li>Restrict or object to processing</li>
              <li>Request data portability</li>
              <li>Withdraw consent at any time</li>
              <li>Lodge a complaint with the Information Commissioner&apos;s Office (ICO)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">9. Identity Verification</h2>
            <p className="mt-3">
              For security reasons, we may request additional information to verify your identity before responding to
              certain requests. This helps protect personal data from unauthorised access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">10. Marketing Communications</h2>
            <p className="mt-3">
              Service-related communications may be sent as part of our contractual relationship. Marketing messages will
              only be sent where permitted by law, and you may opt out at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">11. Third-Party Links</h2>
            <p className="mt-3">
              Our Platform may include links to third-party websites or services. We are not responsible for their
              privacy practices.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">12. Changes to This Policy</h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. Any changes will be published on the Platform with an
              updated revision date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">13. Contact Details</h2>
            <p className="mt-3">For privacy-related questions or requests:</p>
            <ul className="mt-2 list-none space-y-2">
              <li>
                <strong className="font-semibold text-slate-800">Email:</strong>{' '}
                <a className="font-medium text-brand-700 hover:underline" href="mailto:privacy@shiftmyhome.co.uk">
                  privacy@shiftmyhome.co.uk
                </a>
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Data Protection Contact:</strong> ShiftMyHome
              </li>
            </ul>
            <p className="mt-4">
              If you are not satisfied with our response, you may contact the UK Information Commissioner&apos;s Office
              (ICO).
            </p>
          </section>
        </div>
      </article>
    </div>
  )
}
