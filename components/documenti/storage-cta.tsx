"use client"

import { Cloud, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { openNextcloudUrl } from "@/lib/documenti-data"

export function StorageCta() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl bg-[#2E8B72]/8 p-5 ring-1 ring-[#2E8B72]/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#2E8B72]/15 text-[#2E8B72]">
          <Cloud className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-foreground">
            Vuoi accedere a tutti i tuoi documenti?
          </h2>
          <p className="text-sm text-muted-foreground">
            Apri Nextcloud per navigare l&apos;intero archivio, caricare file e
            gestire le cartelle.
          </p>
        </div>
      </div>

      <Button
        className="shrink-0 gap-1.5"
        nativeButton={false}
        render={<a href={openNextcloudUrl()} target="_blank" rel="noopener noreferrer" />}
      >
        Apri Nextcloud
        <ExternalLink className="size-4" aria-hidden="true" />
      </Button>
    </section>
  )
}
