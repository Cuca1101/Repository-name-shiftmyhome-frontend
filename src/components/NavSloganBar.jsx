/** Navy band directly under the site navbar. */
export default function NavSloganBar() {
  return (
    <div className="border-t border-white/10 bg-navy px-3 py-1.5 text-center sm:px-4 sm:py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white sm:text-sm sm:tracking-[0.2em]">Local Removals</p>
      <p className="mt-0.5 flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/75 sm:mt-1.5 sm:text-xs sm:tracking-[0.16em]">
        <span className="h-px w-6 bg-brand-400 sm:w-8" aria-hidden />
        Your move made simple
        <span className="h-px w-6 bg-brand-400 sm:w-8" aria-hidden />
      </p>
    </div>
  )
}
