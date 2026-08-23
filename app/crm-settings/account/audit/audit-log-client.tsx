"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  LogIn,
  FileEdit,
  ShieldAlert,
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Download,
  Trash2,
  ClipboardList,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import {
  AUDIT_EVENT_LABEL,
  AUDIT_EVENT_TONE,
  AUDIT_EVENT_TYPES,
  AUDIT_PERIODI,
  type AuditEventRow,
  type AuditEventType,
  type AuditPeriodo,
  type AuditStats,
  type AuditTone,
  type AuditUtenteOption,
} from "@/lib/audit/constants"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// --- Palette per categoria --------------------------------------------------
// Un solo posto definisce il colore di ciascuna categoria, riusato dal bordo
// della stat card e dal badge in tabella: lo stesso concetto non puo' avere due
// colori diversi nei due punti in cui compare.

interface ToneStyle {
  /** Bordo sinistro della stat card. */
  bordo: string
  /** Sfondo pastello + colore dell'icona. */
  icona: string
  /** Badge in tabella. */
  badge: string
}

const TONE_STYLE: Record<AuditTone, ToneStyle> = {
  accesso: {
    bordo: "border-l-blue-500",
    icona: "bg-blue-50 text-blue-600",
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  modifica: {
    bordo: "border-l-emerald-500",
    icona: "bg-emerald-50 text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  admin: {
    bordo: "border-l-orange-500",
    icona: "bg-orange-50 text-orange-600",
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  fallito: {
    bordo: "border-l-red-500",
    icona: "bg-red-50 text-red-600",
    badge: "bg-red-50 text-red-700 ring-red-200",
  },
  neutro: {
    bordo: "border-l-slate-400",
    icona: "bg-slate-100 text-slate-600",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
  },
}

const EVENT_ICON: Record<AuditEventType, LucideIcon> = {
  accesso: LogIn,
  modifica_record: FileEdit,
  login_fallito: ShieldAlert,
  operazione_admin: ShieldCheck,
  export_dati: Download,
  eliminazione: Trash2,
}

// --- Formattazione ----------------------------------------------------------

const TIMESTAMP_FMT = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : TIMESTAMP_FMT.format(date)
}

// --- Pezzi di UI ------------------------------------------------------------

function AuditStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  hint: string
  icon: LucideIcon
  tone: AuditTone
}) {
  const style = TONE_STYLE[tone]
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border border-l-4 border-border bg-card px-5 py-4 shadow-sm",
        style.bordo,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <span className="text-3xl font-bold tabular-nums text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          style.icona,
        )}
      >
        <Icon className="size-5" />
      </div>
    </div>
  )
}

function EventBadge({ tipo }: { tipo: AuditEventType }) {
  const Icon = EVENT_ICON[tipo]
  const style = TONE_STYLE[AUDIT_EVENT_TONE[tipo]]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        style.badge,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {AUDIT_EVENT_LABEL[tipo]}
    </span>
  )
}

/** Indirizzo IP: chip monospace su grigio, o trattino se non registrato. */
function IpChip({ ip }: { ip: string | null }) {
  if (!ip) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
      {ip}
    </span>
  )
}

function EsitoBadge({ esito }: { esito: "success" | "failed" }) {
  return esito === "success" ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
      <CheckCircle className="size-3.5" />
      Successo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
      <XCircle className="size-3.5" />
      Fallito
    </span>
  )
}

/** Righe fantasma durante il caricamento: stessa griglia della tabella. */
function TableSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index}>
          {[
            "h-4 w-32",
            "h-4 w-28",
            "h-6 w-32 rounded-full",
            "h-4 w-full max-w-sm",
            "h-5 w-24 rounded-md",
            "h-4 w-20",
          ].map((shape, cell) => (
            <TableCell key={cell}>
              <div className={cn("animate-pulse rounded bg-muted", shape)} aria-hidden />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function EmptyState({ filtrata }: { filtrata: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ClipboardList className="size-6" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {filtrata ? "Nessun evento con questi filtri" : "Nessun evento registrato"}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        {filtrata
          ? "Prova ad allargare il periodo o a rimuovere qualche filtro."
          : "Il registro si popola da solo: accessi, modifiche ai record e operazioni amministrative vengono scritti qui nel momento in cui avvengono."}
      </p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="size-6" />
      </div>
      <p className="text-sm font-medium text-foreground">
        Impossibile leggere il registro
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Gli eventi non sono stati caricati, quindi questa tabella non e&apos; vuota:
        e&apos; incompleta. Dettaglio tecnico: {message}
      </p>
    </div>
  )
}

// --- Pagina -----------------------------------------------------------------

interface Props {
  initialStats: AuditStats
  initialEvents: AuditEventRow[]
  initialTotal: number
  initialTotalPages: number
  utenti: AuditUtenteOption[]
  pageSize: number
  initialError: string | null
}

const PERIODO_INIZIALE: AuditPeriodo = "7g"

export function AuditLogClient({
  initialStats,
  initialEvents,
  initialTotal,
  initialTotalPages,
  utenti,
  pageSize,
  initialError,
}: Props) {
  const [periodo, setPeriodo] = useState<AuditPeriodo>(PERIODO_INIZIALE)
  const [tipo, setTipo] = useState<AuditEventType | "all">("all")
  const [utente, setUtente] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState(initialEvents)
  const [total, setTotal] = useState(initialTotal)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

  // La prima pagina arriva gia' renderizzata dal server: senza questa guardia
  // l'effetto la rifarebbe subito identica a ogni montaggio.
  const primaEsecuzione = useRef(true)
  // Solo l'ultima risposta conta: cambiando filtro in fretta le richieste
  // possono tornare fuori ordine e rimettere in tabella un risultato superato.
  const richiestaCorrente = useRef(0)

  const filtrata =
    periodo !== PERIODO_INIZIALE || tipo !== "all" || utente !== "all" || search.trim() !== ""

  const fetchEvents = useCallback(async () => {
    const richiesta = ++richiestaCorrente.current
    setLoading(true)

    const params = new URLSearchParams({
      periodo,
      tipo,
      utente,
      search,
      page: String(page),
    })

    try {
      const res = await fetch(`/api/crm-settings/audit?${params}`, { cache: "no-store" })
      const body = await res.json().catch(() => null)
      if (richiesta !== richiestaCorrente.current) return

      if (!res.ok) {
        setError(body?.error ?? `Errore ${res.status}`)
        setRows([])
        setTotal(0)
        setTotalPages(1)
        return
      }

      setError(null)
      setRows(body.rows)
      setTotal(body.total)
      setTotalPages(body.totalPages)
    } catch (err) {
      if (richiesta !== richiestaCorrente.current) return
      setError(err instanceof Error ? err.message : "Richiesta non riuscita")
      setRows([])
    } finally {
      if (richiesta === richiestaCorrente.current) setLoading(false)
    }
  }, [periodo, tipo, utente, search, page])

  useEffect(() => {
    if (primaEsecuzione.current) {
      primaEsecuzione.current = false
      return
    }
    // Debounce: la ricerca e' legata all'input, senza attesa partirebbe una
    // query per ogni tasto premuto.
    const timer = setTimeout(fetchEvents, 250)
    return () => clearTimeout(timer)
  }, [fetchEvents])

  /** Ogni cambio di filtro riparte da pagina 1: la vecchia potrebbe non esistere. */
  function applica<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  const statCards = useMemo(
    () =>
      [
        {
          label: "Accessi oggi",
          value: initialStats.accessiOggi,
          icon: LogIn,
          tone: "accesso" as AuditTone,
        },
        {
          label: "Modifiche record",
          value: initialStats.modificheRecord,
          icon: FileEdit,
          tone: "modifica" as AuditTone,
        },
        {
          label: "Login falliti",
          value: initialStats.loginFalliti,
          icon: ShieldAlert,
          tone: "fallito" as AuditTone,
        },
        {
          label: "Operazioni admin",
          value: initialStats.operazioniAdmin,
          icon: ShieldCheck,
          tone: "admin" as AuditTone,
        },
      ] as const,
    [initialStats],
  )

  const primoDellaPagina = total === 0 ? 0 : (page - 1) * pageSize + 1
  const ultimoDellaPagina = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Audit & Log"
        description="Monitora tutte le attività del CRM. Tieni traccia di accessi, modifiche ai record e operazioni sensibili."
      />

      {/* Stat: sempre riferite alla giornata di oggi, indipendenti dai filtri */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <AuditStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            hint="Oggi"
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      {/* Filtri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={periodo} onValueChange={(v) => applica(setPeriodo)((v as AuditPeriodo) ?? PERIODO_INIZIALE)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {(v) => AUDIT_PERIODI.find((p) => p.id === v)?.label ?? "Periodo"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AUDIT_PERIODI.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipo} onValueChange={(v) => applica(setTipo)((v as AuditEventType) ?? "all")}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue>
              {(v) =>
                v === "all" ? "Tutti i tipi" : AUDIT_EVENT_LABEL[v as AuditEventType]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {AUDIT_EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {AUDIT_EVENT_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={utente} onValueChange={(v) => applica(setUtente)(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue>
              {(v) =>
                v === "all"
                  ? "Tutti gli utenti"
                  : (utenti.find((u) => u.id === v)?.nome ?? "Utente")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli utenti</SelectItem>
            {utenti.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 sm:min-w-56">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => applica(setSearch)(e.target.value)}
            placeholder="Cerca per descrizione"
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabella eventi */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {error ? (
          <ErrorState message={error} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                <TableHead>Utente</TableHead>
                <TableHead>Tipo evento</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Esito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={Math.min(pageSize, Math.max(rows.length, 5))} />
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState filtrata={filtrata} />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <AuditRow key={row.id} row={row} />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Paginazione reale: gli estremi vengono dal conteggio del database */}
      {!error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {total === 0
              ? "Nessun evento"
              : `${primoDellaPagina}–${ultimoDellaPagina} di ${total} eventi`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Pagina precedente"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-1 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Pagina successiva"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Riga cliccabile con drawer di dettaglio. */
function AuditRow({ row }: { row: AuditEventRow }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow
        className="cursor-pointer transition-colors hover:bg-muted/50"
        onClick={() => setOpen(true)}
      >
        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {formatTimestamp(row.created_at)}
        </TableCell>
        <TableCell className="whitespace-nowrap text-foreground">
          {row.utente_nome ?? (
            <span className="text-muted-foreground italic">sconosciuto</span>
          )}
        </TableCell>
        <TableCell>
          <EventBadge tipo={row.tipo_evento} />
        </TableCell>
        <TableCell className="max-w-md truncate text-muted-foreground">
          {row.descrizione}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <IpChip ip={row.ip_address} />
        </TableCell>
        <TableCell>
          <EsitoBadge esito={row.esito} />
        </TableCell>
      </TableRow>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-[480px]">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Dettaglio evento</SheetTitle>
            <SheetDescription>
              Informazioni complete sull&apos;attività registrata
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
            <div className="flex items-center gap-3">
              {row.esito === "success" ? (
                <CheckCircle className="size-8 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="size-8 shrink-0 text-red-600" />
              )}
              <div className="flex flex-col items-start gap-1">
                <EventBadge tipo={row.tipo_evento} />
                <span className="font-mono text-xs text-muted-foreground">
                  {formatTimestamp(row.created_at)}
                </span>
              </div>
            </div>

            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
              {row.descrizione}
            </p>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Campo label="Utente">
                {row.utente_nome ?? "Sconosciuto"}
              </Campo>
              <Campo label="Indirizzo IP">
                <IpChip ip={row.ip_address} />
              </Campo>
              <Campo label="Esito">
                {row.esito === "success" ? "Successo" : "Fallito"}
              </Campo>
              <Campo label="Modulo">{row.modulo ?? "—"}</Campo>
              {row.record_id ? (
                <Campo label="Record">
                  <span className="font-mono text-xs break-all">{row.record_id}</span>
                </Campo>
              ) : null}
              <Campo label="ID evento">
                <span className="font-mono text-xs break-all">{row.id}</span>
              </Campo>
            </dl>

            <Payload label="Valori precedenti" data={row.dati_prima} />
            <Payload label="Valori applicati" data={row.dati_dopo} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  )
}

/** Colonne jsonb: mostrate solo quando l'evento ne porta davvero. */
function Payload({ label, data }: { label: string; data: unknown }) {
  if (data === null || data === undefined) return null
  if (typeof data === "object" && Object.keys(data as object).length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
