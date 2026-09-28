/** Navy band directly under the site navbar. */
export default function NavSloganBar() {
  return (
    <div className="border-t border-white/10 bg-navy px-4 py-3 text-center sm:py-3.5">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-white sm:text-base">Local Removals</p>
      <p className="mt-1.5 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/75 sm:text-xs">
        <span className="h-px w-6 bg-brand-400 sm:w-8" aria-hidden />
        Your move made simple
        <span className="h-px w-6 bg-brand-400 sm:w-8" aria-hidden />
      </p>
    </div>
  )
}
