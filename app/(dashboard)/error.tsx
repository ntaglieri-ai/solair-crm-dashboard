"use client"

// Confine d'errore per le pagine del CRM.
//
// Serve perché le letture non devono più fallire in silenzio: prima un errore
// di database faceva restituire una lista vuota, e la pagina diceva "nessun
// lead" — indistinguibile da "non ne hai". Successo il 22/08/2026 durante il
// riavvio del database per l'upgrade del piano. Ora la lettura solleva
// l'errore, e qui lo si presenta in modo comprensibile invece di mostrare una
// schermata di crash.
import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[dashboard] errore di rendering:", error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <h1 className="text-xl font-bold text-foreground">
        Non è stato possibile caricare i dati
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Si tratta quasi sempre di un problema temporaneo di connessione al
        database. <strong className="font-semibold text-foreground">I tuoi dati non sono stati persi.</strong>{" "}
        Riprova fra qualche istante.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
      >
        <RotateCcw className="size-4" />
        Riprova
      </button>
      {error.digest ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          riferimento: {error.digest}
        </p>
      ) : null}
    </div>
  )
}
