/**
 * Sample admin Available Jobs email — no quotes/jobs/DB writes.
 */

import { sendResendEmail } from './resendClient.ts'
import { renderAdminAvailableJobEmail } from './transactionalEmailTemplates.ts'
import { adminSiteOrigin, getAdminNotificationRecipients } from './adminAvailableJobNotification.ts'

export type AdminTestEmailResult = {
  ok: boolean
  email_sent?: boolean
  error?: string
  skipped?: boolean
}

const TEST_SUBJECT = 'Test admin job notification — ShiftMyHome'

function testBannerHtml(): string {
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;">
    <tr>
      <td style="padding:14px 16px;font-size:14px;line-height:1.55;color:#92400e;">
        <strong>Test only.</strong> This is a test email from ShiftMyHome admin notifications. No job was created and no booking was marked as notified.
      </td>
    </tr>
  </table>`
}

function todayUk(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Sends a fixed sample email to admin recipients. Does not touch quotes or jobs.
 * @param idempotencySuffix — e.g. admin user id + minute bucket (anti-spam).
 */
export async function sendAdminAvailableJobTestEmail(
  idempotencySuffix: string,
): Promise<AdminTestEmailResult> {
  const recipients = getAdminNotificationRecipients()
  if (!recipients.length) {
    return { ok: false, error: 'no_admin_recipients' }
  }

  const origin = adminSiteOrigin()
  const { html, text: baseText } = renderAdminAvailableJobEmail({
    quoteRef: 'TEST-ADMIN-NOTIFICATION',
    customerName: 'Test Customer',
    serviceType: 'House Removals',
    pickupLabel: 'Glasgow',
    deliveryLabel: 'Edinburgh',
    moveDate: todayUk(),
    estimatedTotal: '£250.00',
    paymentStatus: 'Test only',
    volumeCrew: '12.50 m³ · 3 people',
    viewJobUrl: `${origin}/admin/available-jobs`,
    bannerHtml: testBannerHtml(),
    headerTitle: 'Test — new job available',
  })

  const text = [
    'TEST EMAIL — ShiftMyHome admin notifications',
    'This is a test email. No job was created.',
    '',
    baseText,
  ].join('\n')

  const suffix = String(idempotencySuffix || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  const minuteBucket = new Date().toISOString().slice(0, 16)
  const idempotencyKey = `admin-available-job-test-${suffix}-${minuteBucket}`

  const sendResult = await sendResendEmail({
    to: recipients,
    subject: TEST_SUBJECT,
    html,
    text,
    idempotencyKey,
  })

  if (!sendResult.ok) {
    return { ok: false, email_sent: false, error: sendResult.error || 'send_failed' }
  }

  return { ok: true, email_sent: true }
}
