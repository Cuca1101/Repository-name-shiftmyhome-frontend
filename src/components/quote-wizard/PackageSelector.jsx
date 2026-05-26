import { Check, Crown, Shield, CircleCheck } from 'lucide-react'

const PACKAGES = [
  {
    id: 'standard',
    name: 'Standard',
    subtitle: null,
    icon: Shield,
    features: [
      'Professional loading & transport team',
      'Flexible payment \u2013 pay on completion',
      'Basic insurance coverage included',
      'Free cancellation up to 48 hours',
      '30 minutes waiting time included',
      'Basic furniture placement service',
    ],
    className: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md',
    selectedClassName: 'border-brand-500 bg-white ring-2 ring-brand-500/20 shadow-md',
    iconBg: 'bg-slate-100 text-slate-600',
    selectedIconBg: 'bg-brand-50 text-brand-600',
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'Best for stress-free house moves',
    icon: Crown,
    badge: 'Recommended',
    features: [
      'Expert packing, loading & transport crew',
      'Complete packing & wrapping assistance',
      'All protective materials included',
      'Reserve now, settle on completion',
      'Furniture disassembly & reassembly service',
      'Personal move coordinator assigned',
      'Enhanced ShiftMyHome Protection (\u00a350k)',
      'Free cancellation up to 48 hours',
      'Extended waiting time (up to 2 hours)',
      'Complimentary furniture arrangement service',
    ],
    className:
      'border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50',
    selectedClassName:
      'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50/60 ring-2 ring-blue-400/30 shadow-lg shadow-blue-100/40',
    iconBg: 'bg-blue-100 text-blue-600',
    selectedIconBg: 'bg-blue-100 text-blue-700',
  },
]

/**
 * Compact premium package tier selector.
 * @param {{ value: string, onChange: (tier: string) => void }} props
 */
export default function PackageSelector({ value, onChange }) {
  const selected = value || 'standard'

  return (
    <div className="space-y-2 sm:space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 sm:text-base">Choose your service level</h3>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Select what works best for your move.</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        {PACKAGES.map((pkg) => {
          const isSelected = selected === pkg.id
          const Icon = pkg.icon
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => onChange(pkg.id)}
              className={`relative flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200 sm:rounded-2xl sm:p-4 ${
                isSelected ? pkg.selectedClassName : pkg.className
              }`}
            >
              {pkg.badge ? (
                <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm sm:right-4">
                  {pkg.badge}
                </span>
              ) : null}

              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition sm:h-10 sm:w-10 ${
                  isSelected ? pkg.selectedIconBg : pkg.iconBg
                }`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 sm:text-[15px]">{pkg.name}</span>
                  {isSelected ? (
                    <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand-600 sm:h-5 sm:w-5">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                  ) : null}
                </div>
                {pkg.subtitle ? (
                  <p className="mt-0.5 text-[10px] font-medium italic text-blue-600/80 sm:text-[11px]">{pkg.subtitle}</p>
                ) : null}
                <ul className="mt-1.5 space-y-[3px]">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-slate-600 sm:text-[11.5px]">
                      <CircleCheck className="mt-[1px] h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.5} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
