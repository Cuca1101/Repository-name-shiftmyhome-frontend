import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { listCallContacts } from './data/callContactsRepository'
import { normalisePhone } from './ukPhone'

const CallContactsContext = createContext(null)

export function CallContactsProvider({ children }) {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setContacts(await listCallContacts())
    } catch (err) {
      setContacts([])
      setError(err?.message || 'Could not load contacts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const byPhone = useCallback(
    (phone) => {
      const parsed = normalisePhone(phone)
      if (!parsed.ok) return null
      return contacts.find((contact) => contact.phoneE164 === parsed.e164) || null
    },
    [contacts],
  )

  const value = useMemo(
    () => ({ contacts, loading, error, refresh, byPhone }),
    [contacts, loading, error, refresh, byPhone],
  )

  return <CallContactsContext.Provider value={value}>{children}</CallContactsContext.Provider>
}

export function useCallContacts() {
  const value = useContext(CallContactsContext)
  if (!value) {
    return {
      contacts: [],
      loading: false,
      error: '',
      refresh: async () => {},
      byPhone: () => null,
    }
  }
  return value
}
