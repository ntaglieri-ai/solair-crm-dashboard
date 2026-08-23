// Scheletro mostrato mentre il server component interroga audit_log.
// Ricalca la struttura reale della pagina (4 stat card, barra filtri, tabella a
// 6 colonne) invece di uno spinner: la pagina non "salta" quando i dati
// arrivano, perche' gli ingombri sono gia' quelli definitivi.

function Blocco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} aria-hidden />
}

export default function AuditLogLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Caricamento registro">
      <div className="flex flex-col gap-2">
        <Blocco className="h-6 w-40" />
        <Blocco className="h-4 w-[520px] max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 rounded-xl border border-l-4 border-border bg-card px-5 py-4 shadow-sm"
          >
            <div className="flex flex-col gap-2">
              <Blocco className="h-3 w-24" />
              <Blocco className="h-8 w-14" />
              <Blocco className="h-3 w-10" />
            </div>
            <Blocco className="size-11 rounded-xl" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Blocco className="h-9 w-full sm:w-44" />
        <Blocco className="h-9 w-full sm:w-52" />
        <Blocco className="h-9 w-full sm:w-52" />
        <Blocco className="h-9 flex-1 sm:min-w-56" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Blocco className="h-4 w-full max-w-3xl" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1.4fr_1fr_1.2fr_2fr_1fr_0.8fr] items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
          >
            <Blocco className="h-4 w-32" />
            <Blocco className="h-4 w-24" />
            <Blocco className="h-6 w-32 rounded-full" />
            <Blocco className="h-4 w-full" />
            <Blocco className="h-5 w-24 rounded-md" />
            <Blocco className="h-4 w-20" />
          </div>
        ))}
      </div>

      <span className="sr-only">Caricamento in corso</span>
    </div>
  )
}
