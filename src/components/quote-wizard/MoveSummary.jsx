import MoveSummaryBody from './MoveSummaryBody'
import MobileMoveSummary from '../mobile/MobileMoveSummary'

export default function MoveSummary(props) {
  return (
    <>
      <aside className="hidden w-full min-w-0 flex-col gap-2 md:flex lg:sticky lg:top-24 lg:gap-4">
        <MoveSummaryBody {...props} />
      </aside>
      <MobileMoveSummary {...props} />
    </>
  )
}
