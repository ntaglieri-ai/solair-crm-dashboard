"use client"

import { useCallback, useState, type ReactNode } from "react"
import { AlertTriangle, Sigma } from "lucide-react"
import { cn } from "@/lib/utils"
import { InlineEditableField } from "@/components/shared/inline-edit-field"
import type { FieldModuleKey } from "@/lib/permissions/field-catalog"
import type { LayoutBlocco, LayoutCampo, LayoutPagina } from "@/lib/crm-settings/layout"
import {
  ancoraPagina,
  campoScrivibile,
  formattaValore,
  mappaValori,
  valoreCampo,
} from "@/lib/crm-settings/layout-render"

/**
 * Disegna una scheda a partire dalla configurazione del layout.
 *
 * Sostituisce, per i moduli che hanno un layout configurato, le sezioni
 * scritte a mano nel codice. Il componente non sa nulla di Clienti o Lead:
 * riceve il layout, il record e come rendere modificabile un campo, e da
 * quello ricava tutto il resto.
 *
 * Convive con il rendering esistente: dove il layout non e' configurato la
 * scheda continua a usare le sezioni di prima.
 */

/**
 * Come si modifica un campo. Ogni modulo la fornisce a modo suo, perche' la
 * colonna del database e l'endpoint cambiano da modulo a modulo.
 *
 * Torna null per i campi che non sono modificabili.
 */
export type RisolviModifica = (
  fieldKey: string,
) => {
  module: FieldModuleKey
  field: string
  endpoint: string
  patchKey: string
  value: unknown
  type?: string
  options?: string[]
  optionLabels?: Record<string, string>
} | null

export function LayoutRenderer({
  pagine,
  record,
  risolviModifica,
  componenti,
  valoriVisualizzati,
  onSalvato,
}: {
  pagine: LayoutPagina[]
  record: Record<string, unknown>
  risolviModifica?: RisolviModifica
  /**
   * I componenti dedicati (allegati, calendario, attivita'): il layout dice
   * dove vanno, il modulo dice come sono fatti.
   */
  componenti?: Record<string, ReactNode>
  /**
   * Valori gia' pronti per la lettura, per i campi che nel database
   * contengono un riferimento invece del testo da mostrare: il proprietario,
   * per esempio, e' salvato come id utente e va letto come nome.
   */
  valoriVisualizzati?: Record<string, ReactNode>
  onSalvato?: () => void
}) {
  // Valori appena modificati, prima che il server rimandi il record
  // aggiornato. Senza, un campo calcolato resterebbe fermo al numero vecchio
  // per tutta la durata del giro di rete: cambi il numero di batterie e il
  // totale si aggiorna un istante dopo.
  const [modificati, setModificati] = useState<Record<string, unknown>>({})
  const recordVivo = { ...record, ...modificati }
  const valori = mappaValori(recordVivo)

  const salvato = useCallback(
    (fieldKey: string, nuovoValore: unknown) => {
      setModificati((precedenti) => ({ ...precedenti, [fieldKey]: nuovoValore }))
      onSalvato?.()
    },
    [onSalvato],
  )

  return (
    <div className="flex flex-col gap-4">
      {pagine.map((pagina) => (
        <section
          key={pagina.id}
          id={ancoraPagina(pagina.pageKey)}
          className="scroll-mt-[var(--detail-header-h,0px)]"
        >
          <h2 className="mb-2 text-sm font-bold text-foreground">{pagina.label}</h2>

          {pagina.componente ? (
            <div className="mb-3">{componenti?.[pagina.componente] ?? null}</div>
          ) : null}

          <div className="flex flex-col gap-3">
            {pagina.blocchi.map((blocco) => (
              <BloccoRenderer
                key={blocco.id}
                blocco={blocco}
                record={recordVivo}
                valori={valori}
                risolviModifica={risolviModifica}
                valoriVisualizzati={valoriVisualizzati}
                onSalvato={salvato}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function BloccoRenderer({
  blocco,
  record,
  valori,
  risolviModifica,
  valoriVisualizzati,
  onSalvato,
}: {
  blocco: LayoutBlocco
  record: Record<string, unknown>
  valori: ReturnType<typeof mappaValori>
  risolviModifica?: RisolviModifica
  valoriVisualizzati?: Record<string, ReactNode>
  onSalvato?: (fieldKey: string, nuovoValore: unknown) => void
}) {
  if (blocco.campi.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {blocco.mostraTitolo ? (
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {blocco.label}
        </h3>
      ) : null}

      <div
        className={cn(
          "grid gap-x-8 gap-y-4",
          blocco.colonne === 1 && "grid-cols-1",
          blocco.colonne === 2 && "grid-cols-1 sm:grid-cols-2",
          blocco.colonne === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          blocco.colonne >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {blocco.campi.map((campo) => (
          <CampoRenderer
            key={campo.id}
            campo={campo}
            record={record}
            valori={valori}
            risolviModifica={risolviModifica}
            valoriVisualizzati={valoriVisualizzati}
            onSalvato={onSalvato}
          />
        ))}
      </div>
    </div>
  )
}

function CampoRenderer({
  campo,
  record,
  valori,
  risolviModifica,
  valoriVisualizzati,
  onSalvato,
}: {
  campo: LayoutCampo
  record: Record<string, unknown>
  valori: ReturnType<typeof mappaValori>
  risolviModifica?: RisolviModifica
  valoriVisualizzati?: Record<string, ReactNode>
  onSalvato?: (fieldKey: string, nuovoValore: unknown) => void
}) {
  const etichetta = campo.labelOverride ?? campo.fieldKey
  const giaPronto = valoriVisualizzati?.[campo.fieldKey]
  const esito = valoreCampo(campo, record, valori)
  const larghezza = cn(
    campo.span === 2 && "sm:col-span-2",
    campo.span === 3 && "sm:col-span-2 lg:col-span-3",
    campo.span >= 4 && "sm:col-span-2 lg:col-span-4",
  )

  // Una formula scritta male non deve far sparire il campo in silenzio: si
  // vede che c'e' un problema, e resta chiaro quale.
  if (esito.stato === "errore") {
    return (
      <div className={cn("flex flex-col gap-0.5", larghezza)}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {etichetta}
        </span>
        <span
          className="flex items-center gap-1 text-[13px] text-destructive"
          title={esito.messaggio}
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          Formula non valida
        </span>
      </div>
    )
  }

  // Risolto una volta sola: serve sia per decidere se il campo e'
  // modificabile sia per sapere come formattarlo quando non lo e'.
  const configurazione = risolviModifica?.(campo.fieldKey) ?? null
  const modifica = campoScrivibile(campo) ? configurazione : null
  // Stessa formattazione per il campo modificabile e per quello in sola
  // lettura: senza, un booleano mostrava "Sì" da fermo e "true" da
  // modificabile, e una data restava in forma ISO.
  const testo = formattaValore(esito.valore, campo.formato, configurazione?.type)

  if (modifica) {
    return (
      <div className={larghezza}>
        <InlineEditableField
          {...modifica}
          label={etichetta}
          type={modifica.type as never}
          emptyLabel={campo.formato.placeholder ?? "—"}
          displayValue={giaPronto ?? testo}
          onSaved={(nuovoValore) => onSalvato?.(campo.fieldKey, nuovoValore)}
        />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-0.5", larghezza)}>
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {etichetta}
        {esito.stato === "calcolato" ? (
          <Sigma className="size-3 text-info" aria-label="Campo calcolato" />
        ) : null}
      </span>
      <div className="text-[13px] text-foreground">{giaPronto ?? testo}</div>
    </div>
  )
}
