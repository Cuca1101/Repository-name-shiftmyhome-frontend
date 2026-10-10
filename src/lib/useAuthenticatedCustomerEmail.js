import { useEffect, useState } from 'react'
import { authenticatedCustomerEmail } from './customerPortalApi'

/** Empty unless a customer portal session is signed in. Staff sessions stay empty. */
export function useAuthenticatedCustomerEmail() {
  const [email, setEmail] = useState('')

  useEffect(() => {
    let cancelled = false
    authenticatedCustomerEmail()
      .then((value) => {
        if (!cancelled && value) setEmail(value)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return email
}
