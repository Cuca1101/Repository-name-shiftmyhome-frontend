import { normalisePhone } from './ukPhone'

/** Official Teams entry. The signed-in user chooses the desktop or web client. */
export const TEAMS_HOME_URL = 'https://teams.microsoft.com/'

/**
 * Official Teams audio deep link for a PSTN number.
 * The call is confirmed and placed in Teams, not inside this website.
 * The leading + is encoded as %2B so Teams keeps the E.164 form.
 * @param {string} e164
 */
export function teamsCallUrl(e164) {
  const digits = String(e164 || '').replace(/^\+/, '').replace(/\D/g, '')
  return `https://teams.microsoft.com/l/call/0/0?users=4:%2B${digits}`
}

/**
 * @param {string} phone
 * @returns {{ ok: true, href: string, e164: string } | { ok: false, error: string }}
 */
export function teamsCallLink(phone) {
  const parsed = normalisePhone(phone)
  if (!parsed.ok) return parsed
  return { ok: true, href: teamsCallUrl(parsed.e164), e164: parsed.e164 }
}
