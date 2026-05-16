import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import CoverageModal from '../components/coverage/CoverageModal'

const CoverageModalContext = createContext(null)

export function CoverageModalProvider({ children }) {
  const [open, setOpen] = useState(false)
  const openModal = useCallback(() => setOpen(true), [])
  const closeModal = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({ open, openModal, closeModal }), [open, openModal, closeModal])

  return (
    <CoverageModalContext.Provider value={value}>
      {children}
      <CoverageModal />
    </CoverageModalContext.Provider>
  )
}

/**
 * @returns {{ open: boolean, openModal: () => void, closeModal: () => void }}
 */
export function useCoverageModal() {
  const ctx = useContext(CoverageModalContext)
  if (!ctx) {
    return {
      open: false,
      openModal: () => {},
      closeModal: () => {},
    }
  }
  return ctx
}
