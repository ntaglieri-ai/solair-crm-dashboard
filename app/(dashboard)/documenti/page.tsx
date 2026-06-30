"use client"

import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CartellePreferite } from "@/components/documenti/cartelle-preferite"
import { DocumentiRecenti } from "@/components/documenti/documenti-recenti"
import { StorageCta } from "@/components/documenti/storage-cta"
import { currentDocumentiUser } from "@/lib/documenti-data"
import { PermissionPageGuard } from "@/lib/permissions/client-guard"

export default function DocumentiPage() {
  const user = currentDocumentiUser

  return (
    <PermissionPageGuard page="documenti">
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
          render={
            <a
              href={user.nextcloud_url}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Apri Nextcloud
          <ExternalLink className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <CartellePreferite
        cartelle={user.cartelle_preferite}
        baseUrl={user.nextcloud_url}
      />

      <DocumentiRecenti
        documenti={user.documenti_recenti}
        baseUrl={user.nextcloud_url}
      />

      <StorageCta baseUrl={user.nextcloud_url} />
      </div>
    </PermissionPageGuard>
  )
}
