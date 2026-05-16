import { AdminJobsPage } from './JobCardsAdmin'

export default function JobHistoryAdmin() {
  return (
    <AdminJobsPage
      title="Job history"
      description="Jobs marked Completed."
      statusFilter="Completed"
      emptyWithoutSearch="No completed jobs yet."
      showStatusFooter={false}
    />
  )
}
