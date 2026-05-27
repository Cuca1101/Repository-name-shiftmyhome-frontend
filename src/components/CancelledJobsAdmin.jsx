import AdminWorkflowJobList from './admin-workflow/AdminWorkflowJobList'

export default function CancelledJobsAdmin() {
  return (
    <AdminWorkflowJobList
      workflow="cancelled"
      title="Cancelled Jobs"
      description="Cancelled jobs only — reason, who cancelled, date/time, and any driver charges or deductions linked to the booking."
    />
  )
}
