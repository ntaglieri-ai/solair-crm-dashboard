"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ChevronRight,
  Filter,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiFilterSelect } from "@/components/shared/multi-filter-select"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { Maximize2, Save } from "lucide-react"
import { FiltriSalvati } from "@/components/filtri/filtri-salvati"
import { CostruttoreFiltro } from "@/components/filtri/costruttore-filtro"
import { GRUPPO_VUOTO, type Gruppo } from "@/lib/filtri/albero"
import { gruppiCampiLead } from "@/lib/filtri/catalogo-lead"
import { alberoDaPannello } from "@/lib/filtri/da-pannello"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  type Lead,
} from "@/lib/mock-data"
import { useTags } from "@/lib/tag-store"
import {
  LeadQuickFilterFields,
  countActiveLeadFilters,
  type LeadFilterState,
} from "@/components/leads/lead-filters"
import { useLeadFieldOptions } from "@/lib/leads/use-lead-field-options"

// ----------------------------------------------------------------------------
// Tipi filtro — logica pura condivisa con il repository server-side
// ----------------------------------------------------------------------------
import {
  type FieldType,
  type FieldValue,
  type AdvancedFilterState,
  EMPTY_ADVANCED,
  isFieldActive,
  countActiveAdvanced,
  matchesAdvanced,
} from "@/lib/leads/advanced-filter-logic"

// Re-export per retro-compatibilità con i consumer esistenti
export {
  EMPTY_ADVANCED,
  countActiveAdvanced,
  matchesAdvanced,
  type AdvancedFilterState,
}

interface FieldDef {
  id: keyof Lead
  label: string
  type: FieldType
  options?: Array<{ value: string; label: string }>
}

interface LeadAdvancedValueOptions {
  statoLead: Array<{ value: string; label: string }>
  origineLead: Array<{ value: string; label: string }>
  sedi: Array<{ value: string; label: string }>
  statoEmail: Array<{ value: string; label: string }>
  saluti: Array<{ value: string; label: string }>
  campagne: Array<{ value: string; label: string }>
  modalitaIscrizioneAnnullata: Array<{ value: string; label: string }>
  modelliPannello: Array<{ value: string; label: string }>
}

// Definizione dei campi del modello Lead in ordine alfabetico (italiano)
const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value }))

function buildFields(
  tags: string[],
  owners: Array<{ id: string; nome: string }>,
  installers: Array<{ id: string; nome: string }>,
  leadValueOptions: LeadAdvancedValueOptions,
): FieldDef[] {
  return [
    { id: "Account convertito", label: "Account convertito", type: "text" },
    {
      id: "campaign name",
      label: "campaign name",
      type: "enum",
      options: leadValueOptions.campagne,
    },
    { id: "Città", label: "Città", type: "text" },
    { id: "Codice postale", label: "Codice postale", type: "text" },
    { id: "Cognome", label: "Cognome", type: "text" },
    { id: "Connesso a", label: "Connesso a", type: "text" },
    // I tre consensi e il wallbox esistono sul record ma non erano
    // filtrabili: l'elenco era scritto a mano e si era disallineato.
    { id: "Consenso telefono", label: "Consenso telefono", type: "boolean" },
    { id: "Consenso e-mail", label: "Consenso e-mail", type: "boolean" },
    { id: "Consenso WhatsApp", label: "Consenso WhatsApp", type: "boolean" },
    { id: "Contatto convertito", label: "Contatto convertito", type: "text" },
    {
      id: "Creato da",
      label: "Creato da",
      type: "enum",
      options: owners.map((item) => ({ value: item.nome, label: item.nome })),
    },
    { id: "Data Click", label: "Data Click", type: "date" },
    { id: "Data sopralluogo", label: "Data sopralluogo", type: "date" },
    { id: "Data/Ora", label: "Data/Ora", type: "date" },
    { id: "Descrizione", label: "Descrizione", type: "text" },
    { id: "E-mail", label: "E-mail", type: "text" },
    {
      id: "Installatore - Incaricato sopralluogo",
      label: "Installatore - Incaricato sopralluogo",
      type: "enum",
      options: installers.map((item) => ({ value: item.id, label: item.nome })),
    },
    { id: "kWh", label: "kWh", type: "number" },
    { id: "kWp", label: "kWp", type: "number" },
    {
      id: "Lead Proprietario",
      label: "Lead Proprietario",
      type: "enum",
      options: owners.map((item) => ({ value: item.id, label: item.nome })),
    },
    { id: "Mobile/Fisso", label: "Mobile/Fisso", type: "text" },
    {
      id: "Modalità iscrizione annullata",
      label: "Modalità iscrizione annullata",
      type: "enum",
      options: leadValueOptions.modalitaIscrizioneAnnullata,
    },
    {
      id: "Modello pannello",
      label: "Modello pannello",
      type: "enum",
      options: leadValueOptions.modelliPannello,
    },
    { id: "Nome", label: "Nome", type: "text" },
    { id: "Nome Lead", label: "Nome Lead", type: "text" },
    {
      id: "Ora iscrizione annullata",
      label: "Ora iscrizione annullata",
      type: "date",
    },
    { id: "Ora creazione", label: "Ora creazione", type: "date" },
    { id: "Ora ultima attività", label: "Ora ultima attività", type: "date" },
    {
      id: "Origine Lead",
      label: "Origine Lead",
      type: "enum",
      options: leadValueOptions.origineLead,
    },
    { id: "Paese", label: "Paese", type: "text" },
    { id: "Provincia", label: "Provincia", type: "text" },
    {
      id: "Residente in Sicilia",
      label: "Residente in Sicilia",
      type: "boolean",
    },
    { id: "Sede", label: "Sede", type: "enum", options: leadValueOptions.sedi },
    { id: "Social Lead ID", label: "Social Lead ID", type: "text" },
    {
      id: "Stato",
      label: "Stato",
      type: "enum",
      options: leadValueOptions.statoEmail,
    },
    {
      id: "Stato Lead",
      label: "Stato Lead",
      type: "enum",
      options: leadValueOptions.statoLead,
    },
    { id: "Tag", label: "Tag", type: "enum", options: options(tags) },
    { id: "Saluti", label: "Saluti", type: "enum", options: leadValueOptions.saluti },
    { id: "Telefono", label: "Telefono", type: "text" },
    {
      id: "Tempo di conversione Lead",
      label: "Tempo di conversione Lead",
      type: "text",
    },
    { id: "Valutazione", label: "Valutazione", type: "number" },
    { id: "Wallbox richiesto", label: "Wallbox richiesto", type: "boolean" },
  ]
}

// ----------------------------------------------------------------------------
// Pill riassuntiva di un filtro attivo
// ----------------------------------------------------------------------------
function fieldPillLabel(def: FieldDef, v: FieldValue): string {
  switch (v.type) {
    case "text":
      return `${def.label}: "${v.contains.trim()}"`
    case "enum":
      return `${def.label}: ${v.selected
        .map(
          (selected) =>
            def.options?.find((option) => option.value === selected)?.label ??
            selected,
        )
        .join(", ")}`
    case "number": {
      if (v.min !== "" && v.max !== "")
        return `${def.label}: ${v.min}–${v.max}`
      if (v.min !== "") return `${def.label}: ≥${v.min}`
      return `${def.label}: ≤${v.max}`
    }
    case "date": {
      if (v.from !== "" && v.to !== "")
        return `${def.label}: ${v.from} → ${v.to}`
      if (v.from !== "") return `${def.label}: da ${v.from}`
      return `${def.label}: fino a ${v.to}`
    }
    case "boolean":
      return `${def.label}: ${v.value === "yes" ? "Sì" : "No"}`
  }
}

const QUICK_LABELS: Record<keyof AdvancedFilterState["quick"], string> = {
  badgeAttivita: "Badge dell'attività",
  badgeNota: "Badge di nota",
  nonToccati: "Record non toccati",
  toccati: "Record toccati",
}

// ----------------------------------------------------------------------------
// Componente principale
// ----------------------------------------------------------------------------
export function AdvancedFilters({
  applied,
  onApply,
  tags,
  quickFilters,
  onQuickFiltersChange,
  onQuickFiltersReset,
  quickViews,
  trigger,
  inline = false,
  openInline = false,
  onOpenInlineChange,
  inlineContainer,
  onApplicaAlbero,
  alberoApplicato,
}: {
  applied: AdvancedFilterState
  onApply: (state: AdvancedFilterState) => void
  tags: string[]
  /** Filtri "principali" (stato/sede/proprietario/…): si applicano subito, vivono nello stesso drawer. */
  quickFilters?: LeadFilterState
  onQuickFiltersChange?: (next: LeadFilterState) => void
  onQuickFiltersReset?: () => void
  /** Viste rapide (es. Tutti/Da contattare/…): pillole in cima al drawer. */
  quickViews?: { label: string; active: boolean; onSelect: () => void }[]
  /** Trigger personalizzato (es. bottone header colorato). Se assente, resta l'icona compatta di default. */
  trigger?: (ctx: { onClick: () => void; count: number }) => ReactNode
  /**
   * Pannello incastonato nella pagina invece che sovrapposto.
   *
   * Sovrapposto, il pannello copre la lista: si compone il filtro alla cieca
   * e si scopre il risultato solo dopo aver chiuso. Incastonato, la lista
   * resta accanto e si aggiorna mentre si sceglie.
   *
   * In questa modalita' l'apertura la governa la pagina, non il componente.
   */
  inline?: boolean
  openInline?: boolean
  onOpenInlineChange?: (open: boolean) => void
  /**
   * Dove disegnare il pannello quando e' incastonato.
   *
   * Il componente e' montato nella barra dei pulsanti, ma il pannello deve
   * stare accanto alla tabella: la pagina fornisce il contenitore e il
   * pannello ci viene portato dentro, senza duplicare lo stato del filtro.
   */
  inlineContainer?: HTMLElement | null
  /**
   * Applica un filtro ad albero (dal costruttore o da un filtro salvato).
   * Assente = costruttore e filtri salvati non disponibili.
   */
  onApplicaAlbero?: (gruppo: Gruppo) => void
  /** L'albero attualmente applicato, per riaprirlo nel costruttore. */
  alberoApplicato?: Gruppo
}) {
  const { owners, installers } = useTags()
  const leadOptions = useLeadFieldOptions()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AdvancedFilterState>(applied)
  const [fieldQuery, setFieldQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const allFields = useMemo(
    () =>
      buildFields(tags, owners, installers, {
        statoLead: leadOptions.optionsFor("stato_lead"),
        origineLead: leadOptions.optionsFor("origine_lead"),
        sedi: leadOptions.optionsFor("sede"),
        statoEmail: leadOptions.optionsFor("stato_email"),
        saluti: leadOptions.optionsFor("saluti"),
        campagne: leadOptions.optionsFor("campaign_name"),
        modalitaIscrizioneAnnullata: leadOptions.optionsFor("modalita_iscrizione_annullata"),
        modelliPannello: leadOptions.optionsFor("modello_pannello"),
      }),
    [installers, leadOptions, owners, tags],
  )
  const fieldsById = useMemo(
    () => new Map(allFields.map((f) => [f.id as string, f])),
    [allFields],
  )

  // Sincronizza il draft con lo stato applicato all'apertura del pannello
  useEffect(() => {
    if (open) {
      setDraft(applied)
      setFieldQuery("")
      setExpanded(null)
    }
  }, [open, applied])

  const visibleFields = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase()
    if (!q) return allFields
    return allFields.filter((f) => f.label.toLowerCase().includes(q))
  }, [allFields, fieldQuery])

  const appliedCount = countActiveAdvanced(applied)
  const draftCount = countActiveAdvanced(draft)
  const quickCount = quickFilters ? countActiveLeadFilters(quickFilters) : 0
  const totalAppliedCount = appliedCount + quickCount

  const setQuick = (key: keyof AdvancedFilterState["quick"], value: boolean) =>
    setDraft((d) => ({ ...d, quick: { ...d.quick, [key]: value } }))

  const setField = (id: string, value: FieldValue) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [id]: value } }))

  const clearField = (id: string) =>
    setDraft((d) => {
      const next = { ...d.fields }
      delete next[id]
      return { ...d, fields: next }
    })

  const getDraftField = (def: FieldDef): FieldValue => {
    const existing = draft.fields[def.id as string]
    if (existing) return existing
    switch (def.type) {
      case "text":
        return { type: "text", contains: "" }
      case "enum":
        return { type: "enum", selected: [] }
      case "date":
        return { type: "date", from: "", to: "" }
      case "number":
        return { type: "number", min: "", max: "" }
      case "boolean":
        return { type: "boolean", value: "all" }
    }
  }

  // Pill dei filtri attivi nel draft
  const activePills: { id: string; label: string }[] = []
  for (const [key, on] of Object.entries(draft.quick)) {
    if (on)
      activePills.push({
        id: `quick:${key}`,
        label: QUICK_LABELS[key as keyof AdvancedFilterState["quick"]],
      })
  }
  for (const [id, v] of Object.entries(draft.fields)) {
    const def = fieldsById.get(id)
    if (def && isFieldActive(v))
      activePills.push({ id: `field:${id}`, label: fieldPillLabel(def, v) })
  }

  const removePill = (pillId: string) => {
    const [kind, key] = pillId.split(":")
    if (kind === "quick")
      setQuick(key as keyof AdvancedFilterState["quick"], false)
    else clearField(key)
  }

  const [costruttoreAperto, setCostruttoreAperto] = useState(false)
  const [filtroSalvatoAttivo, setFiltroSalvatoAttivo] = useState<string | null>(null)
  // Cambia a ogni salvataggio, per far rileggere l'elenco dei salvati.
  const [versioneSalvati, setVersioneSalvati] = useState(0)

  // Con il pannello incastonato la lista si aggiorna mentre si compone il
  // filtro: e' il motivo per cui sta accanto invece che sopra. Modifiche e
  // scrittura hanno un debounce breve; rimozioni e svuotamenti sono immediati,
  // cosi' la tabella libera subito i risultati esclusi dal filtro appena tolto.
  const applicaRef = useRef(onApply)
  const conteggioPrecedenteRef = useRef(countActiveAdvanced(draft))
  useEffect(() => {
    applicaRef.current = onApply
  }, [onApply])
  useEffect(() => {
    if (!inline) return
    const conteggioCorrente = countActiveAdvanced(draft)
    const staRimuovendo = conteggioCorrente < conteggioPrecedenteRef.current
    conteggioPrecedenteRef.current = conteggioCorrente

    if (conteggioCorrente === 0 || staRimuovendo) {
      applicaRef.current(draft)
      return
    }

    const attesa = setTimeout(() => applicaRef.current(draft), 150)
    return () => clearTimeout(attesa)
  }, [inline, draft])

  // Apertura: nella modalita' incastonata la governa la pagina, che deve
  // sapere quanto spazio lasciare alla lista.
  const aperto = inline ? openInline : open
  const chiudi = () => (inline ? onOpenInlineChange?.(false) : setOpen(false))

  // Le opzioni dei campi a elenco vengono dai dati veri, non da un elenco
  // scritto qui: uno stato aggiunto in configurazione deve comparire nel
  // costruttore senza toccare il codice.
  const opzioniCatalogo = {
    stati: leadOptions.optionsFor("stato_lead").map((opzione) => opzione.value),
    origini: leadOptions.optionsFor("origine_lead").map((opzione) => opzione.value),
    sedi: leadOptions.optionsFor("sede").map((opzione) => opzione.value),
    statoEmail: leadOptions.optionsFor("stato_email").map((opzione) => opzione.value),
    saluti: leadOptions.optionsFor("saluti").map((opzione) => opzione.value),
    campagne: leadOptions.optionsFor("campaign_name").map((opzione) => opzione.value),
    modalitaIscrizioneAnnullata: leadOptions
      .optionsFor("modalita_iscrizione_annullata")
      .map((opzione) => opzione.value),
    modelliPannello: leadOptions.optionsFor("modello_pannello").map((opzione) => opzione.value),
    installatori: installers.map((installer) => installer.nome),
    creatori: owners.map((owner) => owner.nome),
    proprietari: owners.map((owner) => owner.id),
    tag: tags,
  }

  async function salvaFiltro(nome: string, gruppo: Gruppo) {
    const risposta = await fetch("/api/filtri-salvati", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo: "lead", nome, definizione: gruppo }),
    })
    if (!risposta.ok) {
      const dati = (await risposta.json().catch(() => ({}))) as { error?: string }
      toast.error(dati.error ?? "Salvataggio non riuscito")
      return
    }
    toast.success(`Filtro "${nome}" salvato e condiviso`)
    setVersioneSalvati((v) => v + 1)
  }

  /** Salva quello che c'e' nel pannello, senza passare dal costruttore. */
  async function salvaDalPannello() {
    const nome = window.prompt("Nome del filtro (lo vedranno tutti):")?.trim()
    if (!nome) return
    const gruppo = alberoDaPannello(draft, gruppiCampiLead(opzioniCatalogo).flatMap((g) => g.campi))
    if (!gruppo.nodi.length) {
      toast.error("Nessuna condizione da salvare")
      return
    }
    await salvaFiltro(nome, gruppo)
  }

  const costruttore = onApplicaAlbero ? (
    <CostruttoreFiltro
      aperto={costruttoreAperto}
      onChiudi={() => setCostruttoreAperto(false)}
      gruppi={gruppiCampiLead(opzioniCatalogo)}
      valoreIniziale={alberoApplicato ?? GRUPPO_VUOTO}
      onApplica={(gruppo) => {
        // Applicare un albero composto a mano stacca l'eventuale filtro
        // salvato: non e' piu' quello.
        setFiltroSalvatoAttivo(null)
        onApplicaAlbero(gruppo)
      }}
      onSalva={salvaFiltro}
    />
  ) : null

  const contenutoPannello = (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-row items-center justify-between border-b border-border p-4">
          <p className="text-base font-semibold text-foreground">Filtra Lead per</p>
          <div className="flex items-center gap-0.5">
            {onApplicaAlbero ? (
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
            <Button variant="ghost" size="icon-sm" aria-label="Chiudi" onClick={chiudi}>
              <X />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {onApplicaAlbero ? (
          <FiltriSalvati
            modulo="lead"
            attivo={filtroSalvatoAttivo}
            ricarica={versioneSalvati}
            azione={
              draftCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void salvaDalPannello()}
                >
                  <Save data-icon="inline-start" />
                  Salva
                </Button>
              ) : null
            }
            onApplica={(filtro) => {
              setFiltroSalvatoAttivo(filtro.id)
              onApplicaAlbero(filtro.definizione)
            }}
          />
          ) : null}

          {/* Viste rapide */}
          {quickViews && quickViews.length > 0 ? (
            <div className="border-b border-border p-3">
              <p className="px-1 pb-2 text-sm font-semibold text-foreground">
                Viste rapide
              </p>
              <div className="flex flex-wrap gap-2">
                {quickViews.map((view) => (
                  <button
                    type="button"
                    key={view.label}
                    onClick={view.onSelect}
                    className={cn(
                      "h-10 shrink-0 rounded-lg px-4 text-sm font-bold transition-colors",
                      view.active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Ricerca campo */}
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fieldQuery}
                onChange={(e) => setFieldQuery(e.target.value)}
                placeholder="Cerca campo..."
                className="bg-card pl-9"
                aria-label="Cerca campo"
              />
            </div>
          </div>

          {/* Pill filtri attivi */}
          {activePills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b border-border bg-muted/40 p-3">
              {activePills.map((pill) => (
                <span
                  key={pill.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal"
                >
                  <span className="truncate">{pill.label}</span>
                  <button
                    type="button"
                    aria-label={`Rimuovi ${pill.label}`}
                    onClick={() => removePill(pill.id)}
                    className="shrink-0 rounded-full hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {/* Filtri principali (stato, sede, proprietario, origine, tag, valutazione) */}
          {quickFilters && onQuickFiltersChange && onQuickFiltersReset ? (
            <div className="border-b border-border p-3">
              <p className="px-1 pb-2 text-sm font-semibold text-foreground">
                Filtri principali
              </p>
              <LeadQuickFilterFields
                filters={quickFilters}
                onChange={onQuickFiltersChange}
                onReset={onQuickFiltersReset}
              />
            </div>
          ) : null}

          {/* Filtri rapidi (collassati di default) */}
          <Accordion className="border-b border-border px-3">
            <AccordionItem value="quick" className="border-b-0">
              <AccordionTrigger className="text-sm font-semibold">
                Filtri rapidi
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2.5">
                  {(
                    Object.keys(draft.quick) as (keyof AdvancedFilterState["quick"])[]
                  ).map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={draft.quick[key]}
                        onCheckedChange={(c) => setQuick(key, c === true)}
                      />
                      {QUICK_LABELS[key]}
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Filtra per campo */}
          <div className="p-3">
            <p className="px-1 pb-2 text-sm font-semibold text-foreground">
              Filtra per campo
            </p>
            <div className="flex flex-col">
              {visibleFields.map((def) => {
                const id = def.id as string
                const isOpen = expanded === id
                const v = getDraftField(def)
                const active = draft.fields[id]
                  ? isFieldActive(draft.fields[id])
                  : false
                return (
                  <div
                    key={id}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                        active && "font-medium text-foreground",
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {active ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-teal" />
                        ) : null}
                        <span className="truncate">{def.label}</span>
                      </span>
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                    </button>

                    {isOpen ? (
                      <div className="px-2 pb-3 pt-1">
                        <FieldEditor
                          def={def}
                          value={v}
                          onChange={(nv) => setField(id, nv)}
                          onClear={() => clearField(id)}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
              {visibleFields.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Nessun campo trovato
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-row gap-2 border-t border-border p-4">
          <Button
            variant="outline"
            className="flex-1 bg-card"
            onClick={() => setDraft(EMPTY_ADVANCED)}
            disabled={draftCount === 0}
          >
            <RotateCcw data-icon="inline-start" />
            Reimposta tutto
          </Button>
          {!inline ? (
            <Button
              className="flex-1 bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => {
                onApply(draft)
                setOpen(false)
              }}
            >
              Applica filtri
            </Button>
          ) : null}
        </div>
      </div>
  )

  if (inline) {
    // Due pezzi in due posti: il pulsante resta nella barra dove il
    // componente e' montato, il pannello viene portato accanto alla tabella.
    // Disegnarne uno solo — com'era in una prima versione — faceva sparire
    // il pulsante insieme al pannello chiuso.
    const pulsante = trigger ? (
      trigger({ onClick: () => onOpenInlineChange?.(!aperto), count: totalAppliedCount })
    ) : (
      <Button
        variant="outline"
        size="icon"
        className="relative bg-card"
        aria-label="Filtri avanzati"
        onClick={() => onOpenInlineChange?.(!aperto)}
      >
        <Filter />
        {totalAppliedCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal px-1 text-[10px] font-bold tabular-nums text-teal-foreground">
            {totalAppliedCount}
          </span>
        ) : null}
      </Button>
    )

    return (
      <>
        {pulsante}
        {costruttore}
        {aperto && inlineContainer
          ? createPortal(
              <aside className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                {contenutoPannello}
              </aside>,
              inlineContainer,
            )
          : null}
      </>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? (
        trigger({ onClick: () => setOpen(true), count: totalAppliedCount })
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="relative bg-card"
          aria-label="Filtri avanzati"
          onClick={() => setOpen(true)}
        >
          <Filter />
          {totalAppliedCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal px-1 text-[10px] font-bold tabular-nums text-teal-foreground">
              {totalAppliedCount}
            </span>
          ) : null}
        </Button>
      )}
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[340px] gap-0 p-0 sm:max-w-[340px]"
      >
        {contenutoPannello}
      </SheetContent>
      {costruttore}
    </Sheet>
  )
}

function FieldEditor({
  def,
  value,
  onChange,
  onClear,
}: {
  def: FieldDef
  value: FieldValue
  onChange: (v: FieldValue) => void
  onClear: () => void
}) {
  if (value.type === "text") {
    return (
      <Input
        autoFocus
        value={value.contains}
        onChange={(e) => onChange({ type: "text", contains: e.target.value })}
        placeholder="contiene..."
        className="bg-card"
        aria-label={`${def.label} contiene`}
      />
    )
  }

  if (value.type === "enum") {
    const selected = value.selected
    return (
      <div className="flex flex-col gap-2">
        {(def.options ?? []).length > 0 ? (
          <MultiFilterSelect
            ariaLabel={`Filtra per ${def.label}`}
            className="h-10 w-full bg-card text-sm"
            value={selected}
            onValueChange={(next) => onChange({ type: "enum", selected: next })}
            allLabel="Tutti i valori"
            options={def.options ?? []}
          />
        ) : (
          <p className="text-xs text-muted-foreground">Nessun valore</p>
        )}
      </div>
    )
  }

  if (value.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value.min}
          onChange={(e) =>
            onChange({ type: "number", min: e.target.value, max: value.max })
          }
          placeholder="Min"
          className="bg-card"
          aria-label={`${def.label} minimo`}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          value={value.max}
          onChange={(e) =>
            onChange({ type: "number", min: value.min, max: e.target.value })
          }
          placeholder="Max"
          className="bg-card"
          aria-label={`${def.label} massimo`}
        />
      </div>
    )
  }

  if (value.type === "date") {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Da
          <Input
            type="date"
            value={value.from}
            onChange={(e) =>
              onChange({ type: "date", from: e.target.value, to: value.to })
            }
            className="w-[170px] bg-card"
            aria-label={`${def.label} da`}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          A
          <Input
            type="date"
            value={value.to}
            onChange={(e) =>
              onChange({ type: "date", from: value.from, to: e.target.value })
            }
            className="w-[170px] bg-card"
            aria-label={`${def.label} a`}
          />
        </label>
      </div>
    )
  }

  // boolean
  const current = value.value
  return (
    <div className="flex items-center gap-1.5">
      {(
        [
          ["all", "Tutti"],
          ["yes", "Sì"],
          ["no", "No"],
        ] as const
      ).map(([val, label]) => (
        <Button
          key={val}
          type="button"
          size="sm"
          variant={current === val ? "default" : "outline"}
          className={cn(
            "flex-1",
            current === val
              ? "bg-teal text-teal-foreground hover:bg-teal/90"
              : "bg-card",
          )}
          onClick={() => onChange({ type: "boolean", value: val })}
        >
          {label}
        </Button>
      ))}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Azzera campo"
        onClick={onClear}
      >
        <X />
      </Button>
    </div>
  )
}
