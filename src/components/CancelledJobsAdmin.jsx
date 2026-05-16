import AdminWorkflowJobList from './admin-workflow/AdminWorkflowJobList'

export default function CancelledJobsAdmin() {
  return (
    <AdminWorkflowJobList
      workflow="cancelled"
      title="Cancelled Jobs"
      description="Cancelled quotes or job cards, or jobs marked cancelled in marketplace controls. Cancellation reason and refund use local admin fields until persisted."
    />
  )
}
