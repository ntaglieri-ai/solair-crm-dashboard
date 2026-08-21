// Skeleton di rotta per le pagine del dashboard. Stessa impostazione di
// CrmSettingsSectionLoading, ma modellati sulla forma reale delle pagine:
// uno skeleton che non combacia con il layout finale produce un salto quando
// arriva il contenuto, e si percepisce peggio del non averlo affatto.
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/80 ${className}`}
      aria-hidden="true"
    />
  )
}

/** Liste: intestazione + filtri rapidi + ricerca + tabella + paginazione. */
export function ListPageLoading({ rows = 10 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col gap-6 animate-in fade-in duration-150"
      role="status"
      aria-label="Caricamento pagina"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["w-16", "w-28", "w-32", "w-28"].map((w, i) => (
          <Skeleton key={i} className={`h-9 rounded-lg ${w}`} />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Skeleton className="h-11 w-11 rounded-lg" />
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Skeleton className="m-0 h-11 rounded-none" />
        <div className="border-t border-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[3rem_1fr_1fr_1.5fr_1.5fr_3rem] items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
            >
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
      <span className="sr-only">Caricamento in corso</span>
    </div>
  )
}

/** Dettaglio: intestazione record + due colonne (contenuto + pannello laterale). */
export function DetailPageLoading() {
  return (
    <div
      className="flex flex-col gap-6 animate-in fade-in duration-150"
      role="status"
      aria-label="Caricamento scheda"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {[0, 1, 2].map((block) => (
            <div key={block} className="rounded-lg border border-border bg-card p-5">
              <Skeleton className="h-5 w-36" />
              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[320px]">
          {[0, 1].map((block) => (
            <div key={block} className="rounded-lg border border-border bg-card p-5">
              <Skeleton className="h-5 w-28" />
              <div className="mt-4 flex flex-col gap-3">
                <Skeleton className="h-4" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Caricamento in corso</span>
    </div>
  )
}
