"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ChevronRight,
  Filter,
  Maximize2,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MultiFilterSelect } from "@/components/shared/multi-filter-select"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import {
  FiltriSalvati,
  FiltroPreview,
  type FiltroSalvato,
} from "@/components/filtri/filtri-salvati"
import { CostruttoreFiltro } from "@/components/filtri/costruttore-filtro"
import { contaCondizioni, GRUPPO_VUOTO, type Gruppo } from "@/lib/filtri/albero"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  type Lead,
} from "@/lib/mock-data"
import { useTags } from "@/lib/tag-store"
import {
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
  rating: Array<{ value: string; label: string }>
  statoArricchito: Array<{ value: string; label: string }>
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
      id: "Stato arricchito",
      label: "Stato arricchito",
      type: "enum",
      options: leadValueOptions.statoArricchito,
    },
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
    {
      id: "Valutazione",
      label: "Valutazione",
      type: "enum",
      options: leadValueOptions.rating,
    },
    { id: "Punteggio", label: "Punteggio", type: "number" },
    { id: "Wallbox richiesto", label: "Wallbox richiesto", type: "boolean" },
  ]
}

const QUICK_LABELS: Record<keyof AdvancedFilterState["quick"], string> = {
  badgeAttivita: "Badge dell'attività",
  badgeNota: "Badge di nota",
  nonToccati: "Record non toccati",
  toccati: "Record toccati",
}

function formatFieldCondition(def: FieldDef, value: FieldValue): { operatore: string; valore: string } {
  const operatoreBase = value.negated ? "non è" : "è"
  switch (value.type) {
    case "text":
      return { operatore: operatoreBase, valore: value.contains.trim() }
    case "enum":
      return {
        operatore: operatoreBase,
        valore: value.selected
          .map(
            (selected) =>
              def.options?.find((option) => option.value === selected)?.label ?? selected,
          )
          .join(", "),
      }
    case "number": {
      if (value.min !== "" && value.max !== "") {
        return { operatore: operatoreBase, valore: `fra ${value.min} e ${value.max}` }
      }
      if (value.min !== "") return { operatore: operatoreBase, valore: `da ${value.min}` }
      return { operatore: operatoreBase, valore: `fino a ${value.max}` }
    }
    case "date": {
      if (value.from !== "" && value.to !== "") {
        return { operatore: operatoreBase, valore: `fra ${value.from} e ${value.to}` }
      }
      if (value.from !== "") return { operatore: operatoreBase, valore: `dal ${value.from}` }
      return { operatore: operatoreBase, valore: `fino al ${value.to}` }
    }
    case "boolean":
      return { operatore: operatoreBase, valore: value.value === "yes" ? "Sì" : "No" }
  }
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
  /** Viste rapide ricevute dalla pagina, non mostrate nel pannello laterale. */
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
  const { owners, installers, tags: tagDefinitions } = useTags()
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
        rating: leadOptions.optionsFor("rating"),
        statoArricchito: leadOptions.optionsFor("stato_arricchito"),
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
  const aperto = inline ? openInline : open

  // Sincronizza il draft con lo stato applicato all'apertura del pannello
  useEffect(() => {
    if (aperto) {
      const timeout = window.setTimeout(() => {
        setDraft(applied)
        setFieldQuery("")
        setExpanded(null)
      }, 0)
      return () => window.clearTimeout(timeout)
    }
  }, [aperto, applied])

  const visibleFields = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase()
    if (!q) return allFields
    return allFields.filter((f) => f.label.toLowerCase().includes(q))
  }, [allFields, fieldQuery])

  const appliedCount = countActiveAdvanced(applied)
  const draftCount = countActiveAdvanced(draft)
  const quickCount = quickFilters ? countActiveLeadFilters(quickFilters) : 0
  const treeCount = alberoApplicato ? contaCondizioni(alberoApplicato) : 0
  const totalAppliedCount = appliedCount + quickCount + treeCount

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

  const [costruttoreAperto, setCostruttoreAperto] = useState(false)
  const [filtroSalvatoAttivo, setFiltroSalvatoAttivo] = useState<string | null>(null)
  const [filtroInModifica, setFiltroInModifica] = useState<FiltroSalvato | null>(null)
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
    rating: leadOptions.optionsFor("rating").map((opzione) => opzione.value),
    statoArricchito: leadOptions.optionsFor("stato_arricchito").map((opzione) => opzione.value),
    campagne: leadOptions.optionsFor("campaign_name").map((opzione) => opzione.value),
    modalitaIscrizioneAnnullata: leadOptions
      .optionsFor("modalita_iscrizione_annullata")
      .map((opzione) => opzione.value),
    modelliPannello: leadOptions.optionsFor("modello_pannello").map((opzione) => opzione.value),
    installatori: installers.map((installer) => installer.id),
    creatori: owners.map((owner) => owner.nome),
    proprietari: owners.map((owner) => owner.id),
    tag: tagDefinitions.map((tag) => tag.id),
  }
  const etichetteValoriLead: Record<string, Record<string, string>> = {
    "Lead Proprietario": Object.fromEntries(owners.map((owner) => [owner.id, owner.nome])),
    "Installatore - Incaricato sopralluogo": Object.fromEntries(
      installers.map((installer) => [installer.id, installer.nome]),
    ),
    Tag: Object.fromEntries(tagDefinitions.map((tag) => [tag.id, tag.name])),
  }
  const gruppiLeadFiltrabili = gruppiCampiLead(opzioniCatalogo).map((gruppo) => ({
    ...gruppo,
    campi: gruppo.campi.map((campo) => ({
      ...campo,
      etichette: etichetteValoriLead[campo.chiave],
    })),
  }))
  const campiLeadFiltrabili = gruppiLeadFiltrabili.flatMap((gruppo) => gruppo.campi)
  const campiLeadPerChiave = new Map(campiLeadFiltrabili.map((campo) => [campo.chiave, campo]))
  const groupedVisibleFields = gruppiLeadFiltrabili
    .map((gruppo) => ({
      chiave: gruppo.chiave,
      etichetta: gruppo.etichetta,
      campi: gruppo.campi
        .map((campo) => fieldsById.get(campo.chiave))
        .filter((campo): campo is FieldDef => {
          if (!campo) return false
          return visibleFields.some((visibile) => visibile.id === campo.id)
        }),
    }))
    .filter((gruppo) => gruppo.campi.length > 0)
  const labelFor = (
    selected: readonly string[],
    options: readonly { value: string; label: string }[],
  ) =>
    selected
      .map((value) => options.find((option) => option.value === value)?.label ?? value)
      .join(", ")
  const activeFilterRows: Array<{
    id: string
    campo: string
    operatore: string
    valore: string
    onRemove: () => void
  }> = []

  if (quickFilters && onQuickFiltersChange) {
    const quickOptions = {
      stato: leadOptions.optionsFor("stato_lead"),
      sede: leadOptions.optionsFor("sede"),
      commerciale: owners.map((owner) => ({ value: owner.id, label: owner.nome })),
      origine: leadOptions.optionsFor("origine_lead"),
      tag: tagDefinitions.map((tag) => ({ value: tag.id, label: tag.name })),
      score: [
        { value: "caldo", label: "Caldo (>80)" },
        { value: "medio", label: "Medio (50-80)" },
        { value: "freddo", label: "Freddo (<50)" },
      ],
    } satisfies Record<Exclude<keyof LeadFilterState, "search">, Array<{ value: string; label: string }>>
    const quickLabels: Record<Exclude<keyof LeadFilterState, "search">, string> = {
      stato: "Stato lead",
      sede: "Sede",
      commerciale: "Proprietario",
      origine: "Origine lead",
      tag: "Tag",
      score: "Punteggio",
    }

    ;(Object.keys(quickOptions) as Array<Exclude<keyof LeadFilterState, "search">>).forEach((key) => {
      const values = quickFilters[key]
      if (!values.length) return
      activeFilterRows.push({
        id: `main:${key}`,
        campo: quickLabels[key],
        operatore: "è",
        valore: labelFor(values, quickOptions[key]),
        onRemove: () => onQuickFiltersChange({ ...quickFilters, [key]: [] }),
      })
    })
  }

  ;(Object.keys(draft.quick) as Array<keyof AdvancedFilterState["quick"]>).forEach((key) => {
    if (!draft.quick[key]) return
    activeFilterRows.push({
      id: `quick:${key}`,
      campo: QUICK_LABELS[key],
      operatore: "è",
      valore: "attivo",
      onRemove: () => setQuick(key, false),
    })
  })

  for (const [id, value] of Object.entries(draft.fields)) {
    const def = fieldsById.get(id)
    if (!def || !isFieldActive(value)) continue
    const formatted = formatFieldCondition(def, value)
    activeFilterRows.push({
      id: `field:${id}`,
      campo: def.label,
      operatore: formatted.operatore,
      valore: formatted.valore,
      onRemove: () => clearField(id),
    })
  }
  const activeFilterTotal = activeFilterRows.length + treeCount

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

  async function aggiornaFiltroSalvato(nome: string, gruppo: Gruppo) {
    if (!filtroInModifica) return
    const risposta = await fetch("/api/filtri-salvati", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: filtroInModifica.id,
        modulo: "lead",
        nome,
        definizione: gruppo,
      }),
    })
    if (!risposta.ok) {
      const dati = (await risposta.json().catch(() => ({}))) as { error?: string }
      toast.error(dati.error ?? "Modifica non riuscita")
      return
    }
    toast.success(`Filtro "${nome}" aggiornato`)
    setFiltroSalvatoAttivo(filtroInModifica.id)
    setFiltroInModifica(null)
    setCostruttoreAperto(false)
    setVersioneSalvati((v) => v + 1)
  }

  /** Salva quello che c'e' nel pannello, senza passare dal costruttore. */
  async function salvaDalPannello() {
    const nome = window.prompt("Nome del filtro (lo vedranno tutti):")?.trim()
    if (!nome) return
    const gruppo = alberoDaPannello(draft, campiLeadFiltrabili)
    if (!gruppo.nodi.length) {
      toast.error("Nessuna condizione da salvare")
      return
    }
    await salvaFiltro(nome, gruppo)
  }

  const costruttore = onApplicaAlbero ? (
    <CostruttoreFiltro
      aperto={costruttoreAperto}
      onChiudi={() => {
        setCostruttoreAperto(false)
        setFiltroInModifica(null)
      }}
      gruppi={gruppiLeadFiltrabili}
      valoreIniziale={filtroInModifica?.definizione ?? alberoApplicato ?? GRUPPO_VUOTO}
      nomeIniziale={filtroInModifica?.nome ?? ""}
      titolo={filtroInModifica ? "Modifica filtro salvato" : "Costruisci filtro"}
      etichettaSalva={filtroInModifica ? "Aggiorna filtro" : "Salva"}
      onApplica={(gruppo) => {
        // Applicare un albero composto a mano stacca l'eventuale filtro
        // salvato: non e' piu' quello.
        setFiltroSalvatoAttivo(null)
        setFiltroInModifica(null)
        onApplicaAlbero(gruppo)
      }}
      onSalva={filtroInModifica ? aggiornaFiltroSalvato : salvaFiltro}
    />
  ) : null

  const contenutoPannello = (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-row items-center justify-between border-b border-border p-4">
          <p className="text-base font-semibold text-foreground">Filtra Lead per</p>
          <div className="flex items-center gap-0.5">
            {onApplicaAlbero ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-card px-2 text-xs"
                aria-label="Apri il costruttore"
                title="Costruisci un filtro con condizioni e gruppi"
                onClick={() => {
                  setFiltroInModifica(null)
                  setCostruttoreAperto(true)
                }}
              >
                <Maximize2 data-icon="inline-start" />
                AND/OR
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
            campi={campiLeadFiltrabili}
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
            onModifica={(filtro) => {
              setFiltroInModifica(filtro)
              setCostruttoreAperto(true)
            }}
          />
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

          {/* Filtri in uso */}
          {activeFilterTotal > 0 ? (
            <div className="border-b border-border bg-secondary/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Filtri in uso</p>
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {activeFilterTotal}
                </span>
              </div>
              <div className="space-y-2">
                {activeFilterRows.length > 0 ? (
                  <div className="rounded-lg border border-border bg-card p-2">
                    <div className="mb-2 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase text-secondary-foreground">
                      Devono valere tutte
                    </div>
                    <div className="space-y-2">
                      {activeFilterRows.map((row, index) => (
                        <div key={row.id} className="space-y-2">
                          {index > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="h-px flex-1 bg-border" />
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                E
                              </span>
                              <div className="h-px flex-1 bg-border" />
                            </div>
                          ) : null}
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-border/70 bg-background p-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                {row.campo}
                              </p>
                              <p className="mt-1 break-words text-sm font-semibold text-foreground">
                                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-bold text-secondary-foreground">
                                  {row.operatore}
                                </span>{" "}
                                {row.valore}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Rimuovi ${row.campo}`}
                              onClick={row.onRemove}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {alberoApplicato && treeCount > 0 ? (
                  <div className="rounded-lg border border-border bg-card p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase text-secondary-foreground">
                        Filtro avanzato
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {treeCount} condizion{treeCount === 1 ? "e" : "i"}
                      </span>
                    </div>
                    <FiltroPreview gruppo={alberoApplicato} campi={campiLeadPerChiave} />
                    <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-card"
                        onClick={() => {
                          setFiltroInModifica(null)
                          setCostruttoreAperto(true)
                        }}
                      >
                        <Maximize2 data-icon="inline-start" />
                        Modifica
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Rimuovi filtro avanzato"
                        onClick={() => onApplicaAlbero?.(GRUPPO_VUOTO)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Filtra per campo */}
          <div className="p-3">
            <p className="px-1 pb-2 text-sm font-semibold text-foreground">
              Filtra per campo
            </p>
            <div className="flex flex-col gap-2">
              {groupedVisibleFields.map((gruppo) => (
                <Accordion key={gruppo.chiave} defaultValue={[gruppo.chiave]}>
                  <AccordionItem value={gruppo.chiave} className="rounded-lg border border-border bg-card px-2">
                    <AccordionTrigger className="py-2 text-sm font-semibold no-underline hover:no-underline">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{gruppo.etichetta}</span>
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {gruppo.campi.length}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="flex flex-col">
                        {gruppo.campi.map((def) => {
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
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ))}
              {groupedVisibleFields.length === 0 ? (
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
  const verso = (
    <Select
      value={value.negated ? "non" : "si"}
      onValueChange={(next) => onChange({ ...value, negated: next === "non" })}
    >
      <SelectTrigger className="h-10 w-full bg-card text-sm" aria-label={`${def.label} operatore`}>
        <span>{value.negated ? "non è" : "è"}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="si">è</SelectItem>
        <SelectItem value="non">non è</SelectItem>
      </SelectContent>
    </Select>
  )

  if (value.type === "text") {
    return (
      <div className="grid gap-2">
        {verso}
        <Input
          autoFocus
          value={value.contains}
          onChange={(e) => onChange({ ...value, type: "text", contains: e.target.value })}
          placeholder="Valore"
          className="bg-card"
          aria-label={`${def.label} valore`}
        />
      </div>
    )
  }

  if (value.type === "enum") {
    const selected = value.selected
    return (
      <div className="flex flex-col gap-2">
        {verso}
        {(def.options ?? []).length > 0 ? (
          <MultiFilterSelect
            ariaLabel={`Filtra per ${def.label}`}
            className="h-10 w-full bg-card text-sm"
            value={selected}
            onValueChange={(next) => onChange({ ...value, type: "enum", selected: next })}
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
      <div className="grid gap-2">
        {verso}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value.min}
            onChange={(e) =>
              onChange({ ...value, type: "number", min: e.target.value, max: value.max })
            }
            placeholder="Da"
            className="bg-card"
            aria-label={`${def.label} minimo`}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            value={value.max}
            onChange={(e) =>
              onChange({ ...value, type: "number", min: value.min, max: e.target.value })
            }
            placeholder="A"
            className="bg-card"
            aria-label={`${def.label} massimo`}
          />
        </div>
      </div>
    )
  }

  if (value.type === "date") {
    return (
      <div className="flex flex-col gap-2">
        {verso}
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Da
          <Input
            type="date"
            value={value.from}
            onChange={(e) =>
              onChange({ ...value, type: "date", from: e.target.value, to: value.to })
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
              onChange({ ...value, type: "date", from: value.from, to: e.target.value })
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
    <div className="grid gap-2">
      {verso}
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
            onClick={() => onChange({ ...value, type: "boolean", value: val })}
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
    </div>
  )
}
