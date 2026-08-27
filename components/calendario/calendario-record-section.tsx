"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { IconCalendarPlus, IconExternalLink } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { usePermissions } from "@/lib/permissions/provider"
import { EventoDialog } from "./evento-dialog"
import { formatDataOra, formatOra } from "@/lib/calendario/date-utils"
import {
  coloreEvento,
  nomeCategoria,
  puoModificareEvento,
  type CategoriaCalendario,
  type EventoCalendario,
  type EventoCorrelatoTipo,
} from "@/lib/calendario/types"

/**
 * Il calendario richiamato da una scheda Lead/Cliente/Installatore,
 * filtrato sul record. Non e' una vista a griglia: su una scheda serve
 * l'elenco cronologico degli appuntamenti di QUEL record, non il mese.
 */
export function CalendarioRecordSection({
  recordTipo,
  recordId,
  nomeRecord,
}: {
  recordTipo: EventoCorrelatoTipo
  recordId: string
  nomeRecord: string
}) {
  const permissions = usePermissions()
  const subject = permissions.snapshot.subject
  const abilitato = permissions.canPage("calendario")

  const [eventi, setEventi] = useState<EventoCalendario[]>([])
  const [categorie, setCategorie] = useState<CategoriaCalendario[]>([])
  const [loading, setLoading] = useState(true)
  const [eventoAperto, setEventoAperto] = useState<EventoCalendario | undefined>()
  const [dialogAperto, setDialogAperto] = useState(false)

  const carica = useCallback(async () => {
    try {
      const [eventiRes, categorieRes] = await Promise.all([
        fetch(
          `/api/calendario/eventi?correlatoTipo=${recordTipo}&correlatoId=${recordId}`,
          { cache: "no-store" },
        ),
        fetch("/api/calendario/categorie", { cache: "no-store" }),
      ])
      if (!eventiRes.ok || !categorieRes.ok) throw new Error()
      const eventiPayload = (await eventiRes.json()) as { eventi: EventoCalendario[] }
      const categoriePayload = (await categorieRes.json()) as {
        categorie: CategoriaCalendario[]
      }
      setEventi(eventiPayload.eventi ?? [])
      setCategorie(categoriePayload.categorie ?? [])
    } catch {
      toast.error("Impossibile caricare gli eventi collegati")
    } finally {
      setLoading(false)
    }
  }, [recordTipo, recordId])

  useEffect(() => {
    if (!abilitato) return
    void carica()
  }, [abilitato, carica])

  if (!abilitato) return null

  const onSaved = (salvato: EventoCalendario) => {
    setEventi((prev) => {
      const esiste = prev.some((evento) => evento.id === salvato.id)
      const aggiornati = esiste
        ? prev.map((evento) => (evento.id === salvato.id ? salvato : evento))
        : [...prev, salvato]
      return aggiornati.sort((a, b) => a.inizio.localeCompare(b.inizio))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">
          {loading
            ? "Caricamento…"
            : eventi.length === 0
              ? "Nessun evento collegato a questo record."
              : `${eventi.length} event${eventi.length === 1 ? "o" : "i"} collegat${
                  eventi.length === 1 ? "o" : "i"
                }.`}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" render={<Link href="/calendario" />}>
            <IconExternalLink size={14} data-icon="inline-start" />
            Apri calendario
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEventoAperto(undefined)
              setDialogAperto(true)
            }}
          >
            <IconCalendarPlus size={14} data-icon="inline-start" />
            Nuovo evento
          </Button>
        </div>
      </div>

      {eventi.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {eventi.map((evento) => (
            <li key={evento.id}>
              <button
                type="button"
                onClick={() => {
                  setEventoAperto(evento)
                  setDialogAperto(true)
                }}
                style={{ borderLeftColor: coloreEvento(evento, categorie) }}
                className="flex w-full items-center gap-3 rounded-lg border border-border border-l-[3px] bg-card px-3 py-2 text-left transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {evento.titolo}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {nomeCategoria(evento, categorie)}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {formatDataOra(evento.inizio)}
                  {evento.fine ? ` – ${formatOra(evento.fine)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <EventoDialog
        open={dialogAperto}
        onOpenChange={setDialogAperto}
        categorie={categorie}
        evento={eventoAperto}
        correlatoFisso={{ tipo: recordTipo, id: recordId, nome: nomeRecord }}
        modificabile={
          !eventoAperto ||
          puoModificareEvento(eventoAperto, {
            userId: subject.userId,
            ruoloCode: subject.ruoloCode,
          })
        }
        onSaved={onSaved}
        onDeleted={(id) => setEventi((prev) => prev.filter((e) => e.id !== id))}
      />
    </div>
  )
}
