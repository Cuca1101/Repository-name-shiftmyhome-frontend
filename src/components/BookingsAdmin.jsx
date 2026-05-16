import { AdminJobsPage } from './JobCardsAdmin'

export default function BookingsAdmin() {
  return (
    <AdminJobsPage
      title="Bookings"
      description="Jobs with status Booked — confirmed moves."
      statusFilter="Booked"
      emptyWithoutSearch="No bookings yet."
      showStatusFooter={false}
    />
  )
}
