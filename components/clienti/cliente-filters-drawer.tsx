"use client"

import { useState, type ReactNode } from "react"
import { Maximize2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { FiltriSalvati } from "@/components/filtri/filtri-salvati"
import { CostruttoreFiltro } from "@/components/filtri/costruttore-filtro"
import { GRUPPO_VUOTO, type Gruppo } from "@/lib/filtri/albero"
import { gruppiCampiClienti } from "@/lib/filtri/catalogo-clienti"
import type { LayoutPagina } from "@/lib/crm-settings/layout"
import {
  ClienteQuickFilterFields,
  countActiveClienteFilters,
  type ClienteFilterState,
} from "@/components/clienti/cliente-filters"

/** Drawer unico per i filtri Clienti: un solo pulsante in header, un solo
 * pannello (a differenza dei vecchi dropdown impilati sopra la lista). */
export function ClienteFiltersDrawer({
  filters,
  onChange,
  onReset,
  trigger,
  layout,
  onApplicaAlbero,
  alberoApplicato,
}: {
  filters: ClienteFilterState
  onChange: (next: ClienteFilterState) => void
  onReset: () => void
  trigger: (ctx: { onClick: () => void; count: number }) => ReactNode
  /**
   * Layout della scheda Cliente: da qui vengono i campi filtrabili e i loro
   * gruppi. Assente = costruttore e filtri salvati non disponibili.
   */
  layout?: LayoutPagina[]
  onApplicaAlbero?: (gruppo: Gruppo) => void
  alberoApplicato?: Gruppo
}) {
  const [open, setOpen] = useState(false)
  const [costruttoreAperto, setCostruttoreAperto] = useState(false)
  const [filtroAttivo, setFiltroAttivo] = useState<string | null>(null)
  const [versioneSalvati, setVersioneSalvati] = useState(0)
  const count = countActiveClienteFilters(filters)

  const disponibile = Boolean(layout?.length && onApplicaAlbero)

  async function salvaFiltro(nome: string, gruppo: Gruppo) {
    const risposta = await fetch("/api/filtri-salvati", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo: "clienti", nome, definizione: gruppo }),
    })
    if (!risposta.ok) {
      const dati = (await risposta.json().catch(() => ({}))) as { error?: string }
      toast.error(dati.error ?? "Salvataggio non riuscito")
      return
    }
    toast.success(`Filtro "${nome}" salvato e condiviso`)
    setVersioneSalvati((v) => v + 1)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger({ onClick: () => setOpen(true), count })}

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[340px] gap-0 p-0 sm:max-w-[340px]"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-border p-4">
          <SheetTitle>Filtra clienti per</SheetTitle>
          <div className="flex items-center gap-0.5">
            {disponibile ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Apri il costruttore"
                title="Costruisci un filtro con condizioni e gruppi"
                onClick={() => setCostruttoreAperto(true)}
              >
                <Maximize2 />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Chiudi"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {disponibile ? (
            <FiltriSalvati
              modulo="clienti"
              attivo={filtroAttivo}
              ricarica={versioneSalvati}
              onApplica={(filtro) => {
                setFiltroAttivo(filtro.id)
                onApplicaAlbero?.(filtro.definizione)
              }}
            />
          ) : null}

          <div className="p-3">
            <ClienteQuickFilterFields filters={filters} onChange={onChange} onReset={onReset} />
          </div>
        </div>
      </SheetContent>

      {disponibile ? (
        <CostruttoreFiltro
          aperto={costruttoreAperto}
          onChiudi={() => setCostruttoreAperto(false)}
          gruppi={gruppiCampiClienti(layout ?? [])}
          valoreIniziale={alberoApplicato ?? GRUPPO_VUOTO}
          onApplica={(gruppo) => {
            setFiltroAttivo(null)
            onApplicaAlbero?.(gruppo)
          }}
          onSalva={salvaFiltro}
        />
      ) : null}
    </Sheet>
  )
}
