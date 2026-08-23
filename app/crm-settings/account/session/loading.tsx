// Scheletro mostrato mentre il server component interroga auth.sessions e
// ip_bloccati. Ricalca la struttura reale della pagina (4 stat card, tabella
// sessioni a 6 colonne, card configurazione, tabella IP) invece di uno spinner:
// la pagina non "salta" quando i dati arrivano, perche' gli ingombri sono gia'
// quelli definitivi. Stessa forma del loading di Audit & Log.

function Blocco({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} aria-hidden />
}

export default function SessionAccessLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Caricamento sessioni">
      <div className="flex flex-col gap-2">
        <Blocco className="h-6 w-44" />
        <Blocco className="h-4 w-[560px] max-w-full" />
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
              <Blocco className="h-3 w-16" />
            </div>
            <Blocco className="size-11 rounded-xl" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Blocco className="h-4 w-48" />
          <Blocco className="h-9 w-52 rounded-md" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1.6fr_1.4fr_1fr_1.1fr_1.1fr_0.9fr] items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
          >
            <Blocco className="h-4 w-40" />
            <Blocco className="h-4 w-32" />
            <Blocco className="h-5 w-28 rounded-md" />
            <Blocco className="h-4 w-24" />
            <Blocco className="h-4 w-24" />
            <Blocco className="h-8 w-24 rounded-md" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <Blocco className="h-5 w-56" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Blocco className="h-4 w-52" />
              <Blocco className="h-3 w-80 max-w-full" />
            </div>
            <Blocco className="h-9 w-40 rounded-md" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Blocco className="h-4 w-40" />
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_2fr_1fr_1fr_0.8fr] items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
          >
            <Blocco className="h-5 w-28 rounded-md" />
            <Blocco className="h-4 w-full max-w-sm" />
            <Blocco className="h-4 w-24" />
            <Blocco className="h-5 w-20 rounded-full" />
            <Blocco className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>

      <span className="sr-only">Caricamento in corso</span>
    </div>
  )
}
