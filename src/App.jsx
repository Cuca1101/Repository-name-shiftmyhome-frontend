import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import WebsiteLeadPageTracker from './components/WebsiteLeadPageTracker'
import PublicMarketingTracker from './components/PublicMarketingTracker'
import CookieConsentBanner from './components/CookieConsentBanner'
import SiteBrandMeta from './components/seo/SiteBrandMeta'
import GlobalCanonicalLink from './components/seo/GlobalCanonicalLink'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import PublicLayout from './layouts/PublicLayout'
import ServiceQuoteLayout from './layouts/ServiceQuoteLayout'
import HomePage from './pages/HomePage'
import QuotePage from './pages/QuotePage'
import QuoteResumePage from './pages/QuoteResumePage'
import QuotePayRecoveryPage from './pages/QuotePayRecoveryPage'
import JobTrackingPortalPage from './pages/JobTrackingPortalPage'
import { PortalSessionProvider } from './components/customer-portal/PortalShell'
import CustomerPortalLoginPage from './pages/CustomerPortalLoginPage'
import CustomerPortalAuthPage from './pages/CustomerPortalAuthPage'
import CustomerPortalBookingsPage from './pages/CustomerPortalBookingsPage'
import CustomerPortalBookingPage from './pages/CustomerPortalBookingPage'
import CustomerPortalEditPage from './pages/CustomerPortalEditPage'
import CustomerPortalForgotPasswordPage from './pages/CustomerPortalForgotPasswordPage'
import CustomerPortalResetPasswordPage from './pages/CustomerPortalResetPasswordPage'
import CustomerPortalConfirmEmailPage from './pages/CustomerPortalConfirmEmailPage'
import CustomerPortalAccountPage from './pages/CustomerPortalAccountPage'
import CustomerPortalHelpPage from './pages/CustomerPortalHelpPage'
import JobFeedbackPage from './pages/JobFeedbackPage'
import JobTipPage from './pages/JobTipPage'
import CoveragePage from './pages/CoveragePage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import CookiePreferencesPage from './pages/CookiePreferencesPage'
import BlogPage from './pages/BlogPage'
import ServiceQuotePage from './pages/ServiceQuotePage'
import AdminLogin from './pages/AdminLogin'
import DriverResetPasswordPage from './pages/DriverResetPasswordPage'
import AdminHome from './pages/AdminHome'
import BookingsAdmin from './components/BookingsAdmin'
import JobCardsAdmin from './components/JobCardsAdmin'
import JobHistoryAdmin from './components/JobHistoryAdmin'
import JobCardDetails from './components/JobCardDetails'
import PricingEngineAdmin from './components/PricingEngineAdmin'
import ItemsLibraryAdmin from './components/ItemsLibraryAdmin'
import ReviewsAdmin from './components/ReviewsAdmin'
import WebsiteCmsAdmin from './components/admin/WebsiteCmsAdmin'
import PhoneBookingAdmin from './components/PhoneBookingAdmin'
import EditBookingAdmin from './components/EditBookingAdmin'
import AuthAccessAdmin from './pages/AuthAccessAdmin'
import SeoDashboardAdmin from './components/admin/SeoDashboardAdmin'
import AvailableJobsAdmin from './components/AvailableJobsAdmin'
import MarketplaceJobsAdmin from './components/MarketplaceJobsAdmin'
import ActiveJobsAdmin from './components/ActiveJobsAdmin'
import CompletedJobsAdmin from './components/CompletedJobsAdmin'
import CancelledJobsAdmin from './components/CancelledJobsAdmin'
import DriversAdmin from './components/DriversAdmin'
import DriverPaymentsAdmin from './pages/DriverPaymentsAdmin'
import PartnersAdmin from './components/PartnersAdmin'
import HomePageQuoteRequestsAdmin from './components/HomePageQuoteRequestsAdmin'
import AllQuotesAdmin from './components/AllQuotesAdmin'
import QuoteRequestLeadDetails from './components/QuoteRequestLeadDetails'
import WebsiteLeadsAdmin from './components/WebsiteLeadsAdmin'
import CustomerLeadsAdmin from './components/CustomerLeadsAdmin'
import CustomersAdmin from './components/CustomersAdmin'
import CustomerLeadDetailAdmin from './components/CustomerLeadDetailAdmin'
import AdminAnalyticsPage from './pages/AdminAnalyticsPage'
import AdminSessionsPage from './pages/AdminSessionsPage'
import ExtraChargesAdmin from './components/ExtraChargesAdmin'
import CustomerTipsAdmin from './components/CustomerTipsAdmin'
import DriverMessagesAdmin from './components/DriverMessagesAdmin'
import AvailableJobDetails from './components/AvailableJobDetails'
import JourneyPlannerPage from './components/JourneyPlannerPage'
import JourneyViewPage from './components/journey-planner/JourneyViewPage'
import OperationsMapPage from './components/OperationsMapPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentCancelledPage from './pages/PaymentCancelledPage'
import SeoLandingPage from './pages/SeoLandingPage'
import NotFoundPage from './pages/NotFoundPage'

const AdminCallCentrePage = lazy(() => import('./pages/AdminCallCentrePage'))
import { SEO_PAGE_PATHS } from './data/seoPages'
import { withTrailingSlashVariants } from './lib/normalizePublicPath'

function RedirectLegacyQuoteDetail() {
  const { id } = useParams()
  return <Navigate to={`/admin/quote-requests/${id}`} replace />
}

function AdminCustomerPortalRedirect() {
  const { id, bookingId } = useParams()
  const target = bookingId
    ? `/portal/bookings/${bookingId}?customer=${id}`
    : `/portal/bookings?customer=${id}`
  return <Navigate to={target} replace />
}

const servicePaths = withTrailingSlashVariants([
  '/house-removals',
  '/man-with-van',
  '/furniture-delivery',
  '/office-moves',
  '/student-moves',
  '/clearance',
  '/long-distance-removals',
  '/urgent-removals',
])

const seoRoutePaths = withTrailingSlashVariants(SEO_PAGE_PATHS)

export default function App() {
  return (
    <>
      <WebsiteLeadPageTracker />
      <PublicMarketingTracker />
      <SiteBrandMeta />
      <GlobalCanonicalLink />
      <CookieConsentBanner />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/quote" element={<QuotePage />} />
      <Route
        path="/quote/resume/:token"
        element={
          <PublicLayout>
            <QuoteResumePage />
          </PublicLayout>
        }
      />
      <Route
        path="/quote/pay/:token"
        element={
          <PublicLayout>
            <QuotePayRecoveryPage />
          </PublicLayout>
        }
      />
      <Route element={<PortalSessionProvider />}>
      <Route path="/portal" element={<CustomerPortalLoginPage />} />
      <Route path="/portal/auth" element={<CustomerPortalAuthPage />} />
      <Route path="/portal/bookings" element={<CustomerPortalBookingsPage />} />
      <Route path="/portal/bookings/:id" element={<CustomerPortalBookingPage />} />
      <Route path="/portal/bookings/:id/edit" element={<CustomerPortalEditPage />} />
      <Route path="/portal/account" element={<CustomerPortalAccountPage />} />
      <Route path="/portal/help" element={<CustomerPortalHelpPage />} />
      <Route path="/portal/forgot-password" element={<CustomerPortalForgotPasswordPage />} />
      <Route path="/portal/reset-password" element={<CustomerPortalResetPasswordPage />} />
      <Route path="/portal/confirm-email" element={<CustomerPortalConfirmEmailPage />} />
      </Route>
      <Route
        path="/track/:token"
        element={
          <PublicLayout>
            <JobTrackingPortalPage />
          </PublicLayout>
        }
      />
      <Route
        path="/track/:token/feedback"
        element={
          <PublicLayout>
            <JobFeedbackPage />
          </PublicLayout>
        }
      />
      <Route
        path="/track/:token/tip"
        element={
          <PublicLayout>
            <JobTipPage />
          </PublicLayout>
        }
      />
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
        path="/blog"
        element={
          <PublicLayout>
            <BlogPage />
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
            <ServiceQuoteLayout>
              <ServiceQuotePage />
            </ServiceQuoteLayout>
          }
        />
      ))}
      {seoRoutePaths.map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <PublicLayout>
              <SeoLandingPage />
            </PublicLayout>
          }
        />
      ))}
      <Route path="/driver/reset-password" element={<DriverResetPasswordPage />} />
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
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="sessions" element={<AdminSessionsPage />} />
        <Route
          path="calls"
          element={
            <Suspense
              fallback={
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
                  <span
                    className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
                    aria-hidden
                  />
                  Loading Call Centre…
                </div>
              }
            >
              <AdminCallCentrePage />
            </Suspense>
          }
        />
        <Route path="operations-map" element={<OperationsMapPage />} />
        <Route path="available-jobs/:id/edit" element={<EditBookingAdmin />} />
        <Route path="available-jobs/:id" element={<AvailableJobDetails />} />
        <Route path="available-jobs" element={<AvailableJobsAdmin />} />
        <Route path="journey-planner/view/:journeyId" element={<JourneyViewPage />} />
        <Route path="journey-planner" element={<JourneyPlannerPage />} />
        <Route path="marketplace" element={<MarketplaceJobsAdmin />} />
        <Route path="active-jobs/:id/edit" element={<EditBookingAdmin />} />
        <Route path="active-jobs/:id" element={<AvailableJobDetails />} />
        <Route path="active-jobs" element={<ActiveJobsAdmin />} />
        <Route path="completed-jobs" element={<CompletedJobsAdmin />} />
        <Route path="cancelled-jobs" element={<CancelledJobsAdmin />} />
        <Route path="access-control" element={<AuthAccessAdmin />} />
        <Route path="drivers" element={<DriversAdmin />} />
        <Route path="driver-payments" element={<DriverPaymentsAdmin />} />
        <Route path="partners" element={<PartnersAdmin />} />
        <Route path="new-phone-booking" element={<PhoneBookingAdmin />} />
        <Route path="all-quotes" element={<AllQuotesAdmin />} />
        <Route path="quote-requests" element={<HomePageQuoteRequestsAdmin />} />
        <Route path="quote-requests/:id" element={<QuoteRequestLeadDetails />} />
        <Route path="website-leads" element={<WebsiteLeadsAdmin />} />
        <Route path="customers" element={<CustomersAdmin />} />
        <Route path="customers/:id/portal/:bookingId" element={<AdminCustomerPortalRedirect />} />
        <Route path="customers/:id/portal" element={<AdminCustomerPortalRedirect />} />
        <Route path="customers/:id" element={<AdminCustomerPortalRedirect />} />
        <Route path="customer-leads" element={<CustomerLeadsAdmin />} />
        <Route path="customer-leads/:id" element={<CustomerLeadDetailAdmin />} />
        <Route path="quotes/:id" element={<RedirectLegacyQuoteDetail />} />
        <Route path="quotes" element={<Navigate to="/admin/all-quotes" replace />} />
        <Route path="jobs" element={<JobCardsAdmin />} />
        <Route path="bookings" element={<BookingsAdmin />} />
        <Route path="job-history" element={<JobHistoryAdmin />} />
        <Route path="jobs/:id" element={<JobCardDetails />} />
        <Route path="pricing" element={<PricingEngineAdmin />} />
        <Route path="items" element={<ItemsLibraryAdmin />} />
        <Route path="reviews" element={<ReviewsAdmin />} />
        <Route path="website-cms" element={<WebsiteCmsAdmin />} />
        <Route path="seo" element={<SeoDashboardAdmin />} />
        <Route path="extra-charges" element={<ExtraChargesAdmin />} />
        <Route path="customer-tips" element={<CustomerTipsAdmin />} />
        <Route path="driver-messages" element={<DriverMessagesAdmin />} />
        <Route path="support-requests" element={<Navigate to="/admin/driver-messages" replace />} />
      </Route>
      <Route
        path="*"
        element={
          <PublicLayout>
            <NotFoundPage />
          </PublicLayout>
        }
      />
    </Routes>
    </>
  )
}
