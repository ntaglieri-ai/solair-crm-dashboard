"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  HardHat,
  ListTodo,
  Loader2,
  Mail,
  Search,
  Shuffle,
  StickyNote,
  Trash2,
  UserMinus,
  Users,
  Workflow,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * I due passaggi dell'eliminazione di un account, uno per dialog.
 *
 * Passaggio 1 (EliminaUtenteDialog): la riassegnazione non e' opzionale. Il
 * pulsante di conferma resta disabilitato finche' non c'e' un destinatario, e
 * l'API rifiuta comunque una richiesta senza destinatario — la regola non vive
 * solo nel bottone.
 *
 * Passaggio 2 (CancellaDefinitivamenteDialog): visibile solo per un account
 * gia' passato dal primo. Elenca cosa si perde davvero, perche' e' irreversibile.
 *
 * Il destinatario si sceglie da una lista dentro il dialog, non da una select a
 * tendina: con trenta utenti serve la ricerca, e un popup sopra un altro popup
 * finiva per uscire dai bordi del dialog troncando le email.
 */

export type ConteggiUtente = {
  proprieta: {
    leads: number
    clienti: number
    compiti: number
    scadenze: number
    installatori: number
    regole_assegnazione: number
  }
  storico: {
    note: number
    audit: number
    documenti: number
    email_inviate: number
    eventi_calendario: number
    caselle_personali: number
    caselle_condivise: number
    token_mcp: number
  }
}

type UtenteMinimo = { id: string; nome: string; email: string; ruolo?: string }

/** Palette "gommosa" della pagina Account: ogni modulo ha il suo colore. */
const TIPI_PROPRIETA: {
  chiave: keyof ConteggiUtente["proprieta"]
  label: string
  icona: React.ReactNode
  chip: string
  card: string
}[] = [
  {
    chiave: "leads",
    label: "Lead",
    icona: <Users className="size-4" />,
    chip: "from-[#0176d3] to-[#0b5cab] shadow-[0_6px_14px_rgb(1_118_211/35%)]",
    card: "from-[#eaf4ff] to-white ring-[#b7d9f8]/60",
  },
  {
    chiave: "clienti",
    label: "Clienti",
    icona: <HardHat className="size-4" />,
    chip: "from-[#2e8b72] to-[#1c6b57] shadow-[0_6px_14px_rgb(46_139_114/35%)]",
    card: "from-[#e9f8f2] to-white ring-[#9ed9c5]/60",
  },
  {
    chiave: "compiti",
    label: "Compiti",
    icona: <ListTodo className="size-4" />,
    chip: "from-[#f5b041] to-[#dd7a01] shadow-[0_6px_14px_rgb(221_122_1/32%)]",
    card: "from-[#fff5e4] to-white ring-[#f6d69b]/70",
  },
  {
    chiave: "scadenze",
    label: "Scadenze",
    icona: <CalendarClock className="size-4" />,
    chip: "from-[#8b5cf6] to-[#6f42c1] shadow-[0_6px_14px_rgb(111_66_193/32%)]",
    card: "from-[#f3edff] to-white ring-[#d3c2f5]/70",
  },
  {
    chiave: "installatori",
    label: "Installatori",
    icona: <Workflow className="size-4" />,
    chip: "from-[#22b8cf] to-[#0b7d8f] shadow-[0_6px_14px_rgb(11_125_143/32%)]",
    card: "from-[#e6f9fc] to-white ring-[#a5e4ee]/70",
  },
  {
    chiave: "regole_assegnazione",
    label: "Regole",
    icona: <Shuffle className="size-4" />,
    chip: "from-[#f472b6] to-[#be185d] shadow-[0_6px_14px_rgb(190_24_93/28%)]",
    card: "from-[#ffeaf3] to-white ring-[#f8c2d9]/70",
  },
]

const AVATAR_RUOLO: Record<string, string> = {
  SUPERADMIN: "from-violet-600 to-indigo-700",
  ADMIN: "from-[#0176d3] to-[#0b5cab]",
  DIRECTOR: "from-amber-500 to-orange-600",
  STANDARD: "from-sky-500 to-cyan-600",
  AGENT: "from-emerald-500 to-teal-700",
}

function gradienteAvatar(ruolo?: string) {
  return AVATAR_RUOLO[(ruolo ?? "").toUpperCase()] ?? "from-slate-500 to-slate-700"
}

function iniziali(nome: string) {
  return nome
    .split(" ")
    .map((parte) => parte[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function totale(conteggi: ConteggiUtente["proprieta"]) {
  return Object.values(conteggi).reduce((somma, valore) => somma + valore, 0)
}

/**
 * Carica i conteggi del singolo utente. Lo stato iniziale e' gia' quello giusto
 * (caricamento acceso se c'e' un utente) e i due dialog vengono rimontati a ogni
 * cambio di bersaglio grazie alla `key`: cosi' nessuno setState parte in modo
 * sincrono dentro l'effetto, e non c'e' niente da ripulire a mano.
 */
function useConteggi(utenteId: string | null) {
  const [conteggi, setConteggi] = useState<ConteggiUtente | null>(null)
  const [caricamento, setCaricamento] = useState(Boolean(utenteId))
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    if (!utenteId) return
    let annullato = false
    fetch(`/api/crm-settings/utenti/${utenteId}/eliminazione`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { conteggi?: ConteggiUtente; error?: string }
          | null
        if (annullato) return
        if (!res.ok || !body?.conteggi) {
          throw new Error(body?.error ?? "Impossibile leggere i record dell'utente")
        }
        setConteggi(body.conteggi)
      })
      .catch((e: unknown) => {
        if (annullato) return
        setErrore(e instanceof Error ? e.message : "Impossibile leggere i record dell'utente")
      })
      .finally(() => {
        if (!annullato) setCaricamento(false)
      })
    return () => {
      annullato = true
    }
  }, [utenteId])

  return { conteggi, caricamento, errore }
}

/** Guscio comune: barra a gradiente, header con badge, corpo scrollabile, footer. */
function GuscioDialog({
  aperto,
  onChiudi,
  rail,
  badge,
  icona,
  titolo,
  descrizione,
  children,
  footer,
}: {
  aperto: boolean
  onChiudi: () => void
  rail: string
  badge: string
  icona: React.ReactNode
  titolo: string
  descrizione: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <Dialog open={aperto} onOpenChange={(open) => !open && onChiudi()}>
      <DialogContent className="grid max-h-[min(calc(100dvh-2rem),44rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 shadow-[0_32px_80px_rgb(15_35_65/22%)] ring-slate-900/[0.06] sm:max-w-xl">
        <div className={cn("h-1.5 w-full", rail)} aria-hidden />

        <DialogHeader className="gap-3 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#eef6ff_100%)] px-5 pt-5 pb-4">
          <div className="flex items-start gap-3 pr-8">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                badge,
              )}
              aria-hidden
            >
              {icona}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold text-slate-950">{titolo}</DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed text-slate-600">
                {descrizione}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto border-y border-slate-200/70 bg-slate-50/40 px-5 py-4">
          {children}
        </div>

        <div className="flex flex-col-reverse gap-2 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TitoloSezione({ testo, dopo }: { testo: string; dopo?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{testo}</p>
      {dopo}
    </div>
  )
}

export function EliminaUtenteDialog({
  utente,
  candidati,
  saving,
  onAnnulla,
  onConferma,
}: {
  utente: UtenteMinimo | null
  /** Utenti attivi che possono ricevere i record, gia' privi di quello da eliminare. */
  candidati: UtenteMinimo[]
  saving: boolean
  onAnnulla: () => void
  onConferma: (destinatarioId: string) => void
}) {
  const [destinatarioId, setDestinatarioId] = useState("")
  const [ricerca, setRicerca] = useState("")
  const { conteggi, caricamento, errore } = useConteggi(utente?.id ?? null)

  const filtrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase()
    if (!termine) return candidati
    return candidati.filter(
      (c) =>
        c.nome.toLowerCase().includes(termine) || c.email.toLowerCase().includes(termine),
    )
  }, [candidati, ricerca])

  const daSpostare = conteggi ? totale(conteggi.proprieta) : null
  const tipiConRecord = conteggi
    ? TIPI_PROPRIETA.filter((tipo) => conteggi.proprieta[tipo.chiave] > 0)
    : []

  return (
    <GuscioDialog
      aperto={utente !== null}
      onChiudi={onAnnulla}
      rail="bg-[linear-gradient(90deg,#0176d3_0%,#2e8b72_38%,#f5b041_72%,#6f42c1_100%)]"
      badge="from-[#f06b62] to-[#c23934] shadow-[0_10px_22px_rgb(194_57_52/30%)]"
      icona={<UserMinus className="size-5" />}
      titolo="Elimina utente"
      descrizione={
        <>
          Tutto ciò che è assegnato a{" "}
          <span className="font-medium text-slate-800">{utente?.nome ?? "questo utente"}</span>{" "}
          passa a un altro utente del CRM, poi l&apos;account viene disattivato e
          l&apos;accesso revocato. La riassegnazione è obbligatoria.
        </>
      }
      footer={
        <>
          <Button variant="outline" onClick={onAnnulla} disabled={saving} className="rounded-lg">
            Annulla
          </Button>
          <Button
            disabled={!destinatarioId || saving}
            onClick={() => onConferma(destinatarioId)}
            className={cn(
              "rounded-lg border-0 bg-[linear-gradient(135deg,#f06b62_0%,#c23934_100%)] text-white transition",
              "shadow-[0_14px_30px_rgb(194_57_52/28%)] hover:brightness-[1.06]",
              "disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none",
            )}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Riassegnazione…
              </>
            ) : (
              "Riassegna ed elimina"
            )}
          </Button>
        </>
      }
    >
      <section>
        <TitoloSezione
          testo="Record da trasferire"
          dopo={
            daSpostare !== null ? (
              <span className="rounded-full bg-[linear-gradient(135deg,#0176d3_0%,#0b5cab_100%)] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white shadow-[0_6px_14px_rgb(1_118_211/28%)]">
                {daSpostare} in totale
              </span>
            ) : null
          }
        />

        {caricamento ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Conteggio in corso…
          </div>
        ) : errore ? (
          <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-3 text-sm text-destructive">
            {errore}
          </p>
        ) : daSpostare === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
            Nessun record assegnato: l&apos;account viene solo disattivato.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tipiConRecord.map((tipo) => (
              <div
                key={tipo.chiave}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl bg-gradient-to-br p-2.5 ring-1",
                  "shadow-[0_8px_20px_rgb(30_58_95/7%)]",
                  tipo.card,
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                    tipo.chip,
                  )}
                  aria-hidden
                >
                  {tipo.icona}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {tipo.label}
                  </p>
                  <p className="text-lg leading-tight font-semibold tabular-nums text-slate-900">
                    {conteggi?.proprieta[tipo.chiave]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5">
        <TitoloSezione
          testo="Destinatario dei record"
          dopo={
            <span className="text-xs text-slate-400">
              {filtrati.length} utent{filtrati.length === 1 ? "e" : "i"}
            </span>
          }
        />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_26px_rgb(30_58_95/7%)]">
          <div className="relative border-b border-slate-100">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca per nome o email…"
              className="h-10 w-full bg-transparent pr-3 pl-9 text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5" role="radiogroup" aria-label="Destinatario dei record">
            {filtrati.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-sm text-slate-400">
                Nessun utente corrisponde alla ricerca.
              </p>
            ) : (
              filtrati.map((candidato) => {
                const scelto = candidato.id === destinatarioId
                return (
                  <button
                    key={candidato.id}
                    type="button"
                    role="radio"
                    aria-checked={scelto}
                    onClick={() => setDestinatarioId(candidato.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition",
                      scelto
                        ? "bg-[linear-gradient(135deg,#eef6ff_0%,#e6f5ff_100%)] ring-1 ring-[#0176d3]/35"
                        : "hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white shadow-sm",
                        gradienteAvatar(candidato.ruolo),
                      )}
                      aria-hidden
                    >
                      {iniziali(candidato.nome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {candidato.nome}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{candidato.email}</span>
                    </span>
                    {candidato.ruolo ? (
                      <span className="hidden shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 sm:inline">
                        {candidato.ruolo}
                      </span>
                    ) : null}
                    <CheckCircle2
                      className={cn(
                        "size-5 shrink-0 transition",
                        scelto ? "text-[#0176d3]" : "text-transparent",
                      )}
                    />
                  </button>
                )
              })
            )}
          </div>
        </div>

        <p className="mt-2 flex items-start gap-2 rounded-lg bg-slate-100/70 px-3 py-2 text-xs leading-relaxed text-slate-500">
          <StickyNote className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Note, audit, documenti caricati ed email inviate restano attribuiti a{" "}
            {utente?.nome ?? "l'utente eliminato"}: sono storico, non proprietà.
          </span>
        </p>
      </section>
    </GuscioDialog>
  )
}

export function CancellaDefinitivamenteDialog({
  utente,
  saving,
  onAnnulla,
  onConferma,
}: {
  utente: UtenteMinimo | null
  saving: boolean
  onAnnulla: () => void
  onConferma: () => void
}) {
  const { conteggi, caricamento, errore } = useConteggi(utente?.id ?? null)
  const proprietaResidue = conteggi ? totale(conteggi.proprieta) : 0

  const conseguenze = conteggi
    ? [
        {
          icona: <StickyNote className="size-4" />,
          label: "Note e timeline che perdono l'autore (diventano «Sistema»)",
          valore: conteggi.storico.note,
        },
        {
          icona: <Mail className="size-4" />,
          label: "Caselle email personali eliminate",
          valore: conteggi.storico.caselle_personali,
        },
        {
          icona: <CalendarClock className="size-4" />,
          label: "Eventi calendario creati da lui, che vengono cancellati",
          valore: conteggi.storico.eventi_calendario,
        },
        {
          icona: <Workflow className="size-4" />,
          label: "Token MCP revocati",
          valore: conteggi.storico.token_mcp,
        },
      ]
    : []

  return (
    <GuscioDialog
      aperto={utente !== null}
      onChiudi={onAnnulla}
      rail="bg-[linear-gradient(90deg,#f5b041_0%,#e0457b_52%,#c23934_100%)]"
      badge="from-[#c23934] to-[#8f1f1c] shadow-[0_10px_22px_rgb(143_31_28/32%)]"
      icona={<Trash2 className="size-5" />}
      titolo="Cancella definitivamente l'account"
      descrizione={
        <>
          La riga di{" "}
          <span className="font-medium text-slate-800">{utente?.nome ?? "questo utente"}</span>{" "}
          viene rimossa dal database, insieme all&apos;account Auth e all&apos;account
          Nextcloud. Non è reversibile.
        </>
      }
      footer={
        <>
          <Button variant="outline" onClick={onAnnulla} disabled={saving} className="rounded-lg">
            Annulla
          </Button>
          <Button
            disabled={saving || caricamento || proprietaResidue > 0}
            onClick={onConferma}
            className={cn(
              "rounded-lg border-0 bg-[linear-gradient(135deg,#c23934_0%,#8f1f1c_100%)] text-white transition",
              "shadow-[0_14px_30px_rgb(143_31_28/30%)] hover:brightness-[1.08]",
              "disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none",
            )}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Cancellazione…
              </>
            ) : (
              "Cancella definitivamente"
            )}
          </Button>
        </>
      }
    >
      {caricamento ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Verifica in corso…
        </div>
      ) : errore ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-3 text-sm text-destructive">
          {errore}
        </p>
      ) : conteggi ? (
        <>
          {proprietaResidue > 0 ? (
            <p className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-[linear-gradient(135deg,#fff1f0_0%,#ffe7e5_100%)] px-3 py-2.5 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              L&apos;utente possiede ancora {proprietaResidue} record: ripeti prima la
              riassegnazione.
            </p>
          ) : null}

          <TitoloSezione testo="Cosa succede allo storico" />
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_26px_rgb(30_58_95/7%)]">
            {conseguenze.map((voce) => (
              <li
                key={voce.label}
                className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    voce.valore > 0
                      ? "bg-[linear-gradient(135deg,#fdeceb_0%,#fbdad8_100%)] text-[#c23934]"
                      : "bg-slate-100 text-slate-400",
                  )}
                  aria-hidden
                >
                  {voce.icona}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-snug text-slate-600">
                  {voce.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums",
                    voce.valore > 0 ? "bg-[#fdeceb] text-[#c23934]" : "bg-slate-100 text-slate-400",
                  )}
                >
                  {voce.valore}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-2 flex items-start gap-2 rounded-lg bg-slate-100/70 px-3 py-2 text-xs leading-relaxed text-slate-500">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#2e8b72]" />
            <span>
              Le {conteggi.storico.audit} righe di audit restano leggibili: conservano il nome
              dell&apos;utente anche senza l&apos;account.
            </span>
          </p>
        </>
      ) : null}
    </GuscioDialog>
  )
}
