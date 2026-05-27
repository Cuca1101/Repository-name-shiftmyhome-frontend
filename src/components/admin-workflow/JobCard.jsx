import AdminJobOperationsCard from './AdminJobOperationsCard'

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   statusBadge?: { label: string, tone?: string } | null,
 *   workflowRows?: { label: string, value: string }[],
 *   showQuickActions?: boolean,
 *   adminSlot?: unknown,
 *   listVariant?: 'available' | 'marketplace' | 'active' | 'completed' | 'cancelled' | null,
 *   layoutMode?: 'grid' | 'list',
 *   onAssignDriver?: () => void,
 *   onMarketplace?: () => void,
 *   selectionCheckbox?: unknown,
 *   marketplaceOnApplied?: () => void | Promise<void>,
 *   onDemoCancelled?: () => void | Promise<void>,
 *   highlight?: boolean,
 *   secondarySlot?: unknown,
 *   viewJobLabel?: string,
 * }} props
 */
export default function JobCard({
  q,
  statusBadge = null,
  workflowRows = [],
  adminSlot = null,
  listVariant = null,
  layoutMode = 'list',
  selectionCheckbox = null,
  highlight = false,
  secondarySlot = null,
  viewJobLabel,
}) {
  const cardVariant =
    listVariant === 'available'
      ? 'available'
      : listVariant === 'marketplace'
        ? 'marketplace'
        : listVariant === 'active'
          ? 'active'
          : listVariant === 'completed'
            ? 'completed'
            : listVariant === 'cancelled'
              ? 'cancelled'
              : 'default'

  return (
    <AdminJobOperationsCard
      q={q}
      cardVariant={cardVariant}
      statusBadge={statusBadge}
      workflowRows={workflowRows}
      layoutMode={layoutMode}
      selectionCheckbox={selectionCheckbox}
      secondarySlot={secondarySlot ?? adminSlot}
      highlight={highlight}
      viewJobLabel={viewJobLabel}
    />
  )
}

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

export { money }
