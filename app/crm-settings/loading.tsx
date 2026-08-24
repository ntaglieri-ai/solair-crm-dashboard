function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />
}

export default function CrmSettingsLoading() {
  return (
    <div>
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Stessa scatola della sidebar di sezione, per non far saltare il layout. */}
        <aside className="lg:w-64 lg:shrink-0">
          <div className="overflow-hidden rounded-xl border border-white/70 bg-white/82 shadow-[0_18px_45px_rgb(30_58_95/8%)] ring-1 ring-slate-900/[0.03]">
            <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_54%,#f6fffc_100%)] px-3 py-3">
              <SkeletonLine className="h-6 w-32" />
            </div>
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLine key={i} className="h-11 w-full" />
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              <SkeletonLine className="h-7 w-56" />
              <SkeletonLine className="h-4 w-96 max-w-full" />
            </div>
            <SkeletonLine className="h-10 w-36" />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLine key={i} className="h-24" />
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-border">
            <SkeletonLine className="m-4 h-10" />
            <div className="border-t border-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <SkeletonLine className="h-5" />
                  <SkeletonLine className="h-5" />
                  <SkeletonLine className="h-5" />
                  <SkeletonLine className="h-5" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
