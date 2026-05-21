import { useState } from 'react'
import UnlockProtectedSettingsModal from './UnlockProtectedSettingsModal'
import ProductionDataCleanupModal from './ProductionDataCleanupModal'
import { verifyProtectedMarketplaceSettingsUnlock } from '../../lib/adminProtectedMarketplaceSettingsAuth'

/**
 * PIN/password gate (same as Marketplace settings) then go-live cleanup confirmation.
 * Always requires fresh verification — does not reuse marketplace unlock session.
 *
 * @param {{ open: boolean, onClose: () => void, onDone?: () => void | Promise<void> }} props
 */
export default function GoLiveCleanupGate({ open, onClose, onDone }) {
  const [pinVerified, setPinVerified] = useState(false)
  const [cleanupOpen, setCleanupOpen] = useState(false)

  function handleCloseAll() {
    setPinVerified(false)
    setCleanupOpen(false)
    onClose()
  }

  function handlePinModalClose() {
    if (cleanupOpen) return
    setPinVerified(false)
    onClose()
  }

  if (!open) return null

  return (
    <>
      <UnlockProtectedSettingsModal
        open={open && !cleanupOpen}
        onClose={handlePinModalClose}
        onUnlock={async (creds) => {
          const result = await verifyProtectedMarketplaceSettingsUnlock(creds)
          if (result.ok) {
            setPinVerified(true)
            setCleanupOpen(true)
          }
          return result
        }}
        title="Protected destructive action"
        description="Use the same protected admin PIN/password as Marketplace settings. Verification is required again for this destructive action. This will archive/hide old test/demo admin data before live launch."
      />
      {pinVerified ? (
        <div className="sr-only" aria-live="polite">
          Verified. Confirm go-live cleanup below.
        </div>
      ) : null}
      <ProductionDataCleanupModal
        open={cleanupOpen}
        onClose={handleCloseAll}
        onDone={async () => {
          await onDone?.()
          handleCloseAll()
        }}
        showPinHint
      />
    </>
  )
}
