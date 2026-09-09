"use client"

import { useCallback, useEffect, useState } from "react"
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
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Sigma,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
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
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/lib/permissions/provider"
import { CAMPO_TIPI, CAMPO_TIPO_LABEL, type CampoTipo } from "@/lib/system-settings-data"
import type { LayoutBlocco, LayoutCampo, LayoutPagina } from "@/lib/crm-settings/layout"
import { LAYOUT_MODULI, type LayoutModulo } from "@/lib/crm-settings/layout-validate"
import { valutaFormula } from "@/lib/crm-settings/formula-eval"

const MODULO_LABEL: Record<LayoutModulo, string> = {
  clienti: "Clienti",
  lead: "Lead",
  installatori: "Installatori",
  compiti: "Compiti",
}

const PAGE_KEY = "crm_settings.system.layout"

type Dialogo =
  | { tipo: "pagina" }
  | { tipo: "blocco"; paginaId: string; paginaLabel: string }
  | { tipo: "campo"; bloccoId: string; bloccoLabel: string }
  | { tipo: "modifica-campo"; campo: LayoutCampo }
  | { tipo: "rinomina"; livello: "pagina" | "blocco"; id: string; label: string }
  | null

type Patch = (tipo: string, id: string, campi: Record<string, unknown>) => Promise<void>
type Elimina = (tipo: string, id: string, avviso: string) => Promise<void>
/**
 * Riordina i fratelli di un livello. `contenitoreId` identifica il genitore
 * (pagina per i blocchi, blocco per i campi) e serve per anticipare il nuovo
 * ordine nello stato senza aspettare il server: e' quello che rende fluido
 * il trascinamento. Le pagine non ne hanno bisogno, stanno alla radice.
 */
type Riordina = (
  tipo: "pagina" | "blocco" | "campo",
  ordine: string[],
  contenitoreId?: string,
) => Promise<boolean>

export default function LayoutSchedePage() {
  const { pageAccess } = usePermissions()
  const readonly = pageAccess(PAGE_KEY) !== "rw"

  const [modulo, setModulo] = useState<LayoutModulo>("clienti")
  const [pagine, setPagine] = useState<LayoutPagina[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [aperte, setAperte] = useState<Set<string>>(new Set())
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const carica = useCallback(async () => {
    setCaricamento(true)
    setMessaggio(null)
    try {
      const risposta = await fetch(`/api/crm-settings/layout?modulo=${modulo}`)
      const dati = await risposta.json()
      if (!risposta.ok) throw new Error(dati.error ?? "Caricamento non riuscito")
      setPagine(dati.pagine ?? [])
    } catch (e) {
      setMessaggio(e instanceof Error ? e.message : "Caricamento non riuscito")
      setPagine([])
    } finally {
      setCaricamento(false)
    }
  }, [modulo])

  useEffect(() => {
    queueMicrotask(() => void carica())
  }, [carica])

  const scrivi = useCallback(
    async (init: RequestInit & { url?: string }) => {
      setMessaggio(null)
      try {
        const risposta = await fetch(init.url ?? "/api/crm-settings/layout", init)
        const dati = await risposta.json().catch(() => ({}))
        if (!risposta.ok) throw new Error(dati.error ?? "Operazione non riuscita")
        if (dati.avviso) setMessaggio(dati.avviso)
        await carica()
        return true
      } catch (e) {
        setMessaggio(e instanceof Error ? e.message : "Operazione non riuscita")
        return false
      }
    },
    [carica],
  )

  const riordina: Riordina = useCallback(
    (tipo, ordine, contenitoreId) => {
      // Anticipo ottimistico sullo stato principale: la lista si riordina
      // subito sotto le dita, poi carica() conferma con quanto salvato.
      const perIndice = new Map(ordine.map((id, indice) => [id, indice]))
      const ordinaPer = <T extends { id: string }>(elementi: T[]) =>
        [...elementi].sort(
          (a, b) => (perIndice.get(a.id) ?? 0) - (perIndice.get(b.id) ?? 0),
        )

      setPagine((precedenti) => {
        if (tipo === "pagina") return ordinaPer(precedenti)
        if (tipo === "blocco") {
          return precedenti.map((p) =>
            p.id === contenitoreId ? { ...p, blocchi: ordinaPer(p.blocchi) } : p,
          )
        }
        return precedenti.map((p) => ({
          ...p,
          blocchi: p.blocchi.map((b) =>
            b.id === contenitoreId ? { ...b, campi: ordinaPer(b.campi) } : b,
          ),
        }))
      })

      return scrivi({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulo, tipo, ordine }),
      })
    },
    [modulo, scrivi],
  )

  const patch: Patch = useCallback(
    async (tipo, id, campi) => {
      await scrivi({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulo, tipo, id, ...campi }),
      })
    },
    [modulo, scrivi],
  )

  const elimina: Elimina = useCallback(
    async (tipo, id, avviso) => {
      if (!window.confirm(avviso)) return
      await scrivi({ method: "DELETE", url: `/api/crm-settings/layout?tipo=${tipo}&id=${id}` })
    },
    [scrivi],
  )

  function alterna(id: string) {
    setAperte((precedenti) => {
      const nuove = new Set(precedenti)
      if (nuove.has(id)) nuove.delete(id)
      else nuove.add(id)
      return nuove
    })
  }

  function fineTrascinaPagine(evento: DragEndEvent) {
    const { active, over } = evento
    if (readonly || !over || active.id === over.id) return
    const da = pagine.findIndex((p) => p.id === active.id)
    const a = pagine.findIndex((p) => p.id === over.id)
    void riordina(
      "pagina",
      arrayMove(pagine, da, a).map((p) => p.id),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Layout schede"
        description="Pagine, blocchi e disposizione dei campi nelle schede record. La struttura definita qui vale per tutti."
        action={
          <div className="flex items-center gap-2">
            <Select
              value={modulo}
              onValueChange={(v) => setModulo((v ?? "clienti") as LayoutModulo)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_MODULI.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODULO_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!readonly ? (
              <Button size="sm" onClick={() => setDialogo({ tipo: "pagina" })}>
                <Plus data-icon="inline-start" />
                Pagina
              </Button>
            ) : null}
          </div>
        }
      />

      {messaggio ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {messaggio}
        </div>
      ) : null}

      {caricamento ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Caricamento del layout…
        </div>
      ) : pagine.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nessuna pagina configurata per {MODULO_LABEL[modulo]}.
          {!readonly ? " Aggiungine una per iniziare." : null}
        </div>
      ) : (
        <DndContext
          id={`layout-pagine-${modulo}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={fineTrascinaPagine}
        >
          <SortableContext items={pagine.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {pagine.map((pagina) => (
                <RigaPagina
                  key={pagina.id}
                  pagina={pagina}
                  aperta={aperte.has(pagina.id)}
                  readonly={readonly}
                  sensors={sensors}
                  onAlterna={() => alterna(pagina.id)}
                  onPatch={patch}
                  onElimina={elimina}
                  onRiordina={riordina}
                  onDialogo={setDialogo}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <DialoghiLayout
        key={chiaveDialogo(dialogo)}
        dialogo={dialogo}
        modulo={modulo}
        onChiudi={() => setDialogo(null)}
        onInvia={async (metodo, corpo) => {
          const ok = await scrivi({
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modulo, ...corpo }),
          })
          if (ok) setDialogo(null)
        }}
      />
    </div>
  )
}

/** Chiave di rimontaggio: il form riparte pulito a ogni apertura diversa. */
function chiaveDialogo(dialogo: Dialogo): string {
  if (!dialogo) return "chiuso"
  if (dialogo.tipo === "pagina") return "pagina"
  if (dialogo.tipo === "blocco") return `blocco:${dialogo.paginaId}`
  if (dialogo.tipo === "campo") return `campo:${dialogo.bloccoId}`
  if (dialogo.tipo === "modifica-campo") return `modifica:${dialogo.campo.id}`
  return `rinomina:${dialogo.id}`
}

/* --------------------------------------------------------------- pagina */

function RigaPagina({
  pagina,
  aperta,
  readonly,
  sensors,
  onAlterna,
  onPatch,
  onElimina,
  onRiordina,
  onDialogo,
}: {
  pagina: LayoutPagina
  aperta: boolean
  readonly: boolean
  sensors: ReturnType<typeof useSensors>
  onAlterna: () => void
  onPatch: Patch
  onElimina: Elimina
  onRiordina: Riordina
  onDialogo: (d: Dialogo) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pagina.id,
  })
  const blocchi = pagina.blocchi
  const conteggio = blocchi.reduce((somma, b) => somma + b.campi.length, 0)

  function fineTrascinaBlocchi(evento: DragEndEvent) {
    const { active, over } = evento
    if (readonly || !over || active.id === over.id) return
    const da = blocchi.findIndex((b) => b.id === active.id)
    const a = blocchi.findIndex((b) => b.id === over.id)
    void onRiordina(
      "blocco",
      arrayMove(blocchi, da, a).map((b) => b.id),
      pagina.id,
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-border bg-card",
        !pagina.visible && "opacity-60",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        {!readonly ? (
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Trascina per riordinare la pagina"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={onAlterna}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {aperta ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-semibold text-foreground">{pagina.label}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {pagina.componente
              ? `componente dedicato${blocchi.length ? ` · ${blocchi.length} blocchi · ${conteggio} campi` : ""}`
              : `${blocchi.length} blocchi · ${conteggio} campi`}
          </span>
        </button>

        {!readonly ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onDialogo({ tipo: "blocco", paginaId: pagina.id, paginaLabel: pagina.label })
              }
            >
              <Plus data-icon="inline-start" />
              Blocco
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Rinomina pagina"
              onClick={() =>
                onDialogo({
                  tipo: "rinomina",
                  livello: "pagina",
                  id: pagina.id,
                  label: pagina.label,
                })
              }
            >
              <Pencil className="size-4" />
            </Button>
            <BottoneVisibilita
              visible={pagina.visible}
              onCambia={(v) => void onPatch("pagina", pagina.id, { visible: v })}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Elimina pagina"
              onClick={() =>
                void onElimina(
                  "pagina",
                  pagina.id,
                  `Eliminare la pagina "${pagina.label}"? Spariranno anche i suoi blocchi e la disposizione dei campi. I dati dei campi non vengono toccati.`,
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      {aperta ? (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
          {pagina.componente ? (
            <p className="text-xs text-muted-foreground">
              Mostra il componente <span className="font-semibold">{pagina.componente}</span>. I
              blocchi aggiunti qui compaiono sotto di esso.
            </p>
          ) : null}

          {blocchi.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun blocco in questa pagina.</p>
          ) : (
            <DndContext
              id={`layout-blocchi-${pagina.pageKey}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={fineTrascinaBlocchi}
            >
              <SortableContext
                items={blocchi.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {blocchi.map((blocco) => (
                    <RigaBlocco
                      key={blocco.id}
                      blocco={blocco}
                      readonly={readonly}
                      sensors={sensors}
                      onPatch={onPatch}
                      onElimina={onElimina}
                      onRiordina={onRiordina}
                      onDialogo={onDialogo}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------- blocco */

function RigaBlocco({
  blocco,
  readonly,
  sensors,
  onPatch,
  onElimina,
  onRiordina,
  onDialogo,
}: {
  blocco: LayoutBlocco
  readonly: boolean
  sensors: ReturnType<typeof useSensors>
  onPatch: Patch
  onElimina: Elimina
  onRiordina: Riordina
  onDialogo: (d: Dialogo) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: blocco.id,
  })
  const campi = blocco.campi

  function fineTrascinaCampi(evento: DragEndEvent) {
    const { active, over } = evento
    if (readonly || !over || active.id === over.id) return
    const da = campi.findIndex((c) => c.id === active.id)
    const a = campi.findIndex((c) => c.id === over.id)
    void onRiordina(
      "campo",
      arrayMove(campi, da, a).map((c) => c.id),
      blocco.id,
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border border-border/70 bg-secondary/30 p-2.5",
        !blocco.visible && "opacity-60",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!readonly ? (
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Trascina per riordinare il blocco"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}

        <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {blocco.label}
        </span>

        {!readonly ? (
          <div className="flex items-center gap-1">
            <Select
              value={String(blocco.colonne)}
              onValueChange={(v) => void onPatch("blocco", blocco.id, { colonne: Number(v ?? 2) })}
            >
              <SelectTrigger className="h-7 w-28 text-xs" aria-label="Colonne del blocco">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} colonn{n === 1 ? "a" : "e"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onDialogo({ tipo: "campo", bloccoId: blocco.id, bloccoLabel: blocco.label })
              }
            >
              <Plus data-icon="inline-start" />
              Campo
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Rinomina blocco"
              onClick={() =>
                onDialogo({
                  tipo: "rinomina",
                  livello: "blocco",
                  id: blocco.id,
                  label: blocco.label,
                })
              }
            >
              <Pencil className="size-3.5" />
            </Button>
            <BottoneVisibilita
              visible={blocco.visible}
              onCambia={(v) => void onPatch("blocco", blocco.id, { visible: v })}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Elimina blocco"
              onClick={() =>
                void onElimina(
                  "blocco",
                  blocco.id,
                  `Eliminare il blocco "${blocco.label}"? I campi al suo interno tornano disponibili da riposizionare. I dati non vengono toccati.`,
                )
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {campi.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">Nessun campo in questo blocco.</p>
      ) : (
        <DndContext
          id={`layout-campi-${blocco.blockKey}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={fineTrascinaCampi}
        >
          <SortableContext items={campi.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div
              className={cn(
                "mt-2 grid gap-1.5",
                blocco.colonne === 1 && "grid-cols-1",
                blocco.colonne === 2 && "grid-cols-1 sm:grid-cols-2",
                blocco.colonne >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {campi.map((campo) => (
                <RigaCampo
                  key={campo.id}
                  campo={campo}
                  readonly={readonly}
                  onPatch={onPatch}
                  onElimina={onElimina}
                  onDialogo={onDialogo}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- campo */

function RigaCampo({
  campo,
  readonly,
  onPatch,
  onElimina,
  onDialogo,
}: {
  campo: LayoutCampo
  readonly: boolean
  onPatch: Patch
  onElimina: Elimina
  onDialogo: (d: Dialogo) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: campo.id,
  })
  const etichetta = campo.labelOverride ?? campo.fieldKey

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5",
        !campo.visible && "opacity-50",
        isDragging && "z-10 shadow-lg",
      )}
    >
      {!readonly ? (
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Trascina per riordinare il campo"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : null}

      {campo.formula ? (
        <Sigma className="size-3.5 shrink-0 text-info" aria-label="Campo calcolato" />
      ) : null}

      <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={campo.fieldKey}>
        {etichetta}
      </span>

      {campo.origine === "custom" ? (
        <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-semibold uppercase text-muted-foreground">
          custom
        </span>
      ) : null}

      {!readonly ? (
        <div className="flex shrink-0 items-center">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Modifica campo"
            onClick={() => onDialogo({ tipo: "modifica-campo", campo })}
          >
            <Pencil className="size-3.5" />
          </Button>
          <BottoneVisibilita
            visible={campo.visible}
            onCambia={(v) => void onPatch("campo", campo.id, { visible: v })}
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Togli campo"
            onClick={() =>
              void onElimina(
                "campo",
                campo.id,
                `Togliere "${etichetta}" dal layout? Il campo e il suo contenuto restano nel database, sparisce solo dalla scheda.`,
              )
            }
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function BottoneVisibilita({
  visible,
  onCambia,
}: {
  visible: boolean
  onCambia: (visible: boolean) => void
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={visible ? "Nascondi" : "Mostra"}
      title={visible ? "Nascondi" : "Mostra"}
      onClick={() => onCambia(!visible)}
    >
      {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
    </Button>
  )
}

/* -------------------------------------------------------------- dialoghi */

function DialoghiLayout({
  dialogo,
  modulo,
  onChiudi,
  onInvia,
}: {
  dialogo: Dialogo
  modulo: LayoutModulo
  onChiudi: () => void
  onInvia: (metodo: "POST" | "PATCH", corpo: Record<string, unknown>) => Promise<void>
}) {
  const campoInModifica = dialogo?.tipo === "modifica-campo" ? dialogo.campo : null

  const [label, setLabel] = useState(
    dialogo?.tipo === "rinomina"
      ? dialogo.label
      : (campoInModifica?.labelOverride ?? ""),
  )
  const [fieldKey, setFieldKey] = useState("")
  const [tipo, setTipo] = useState<CampoTipo>("text")
  const [span, setSpan] = useState(campoInModifica?.span ?? 1)
  const [solaLettura, setSolaLettura] = useState(campoInModifica?.solaLettura ?? false)
  const [decimali, setDecimali] = useState(
    campoInModifica?.formato.decimali != null ? String(campoInModifica.formato.decimali) : "",
  )
  const [formula, setFormula] = useState(campoInModifica?.formula?.expr ?? "")
  const [inCorso, setInCorso] = useState(false)

  if (!dialogo) return null

  // Verifica immediata con lo stesso valutatore che usera' la scheda: un
  // refuso si vede mentre si scrive, non quando il campo mostra un numero
  // sbagliato. La mappa vuota basta: interessa la forma, non il risultato.
  const formulaTrim = formula.trim()
  const esitoFormula = formulaTrim ? valutaFormula(formulaTrim, new Map()) : null
  const formulaNonValida = esitoFormula !== null && !esitoFormula.ok

  const titolo =
    dialogo.tipo === "pagina"
      ? `Nuova pagina in ${MODULO_LABEL[modulo]}`
      : dialogo.tipo === "blocco"
        ? `Nuovo blocco in "${dialogo.paginaLabel}"`
        : dialogo.tipo === "campo"
          ? `Nuovo campo in "${dialogo.bloccoLabel}"`
          : dialogo.tipo === "modifica-campo"
            ? `Modifica "${dialogo.campo.labelOverride ?? dialogo.campo.fieldKey}"`
            : dialogo.livello === "pagina"
              ? "Rinomina pagina"
              : "Rinomina blocco"

  async function conferma() {
    if (!dialogo) return
    setInCorso(true)
    try {
      if (dialogo.tipo === "pagina") {
        await onInvia("POST", { tipo: "pagina", label })
      } else if (dialogo.tipo === "blocco") {
        await onInvia("POST", { tipo: "blocco", paginaId: dialogo.paginaId, label })
      } else if (dialogo.tipo === "campo") {
        await onInvia("POST", {
          tipo: "campo",
          bloccoId: dialogo.bloccoId,
          fieldKey: fieldKey.trim(),
          label: label.trim() || undefined,
        })
      } else if (dialogo.tipo === "rinomina") {
        await onInvia("PATCH", { tipo: dialogo.livello, id: dialogo.id, label })
      } else {
        await onInvia("PATCH", {
          tipo: "campo",
          id: dialogo.campo.id,
          label: label.trim() || undefined,
          span,
          solaLettura,
          formato: decimali === "" ? {} : { decimali: Number(decimali) },
          // Svuotare la formula rende il campo di nuovo scrivibile.
          formula: formulaTrim ? { expr: formulaTrim } : null,
        })
      }
    } finally {
      setInCorso(false)
    }
  }

  const puoConfermare =
    dialogo.tipo === "campo"
      ? fieldKey.trim().length > 0
      : dialogo.tipo === "modifica-campo"
        ? !formulaNonValida
        : label.trim().length > 0

  return (
    <Dialog open onOpenChange={(aperto) => (!aperto ? onChiudi() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titolo}</DialogTitle>
          <DialogDescription>
            {dialogo.tipo === "campo"
              ? "Indica la chiave del campo come e' definita nel modulo."
              : dialogo.tipo === "modifica-campo"
                ? `Chiave: ${dialogo.campo.fieldKey}. La chiave non cambia, il dato sottostante resta dove si trova.`
                : "Il nome e' modificabile in seguito."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {dialogo.tipo === "campo" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="layout-field-key">Chiave del campo</Label>
                <Input
                  id="layout-field-key"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                  placeholder="es. Importo Contrattuale"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="layout-field-label">Etichetta (facoltativa)</Label>
                <Input
                  id="layout-field-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Lascia vuoto per usare quella nativa"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="layout-field-tipo">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo((v ?? "text") as CampoTipo)}>
                  <SelectTrigger id="layout-field-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPO_TIPI.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CAMPO_TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Per un campo esistente il tipo resta quello che ha nel modulo.
                </p>
              </div>
            </>
          ) : dialogo.tipo === "modifica-campo" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="layout-edit-label">Etichetta</Label>
                <Input
                  id="layout-edit-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={dialogo.campo.fieldKey}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="layout-edit-span">Larghezza</Label>
                  <Select value={String(span)} onValueChange={(v) => setSpan(Number(v ?? 1))}>
                    <SelectTrigger id="layout-edit-span">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} colonn{n === 1 ? "a" : "e"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="layout-edit-decimali">Decimali</Label>
                  <Input
                    id="layout-edit-decimali"
                    type="number"
                    min={0}
                    max={6}
                    value={decimali}
                    onChange={(e) => setDecimali(e.target.value)}
                    placeholder="automatico"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="flex flex-col">
                  <Label htmlFor="layout-edit-readonly">Sola lettura</Label>
                  <span className="text-xs text-muted-foreground">
                    Mostra il valore senza permetterne la modifica.
                  </span>
                </div>
                <Switch
                  id="layout-edit-readonly"
                  checked={solaLettura}
                  onCheckedChange={(v) => setSolaLettura(Boolean(v))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="layout-edit-formula">Formula</Label>
                <Textarea
                  id="layout-edit-formula"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="{Importo Contrattuale}-{Sconto COMBO}"
                />
                {formulaNonValida && esitoFormula && !esitoFormula.ok ? (
                  <p className="text-xs text-destructive">{esitoFormula.errore}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Un campo con formula non si modifica a mano: il valore viene calcolato.
                    Svuota il riquadro per renderlo di nuovo scrivibile.
                  </p>
                )}
                {dialogo.campo.formula?.origine_zoho ? (
                  <p className="rounded bg-muted px-2 py-1 font-mono text-[11px] break-all text-muted-foreground">
                    Originale Zoho: {dialogo.campo.formula.origine_zoho}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="layout-label">Nome</Label>
              <Input
                id="layout-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={
                  dialogo.tipo === "pagina" ? "es. Impianto" : "es. Informazioni Tecniche FTV"
                }
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onChiudi} disabled={inCorso}>
            Annulla
          </Button>
          <Button onClick={() => void conferma()} disabled={!puoConfermare || inCorso}>
            {inCorso ? <Loader2 className="size-4 animate-spin" /> : null}
            {dialogo.tipo === "modifica-campo" || dialogo.tipo === "rinomina" ? "Salva" : "Crea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
