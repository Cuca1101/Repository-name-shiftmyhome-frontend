import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import PublicLayout from './layouts/PublicLayout'
import HomePage from './pages/HomePage'
import QuotePage from './pages/QuotePage'
import CoveragePage from './pages/CoveragePage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import CookiePreferencesPage from './pages/CookiePreferencesPage'
import ServiceQuotePage from './pages/ServiceQuotePage'
import AdminLogin from './pages/AdminLogin'
import AdminHome from './pages/AdminHome'
import BookingsAdmin from './components/BookingsAdmin'
import JobCardsAdmin from './components/JobCardsAdmin'
import JobHistoryAdmin from './components/JobHistoryAdmin'
import JobCardDetails from './components/JobCardDetails'
import PricingEngineAdmin from './components/PricingEngineAdmin'
import ItemsLibraryAdmin from './components/ItemsLibraryAdmin'
import ReviewsAdmin from './components/ReviewsAdmin'
import WebsiteCmsAdmin from './components/admin/WebsiteCmsAdmin'
import AvailableJobsAdmin from './components/AvailableJobsAdmin'
import MarketplaceJobsAdmin from './components/MarketplaceJobsAdmin'
import ActiveJobsAdmin from './components/ActiveJobsAdmin'
import CompletedJobsAdmin from './components/CompletedJobsAdmin'
import CancelledJobsAdmin from './components/CancelledJobsAdmin'
import DriversAdmin from './components/DriversAdmin'
import PartnersAdmin from './components/PartnersAdmin'
import HomePageQuoteRequestsAdmin from './components/HomePageQuoteRequestsAdmin'
import WebsiteLeadsAdmin from './components/WebsiteLeadsAdmin'
import AvailableJobDetails from './components/AvailableJobDetails'
import JourneyPlannerPage from './components/JourneyPlannerPage'
import OperationsMapPage from './components/OperationsMapPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentCancelledPage from './pages/PaymentCancelledPage'

function RedirectQuoteDetailToAvailableJobs() {
  const { id } = useParams()
  return <Navigate to={`/admin/available-jobs/${id}`} replace />
}

const servicePaths = [
  '/house-removals',
  '/man-with-van',
  '/furniture-delivery',
  '/office-moves',
  '/student-moves',
  '/clearance',
]

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/quote" element={<QuotePage />} />
      <Route
        path="/coverage"
        element={
          <PublicLayout>
            <CoveragePage />
          </PublicLayout>
        }
      />
      <Route
        path="/terms"
        element={
          <PublicLayout>
            <TermsPage />
          </PublicLayout>
        }
      />
      <Route
        path="/privacy"
        element={
          <PublicLayout>
            <PrivacyPage />
          </PublicLayout>
        }
      />
      <Route
        path="/cookies"
        element={
          <PublicLayout>
            <CookiePreferencesPage />
          </PublicLayout>
        }
      />
      <Route
        path="/payment-success"
        element={
          <PublicLayout>
            <PaymentSuccessPage />
          </PublicLayout>
        }
      />
      <Route
        path="/payment-cancelled"
        element={
          <PublicLayout>
            <PaymentCancelledPage />
          </PublicLayout>
        }
      />
      {servicePaths.map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <PublicLayout>
              <ServiceQuotePage />
            </PublicLayout>
          }
        />
      ))}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="operations-map" element={<OperationsMapPage />} />
        <Route path="available-jobs/:id" element={<AvailableJobDetails />} />
        <Route path="available-jobs" element={<AvailableJobsAdmin />} />
        <Route path="journey-planner" element={<JourneyPlannerPage />} />
        <Route path="marketplace" element={<MarketplaceJobsAdmin />} />
        <Route path="active-jobs" element={<ActiveJobsAdmin />} />
        <Route path="completed-jobs" element={<CompletedJobsAdmin />} />
        <Route path="cancelled-jobs" element={<CancelledJobsAdmin />} />
        <Route path="drivers" element={<DriversAdmin />} />
        <Route path="partners" element={<PartnersAdmin />} />
        <Route path="quote-requests" element={<HomePageQuoteRequestsAdmin />} />
        <Route path="website-leads" element={<WebsiteLeadsAdmin />} />
        <Route path="quotes/:id" element={<RedirectQuoteDetailToAvailableJobs />} />
        <Route path="quotes" element={<Navigate to="/admin/available-jobs" replace />} />
        <Route path="jobs" element={<JobCardsAdmin />} />
        <Route path="bookings" element={<BookingsAdmin />} />
        <Route path="job-history" element={<JobHistoryAdmin />} />
        <Route path="jobs/:id" element={<JobCardDetails />} />
        <Route path="pricing" element={<PricingEngineAdmin />} />
        <Route path="items" element={<ItemsLibraryAdmin />} />
        <Route path="reviews" element={<ReviewsAdmin />} />
        <Route path="website-cms" element={<WebsiteCmsAdmin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
