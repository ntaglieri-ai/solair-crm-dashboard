"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/lib/permissions/provider"
import {
  CalendarioGriglia,
  type VistaCalendario,
} from "@/components/calendario/calendario-griglia"
import { EventoDialog } from "@/components/calendario/evento-dialog"
import { CategorieDialog } from "@/components/calendario/categorie-dialog"
import {
  addDays,
  addMonths,
  formatIntervalloSettimana,
  formatMeseAnno,
  rangeVista,
} from "@/lib/calendario/date-utils"
import {
  puoGestireCategorie,
  puoModificareEvento,
  type CategoriaCalendario,
  type EventoCalendario,
} from "@/lib/calendario/types"

export function CalendarioClient({
  eventiIniziali,
  categorieIniziali,
  tidycalBookingUrl,
}: {
  eventiIniziali: EventoCalendario[]
  categorieIniziali: CategoriaCalendario[]
  tidycalBookingUrl: string | null
}) {
  const permissions = usePermissions()
  const subject = permissions.snapshot.subject

  const [vista, setVista] = useState<VistaCalendario>("mese")
  const [riferimento, setRiferimento] = useState(() => new Date())
  const [eventi, setEventi] = useState(eventiIniziali)
  const [categorie, setCategorie] = useState(categorieIniziali)
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncingTidyCal, setSyncingTidyCal] = useState(false)

  const [eventoAperto, setEventoAperto] = useState<EventoCalendario | undefined>()
  const [giornoIniziale, setGiornoIniziale] = useState<Date | undefined>()
  const [dialogAperto, setDialogAperto] = useState(false)
  const [categorieAperte, setCategorieAperte] = useState(false)

  // La prima finestra arriva gia' renderizzata dal server; ogni cambio di
  // periodo o di vista ne richiede un'altra. Senza questa guardia il
  // mount rifarebbe subito la stessa query che ha gia' prodotto
  // `eventiIniziali`.
  const montato = useRef(false)

  const carica = useCallback(async () => {
    const { da, a } = rangeVista(riferimento, vista)
    setLoading(true)
    try {
      const res = await fetch(
        `/api/calendario/eventi?da=${encodeURIComponent(da)}&a=${encodeURIComponent(a)}`,
        { cache: "no-store" },
      )
      if (!res.ok) throw new Error()
      const payload = (await res.json()) as { eventi: EventoCalendario[] }
      setEventi(payload.eventi ?? [])
    } catch {
      toast.error("Impossibile caricare gli eventi del calendario")
    } finally {
      setLoading(false)
    }
  }, [riferimento, vista])

  useEffect(() => {
    if (!montato.current) {
      montato.current = true
      return
    }
    void carica()
  }, [carica])

  const eventiVisibili = useMemo(
    () =>
      filtroCategoria
        ? eventi.filter((evento) => evento.categoria_id === filtroCategoria)
        : eventi,
    [eventi, filtroCategoria],
  )

  const vaiA = (delta: number) => {
    setRiferimento((corrente) =>
      vista === "mese" ? addMonths(corrente, delta) : addDays(corrente, delta * 7),
    )
  }

  const apriNuovo = (giorno: Date) => {
    setEventoAperto(undefined)
    setGiornoIniziale(giorno)
    setDialogAperto(true)
  }

  const apriEsistente = (evento: EventoCalendario) => {
    setEventoAperto(evento)
    setGiornoIniziale(undefined)
    setDialogAperto(true)
  }

  const onSaved = (salvato: EventoCalendario) => {
    setEventi((prev) => {
      const esiste = prev.some((evento) => evento.id === salvato.id)
      const aggiornati = esiste
        ? prev.map((evento) => (evento.id === salvato.id ? salvato : evento))
        : [...prev, salvato]
      return aggiornati.sort((a, b) => a.inizio.localeCompare(b.inizio))
    })
  }

  const onDeleted = (id: string) => {
    setEventi((prev) => prev.filter((evento) => evento.id !== id))
  }

  const titoloPeriodo =
    vista === "mese" ? formatMeseAnno(riferimento) : formatIntervalloSettimana(riferimento)

  const sincronizzaTidyCal = async () => {
    if (syncingTidyCal) return
    setSyncingTidyCal(true)
    try {
      const res = await fetch("/api/calendario/tidycal/sync", { method: "POST" })
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; imported?: number; cancelled?: number }
        | null
      if (!res.ok) throw new Error(payload?.error ?? "Sincronizzazione non riuscita")
      await carica()
      toast.success(`${payload?.imported ?? 0} prenotazioni TidyCal sincronizzate`, {
        description: payload?.cancelled ? `${payload.cancelled} cancellate e nascoste` : undefined,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sincronizzazione TidyCal fallita")
    } finally {
      setSyncingTidyCal(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Eventi condivisi con tutto lo staff. Puoi modificare quelli che hai creato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tidycalBookingUrl ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={tidycalBookingUrl} target="_blank" rel="noreferrer" />}
            >
              <IconExternalLink size={16} data-icon="inline-start" />
              Prenota con TidyCal
            </Button>
          ) : null}
          {puoGestireCategorie(subject.ruoloCode) ? (
            <>
              <Button
                variant="outline"
                disabled={syncingTidyCal}
                onClick={() => void sincronizzaTidyCal()}
              >
                <IconRefresh
                  size={16}
                  className={syncingTidyCal ? "animate-spin" : undefined}
                  data-icon="inline-start"
                />
                {syncingTidyCal ? "Sincronizzazione…" : "Sincronizza TidyCal"}
              </Button>
              <Button variant="outline" onClick={() => setCategorieAperte(true)}>
                <IconSettings size={16} data-icon="inline-start" />
                Categorie
              </Button>
            </>
          ) : null}
          <Button onClick={() => apriNuovo(new Date())}>
            <IconPlus size={16} data-icon="inline-start" />
            Nuovo evento
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={vista === "mese" ? "Mese precedente" : "Settimana precedente"}
            onClick={() => vaiA(-1)}
          >
            <IconChevronLeft size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRiferimento(new Date())}>
            Oggi
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={vista === "mese" ? "Mese successivo" : "Settimana successiva"}
            onClick={() => vaiA(1)}
          >
            <IconChevronRight size={18} />
          </Button>
          <span className="ml-2 text-base font-semibold capitalize text-foreground">
            {titoloPeriodo}
          </span>
          {loading ? (
            <span className="ml-2 text-xs text-muted-foreground">Aggiornamento…</span>
          ) : null}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(["mese", "settimana"] as const).map((valore) => (
            <button
              key={valore}
              type="button"
              onClick={() => setVista(valore)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                vista === valore
                  ? "bg-navy text-navy-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {valore}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda: fa anche da filtro, cliccando una categoria si isola. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categorie.map((categoria) => {
          const attiva = filtroCategoria === categoria.id
          return (
            <button
              key={categoria.id}
              type="button"
              onClick={() => setFiltroCategoria(attiva ? null : categoria.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                attiva
                  ? "border-navy bg-navy/5 text-navy"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: categoria.colore }}
              />
              {categoria.nome}
            </button>
          )
        })}
        {filtroCategoria ? (
          <Button variant="ghost" size="sm" onClick={() => setFiltroCategoria(null)}>
            Mostra tutte
          </Button>
        ) : null}
      </div>

      <CalendarioGriglia
        vista={vista}
        riferimento={riferimento}
        eventi={eventiVisibili}
        categorie={categorie}
        onSelezionaEvento={apriEsistente}
        onSelezionaGiorno={apriNuovo}
      />

      <EventoDialog
        open={dialogAperto}
        onOpenChange={setDialogAperto}
        categorie={categorie}
        evento={eventoAperto}
        giornoIniziale={giornoIniziale}
        modificabile={
          !eventoAperto ||
          permissions.canAction("calendario.events.manage_all") || puoModificareEvento(eventoAperto, {
            userId: subject.userId,
            ruoloCode: subject.ruoloCode,
          })
        }
        onSaved={onSaved}
        onDeleted={onDeleted}
      />

      <CategorieDialog
        open={categorieAperte}
        onOpenChange={setCategorieAperte}
        categorie={categorie}
        onSaved={setCategorie}
      />
    </div>
  )
}
