"use client"

import {
  Folder,
  FolderOpen,
  FileCheck,
  FileClock,
  ExternalLink,
  Plus,
  type LucideIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  type CartellaPreferita,
  type CartellaIcona,
  CARTELLA_COLORE_CLASSI,
  nextcloudLink,
  relativeDateIt,
} from "@/lib/documenti-data"

const ICON_MAP: Record<CartellaIcona, LucideIcon> = {
  Folder,
  FolderOpen,
  FileCheck,
  FileClock,
}

function CartellaCard({
  cartella,
  baseUrl,
}: {
  cartella: CartellaPreferita
  baseUrl: string
}) {
  const Icon = ICON_MAP[cartella.icona]

  return (
    <Card className="flex-row items-start justify-between gap-3 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${CARTELLA_COLORE_CLASSI[cartella.colore]}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">
            {cartella.nome}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {cartella.path}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ultimo accesso: {relativeDateIt(cartella.ultimo_accesso)}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5 bg-card"
        render={
          <a
            href={nextcloudLink(baseUrl, cartella.path)}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        Apri
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </Button>
    </Card>
  )
}

export function CartellePreferite({
  cartelle,
  baseUrl,
}: {
  cartelle: CartellaPreferita[]
  baseUrl: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Cartelle preferite
        </h2>
        <Button variant="link" size="sm" className="h-auto p-0 text-primary">
          Gestisci preferiti
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cartelle.map((c) => (
          <CartellaCard key={c.id} cartella={c} baseUrl={baseUrl} />
        ))}

        {/* Card placeholder per aggiungere una nuova cartella preferita */}
        <button
          type="button"
          className="flex min-h-[92px] items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Aggiungi cartella
        </button>
      </div>
    </section>
  )
}
