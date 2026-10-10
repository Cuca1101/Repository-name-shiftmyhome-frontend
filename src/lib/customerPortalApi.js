import { canEnterCustomerPortal } from './accountRole'
import { detailFromFunctionsInvokeError } from './functionsInvokeError'
import { customerPortalClient } from './customerPortalClient'
import { isSupabaseConfigured, supabase } from './supabase'

function portalAccess(access) {
  if (access?.mode === 'admin' && access.customerId) {
    return { mode: 'admin', customerId: String(access.customerId) }
  }
  return { mode: 'customer', customerId: '' }
}

async function invoke(name, body, client) {
  const active = client || customerPortalClient
  if (!isSupabaseConfigured || !active) throw new Error('Bookings are temporarily unavailable.')
  const { data, error } = await active.functions.invoke(name, { body })
  if (data && data.ok === false) throw new Error(data.error || 'Request failed.')
  if (error) throw new Error(await detailFromFunctionsInvokeError(error, 'Request failed.'))
  return data
}

function portalMailError(err, fallback) {
  const text = String(err?.message || '').trim()
  if (!text || /failed to send a request|failed to fetch|network error/i.test(text)) {
    return 'The email service could not be reached. Check your connection and try again.'
  }
  if (/edge function returned a non-2xx/i.test(text)) return fallback
  return text
}

export async function requestPortalLink(email, quoteId) {
  try {
    return await invoke('customer-portal-link', {
      email: String(email || '').trim(),
      quote_id: quoteId || null,
      purpose: 'sign-in',
    })
  } catch (err) {
    throw new Error(portalMailError(err, 'Could not send the login link.'))
  }
}

export async function requestPasswordReset(email) {
  try {
    return await invoke('customer-portal-link', {
      email: String(email || '').trim(),
      purpose: 'recovery',
    })
  } catch (err) {
    throw new Error(portalMailError(err, 'Could not send the password reset link.'))
  }
}

function profileFromRow(row) {
  return {
    id: row?.id || '',
    fullName: row?.full_name || '',
    phone: row?.phone || '',
    email: row?.email || '',
    savedAddress: row?.saved_address || '',
    pendingEmail: row?.pending_email || '',
    hasPassword: Boolean(row?.has_password),
    bookingCount: Number(row?.booking_count) || 0,
    firstBookingAt: row?.first_booking_at || null,
  }
}

function customerFromAdmin(data) {
  return profileFromRow(data?.customer)
}

/** Signed-in customer email. Staff sessions are not a customer identity. */
export async function authenticatedCustomerEmail() {
  if (!customerPortalClient) return ''
  const { data } = await customerPortalClient.auth.getSession()
  const user = data?.session?.user
  if (!canEnterCustomerPortal(user)) return ''
  return String(user.email || '').trim().toLowerCase()
}

export async function authenticatedCustomerAccessToken() {
  if (!customerPortalClient) return ''
  const { data } = await customerPortalClient.auth.getSession()
  const user = data?.session?.user
  if (!canEnterCustomerPortal(user)) return ''
  return String(data.session?.access_token || '')
}

export async function getPortalContact(access) {
  const view = portalAccess(access)
  if (view.mode === 'admin') {
    if (!supabase) return null
    const { data, error } = await supabase.rpc('admin_customer_portal_list', { p_customer_id: view.customerId })
    if (error || !data?.ok) return null
    return customerFromAdmin(data)
  }
  if (!customerPortalClient) return null
  const { data, error } = await customerPortalClient.rpc('customer_portal_contact')
  if (error || !data?.ok) return null
  return profileFromRow(data)
}

export async function savePortalProfile(field, value, access) {
  const view = portalAccess(access)
  const client = view.mode === 'admin' ? supabase : customerPortalClient
  if (!client) throw new Error('Account settings are unavailable.')
  const { data, error } = await client.rpc('customer_portal_save_profile', {
    p_field: field,
    p_value: value,
    p_customer_id: view.mode === 'admin' ? view.customerId : null,
  })
  if (error) throw new Error(error.message || 'Could not save this change.')
  if (!data?.ok) throw new Error(data?.error || 'Could not save this change.')
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('smh-portal-profile'))
  return profileFromRow(data)
}

export async function requestEmailChange(newEmail, access) {
  const view = portalAccess(access)
  return invoke('customer-portal-link', {
    purpose: 'email-change',
    new_email: String(newEmail || '').trim(),
    ...(view.mode === 'admin' ? { admin_customer_id: view.customerId } : {}),
  }, view.mode === 'admin' ? supabase : customerPortalClient)
}

export async function confirmEmailChange(token) {
  return invoke('customer-portal-link', {
    purpose: 'confirm-email',
    token: String(token || '').trim(),
  }, customerPortalClient)
}

export async function listPortalBookings(access) {
  const view = portalAccess(access)
  if (view.mode === 'admin') {
    if (!supabase) throw new Error('Bookings are temporarily unavailable.')
    const { data, error } = await supabase.rpc('admin_customer_portal_list', { p_customer_id: view.customerId })
    if (error) throw new Error(error.message || 'Could not load bookings.')
    if (!data?.ok) throw new Error(data?.error === 'forbidden' ? 'Admin access is required.' : 'Customer not found.')
    return Array.isArray(data.bookings) ? data.bookings : []
  }
  if (!customerPortalClient) throw new Error('Bookings are temporarily unavailable.')
  const { data, error } = await customerPortalClient.rpc('customer_portal_list_bookings')
  if (error) throw new Error(error.message || 'Could not load bookings.')
  if (!data?.ok) throw new Error('Sign in again to see your bookings.')
  return Array.isArray(data.bookings) ? data.bookings : []
}

export async function getPortalBooking(quoteId, access) {
  const view = portalAccess(access)
  if (view.mode === 'admin') {
    if (!supabase) throw new Error('Bookings are temporarily unavailable.')
    const { data, error } = await supabase.rpc('admin_customer_portal_booking', {
      p_customer_id: view.customerId,
      p_quote_id: quoteId,
    })
    if (error) throw new Error(error.message || 'Could not load this booking.')
    if (!data?.ok || !data.booking) {
      const err = new Error(data?.error === 'forbidden' ? 'Admin access is required.' : 'Booking not found.')
      err.code = 'not_found'
      throw err
    }
    return data
  }
  if (!customerPortalClient) throw new Error('Bookings are temporarily unavailable.')
  const { data, error } = await customerPortalClient.rpc('customer_portal_get_booking', { p_quote_id: quoteId })
  if (error) throw new Error(error.message || 'Could not load this booking.')
  if (!data?.ok || !data.booking) {
    const err = new Error('Booking not found.')
    err.code = 'not_found'
    throw err
  }
  return data
}

function amendBody(action, fields, access) {
  const view = portalAccess(access)
  return {
    action,
    ...fields,
    ...(view.mode === 'admin' ? { admin_customer_id: view.customerId } : {}),
  }
}

function amendClient(access) {
  return portalAccess(access).mode === 'admin' ? supabase : customerPortalClient
}

export async function previewPortalChange(quoteId, edits, access) {
  return invoke('customer-booking-amend', amendBody('preview', { quote_id: quoteId, edits }, access), amendClient(access))
}

export async function commitPortalChange(quoteId, edits, expectedTotal, access) {
  return invoke('customer-booking-amend', amendBody('commit', {
    quote_id: quoteId,
    edits,
    expected_total: expectedTotal,
  }, access), amendClient(access))
}

export async function payPortalAmendment(quoteId, amendmentId, access) {
  return invoke('customer-booking-amend', amendBody('pay', { quote_id: quoteId, amendment_id: amendmentId }, access), amendClient(access))
}

export async function abandonPortalAmendment(quoteId, amendmentId, access) {
  return invoke('customer-booking-amend', amendBody('abandon', { quote_id: quoteId, amendment_id: amendmentId }, access), amendClient(access))
}

export async function confirmPortalPayment(quoteId, sessionId, access) {
  return invoke('customer-booking-amend', amendBody('confirm_payment', {
    quote_id: quoteId,
    session_id: sessionId,
  }, access), amendClient(access))
}

export async function reviewPortalAmendment(amendmentId, action) {
  return invoke('customer-booking-amend', { action, amendment_id: amendmentId }, supabase)
}
