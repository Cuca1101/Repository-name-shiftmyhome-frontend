import { Component } from 'react'
import MarketplacePricingSettingsPanel from './admin-workflow/MarketplacePricingSettingsPanel'
import AdminWorkflowJobList from './admin-workflow/AdminWorkflowJobList'

class MarketplacePageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[MarketplaceJobsAdmin] render error:', error?.message ?? String(error))
    }
    console.error('[MarketplaceJobsAdmin error boundary]', error?.message ?? error, {
      name: error?.name,
      stack: error?.stack,
      componentStack: info?.componentStack,
    })
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-red-950">Marketplace could not render</h2>
          <p className="mt-2 text-sm text-red-900">
            {error?.message ? String(error.message) : 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            className="mt-4 min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function MarketplaceJobsAdmin() {
  return (
    <MarketplacePageErrorBoundary>
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Marketplace finance</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            The commission you set here applies only after a job is sent to the partner marketplace.
            It is not applied to Available Jobs or to jobs assigned to your own drivers. Partner payout
            is the job total minus this commission. It does not change the customer price or the balance
            remaining, and it is not net profit.
          </p>
          <div className="mt-3">
            <MarketplacePricingSettingsPanel
              marketplaceQuotes={[]}
              recalcScope="marketplace"
              onApplied={() => {}}
              compact
              embedded
            />
          </div>
        </section>
        <AdminWorkflowJobList
          workflow="marketplace"
          title="Marketplace"
          description="Jobs published to the partner marketplace awaiting acceptance. Once a partner accepts, the job moves to Job Accepted — it will not appear here."
        />
      </div>
    </MarketplacePageErrorBoundary>
  )
}
