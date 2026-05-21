/**
 * @param {{ className?: string, variant?: 'light' | 'dark' }} props
 */
export default function JourneyCompletionGuidance({ className = '', variant = 'light' }) {
  const items = [
    'Send to Marketplace if you want partners to claim it.',
    'Assign internal driver if your own driver will complete it.',
    'Use Save Journey after changing stop order or pricing.',
  ]

  const box =
    variant === 'dark'
      ? 'border-white/15 bg-white/5 text-slate-200'
      : 'border-slate-200 bg-white text-slate-700'

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${box} ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">When the journey is ready</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  )
}
