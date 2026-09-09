"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AllegatiSection } from "@/components/shared/allegati-section"
import { EmailHistorySection } from "@/components/shared/email-history-section"
import { CalendarioRecordSection } from "@/components/calendario/calendario-record-section"
import { InstallatoreNoteSection } from "@/components/installatori/installatore-note-section"
import { LayoutRenderer, type RisolviModifica } from "@/components/shared/layout-renderer"
import type { LayoutPagina } from "@/lib/crm-settings/layout"
import { ancoraPagina } from "@/lib/crm-settings/layout-render"
import { CANALE_PREFERITO_LABELS } from "@/lib/installatori/api-types"
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import type { EmailLogEntry } from "@/lib/email/email-log"

/**
 * Scheda Installatore disegnata dal layout configurato.
 *
 * A differenza di Cliente e Lead, il layout di questo modulo non deriva
 * dall'export Zoho: il modulo Zoho ha meno campi di quanti la scheda ne
 * mostri gia', e mancano proprio quelli che contano per le automazioni
 * (canale preferito, stato attivo). I blocchi sono quindi descritti nello
 * script di popolamento, e le chiavi sono quelle del record applicativo.
 */

/** Come si modifica ciascun campo: colonna del database e tipo del controllo. */
const CAMPI: Record<string, { column: string; type: string }> = {
  nome: { column: "nome", type: "text" },
  email: { column: "email", type: "email" },
  email_secondaria: { column: "email_secondaria", type: "email" },
  telefono: { column: "telefono", type: "tel" },
  tag: { column: "tag", type: "text" },
  attivo: { column: "attivo", type: "boolean" },
  canale_preferito: { column: "canale_preferito", type: "select" },
  note: { column: "note", type: "textarea" },
}

export function InstallatoreDetailContent({
  installatore,
  emailLog,
  layout,
}: {
  installatore: InstallatoreRecord
  emailLog: EmailLogEntry[]
  layout: LayoutPagina[]
}) {
  const router = useRouter()
  const endpoint = `/api/installatori/${installatore.id}`

  const salvaOrdine = (corpo: Record<string, unknown>) => {
    void fetch("/api/layout/ordine-personale", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo: "installatori", ...corpo }),
    }).catch(() => {})
  }

  const componenti: Record<string, ReactNode> = {
    allegati: (
      <AllegatiSection
        recordTipo="installatore"
        recordId={installatore.id}
        nomeRecord={installatore.nome}
      />
    ),
    note: (
      <InstallatoreNoteSection
        installatoreId={installatore.id}
        nomeRecord={installatore.nome}
      />
    ),
    email: (
      <EmailHistorySection
        emailLog={emailLog}
        emptyLabel="Nessuna email inviata a questo installatore dal CRM."
        recordTipo="installatore"
        recordId={installatore.id}
        nomeRecord={installatore.nome}
      />
    ),
    calendario: (
      <CalendarioRecordSection
        recordTipo="installatore"
        recordId={installatore.id}
        nomeRecord={installatore.nome}
      />
    ),
  }

  const risolviModifica: RisolviModifica = (fieldKey) => {
    const campo = CAMPI[fieldKey]
    if (!campo) return null

    const value = (installatore as unknown as Record<string, unknown>)[fieldKey]

    // Il canale preferito guida l'inoltro della scheda sopralluogo: resta una
    // scelta fra valori previsti, non testo libero.
    if (fieldKey === "canale_preferito") {
      return {
        module: "installatori",
        field: campo.column,
        endpoint,
        patchKey: campo.column,
        value,
        type: "select",
        options: Object.keys(CANALE_PREFERITO_LABELS),
        optionLabels: CANALE_PREFERITO_LABELS,
      }
    }

    return {
      module: "installatori",
      field: campo.column,
      endpoint,
      patchKey: campo.column,
      value,
      type: campo.type,
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-background pb-3 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        {layout.map((pagina) => (
          <button
            key={pagina.id}
            type="button"
            onClick={() =>
              document
                .getElementById(ancoraPagina(pagina.pageKey))
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {pagina.label}
          </button>
        ))}
      </nav>

      <LayoutRenderer
        pagine={layout}
        record={installatore as unknown as Record<string, unknown>}
        risolviModifica={risolviModifica}
        componenti={componenti}
        onRiordinaBlocchi={(pageKey, ordine) => salvaOrdine({ blocchi: { [pageKey]: ordine } })}
        onRiordinaCampi={(blockKey, ordine) => salvaOrdine({ campi: { [blockKey]: ordine } })}
        onSalvato={() => router.refresh()}
      />
    </div>
  )
}
