"use client"

import { useCallback, useState, type ReactNode } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { AlertTriangle, Sigma } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  InlineEditableField,
  type InlineEditableValueProps,
} from "@/components/shared/inline-edit-field"
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
  allowEmptyOption?: boolean
  emptyLabel?: string
  nullWhenEmpty?: boolean
  custom?: InlineEditableValueProps["custom"]
} | null

type LayoutAppearance = "default" | "clientiSalesforce"

export type RenderCampoLayout = (params: {
  campo: LayoutCampo
  etichetta: string
  valore: unknown
  testo: string
}) => ReactNode | null

export function LayoutRenderer({
  pagine,
  record,
  risolviModifica,
  componenti,
  valoriVisualizzati,
  renderCampo,
  appearance = "default",
  onRiordinaPagine,
  onRiordinaBlocchi,
  onRiordinaCampi,
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
   * Override puntuale per campi che non sono un semplice label/valore:
   * esempi: installatore cliente da elenco installatori, contatti con copia,
   * lookup o altri controlli specialistici del modulo.
   */
  renderCampo?: RenderCampoLayout
  /**
   * Valori gia' pronti per la lettura, per i campi che nel database
   * contengono un riferimento invece del testo da mostrare: il proprietario,
   * per esempio, e' salvato come id utente e va letto come nome.
   */
  valoriVisualizzati?: Record<string, ReactNode>
  appearance?: LayoutAppearance
  /**
   * Riordino personale delle macro sezioni della scheda: Anagrafica,
   * Documenti, Sopralluogo, Note, ecc. Assente = trascinamento disattivato.
   */
  onRiordinaPagine?: (ordine: string[]) => void
  /**
   * Riordino personale dei blocchi. Riceve la pagina e il nuovo ordine delle
   * sue chiavi di blocco; chi chiama lo salva come preferenza dell'utente.
   * Assente = trascinamento disattivato.
   */
  onRiordinaBlocchi?: (pageKey: string, ordine: string[]) => void
  /**
   * Riordino personale dei campi dentro un blocco: riceve la chiave del
   * blocco e il nuovo ordine dei campi.
   */
  onRiordinaCampi?: (blockKey: string, ordine: string[]) => void
  onSalvato?: () => void
}) {
  // Valori appena modificati, prima che il server rimandi il record
  // aggiornato. Senza, un campo calcolato resterebbe fermo al numero vecchio
  // per tutta la durata del giro di rete: cambi il numero di batterie e il
  // totale si aggiorna un istante dopo.
  const [modificati, setModificati] = useState<Record<string, unknown>>({})
  const [pagineLocali, setPagineLocali] = useState(pagine)
  const sensoriPagine = useSensoriTrascinamento()
  const recordVivo = { ...record, ...modificati }
  const valori = mappaValori(recordVivo)

  const chiaviPagine = pagine.map((pagina) => pagina.id).join("|")
  const chiaviPagineLocali = pagineLocali.map((pagina) => pagina.id).join("|")
  if (chiaviPagine !== chiaviPagineLocali) {
    setPagineLocali(pagine)
  }

  const salvato = useCallback(
    (fieldKey: string, nuovoValore: unknown) => {
      setModificati((precedenti) => ({ ...precedenti, [fieldKey]: nuovoValore }))
      onSalvato?.()
    },
    [onSalvato],
  )

  function fineTrascinamentoPagine(evento: DragEndEvent) {
    const { active, over } = evento
    if (!over || active.id === over.id) return
    const da = pagineLocali.findIndex((pagina) => pagina.id === active.id)
    const a = pagineLocali.findIndex((pagina) => pagina.id === over.id)
    if (da < 0 || a < 0) return

    const nuove = arrayMove(pagineLocali, da, a)
    setPagineLocali(nuove)
    onRiordinaPagine?.(nuove.map((pagina) => pagina.pageKey))
  }

  const contenuto = pagineLocali.map((pagina) => (
    <PaginaRenderer
      key={pagina.id}
      pagina={pagina}
      record={recordVivo}
      valori={valori}
      risolviModifica={risolviModifica}
      componenti={componenti}
      valoriVisualizzati={valoriVisualizzati}
      renderCampo={renderCampo}
      appearance={appearance}
      trascinabile={Boolean(onRiordinaPagine)}
      onRiordinaBlocchi={onRiordinaBlocchi}
      onRiordinaCampi={onRiordinaCampi}
      onSalvato={salvato}
    />
  ))

  if (!onRiordinaPagine) {
    return (
      <div className={cn("flex flex-col", appearance === "clientiSalesforce" ? "gap-5" : "gap-4")}>
        {contenuto}
      </div>
    )
  }

  return (
    <DndContext
      id="pagine-layout"
      sensors={sensoriPagine}
      collisionDetection={closestCenter}
      onDragEnd={fineTrascinamentoPagine}
    >
      <SortableContext items={pagineLocali.map((pagina) => pagina.id)} strategy={verticalListSortingStrategy}>
        <div className={cn("flex flex-col", appearance === "clientiSalesforce" ? "gap-5" : "gap-4")}>
          {contenuto}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function PaginaRenderer({
  pagina,
  record,
  valori,
  risolviModifica,
  componenti,
  valoriVisualizzati,
  renderCampo,
  appearance,
  trascinabile,
  onRiordinaBlocchi,
  onRiordinaCampi,
  onSalvato,
}: {
  pagina: LayoutPagina
  record: Record<string, unknown>
  valori: ReturnType<typeof mappaValori>
  risolviModifica?: RisolviModifica
  componenti?: Record<string, ReactNode>
  valoriVisualizzati?: Record<string, ReactNode>
  renderCampo?: RenderCampoLayout
  appearance: LayoutAppearance
  trascinabile?: boolean
  onRiordinaBlocchi?: (pageKey: string, ordine: string[]) => void
  onRiordinaCampi?: (blockKey: string, ordine: string[]) => void
  onSalvato?: (fieldKey: string, nuovoValore: unknown) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pagina.id,
    disabled: !trascinabile,
  })

  return (
    <section
      ref={setNodeRef}
      id={ancoraPagina(pagina.pageKey)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "scroll-mt-[var(--detail-header-h,0px)]",
        appearance === "clientiSalesforce" && "rounded-[1.35rem]",
        isDragging && "z-20 opacity-90",
      )}
    >
      <h2
        className={cn(
          "mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground",
          appearance === "clientiSalesforce" &&
            "mb-3 gap-2.5 text-lg font-extrabold tracking-tight text-slate-900",
        )}
      >
        {trascinabile ? (
          <button
            type="button"
            className={cn(
              "cursor-grab touch-none p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing",
              appearance === "clientiSalesforce" && "text-slate-300 hover:text-teal",
            )}
            aria-label={`Trascina per spostare la sezione ${pagina.label}`}
            title="Trascina per spostare questa sezione"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        {appearance === "clientiSalesforce" ? (
          <span
            aria-hidden="true"
            className="h-6 w-1.5 rounded-full bg-[linear-gradient(180deg,var(--teal),var(--info),var(--warning))] shadow-[0_0_0_4px_rgb(46_139_114/0.10)]"
          />
        ) : null}
        <span>{pagina.label}</span>
      </h2>

      {pagina.componente ? (
        <div className="mb-3">{componenti?.[pagina.componente] ?? null}</div>
      ) : null}

      <BlocchiTrascinabili
        pagina={pagina}
        record={record}
        valori={valori}
        risolviModifica={risolviModifica}
        valoriVisualizzati={valoriVisualizzati}
        renderCampo={renderCampo}
        appearance={appearance}
        onRiordinaBlocchi={onRiordinaBlocchi}
        onRiordinaCampi={onRiordinaCampi}
        onSalvato={onSalvato}
      />
    </section>
  )
}

function BloccoRenderer({
  blocco,
  record,
  valori,
  risolviModifica,
  valoriVisualizzati,
  renderCampo,
  appearance,
  trascinabile,
  titoloRidondante,
  onRiordinaCampi,
  onSalvato,
}: {
  blocco: LayoutBlocco
  record: Record<string, unknown>
  valori: ReturnType<typeof mappaValori>
  risolviModifica?: RisolviModifica
  valoriVisualizzati?: Record<string, ReactNode>
  renderCampo?: RenderCampoLayout
  appearance: LayoutAppearance
  trascinabile?: boolean
  titoloRidondante?: boolean
  onRiordinaCampi?: (blockKey: string, ordine: string[]) => void
  onSalvato?: (fieldKey: string, nuovoValore: unknown) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: blocco.id,
    disabled: !trascinabile,
  })
  const [campi, setCampi] = useState(blocco.campi)
  const sensoriCampi = useSensoriTrascinamento()

  // Il blocco puo' arrivare aggiornato dall'alto (ricarica dopo un
  // salvataggio): l'ordine locale vale finche' i campi sono gli stessi.
  if (
    blocco.campi.length !== campi.length ||
    blocco.campi.some((c) => !campi.some((l) => l.id === c.id))
  ) {
    setCampi(blocco.campi)
  }

  if (blocco.campi.length === 0) return null
  const mostraTitoloBlocco = blocco.mostraTitolo && !titoloRidondante

  function fineTrascinaCampi(evento: DragEndEvent) {
    const { active, over } = evento
    if (!over || active.id === over.id) return
    const da = campi.findIndex((c) => c.id === active.id)
    const a = campi.findIndex((c) => c.id === over.id)
    const nuovi = arrayMove(campi, da, a)
    setCampi(nuovi)
    onRiordinaCampi?.(
      blocco.blockKey,
      nuovi.map((c) => c.fieldKey),
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        appearance === "clientiSalesforce" &&
          "relative rounded-[1.35rem] border-slate-200/90 bg-white p-5 shadow-[0_18px_44px_-30px_rgb(15_23_42/0.72)] ring-1 ring-white/80 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:rounded-t-[1.35rem] before:bg-[linear-gradient(90deg,var(--teal)_0%,var(--info)_42%,var(--warning)_72%,var(--destructive)_100%)]",
        isDragging && "z-10 shadow-lg",
      )}
    >
      {titoloRidondante && trascinabile ? (
        <button
          type="button"
          className={cn(
            "absolute left-2 top-3 cursor-grab touch-none p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing",
            appearance === "clientiSalesforce" && "text-slate-300 hover:text-teal",
          )}
          aria-label={`Trascina per spostare il riquadro ${blocco.label}`}
          title="Trascina per spostare questo riquadro"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : null}

      {mostraTitoloBlocco || (trascinabile && !titoloRidondante) ? (
        <div
          className={cn(
            "mb-3 flex items-center gap-1.5",
            appearance === "clientiSalesforce" &&
              "mb-4 border-b border-slate-100 pb-3 pt-0.5",
          )}
        >
          {trascinabile ? (
            <button
              type="button"
              className={cn(
                "cursor-grab touch-none p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing",
                appearance === "clientiSalesforce" &&
                  "text-slate-300 hover:text-teal",
              )}
              aria-label={`Trascina per spostare il riquadro ${blocco.label}`}
              title="Trascina per spostare questo riquadro"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </button>
          ) : null}
          {mostraTitoloBlocco ? (
            <div className="flex min-w-0 items-center gap-2">
              {appearance === "clientiSalesforce" ? (
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-teal shadow-[0_0_0_4px_rgb(46_139_114/0.13)]"
                />
              ) : null}
              <h3
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wide text-muted-foreground",
                  appearance === "clientiSalesforce" &&
                    "truncate text-xs font-extrabold tracking-[0.105em] text-[#526985]",
                )}
              >
                {blocco.label}
              </h3>
            </div>
          ) : null}
        </div>
      ) : null}

      <GrigliaCampi
        attiva={Boolean(onRiordinaCampi)}
        contesto={`campi-${blocco.blockKey}`}
        sensori={sensoriCampi}
        idCampi={campi.map((c) => c.id)}
        onFine={fineTrascinaCampi}
        className={cn(
          "grid gap-x-8 gap-y-4",
          appearance === "clientiSalesforce" && "gap-x-10 gap-y-5",
          blocco.colonne === 1 && "grid-cols-1",
          blocco.colonne === 2 && "grid-cols-1 sm:grid-cols-2",
          blocco.colonne === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          blocco.colonne >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {campi.map((campo) => (
          <CampoRenderer
            key={campo.id}
            campo={campo}
            record={record}
            valori={valori}
            risolviModifica={risolviModifica}
            valoriVisualizzati={valoriVisualizzati}
            renderCampo={renderCampo}
            appearance={appearance}
            trascinabile={Boolean(onRiordinaCampi)}
            onSalvato={onSalvato}
          />
        ))}
      </GrigliaCampi>
    </div>
  )
}

/**
 * Sensori del trascinamento.
 *
 * Su mouse basta un piccolo spostamento. Su touch serve una pressione
 * prolungata: senza, ogni tentativo di scorrere la pagina partendo da un
 * campo verrebbe interpretato come trascinamento, e la scheda diventerebbe
 * inservibile proprio dove lo spazio e' poco.
 */
function useSensoriTrascinamento() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
}

function labelsRidondanti(principale: string, secondaria: string) {
  const a = normalizzaLabel(principale)
  const b = normalizzaLabel(secondaria)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

function normalizzaLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Involucro di un campo: tiene il riferimento per il trascinamento e la
 * maniglia, comuni ai tre modi in cui un campo puo' essere disegnato (errore
 * di formula, modificabile, sola lettura).
 *
 * Definito qui fuori e non dentro il render del campo: un componente creato
 * a ogni ridisegno verrebbe rimontato da capo, perdendo lo stato di
 * modifica in corso.
 */
function ContenitoreCampo({
  campo,
  etichetta,
  trascinabile,
  appearance,
  className,
  children,
}: {
  campo: LayoutCampo
  etichetta: string
  trascinabile?: boolean
  appearance: LayoutAppearance
  className?: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: campo.id,
    disabled: !trascinabile,
  })
  const larghezza = cn(
    campo.span === 2 && "sm:col-span-2",
    campo.span === 3 && "sm:col-span-2 lg:col-span-3",
    campo.span >= 4 && "sm:col-span-2 lg:col-span-4",
  )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/campo relative",
        larghezza,
        // Lo spazio per la maniglia si aggiunge solo quando serve, cosi' i
        // campi non trascinabili restano allineati come prima.
        trascinabile && "pl-4",
        appearance === "clientiSalesforce" &&
          "rounded-xl border border-transparent p-2 transition-all duration-150 hover:border-teal/20 hover:bg-[linear-gradient(135deg,rgb(46_139_114/0.08),rgb(59_130_246/0.055),rgb(245_158_11/0.06))]",
        isDragging && "z-10 opacity-80",
        className,
      )}
    >
      {trascinabile ? (
        <button
          type="button"
          // Sempre visibile, appena accennata: si scurisce passandoci sopra
          // o passando sul campo. Prima era nascosta e compariva solo
          // all'hover, ma la combinazione di prefisso responsive e gruppo
          // con nome non produceva la classe attesa e restava invisibile.
          className={cn(
            "absolute left-0 top-0.5 cursor-grab touch-none p-0.5 text-muted-foreground/30 transition-colors hover:text-foreground group-hover/campo:text-muted-foreground/70 active:cursor-grabbing",
            appearance === "clientiSalesforce" &&
              "text-slate-300 hover:text-teal group-hover/campo:text-teal/70",
          )}
          aria-label={`Trascina per spostare il campo ${etichetta}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : null}
      {children}
    </div>
  )
}

/**
 * La griglia dei campi, ordinabile quando il riordino personale e' attivo.
 * Strategia rettangolare e non verticale: i campi stanno su piu' colonne, e
 * con quella verticale il segnaposto durante il trascinamento finirebbe nel
 * posto sbagliato.
 */
function GrigliaCampi({
  attiva,
  contesto,
  sensori,
  idCampi,
  onFine,
  className,
  children,
}: {
  attiva: boolean
  /**
   * Identificatore stabile del contesto di trascinamento.
   *
   * dnd-kit numera da solo le proprie etichette di accessibilita'
   * ("DndDescribedBy-1", "-2", ...): con il rendering lato server il
   * conteggio riparte nel browser e i due HTML non coincidono, con un errore
   * di idratazione. Un id esplicito e derivato dai dati elimina il problema.
   */
  contesto: string
  sensori: ReturnType<typeof useSensors>
  idCampi: string[]
  onFine: (evento: DragEndEvent) => void
  className: string
  children: ReactNode
}) {
  if (!attiva) return <div className={className}>{children}</div>

  return (
    <DndContext id={contesto} sensors={sensori} collisionDetection={closestCenter} onDragEnd={onFine}>
      <SortableContext items={idCampi} strategy={rectSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  )
}

function CampoRenderer({
  campo,
  record,
  valori,
  risolviModifica,
  valoriVisualizzati,
  renderCampo,
  appearance,
  trascinabile,
  onSalvato,
}: {
  campo: LayoutCampo
  record: Record<string, unknown>
  valori: ReturnType<typeof mappaValori>
  risolviModifica?: RisolviModifica
  valoriVisualizzati?: Record<string, ReactNode>
  renderCampo?: RenderCampoLayout
  appearance: LayoutAppearance
  trascinabile?: boolean
  onSalvato?: (fieldKey: string, nuovoValore: unknown) => void
}) {
  // Il riferimento per il trascinamento e la larghezza in colonne stanno in
  // ContenitoreCampo, che avvolge tutti e tre i modi di disegnare il campo.
  const etichetta = campo.labelOverride ?? campo.fieldKey
  const giaPronto = valoriVisualizzati?.[campo.fieldKey]
  const esito = valoreCampo(campo, record, valori)

  // Una formula scritta male non deve far sparire il campo in silenzio: si
  // vede che c'e' un problema, e resta chiaro quale.
  if (esito.stato === "errore") {
    return (
      <ContenitoreCampo campo={campo} etichetta={etichetta} trascinabile={trascinabile} appearance={appearance} className="flex flex-col gap-0.5">
        <span className={cn("text-[11px] font-medium uppercase tracking-wide text-muted-foreground", appearance === "clientiSalesforce" && "text-[11px] font-bold tracking-[0.08em] text-[#6f7f98]")}>
          {etichetta}
        </span>
        <span
          className="flex items-center gap-1 text-[13px] text-destructive"
          title={esito.messaggio}
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          Formula non valida
        </span>
      </ContenitoreCampo>
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
  const override = renderCampo?.({
    campo,
    etichetta,
    valore: esito.valore,
    testo,
  })

  if (override !== null && override !== undefined) {
    return (
      <ContenitoreCampo campo={campo} etichetta={etichetta} trascinabile={trascinabile} appearance={appearance}>
        {override}
      </ContenitoreCampo>
    )
  }

  if (modifica) {
    return (
      <ContenitoreCampo campo={campo} etichetta={etichetta} trascinabile={trascinabile} appearance={appearance}>
        <InlineEditableField
          {...modifica}
          label={etichetta}
          type={modifica.type as never}
          emptyLabel={modifica.emptyLabel ?? campo.formato.placeholder ?? "—"}
          displayValue={giaPronto ?? testo}
          className={cn(
            appearance === "clientiSalesforce" &&
              "rounded-xl border-slate-200 bg-slate-50/75 px-2.5 shadow-inner transition-all hover:border-teal/35 hover:bg-teal/5",
          )}
          showSelectIndicator={modifica.type === "select"}
          onSaved={(nuovoValore) => onSalvato?.(campo.fieldKey, nuovoValore)}
        />
      </ContenitoreCampo>
    )
  }

  return (
    <ContenitoreCampo campo={campo} etichetta={etichetta} trascinabile={trascinabile} appearance={appearance} className="flex flex-col gap-0.5">
      <span className={cn("flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground", appearance === "clientiSalesforce" && "text-[11px] font-bold tracking-[0.08em] text-[#6f7f98]")}>
        {etichetta}
        {esito.stato === "calcolato" ? (
          <Sigma className="size-3 text-info" aria-label="Campo calcolato" />
        ) : null}
      </span>
      <div className={cn("text-[13px] text-foreground", appearance === "clientiSalesforce" && "text-[15px] font-medium leading-6 text-slate-900")}>{giaPronto ?? testo}</div>
    </ContenitoreCampo>
  )
}

/**
 * I blocchi di una pagina, riordinabili trascinandoli.
 *
 * L'ordine e' una preferenza di chi guarda: non tocca la configurazione
 * dell'admin e non cambia cosa vedono gli altri. Senza onRiordinaBlocchi il
 * trascinamento non compare affatto.
 */
function BlocchiTrascinabili({
  pagina,
  record,
  valori,
  risolviModifica,
  valoriVisualizzati,
  renderCampo,
  appearance,
  onRiordinaBlocchi,
  onRiordinaCampi,
  onSalvato,
}: {
  pagina: LayoutPagina
  record: Record<string, unknown>
  valori: ReturnType<typeof mappaValori>
  risolviModifica?: RisolviModifica
  valoriVisualizzati?: Record<string, ReactNode>
  renderCampo?: RenderCampoLayout
  appearance: LayoutAppearance
  onRiordinaBlocchi?: (pageKey: string, ordine: string[]) => void
  onRiordinaCampi?: (blockKey: string, ordine: string[]) => void
  onSalvato?: (fieldKey: string, nuovoValore: unknown) => void
}) {
  const [blocchi, setBlocchi] = useState(pagina.blocchi)
  const sensors = useSensoriTrascinamento()

  // La pagina puo' cambiare sotto (ricarica dopo un salvataggio): l'ordine
  // locale vale solo finche' coincide per composizione con quello ricevuto.
  const chiaviCorrenti = pagina.blocchi.map((b) => b.id).join("|")
  const chiaviLocali = blocchi.map((b) => b.id).join("|")
  if (
    chiaviCorrenti.length !== chiaviLocali.length ||
    pagina.blocchi.some((b) => !blocchi.some((l) => l.id === b.id))
  ) {
    setBlocchi(pagina.blocchi)
  }

  const contenuto = blocchi.map((blocco) => (
    <BloccoRenderer
      key={blocco.id}
      blocco={blocco}
      record={record}
      valori={valori}
      risolviModifica={risolviModifica}
      valoriVisualizzati={valoriVisualizzati}
      renderCampo={renderCampo}
      appearance={appearance}
      trascinabile={Boolean(onRiordinaBlocchi)}
      titoloRidondante={appearance === "clientiSalesforce" && labelsRidondanti(pagina.label, blocco.label)}
      onRiordinaCampi={onRiordinaCampi}
      onSalvato={onSalvato}
    />
  ))

  if (!onRiordinaBlocchi) {
    return <div className={cn("flex flex-col gap-3", appearance === "clientiSalesforce" && "gap-4")}>{contenuto}</div>
  }

  function fineTrascinamento(evento: DragEndEvent) {
    const { active, over } = evento
    if (!over || active.id === over.id) return
    const da = blocchi.findIndex((b) => b.id === active.id)
    const a = blocchi.findIndex((b) => b.id === over.id)
    const nuovi = arrayMove(blocchi, da, a)
    setBlocchi(nuovi)
    onRiordinaBlocchi?.(
      pagina.pageKey,
      nuovi.map((b) => b.blockKey),
    )
  }

  return (
    <DndContext
      id={`blocchi-${pagina.pageKey}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={fineTrascinamento}
    >
      <SortableContext items={blocchi.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className={cn("flex flex-col gap-3", appearance === "clientiSalesforce" && "gap-4")}>{contenuto}</div>
      </SortableContext>
    </DndContext>
  )
}
