"use client"

import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { SectionHeader, ColorDot } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"
import {
  MODULI_ATTRIBUTI,
  CAMPO_TIPI,
  CAMPO_TIPO_LABEL,
  type ModuloAttributi,
  type CampoTipo,
} from "@/lib/system-settings-data"
import { usePermissions } from "@/lib/permissions/provider"
import { tableForCrmModule } from "@/lib/crm-settings/schema-admin"
import { valutaFormula } from "@/lib/crm-settings/formula-eval"
import type { CrmColumnValueRow } from "@/lib/crm-settings/column-values"
import {
  crmColumnValuesKeys,
  useCrmColumnValues,
} from "@/lib/crm-settings/use-column-values"

/**
 * Campi e attributi: la DEFINIZIONE di un campo.
 *
 * Confine con la pagina Layout schede: li' si decide DOVE un campo appare
 * (pagina, blocco, ordine, larghezza), qui COSA E' (tipo, valori ammessi,
 * formula, formato). Una formula non cambia se sposto il campo in un altro
 * blocco, quindi appartiene al campo e vive qui.
 *
 * I valori delle tendine si leggono da crm_column_values, la stessa tabella
 * che leggono le schede e i filtri del CRM. Prima questa pagina mostrava una
 * copia tenuta in un blob di impostazioni: le due divergevano in silenzio e
 * cancellare un valore sembrava funzionare senza che succedesse niente.
 */

const PALETTE = ["#3b82f6", "#2e8b72", "#f59e0b", "#dc2626", "#8b5cf6", "#94a3b8"]

type SchemaColumn = {
  field_key: string
  label: string
  tipo: CampoTipo
  required: boolean
  requiredBloccato: boolean
  visible: boolean
  system: boolean
  column_name: string
  db_type: string
  formula: { expr: string } | null
  sola_lettura: boolean
  formato: { decimali?: number } | null
  tipi_compatibili: CampoTipo[]
}

type NuovoValore = { etichetta: string; colore: string }

function moduloKey(modulo: ModuloAttributi) {
  return modulo.toLowerCase()
}

function accettaValori(tipo: CampoTipo) {
  return tipo === "select" || tipo === "multiselect"
}

/**
 * Colonne che esistono per far funzionare il database, non per essere
 * configurate: chiavi, timestamp di sistema, residui dell'import Zoho.
 *
 * Restano raggiungibili con l'interruttore "mostra campi tecnici" invece di
 * sparire — in un pannello di amministrazione nascondere per sempre qualcosa
 * che c'e' e' peggio che mostrarlo — ma non occupano una scheda a testa
 * nell'elenco che si guarda tutti i giorni. Su Lead sono la meta' dei 66.
 */
function eTecnico(colonna: string) {
  return (
    colonna === "id" ||
    colonna === "created_at" ||
    colonna === "updated_at" ||
    colonna === "deleted_at" ||
    colonna.startsWith("zoho_") ||
    colonna.endsWith("_zoho_id")
  )
}

function valoriDiColonna(righe: CrmColumnValueRow[] | undefined, colonna: string) {
  return (righe ?? [])
    .filter((riga) => riga.column_name === colonna)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "it"))
}

/** Le colonne di un modulo che hanno almeno un valore: le sorgenti dell'import. */
function colonneConValori(righe: CrmColumnValueRow[] | undefined) {
  const perColonna = new Map<string, number>()
  for (const riga of righe ?? []) {
    perColonna.set(riga.column_name, (perColonna.get(riga.column_name) ?? 0) + 1)
  }
  return [...perColonna.entries()]
    .map(([colonna, quanti]) => ({ colonna, quanti }))
    .sort((a, b) => a.colonna.localeCompare(b.colonna))
}

function ValoreTrascinabile({
  valore,
  onModifica,
  onElimina,
  disabled,
}: {
  valore: CrmColumnValueRow
  onModifica: () => void
  onElimina: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: valore.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "text-muted-foreground",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-grab hover:text-foreground active:cursor-grabbing",
        )}
        aria-label={`Trascina ${valore.label}`}
        {...(disabled ? {} : attributes)}
        {...(disabled ? {} : listeners)}
      >
        <GripVertical className="size-4" />
      </button>
      <ColorDot color={valore.color ?? PALETTE[5]} />
      <span className="flex-1 truncate text-sm text-foreground">{valore.label}</span>
      <button
        type="button"
        onClick={onModifica}
        disabled={disabled}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        aria-label={`Modifica ${valore.label}`}
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onElimina}
        disabled={disabled}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        aria-label={`Elimina ${valore.label}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

/** Editor dei valori usato sia nella creazione del campo sia nel dialogo import. */
function EditorValoriNuovi({
  valori,
  onCambia,
  onImporta,
}: {
  valori: NuovoValore[]
  onCambia: (valori: NuovoValore[]) => void
  onImporta: () => void
}) {
  const [bozza, setBozza] = useState("")

  function aggiungi() {
    const etichetta = bozza.trim()
    if (!etichetta) return
    if (valori.some((v) => v.etichetta.toLowerCase() === etichetta.toLowerCase())) {
      setBozza("")
      return
    }
    onCambia([
      ...valori,
      { etichetta, colore: PALETTE[valori.length % PALETTE.length] },
    ])
    setBozza("")
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Opzioni della tendina</Label>
        <Button type="button" size="sm" variant="ghost" onClick={onImporta}>
          Importa da…
        </Button>
      </div>

      {valori.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {valori.map((valore, indice) => (
            <span
              key={valore.etichetta}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-xs"
            >
              <ColorDot color={valore.colore} />
              <span className="max-w-40 truncate">{valore.etichetta}</span>
              <button
                type="button"
                onClick={() => onCambia(valori.filter((_, i) => i !== indice))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Togli ${valore.etichetta}`}
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nessuna opzione. Un elenco di selezione senza opzioni non e&apos; utilizzabile.
        </p>
      )}

      <div className="flex gap-2">
        <Input
          value={bozza}
          onChange={(event) => setBozza(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              aggiungi()
            }
          }}
          placeholder="Scrivi e premi Invio"
          className="h-9"
        />
        <Button type="button" variant="outline" onClick={aggiungi} disabled={!bozza.trim()}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export default function AttributiPage() {
  const permissions = usePermissions()
  const queryClient = useQueryClient()
  const [modulo, setModulo] = useState<ModuloAttributi>("Lead")
  const [colonne, setColonne] = useState<SchemaColumn[]>([])
  const [search, setSearch] = useState("")
  const [mostraTecnici, setMostraTecnici] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loadingSchema, setLoadingSchema] = useState(false)

  // Creazione campo
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nome, setNome] = useState("")
  const [etichetta, setEtichetta] = useState("")
  const [tipo, setTipo] = useState<CampoTipo>("text")
  const [obbligatorio, setObbligatorio] = useState(false)
  const [valoriNuovi, setValoriNuovi] = useState<NuovoValore[]>([])

  // Import valori da un'altra tendina
  const [importOpen, setImportOpen] = useState(false)
  const [importModulo, setImportModulo] = useState<ModuloAttributi>("Lead")
  const [importColonna, setImportColonna] = useState<string | null>(null)

  // Modifica di un campo esistente
  const [editing, setEditing] = useState<SchemaColumn | null>(null)
  const [editEtichetta, setEditEtichetta] = useState("")
  const [editFormula, setEditFormula] = useState("")
  const [editDecimali, setEditDecimali] = useState("")

  // Valori di un campo
  const [nuovoValoreCampo, setNuovoValoreCampo] = useState<string | null>(null)
  const [nuovoValoreEtichetta, setNuovoValoreEtichetta] = useState("")
  const [nuovoValoreColore, setNuovoValoreColore] = useState(PALETTE[0])
  const [valoreInModifica, setValoreInModifica] = useState<CrmColumnValueRow | null>(null)
  const [valoreEtichetta, setValoreEtichetta] = useState("")
  const [valoreColore, setValoreColore] = useState(PALETTE[0])

  const valoriQuery = useCrmColumnValues(modulo)
  const valoriImport = useCrmColumnValues(importModulo)

  const currentModule = moduloKey(modulo)
  const canManageSchema = permissions.canAction("crm_settings.system.schema.manage")
  const canCreateFields =
    canManageSchema && permissions.canAction(`${currentModule}.fields.create`)
  const canEditFields =
    canManageSchema && permissions.canAction(`${currentModule}.fields.edit`)
  const canDeleteFields =
    canManageSchema && permissions.canAction(`${currentModule}.fields.delete`)
  const canManageVisibility = permissions.canAction(
    `${currentModule}.fields.visibility.manage`,
  )
  const canManageRequired = permissions.canAction(
    `${currentModule}.fields.required.manage`,
  )
  const canManageValues = permissions.canAction(
    "crm_settings.system.default_values.manage",
  )

  useEffect(() => {
    const richiesto = new URLSearchParams(window.location.search).get("module")
    const scelto = MODULI_ATTRIBUTI.find(
      (m) => m.toLowerCase() === richiesto?.toLowerCase(),
    )
    if (scelto) queueMicrotask(() => setModulo(scelto))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function carica() {
      if (!canManageSchema) return
      setLoadingSchema(true)
      setApiError(null)
      const response = await fetch(
        `/api/crm-settings/schema/columns?module=${encodeURIComponent(modulo)}`,
      )
      if (cancelled) return
      setLoadingSchema(false)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setApiError(body?.error ?? "Caricamento campi Supabase non riuscito.")
        return
      }
      const body = (await response.json().catch(() => null)) as
        | { columns?: SchemaColumn[] }
        | null
      if (!cancelled) setColonne(body?.columns ?? [])
    }

    void carica()
    return () => {
      cancelled = true
    }
  }, [canManageSchema, modulo])

  const colonneFiltrate = useMemo(() => {
    const query = search.trim().toLowerCase()
    const base = mostraTecnici ? colonne : colonne.filter((c) => !eTecnico(c.column_name))
    if (!query) return base
    return base.filter((colonna) =>
      `${colonna.column_name} ${colonna.label} ${CAMPO_TIPO_LABEL[colonna.tipo]}`
        .toLowerCase()
        .includes(query),
    )
  }, [colonne, search, mostraTecnici])

  const contaSistema = colonne.filter((colonna) => colonna.system).length
  const contaTecnici = colonne.filter((colonna) => eTecnico(colonna.column_name)).length
  const nomeValido = /^[a-z][a-z0-9_]*$/.test(nome)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function aggiornaColonnaLocale(colonna: string, patch: Partial<SchemaColumn>) {
    setColonne((prev) =>
      prev.map((item) => (item.column_name === colonna ? { ...item, ...patch } : item)),
    )
  }

  async function ricaricaValori() {
    await queryClient.invalidateQueries({ queryKey: crmColumnValuesKeys.module(modulo) })
  }

  async function patchCampo(colonna: string, corpo: Record<string, unknown>) {
    setApiError(null)
    setPending(true)
    const response = await fetch("/api/crm-settings/schema/columns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: modulo, column: colonna, ...corpo }),
    })
    setPending(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Aggiornamento campo non riuscito.")
      return false
    }
    return true
  }

  async function creaCampo() {
    if (!canCreateFields || !nomeValido || !etichetta.trim()) return
    setPending(true)
    setApiError(null)
    setAvviso(null)
    const response = await fetch("/api/crm-settings/schema/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: modulo,
        name: nome,
        label: etichetta.trim(),
        type: tipo,
        required: obbligatorio,
        visible: true,
        values: accettaValori(tipo)
          ? valoriNuovi.map((valore) => ({
              label: valore.etichetta,
              color: valore.colore,
            }))
          : [],
      }),
    })
    setPending(false)
    const body = (await response.json().catch(() => null)) as
      | { error?: string; avviso?: string }
      | null
    if (!response.ok) {
      setApiError(body?.error ?? "Creazione colonna non riuscita.")
      return
    }
    if (body?.avviso) setAvviso(body.avviso)

    setDialogOpen(false)
    setValoriNuovi([])
    setNome("")
    setEtichetta("")
    // Ricarica invece di inserire a mano la riga: il server calcola tipi
    // compatibili, obbligatorieta' reale e ordinamento, e indovinarli qui
    // vorrebbe dire duplicare quella logica e vederla divergere.
    setColonne([])
    await Promise.all([ricaricaValori(), ricaricaColonne()])
  }

  async function ricaricaColonne() {
    const response = await fetch(
      `/api/crm-settings/schema/columns?module=${encodeURIComponent(modulo)}`,
    )
    if (!response.ok) return
    const body = (await response.json().catch(() => null)) as
      | { columns?: SchemaColumn[] }
      | null
    setColonne(body?.columns ?? [])
  }

  async function eliminaCampo(colonna: string) {
    if (!canDeleteFields) return
    setPending(true)
    setApiError(null)
    const response = await fetch(
      `/api/crm-settings/schema/columns?module=${encodeURIComponent(modulo)}&column=${encodeURIComponent(colonna)}`,
      { method: "DELETE" },
    )
    setPending(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Eliminazione colonna non riuscita.")
      return
    }
    setColonne((prev) => prev.filter((item) => item.column_name !== colonna))
    await ricaricaValori()
  }

  function apriModifica(colonna: SchemaColumn) {
    if (!canEditFields) return
    setEditing(colonna)
    setEditEtichetta(colonna.label)
    setEditFormula(colonna.formula?.expr ?? "")
    setEditDecimali(
      colonna.formato?.decimali != null ? String(colonna.formato.decimali) : "",
    )
  }

  async function salvaModifica() {
    if (!editing || !editEtichetta.trim()) return
    const formula = editFormula.trim()
    const ok = await patchCampo(editing.column_name, {
      label: editEtichetta.trim(),
      formula: formula ? { expr: formula } : null,
      formato: editDecimali === "" ? {} : { decimali: Number(editDecimali) },
    })
    if (!ok) return
    aggiornaColonnaLocale(editing.column_name, {
      label: editEtichetta.trim(),
      formula: formula ? { expr: formula } : null,
      formato: editDecimali === "" ? {} : { decimali: Number(editDecimali) },
    })
    setEditing(null)
  }

  async function creaValore() {
    if (!nuovoValoreCampo || !nuovoValoreEtichetta.trim()) return
    setPending(true)
    setApiError(null)
    const response = await fetch("/api/crm-settings/schema/default-values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: modulo,
        field: nuovoValoreCampo,
        label: nuovoValoreEtichetta.trim(),
        color: nuovoValoreColore,
      }),
    })
    setPending(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Creazione valore non riuscita.")
      return
    }
    setNuovoValoreCampo(null)
    setNuovoValoreEtichetta("")
    await ricaricaValori()
  }

  async function salvaValore() {
    if (!valoreInModifica || !valoreEtichetta.trim()) return
    setPending(true)
    setApiError(null)
    const response = await fetch("/api/crm-settings/schema/default-values", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: modulo,
        field: valoreInModifica.column_name,
        id: valoreInModifica.id,
        label: valoreEtichetta.trim(),
        color: valoreColore,
      }),
    })
    setPending(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Modifica valore non riuscita.")
      return
    }
    setValoreInModifica(null)
    await ricaricaValori()
  }

  async function eliminaValore(colonna: string, id: string) {
    if (!canManageValues) return
    setPending(true)
    setApiError(null)
    const params = new URLSearchParams({ module: modulo, field: colonna, id })
    const response = await fetch(`/api/crm-settings/schema/default-values?${params}`, {
      method: "DELETE",
    })
    setPending(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Eliminazione valore non riuscita.")
      return
    }
    await ricaricaValori()
  }

  async function riordinaValori(colonna: string, ids: string[]) {
    setApiError(null)
    const response = await fetch("/api/crm-settings/schema/default-values", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: modulo, field: colonna, order: ids }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Riordino valori non riuscito.")
    }
    await ricaricaValori()
  }

  function importaValori() {
    if (!importColonna) return
    const sorgente = valoriDiColonna(valoriImport.data, importColonna)
    const esistenti = new Set(valoriNuovi.map((v) => v.etichetta.toLowerCase()))
    const aggiunti = sorgente
      .filter((riga) => !esistenti.has(riga.label.toLowerCase()))
      .map((riga, indice) => ({
        etichetta: riga.label,
        colore: riga.color ?? PALETTE[(valoriNuovi.length + indice) % PALETTE.length],
      }))
    setValoriNuovi([...valoriNuovi, ...aggiunti])
    setImportOpen(false)
    setImportColonna(null)
  }

  const formulaTrim = editFormula.trim()
  const esitoFormula = formulaTrim ? valutaFormula(formulaTrim, new Map()) : null
  const formulaNonValida = esitoFormula !== null && !esitoFormula.ok

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Campi e attributi"
        description={
          pending || loadingSchema
            ? "Salvataggio schema CRM..."
            : `Tipo, valori e formule dei campi di ${tableForCrmModule(modulo) ?? modulo}. La posizione in scheda si decide in Layout schede.`
        }
      />

      {apiError ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {apiError}
        </p>
      ) : null}
      {avviso ? (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          {avviso}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {MODULI_ATTRIBUTI.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModulo(m)
                  setSearch("")
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  modulo === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca campo..."
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1">
            {colonneFiltrate.length} campi
          </span>
          <span className="rounded-full bg-muted px-2 py-1">{contaSistema} sistema</span>
          <span className="rounded-full bg-muted px-2 py-1">
            {colonne.length - contaSistema} custom
          </span>
          {contaTecnici > 0 ? (
            <label className="ml-auto flex cursor-pointer items-center gap-2">
              <span>{contaTecnici} campi tecnici</span>
              <Switch
                checked={mostraTecnici}
                onCheckedChange={setMostraTecnici}
                aria-label="Mostra campi tecnici"
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {colonneFiltrate.map((colonna) => {
          const valori = valoriDiColonna(valoriQuery.data, colonna.column_name)
          const mostraValori = accettaValori(colonna.tipo)
          const tipiScegliibili =
            colonna.tipi_compatibili?.length > 0 ? colonna.tipi_compatibili : [colonna.tipo]

          return (
            <article
              key={colonna.column_name}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {colonna.label}
                    </h2>
                    {colonna.system ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span
                              className="inline-flex size-5 items-center justify-center rounded-full border border-warning/30 bg-warning/10 text-xs font-bold text-warning"
                              aria-label="Campo di sistema - non cancellabile"
                            >
                              !
                            </span>
                          }
                        />
                        <TooltipContent>Campo di sistema - non cancellabile</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-semibold text-teal">
                        custom
                      </span>
                    )}
                    {colonna.formula ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                              fx
                            </span>
                          }
                        />
                        <TooltipContent>{colonna.formula.expr}</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {colonna.column_name}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Azioni per ${colonna.label}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!canEditFields}
                      onClick={() => apriModifica(colonna)}
                    >
                      <Pencil className="size-4" />
                      Modifica campo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={colonna.system || !canDeleteFields}
                      onClick={() => void eliminaCampo(colonna.column_name)}
                    >
                      <Trash2 className="size-4" />
                      Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select
                    value={colonna.tipo}
                    disabled={!canEditFields || tipiScegliibili.length < 2}
                    onValueChange={async (v) => {
                      const nuovo = (v ?? colonna.tipo) as CampoTipo
                      if (nuovo === colonna.tipo) return
                      const ok = await patchCampo(colonna.column_name, { type: nuovo })
                      if (ok) aggiornaColonnaLocale(colonna.column_name, { tipo: nuovo })
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue>
                        {(v) => CAMPO_TIPO_LABEL[v as CampoTipo]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tipiScegliibili.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CAMPO_TIPO_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 pt-5">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-1.5">
                      Obbligatorio
                      {colonna.requiredBloccato ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="text-xs text-muted-foreground">(NOT NULL)</span>
                            }
                          />
                          <TooltipContent>
                            La colonna non ammette valori vuoti: l&apos;obbligatorieta&apos; non
                            si puo&apos; togliere senza modificare la colonna.
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </span>
                    <Switch
                      checked={colonna.required}
                      disabled={!canManageRequired || colonna.requiredBloccato}
                      onCheckedChange={async (v) => {
                        const ok = await patchCampo(colonna.column_name, { required: v })
                        if (ok) aggiornaColonnaLocale(colonna.column_name, { required: v })
                      }}
                      aria-label={`${colonna.label} obbligatorio`}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-1.5 text-sm">
                    <span>Visibile</span>
                    <Switch
                      checked={colonna.visible}
                      disabled={!canManageVisibility}
                      onCheckedChange={async (v) => {
                        const ok = await patchCampo(colonna.column_name, { visible: v })
                        if (ok) aggiornaColonnaLocale(colonna.column_name, { visible: v })
                      }}
                      aria-label={`${colonna.label} visibile`}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-1.5 text-sm">
                    <span>Sola lettura</span>
                    <Switch
                      checked={colonna.sola_lettura || colonna.formula !== null}
                      disabled={!canEditFields || colonna.formula !== null}
                      onCheckedChange={async (v) => {
                        const ok = await patchCampo(colonna.column_name, { solaLettura: v })
                        if (ok) aggiornaColonnaLocale(colonna.column_name, { sola_lettura: v })
                      }}
                      aria-label={`${colonna.label} sola lettura`}
                    />
                  </label>
                </div>
              </div>

              {/* Un campo calcolato e' definito dalla sua formula: tenerla dietro
                  un menu a tre puntini vuol dire che per sapere cosa calcola un
                  campo bisogna gia' sapere dove guardare. */}
              {colonna.formula ? (
                <div className="mt-4 rounded-lg border border-border bg-muted/25 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">Formula</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canEditFields}
                      onClick={() => apriModifica(colonna)}
                    >
                      <Pencil className="size-3.5" />
                      Modifica
                    </Button>
                  </div>
                  <code className="mt-2 block break-words rounded-md bg-card px-2 py-1.5 font-mono text-xs text-muted-foreground">
                    {colonna.formula.expr}
                  </code>
                </div>
              ) : null}

              {mostraValori ? (
                <div className="mt-4 rounded-lg border border-border bg-muted/25 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Valori</h3>
                      <p className="text-xs text-muted-foreground">
                        {valoriQuery.isPending
                          ? "Caricamento…"
                          : `${valori.length} opzioni`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canManageValues || pending}
                      onClick={() => {
                        setNuovoValoreCampo(colonna.column_name)
                        setNuovoValoreEtichetta("")
                        setNuovoValoreColore(PALETTE[valori.length % PALETTE.length])
                      }}
                    >
                      <Plus className="size-4" />
                      Valore
                    </Button>
                  </div>

                  {valori.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event
                        if (!canManageValues || !over || active.id === over.id) return
                        const da = valori.findIndex((v) => v.id === active.id)
                        const a = valori.findIndex((v) => v.id === over.id)
                        void riordinaValori(
                          colonna.column_name,
                          arrayMove(valori, da, a).map((v) => v.id),
                        )
                      }}
                    >
                      <SortableContext
                        items={valori.map((v) => v.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="mt-3 flex flex-col gap-1.5">
                          {valori.map((valore) => (
                            <ValoreTrascinabile
                              key={valore.id}
                              valore={valore}
                              disabled={!canManageValues || pending}
                              onModifica={() => {
                                setValoreInModifica(valore)
                                setValoreEtichetta(valore.label)
                                setValoreColore(valore.color ?? PALETTE[0])
                              }}
                              onElimina={() =>
                                void eliminaValore(colonna.column_name, valore.id)
                              }
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Nessuna opzione configurata.
                    </p>
                  )}
                </div>
              ) : null}
            </article>
          )
        })}
        {colonneFiltrate.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground xl:col-span-2">
            {loadingSchema ? "Caricamento campi…" : "Nessun campo trovato."}
          </div>
        ) : null}
      </div>

      <div>
        <Button
          onClick={() => {
            if (!canCreateFields) return
            setNome("")
            setEtichetta("")
            setTipo("text")
            setObbligatorio(false)
            setValoriNuovi([])
            setDialogOpen(true)
          }}
          disabled={!canCreateFields || pending}
          className="bg-teal text-teal-foreground hover:bg-teal/90"
        >
          <Plus className="size-4" />
          Nuovo campo
        </Button>
      </div>

      {/* ---- Nuovo campo ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo campo · {modulo}</DialogTitle>
            <DialogDescription>
              Crea una colonna reale su {tableForCrmModule(modulo) ?? modulo} con il suo
              tipo e, se e&apos; una tendina, le sue opzioni.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="campo-nome">Nome campo (snake_case)</Label>
              <Input
                id="campo-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="es. valore_stimato"
                className={cn(nome && !nomeValido && "border-destructive")}
              />
              {nome && !nomeValido ? (
                <span className="text-xs text-destructive">
                  Solo lettere minuscole, numeri e underscore; deve iniziare con una lettera.
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campo-etichetta">Etichetta</Label>
              <Input
                id="campo-etichetta"
                value={etichetta}
                onChange={(e) => setEtichetta(e.target.value)}
                placeholder="es. Valore stimato (€)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo((v ?? "text") as CampoTipo)}>
                <SelectTrigger>
                  <SelectValue>{(v) => CAMPO_TIPO_LABEL[v as CampoTipo]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CAMPO_TIPI.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CAMPO_TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipo === "lookup" ? (
                <p className="text-xs text-muted-foreground">
                  Crea una colonna uuid. Il collegamento al modulo di destinazione non e&apos;
                  ancora configurabile da qui.
                </p>
              ) : null}
            </div>

            {accettaValori(tipo) ? (
              <EditorValoriNuovi
                valori={valoriNuovi}
                onCambia={setValoriNuovi}
                onImporta={() => {
                  setImportModulo(modulo)
                  setImportColonna(null)
                  setImportOpen(true)
                }}
              />
            ) : null}

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="campo-obbligatorio" className="cursor-pointer">
                Obbligatorio
              </Label>
              <Switch
                id="campo-obbligatorio"
                checked={obbligatorio}
                onCheckedChange={setObbligatorio}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => void creaCampo()}
              disabled={!canCreateFields || pending || !nomeValido || !etichetta.trim()}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Crea campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Importa valori da un'altra tendina ---- */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importa valori</DialogTitle>
            <DialogDescription>
              Copia le opzioni da una tendina gia&apos; configurata. Vengono copiati solo i
              valori: il campo di partenza non viene toccato.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label>Modulo di origine</Label>
              <Select
                value={importModulo}
                onValueChange={(v) => {
                  setImportModulo((v ?? "Lead") as ModuloAttributi)
                  setImportColonna(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULI_ATTRIBUTI.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Campo di origine</Label>
              {valoriImport.isPending ? (
                <p className="text-sm text-muted-foreground">Caricamento…</p>
              ) : colonneConValori(valoriImport.data).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nessuna tendina configurata in {importModulo}.
                </p>
              ) : (
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                  {colonneConValori(valoriImport.data).map((voce) => (
                    <button
                      key={voce.colonna}
                      type="button"
                      onClick={() => setImportColonna(voce.colonna)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        importColonna === voce.colonna
                          ? "border-teal bg-teal/5"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      <span className="font-mono text-xs">{voce.colonna}</span>
                      <span className="text-xs text-muted-foreground">
                        {voce.quanti} opzioni
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={importaValori}
              disabled={!importColonna}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Importa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Modifica campo: etichetta, formula, formato ---- */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica {editing?.label}</DialogTitle>
            <DialogDescription>
              Chiave: {editing?.column_name}. La chiave non cambia, il dato sottostante
              resta dove si trova.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-etichetta">Etichetta</Label>
              <Input
                id="edit-etichetta"
                value={editEtichetta}
                onChange={(e) => setEditEtichetta(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-decimali">Decimali</Label>
              <Input
                id="edit-decimali"
                value={editDecimali}
                onChange={(e) => setEditDecimali(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Lascia vuoto per il default"
                inputMode="numeric"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-formula">Formula</Label>
              <Textarea
                id="edit-formula"
                value={editFormula}
                onChange={(e) => setEditFormula(e.target.value)}
                placeholder="Es. {Tot Contratto} - {Saldo}"
                rows={3}
                className={cn(formulaNonValida && "border-destructive")}
              />
              {formulaNonValida ? (
                <span className="text-xs text-destructive">
                  {esitoFormula && !esitoFormula.ok ? esitoFormula.errore : ""}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Un campo con formula non e&apos; scrivibile: il valore si ricalcola a ogni
                  lettura. Svuota la formula per renderlo di nuovo modificabile.
                </span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annulla
            </Button>
            <Button
              onClick={() => void salvaModifica()}
              disabled={pending || formulaNonValida || !editEtichetta.trim()}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Nuovo valore ---- */}
      <Dialog
        open={nuovoValoreCampo !== null}
        onOpenChange={(open) => {
          if (!open) setNuovoValoreCampo(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo valore</DialogTitle>
            <DialogDescription>
              Nuova opzione per {nuovoValoreCampo}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valore-etichetta">Etichetta</Label>
              <Input
                id="valore-etichetta"
                value={nuovoValoreEtichetta}
                onChange={(e) => setNuovoValoreEtichetta(e.target.value)}
                placeholder="Es. Da richiamare"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Colore</Label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((colore) => (
                  <button
                    key={colore}
                    type="button"
                    onClick={() => setNuovoValoreColore(colore)}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform hover:scale-105",
                      nuovoValoreColore === colore ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: colore }}
                    aria-label={`Colore ${colore}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuovoValoreCampo(null)}>
              Annulla
            </Button>
            <Button
              onClick={() => void creaValore()}
              disabled={pending || !nuovoValoreEtichetta.trim()}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Modifica valore ---- */}
      <Dialog
        open={valoreInModifica !== null}
        onOpenChange={(open) => {
          if (!open) setValoreInModifica(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica valore</DialogTitle>
            <DialogDescription>
              Cambia come l&apos;opzione viene mostrata. I record che la usano restano
              collegati: la chiave interna non cambia.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valore-edit-etichetta">Etichetta</Label>
              <Input
                id="valore-edit-etichetta"
                value={valoreEtichetta}
                onChange={(e) => setValoreEtichetta(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Colore</Label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((colore) => (
                  <button
                    key={colore}
                    type="button"
                    onClick={() => setValoreColore(colore)}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform hover:scale-105",
                      valoreColore === colore ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: colore }}
                    aria-label={`Colore ${colore}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValoreInModifica(null)}>
              Annulla
            </Button>
            <Button
              onClick={() => void salvaValore()}
              disabled={pending || !valoreEtichetta.trim()}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
