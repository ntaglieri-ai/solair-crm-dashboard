function Skeleton({
  className = "",
}: {
  className?: string
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/80 ${className}`}
      aria-hidden="true"
    />
  )
}

export function CrmSettingsSectionLoading() {
  return (
    <div
      className="min-h-[420px] animate-in fade-in duration-150"
      role="status"
      aria-label="Caricamento sezione"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Skeleton className="h-6 w-52 max-w-[65%]" />
          <Skeleton className="h-4 w-[420px] max-w-[90%]" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <Skeleton className="m-4 h-9" />
        <div className="border-t border-border">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[2fr_1fr_1fr] gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Caricamento in corso</span>
    </div>
  )
}
