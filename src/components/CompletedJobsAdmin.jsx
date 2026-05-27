import AdminWorkflowJobList from './admin-workflow/AdminWorkflowJobList'

export default function CompletedJobsAdmin() {
  return (
    <AdminWorkflowJobList
      workflow="completed"
      title="Completed Jobs"
      description="Completed jobs only — ref, driver, customer total, driver payout, platform profit, completion date, and payment status. Open View for full job history."
    />
  )
}
