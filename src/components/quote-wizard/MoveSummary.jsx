import MoveSummaryBody from './MoveSummaryBody'
import MobileMoveSummary from '../mobile/MobileMoveSummary'
import QuoteReviewStickyPanel, {
  QuoteReviewPayCta,
  QuoteReviewSelectedSlot,
} from './QuoteReviewStickyPanel'

export default function MoveSummary(props) {
  const { reviewSticky, ...bodyProps } = props
  const mapVariant = bodyProps.step === 4 ? 'review' : 'default'
  const step3Sidebar =
    reviewSticky?.placement === 'aboveReference' && typeof reviewSticky?.onContinueToPayment === 'function'
  const { placement: _placement, ...stickyPanelProps } = reviewSticky || {}

  return (
    <>
      <aside className="hidden w-full min-w-0 flex-col gap-3 md:flex lg:sticky lg:top-24 lg:gap-4">
        {step3Sidebar ? (
          <QuoteReviewSelectedSlot {...stickyPanelProps} className="!shadow-card" />
        ) : null}
        <MoveSummaryBody {...bodyProps} mapVariant={mapVariant} />
        {step3Sidebar ? (
          <QuoteReviewPayCta
            onContinueToPayment={stickyPanelProps.onContinueToPayment}
            className="!shadow-card"
          />
        ) : null}
        {reviewSticky && !step3Sidebar ? (
          <QuoteReviewStickyPanel {...stickyPanelProps} className="!shadow-card" sticky />
        ) : null}
      </aside>

      {step3Sidebar ? (
        <div className="space-y-1.5 md:hidden">
          <QuoteReviewSelectedSlot {...stickyPanelProps} />
          <MobileMoveSummary {...bodyProps} mapVariant={mapVariant} />
          <QuoteReviewPayCta onContinueToPayment={stickyPanelProps.onContinueToPayment} />
        </div>
      ) : bodyProps.step === 4 ? null : (
        <MobileMoveSummary {...bodyProps} mapVariant={mapVariant} />
      )}
    </>
  )
}
