"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  GIORNI_SETTIMANA,
  formatOra,
  isToday,
  monthGrid,
  sameDay,
  startOfMonth,
  weekGrid,
} from "@/lib/calendario/date-utils"
import {
  coloreEvento,
  nomeCategoria,
  type CategoriaCalendario,
  type EventoCalendario,
} from "@/lib/calendario/types"

export type VistaCalendario = "mese" | "settimana"

/**
 * Pastiglia di un evento. Il colore pieno sta nel pallino e nel bordo
 * sinistro, non nello sfondo: con categorie libere l'utente puo'
 * scegliere un colore chiarissimo, e il testo bianco su fondo pieno
 * diventerebbe illeggibile. Cosi' il contrasto del testo non dipende
 * mai dal colore scelto.
 */
function EventoPill({
  evento,
  categorie,
  onClick,
  mostraOra = true,
}: {
  evento: EventoCalendario
  categorie: CategoriaCalendario[]
  onClick: (evento: EventoCalendario) => void
  mostraOra?: boolean
}) {
  const colore = coloreEvento(evento, categorie)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick(evento)
      }}
      title={`${evento.titolo} — ${nomeCategoria(evento, categorie)}${
        evento.correlato_nome ? ` · ${evento.correlato_nome}` : ""
      }`}
      style={{ borderLeftColor: colore }}
      className="flex w-full items-center gap-1.5 overflow-hidden rounded-[4px] border-l-[3px] bg-muted/60 px-1.5 py-[3px] text-left text-[11px] leading-tight transition-colors hover:bg-muted"
    >
      {mostraOra ? (
        <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
          {formatOra(evento.inizio)}
        </span>
      ) : null}
      <span className="truncate font-medium text-foreground">{evento.titolo}</span>
    </button>
  )
}

function eventiDelGiorno(eventi: EventoCalendario[], giorno: Date) {
  return eventi.filter((evento) => sameDay(new Date(evento.inizio), giorno))
}

const MAX_PILL_MESE = 3

function CellaGiorno({
  giorno,
  eventi,
  categorie,
  vista,
  fuoriMese,
  onSelezionaEvento,
  onSelezionaGiorno,
}: {
  giorno: Date
  eventi: EventoCalendario[]
  categorie: CategoriaCalendario[]
  vista: VistaCalendario
  fuoriMese: boolean
  onSelezionaEvento: (evento: EventoCalendario) => void
  onSelezionaGiorno: (giorno: Date) => void
}) {
  // Nella vista mensile la cella mostra tre pastiglie e poi "+N altri":
  // espanderla in loco e' l'unico modo di leggere le altre senza una
  // vista giornaliera, che non e' richiesta.
  const [espansa, setEspansa] = useState(false)
  const oggi = isToday(giorno)
  const limite = vista === "mese" && !espansa ? MAX_PILL_MESE : eventi.length
  const nascosti = eventi.length - limite

  return (
    <div
      role="gridcell"
      tabIndex={0}
      onClick={() => onSelezionaGiorno(giorno)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelezionaGiorno(giorno)
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-1 border-b border-r border-border p-1.5 outline-none transition-colors last:border-r-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 [&:nth-child(7n)]:border-r-0",
        vista === "mese" ? "min-h-[6.5rem]" : "min-h-[26rem]",
        fuoriMese && "bg-muted/25",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums",
            oggi
              ? "bg-navy text-navy-foreground"
              : fuoriMese
                ? "text-muted-foreground/60"
                : "text-foreground",
          )}
        >
          {giorno.getDate()}
        </span>
        {eventi.length > 0 ? (
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
            {eventi.length}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        {eventi.slice(0, limite).map((evento) => (
          <EventoPill
            key={evento.id}
            evento={evento}
            categorie={categorie}
            onClick={onSelezionaEvento}
          />
        ))}
        {nascosti > 0 || espansa ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEspansa((v) => !v)
            }}
            className="px-1 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {espansa ? "Mostra meno" : `+${nascosti} altri`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function CalendarioGriglia({
  vista,
  riferimento,
  eventi,
  categorie,
  onSelezionaEvento,
  onSelezionaGiorno,
}: {
  vista: VistaCalendario
  riferimento: Date
  eventi: EventoCalendario[]
  categorie: CategoriaCalendario[]
  onSelezionaEvento: (evento: EventoCalendario) => void
  onSelezionaGiorno: (giorno: Date) => void
}) {
  const celle = vista === "mese" ? monthGrid(riferimento) : weekGrid(riferimento)
  const meseCorrente = startOfMonth(riferimento).getMonth()

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/60">
        {GIORNI_SETTIMANA.map((giorno) => (
          <div
            key={giorno}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {giorno}
          </div>
        ))}
      </div>

      <div
        className={cn(
          "grid grid-cols-7",
          // La settimana ha una riga sola e puo' permettersi celle alte;
          // il mese ne ha sei e deve stare in pagina.
          vista === "settimana" ? "min-h-[26rem]" : "",
        )}
      >
        {celle.map((giorno) => (
          <CellaGiorno
            key={giorno.toISOString()}
            giorno={giorno}
            eventi={eventiDelGiorno(eventi, giorno)}
            categorie={categorie}
            vista={vista}
            fuoriMese={vista === "mese" && giorno.getMonth() !== meseCorrente}
            onSelezionaEvento={onSelezionaEvento}
            onSelezionaGiorno={onSelezionaGiorno}
          />
        ))}
      </div>
    </div>
  )
}
