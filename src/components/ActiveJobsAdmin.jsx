import AdminWorkflowJobList from './admin-workflow/AdminWorkflowJobList'

export default function ActiveJobsAdmin() {
  return (
    <AdminWorkflowJobList
      workflow="active"
      title="Active Jobs"
      description="Jobs with a driver/assignee, operational progress, or a linked job card that is not completed or cancelled."
    />
  )
}
