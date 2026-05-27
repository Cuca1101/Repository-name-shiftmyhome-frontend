import AdminWorkflowJobList from './admin-workflow/AdminWorkflowJobList'

export default function ActiveJobsAdmin() {
  return (
    <AdminWorkflowJobList
      workflow="active"
      title="Job Accepted"
      description="Compact list of accepted and in-progress jobs. Click a row or View to open the full job control screen."
    />
  )
}
