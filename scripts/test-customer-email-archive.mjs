import {
  bookingInvoiceArchive,
  buildCustomerEmailList,
  nextProviderStatus,
  providerStatusFromLastEvent,
  providerStatusFromResendEvent,
} from '../src/lib/customerEmailArchive.js'

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
  }
}

assert(providerStatusFromResendEvent('email.delivered') === 'delivered', 'delivered comes from the provider')
assert(providerStatusFromResendEvent('email.sent') === 'sent', 'sent comes from the provider')
assert(providerStatusFromResendEvent('email.bounced') === 'failed', 'bounce is failed')
assert(providerStatusFromResendEvent('email.opened') === 'delivered', 'an open confirms the provider delivered it')
assert(providerStatusFromLastEvent('bounced') === 'failed', 'provider last event bounce is failed')
assert(providerStatusFromLastEvent('delivered') === 'delivered', 'provider last event delivered')
assert(nextProviderStatus('delivered', 'sent') === 'delivered', 'a later sent event does not wipe delivered')
assert(nextProviderStatus('sent', 'failed') === 'failed', 'a provider failure replaces sent')

const rows = buildCustomerEmailList({
  notifications: [
    {
      id: 'n1',
      event_key: 'driver_assigned',
      event_label: 'Driver assigned',
      recipient_email: 'old@example.com',
      sent_at: '2026-09-01T10:00:00.000Z',
      delivery_status: 'sent',
    },
    {
      id: 'n2',
      event_key: 'admin_booking_confirmed',
      recipient_email: 'admin@shiftmyhome.co.uk',
      delivery_status: 'sent',
    },
  ],
  archives: [
    {
      id: 'a1',
      event_key: 'payment_confirmation:pi_1',
      subject: 'Payment received',
      recipient_email: 'pay@example.com',
      html_snapshot: '<p>Paid</p>',
      provider_status: 'delivered',
      invoice_path: 'quote/pi_1.pdf',
      invoice_filename: 'invoice.pdf',
      sent_at: '2026-10-02T09:00:00.000Z',
      notification_id: null,
    },
  ],
  quote: {
    email: 'pay@example.com',
    payment_confirmation_email_sent_at: '2026-08-01T00:00:00.000Z',
  },
})

assert(rows.length === 2, 'admin mail is omitted and the saved payment email replaces the legacy row')
assert(rows[0].subject === 'Payment received' && rows[0].status === 'delivered' && rows[0].hasSnapshot, 'saved copy keeps its subject and delivered status')
assert(rows[0].hasInvoice, 'the attached invoice stays on that email')
assert(!rows[1].hasSnapshot && rows[1].subject === 'Driver assigned', 'an older email has no saved copy')

const legacy = buildCustomerEmailList({
  notifications: [],
  archives: [],
  quote: { email: 'old@example.com', payment_confirmation_email_sent_at: '2026-08-01T00:00:00.000Z' },
})
assert(legacy.length === 1 && !legacy[0].hasSnapshot && legacy[0].status === 'sent', 'old payment email is listed without a fake preview')
assert(bookingInvoiceArchive([{ invoice_path: '' }, { invoice_path: 'a.pdf', sent_at: '2026-01-01' }])?.invoice_path === 'a.pdf', 'invoice lookup uses the stored file only')

console.log('Customer email archive: OK')
