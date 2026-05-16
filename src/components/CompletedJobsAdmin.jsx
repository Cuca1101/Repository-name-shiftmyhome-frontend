import AdminWorkflowJobList from './admin-workflow/AdminWorkflowJobList'

export default function CompletedJobsAdmin() {
  return (
    <AdminWorkflowJobList
      workflow="completed"
      title="Completed Jobs"
      description="Quote workflow or linked job card marked completed. POD and signature fields are local admin flags until stored in the database."
    />
  )
}
