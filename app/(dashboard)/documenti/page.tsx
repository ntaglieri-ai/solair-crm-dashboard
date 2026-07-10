import { AlertCircle, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CartellePreferite } from "@/components/documenti/cartelle-preferite"
import { DocumentiRecenti } from "@/components/documenti/documenti-recenti"
import { StorageCta } from "@/components/documenti/storage-cta"
import { openNextcloudUrl } from "@/lib/documenti-data"
import { requirePage } from "@/lib/permissions/server"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { loadDocumentiData } from "@/lib/nextcloud/documenti"

export default async function DocumentiPage() {
  // Enforcement pagina server-side (redirect se il ruolo non ha accesso).
  await requirePage("documenti")

  const snapshot = await loadCurrentPermissionSnapshot()
  const { subject } = snapshot

  const data =
    subject.userId && subject.email
      ? await loadDocumentiData({
          utenteId: subject.userId,
          email: subject.email,
          roleCode: subject.ruoloCode,
        })
      : { connected: false, message: "Utente non risolto.", favorites: [], recent: [] }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documenti</h1>
          <p className="text-sm text-muted-foreground">
            Accedi allo storage e alle tue cartelle preferite
          </p>
        </div>

        <Button
          className="gap-1.5"
          nativeButton={false}
          render={<a href={openNextcloudUrl()} target="_blank" rel="noopener noreferrer" />}
        >
          Apri Nextcloud
          <ExternalLink className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {!data.connected || data.message ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{data.message}</span>
        </div>
      ) : null}

      {data.connected ? (
        <>
          <CartellePreferite cartelle={data.favorites} />
          <DocumentiRecenti documenti={data.recent} />
        </>
      ) : null}

      <StorageCta />
    </div>
  )
}
