"use client"

import { useCallback, useMemo, useState } from "react"
import {
  Monitor,
  Smartphone,
  Users,
  Ban,
  Timer,
  ShieldOff,
  ShieldAlert,
  LogOut,
  AlertTriangle,
  Globe,
  Plus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"
import {
  DURATA_BLOCCO_MINUTI,
  FINESTRA_TENTATIVI_MINUTI,
  TENTATIVI_AMMESSI,
  TIMEOUT_MINUTI,
  etichettaTimeout,
  isMobileUserAgent,
  type ImpostazioniSicurezza,
  type IpBloccato,
  type OrigineSessione,
  type SessioneAttiva,
} from "@/lib/session-access/constants"
import { SectionHeader, InitialsAvatar } from "@/components/impostazioni/settings-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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

// --- Palette per categoria --------------------------------------------------
// Stesso impianto di Audit & Log: un solo posto definisce il colore di ciascuna
// categoria, riusato dal bordo della stat card, dallo sfondo dell'icona e dai
// badge in tabella.

type Tone = "sessioni" | "utenti" | "bloccati" | "timeout" | "neutro"

interface ToneStyle {
  bordo: string
  icona: string
  badge: string
}

const TONE_STYLE: Record<Tone, ToneStyle> = {
  sessioni: {
    bordo: "border-l-blue-500",
    icona: "bg-blue-50 text-blue-600",
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  utenti: {
    bordo: "border-l-emerald-500",
    icona: "bg-emerald-50 text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  bloccati: {
    bordo: "border-l-red-500",
    icona: "bg-red-50 text-red-600",
    badge: "bg-red-50 text-red-700 ring-red-200",
  },
  timeout: {
    bordo: "border-l-orange-500",
    icona: "bg-orange-50 text-orange-600",
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  neutro: {
    bordo: "border-l-slate-400",
    icona: "bg-slate-100 text-slate-600",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
  },
}

const ORIGINE_LABEL: Record<OrigineSessione, string> = {
  browser: "Browser",
  servizio: "Funzione server",
  script: "Script",
  sconosciuta: "Sconosciuta",
}

const ORIGINE_TONE: Record<OrigineSessione, Tone> = {
  browser: "sessioni",
  servizio: "neutro",
  script: "neutro",
  sconosciuta: "neutro",
}

// --- Formattazione ----------------------------------------------------------

const TIMESTAMP_FMT = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : TIMESTAMP_FMT.format(date)
}

function iniziali(nome: string | null, email: string | null): string {
  const base = (nome ?? email ?? "?").trim()
  const parti = base.split(/[\s.@_-]+/).filter(Boolean)
  if (parti.length === 0) return "?"
  if (parti.length === 1) return parti[0]!.slice(0, 2).toUpperCase()
  return `${parti[0]![0]}${parti[1]![0]}`.toUpperCase()
}

// --- Pezzi di UI ------------------------------------------------------------

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  tone: Tone
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

function OrigineBadge({ origine }: { origine: OrigineSessione }) {
  const style = TONE_STYLE[ORIGINE_TONE[origine]]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        style.badge,
      )}
    >
      {ORIGINE_LABEL[origine]}
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

function EmptyState({
  icon: Icon,
  titolo,
  testo,
}: {
  icon: LucideIcon
  titolo: string
  testo: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <p className="text-sm font-medium text-foreground">{titolo}</p>
      <p className="max-w-md text-sm text-muted-foreground">{testo}</p>
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
        Impossibile leggere le sessioni
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Questa tabella non e&apos; vuota: e&apos; incompleta. Dettaglio tecnico: {message}
      </p>
    </div>
  )
}

/** Righe fantasma durante un ricaricamento: stessa griglia della tabella. */
function TableSkeleton({ rows, shapes }: { rows: number; shapes: string[] }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index}>
          {shapes.map((shape, cell) => (
            <TableCell key={cell}>
              <div className={cn("animate-pulse rounded bg-muted", shape)} aria-hidden />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// --- Pagina -----------------------------------------------------------------

interface Props {
  initialSessioni: SessioneAttiva[]
  initialIpBloccati: IpBloccato[]
  initialImpostazioni: ImpostazioniSicurezza
  initialError: string | null
}

export function SessionAccessClient({
  initialSessioni,
  initialIpBloccati,
  initialImpostazioni,
  initialError,
}: Props) {
  const [sessioni, setSessioni] = useState(initialSessioni)
  const [ipBloccati, setIpBloccati] = useState(initialIpBloccati)
  const [impostazioni, setImpostazioni] = useState(initialImpostazioni)
  const [salvate, setSalvate] = useState(initialImpostazioni)

  const [errore, setErrore] = useState(initialError)
  const [caricamento, setCaricamento] = useState(false)
  const [azione, setAzione] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)

  // Conferma in due tempi per l'operazione piu' distruttiva della pagina,
  // invece di un dialogo: un click solo non deve poter disconnettere tutti.
  const [confermaTutte, setConfermaTutte] = useState(false)

  const [nuovoIp, setNuovoIp] = useState("")
  const [nuovoMotivo, setNuovoMotivo] = useState("")

  const modificate =
    impostazioni.timeoutMinuti !== salvate.timeoutMinuti ||
    impostazioni.maxTentativi !== salvate.maxTentativi ||
    impostazioni.bloccoIpAttivo !== salvate.bloccoIpAttivo

  const utentiCollegati = useMemo(
    () => new Set(sessioni.filter((s) => s.origine === "browser").map((s) => s.authUserId)).size,
    [sessioni],
  )
  const bloccatiAttivi = useMemo(
    () => ipBloccati.filter((i) => i.attivo).length,
    [ipBloccati],
  )
  const revocabili = sessioni.filter((s) => !s.corrente).length

  const ricarica = useCallback(async () => {
    setCaricamento(true)
    try {
      const res = await fetch("/api/crm-settings/session", { cache: "no-store" })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setErrore(body?.error ?? `Errore ${res.status}`)
        return
      }
      setErrore(body.errore ?? null)
      setSessioni(body.sessioni)
      setIpBloccati(body.ipBloccati)
      setImpostazioni(body.impostazioni)
      setSalvate(body.impostazioni)
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore di rete")
    } finally {
      setCaricamento(false)
    }
  }, [])

  /** Esegue un'azione e ricarica: una sola forma per tutti i pulsanti. */
  const esegui = useCallback(
    async (chiave: string, req: () => Promise<Response>, successo: string) => {
      setAzione(chiave)
      setMessaggio(null)
      try {
        const res = await req()
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          setErrore(body?.error ?? `Errore ${res.status}`)
          return
        }
        setErrore(null)
        setMessaggio(typeof successo === "string" ? successo : null)
        await ricarica()
      } catch (err) {
        setErrore(err instanceof Error ? err.message : "Errore di rete")
      } finally {
        setAzione(null)
      }
    },
    [ricarica],
  )

  const post = (url: string, corpo: unknown) => () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    })

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Session & Access"
        description="Sessioni realmente aperte su Supabase, configurazione degli accessi e indirizzi IP bloccati."
      />

      {messaggio ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {messaggio}
        </div>
      ) : null}

      {/* Stat card ---------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sessioni aperte"
          value={sessioni.length}
          hint="righe in auth.sessions"
          icon={Monitor}
          tone="sessioni"
        />
        <StatCard
          label="Utenti collegati"
          value={utentiCollegati}
          hint="da browser, senza duplicati"
          icon={Users}
          tone="utenti"
        />
        <StatCard
          label="IP bloccati"
          value={bloccatiAttivi}
          hint={`su ${ipBloccati.length} in elenco`}
          icon={Ban}
          tone="bloccati"
        />
        <StatCard
          label="Timeout sessione"
          value={etichettaTimeout(salvate.timeoutMinuti)}
          hint="inattivita' massima"
          icon={Timer}
          tone="timeout"
        />
      </div>

      {/* Sezione 1 — Sessioni attive ---------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-base font-semibold text-foreground">Sessioni attive</h3>
            <p className="text-sm text-muted-foreground">
              Lette da <span className="font-mono text-xs">auth.sessions</span>: sono le
              sessioni Supabase realmente aperte, non una stima.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={ricarica}
              disabled={caricamento || azione !== null}
            >
              <RefreshCw className={cn("size-4", caricamento && "animate-spin")} />
              Aggiorna
            </Button>
            {confermaTutte ? (
              <>
                <Button
                  size="sm"
                  className="bg-red-600 text-white transition-colors hover:bg-red-700"
                  disabled={azione !== null}
                  onClick={() => {
                    setConfermaTutte(false)
                    void esegui(
                      "tutte",
                      post("/api/crm-settings/session/revoke", { tutte: true }),
                      "Sessioni terminate.",
                    )
                  }}
                >
                  Confermi? Termina {revocabili}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfermaTutte(false)}>
                  Annulla
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
                disabled={revocabili === 0 || azione !== null}
                onClick={() => setConfermaTutte(true)}
              >
                <LogOut className="size-4" />
                Termina tutte le altre
              </Button>
            )}
          </div>
        </div>

        {/* Nota sul ritardo di propagazione. Non e' un dettaglio da nascondere:
            chi termina una sessione deve sapere entro quando fa effetto. */}
        <div className="flex items-start gap-2 border-b border-border bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Terminare una sessione ne cancella i token di rinnovo: l&apos;utente cade fuori
            al primo rinnovo, <strong>entro circa un&apos;ora</strong>. Non e&apos;
            immediato, perche&apos; il CRM verifica il token in locale senza interrogare
            Supabase a ogni richiesta.
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Inizio sessione</TableHead>
                {/* "Ultimo rinnovo", non "Ultima attivita'": auth.sessions.updated_at
                    si muove al rinnovo del token, non a ogni azione dell'utente.
                    Chiamarla "attivita'" prometterebbe una precisione che il dato
                    non ha. */}
                <TableHead>Ultimo rinnovo</TableHead>
                <TableHead className="text-right">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {caricamento && sessioni.length === 0 ? (
                <TableSkeleton
                  rows={4}
                  shapes={[
                    "h-4 w-40",
                    "h-4 w-32",
                    "h-6 w-24 rounded-full",
                    "h-5 w-28 rounded-md",
                    "h-4 w-24",
                    "h-4 w-24",
                    "h-8 w-24 rounded-md",
                  ]}
                />
              ) : null}

              {sessioni.map((s) => {
                const DeviceIcon = isMobileUserAgent(s.userAgent) ? Smartphone : Monitor
                return (
                  <TableRow key={s.sessionId} className={cn(s.corrente && "bg-blue-50/40")}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar iniziali={iniziali(s.utenteNome, s.utenteEmail)} />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {s.utenteNome ?? "Utente non in anagrafica"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {s.utenteEmail ?? s.authUserId}
                          </span>
                        </div>
                        {s.corrente ? (
                          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            questa
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DeviceIcon className="size-4 shrink-0" />
                        <span className="whitespace-nowrap">{s.dispositivo}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <OrigineBadge origine={s.origine} />
                    </TableCell>
                    <TableCell>
                      <IpChip ip={s.ip} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatTimestamp(s.creataIl)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatTimestamp(s.rinnovataIl)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
                        disabled={s.corrente || azione !== null}
                        title={
                          s.corrente
                            ? "Non puoi terminare la sessione da cui stai lavorando"
                            : undefined
                        }
                        onClick={() =>
                          void esegui(
                            s.sessionId,
                            post("/api/crm-settings/session/revoke", {
                              sessionId: s.sessionId,
                            }),
                            "Sessione terminata.",
                          )
                        }
                      >
                        Termina
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}

              {!caricamento && sessioni.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    {errore ? (
                      <ErrorState message={errore} />
                    ) : (
                      <EmptyState
                        icon={Monitor}
                        titolo="Nessuna sessione aperta"
                        testo="Non risulta alcuna sessione in auth.sessions. Compare una riga qui non appena qualcuno effettua l'accesso al CRM."
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Sezione 2 — Configurazione sicurezza -------------------------------- */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold text-foreground">
            Configurazione sicurezza
          </h3>
          <p className="text-sm text-muted-foreground">
            Salvata su <span className="font-mono text-xs">crm_settings</span>. Le tre
            impostazioni attive sono applicate davvero: il timeout diventa la scadenza
            del cookie di sessione, soglia e blocco IP sono letti a ogni tentativo di
            accesso.
          </p>
        </div>

        {/* Timeout sessione */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">Timeout sessione</span>
            <span className="text-sm text-muted-foreground">
              Disconnette dopo questo periodo di inattivita&apos;. Raggiunge le sessioni
              gia&apos; aperte entro un minuto.
            </span>
          </div>
          <Select
            value={String(impostazioni.timeoutMinuti)}
            onValueChange={(v) =>
              setImpostazioni((p) => ({ ...p, timeoutMinuti: Number(v) || p.timeoutMinuti }))
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEOUT_MINUTI.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {etichettaTimeout(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2FA — dichiaratamente non disponibile.
            Un interruttore cliccabile che salva `true` senza che nessun fattore
            esista protegge zero utenti e ne convince molti del contrario: finche'
            l'enrollment MFA non c'e', la riga resta spenta e spiega perche'. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 opacity-70">
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                Autenticazione a due fattori (2FA)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 ring-inset">
                <ShieldOff className="size-3.5" />
                Non disponibile — richiede attivazione MFA
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              Nessun fattore TOTP risulta registrato e il CRM non ha ancora una
              procedura di enrollment: l&apos;interruttore resta spento finche&apos; non
              esiste qualcosa da imporre.
            </span>
          </div>
          <Switch checked={false} disabled aria-label="2FA non disponibile" />
        </div>

        {/* Tentativi login massimi */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              Tentativi di login massimi
            </span>
            <span className="text-sm text-muted-foreground">
              Fallimenti tollerati da uno stesso IP in {FINESTRA_TENTATIVI_MINUTI} minuti.
              Il conteggio riparte dopo ogni accesso riuscito.
            </span>
          </div>
          <Select
            value={String(impostazioni.maxTentativi)}
            onValueChange={(v) =>
              setImpostazioni((p) => ({ ...p, maxTentativi: Number(v) || p.maxTentativi }))
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TENTATIVI_AMMESSI.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  {t} tentativi
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Blocco IP */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              Blocco IP dopo login falliti
            </span>
            <span className="text-sm text-muted-foreground">
              Al superamento della soglia l&apos;indirizzo viene bloccato per{" "}
              {DURATA_BLOCCO_MINUTI} minuti e non puo&apos; nemmeno provare le credenziali.
            </span>
          </div>
          <Switch
            checked={impostazioni.bloccoIpAttivo}
            onCheckedChange={(v) =>
              setImpostazioni((p) => ({ ...p, bloccoIpAttivo: v === true }))
            }
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            className="bg-teal text-teal-foreground transition-colors hover:bg-teal/90"
            disabled={!modificate || azione !== null}
            onClick={() =>
              void esegui(
                "impostazioni",
                () =>
                  fetch("/api/crm-settings/session/impostazioni", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(impostazioni),
                  }),
                "Impostazioni di sicurezza salvate.",
              )
            }
          >
            {azione === "impostazioni" ? "Salvataggio…" : "Salva impostazioni di sicurezza"}
          </Button>
          {modificate ? (
            <span className="text-xs text-muted-foreground">Modifiche non salvate</span>
          ) : null}
        </div>
      </section>

      {/* Sezione 3 — IP bloccati -------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-base font-semibold text-foreground">IP bloccati</h3>
            <p className="text-sm text-muted-foreground">
              I blocchi automatici scadono da soli dopo {DURATA_BLOCCO_MINUTI} minuti; un
              blocco inserito qui a mano resta finche&apos; non lo togli.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={nuovoIp}
              onChange={(e) => setNuovoIp(e.target.value)}
              placeholder="192.0.2.10"
              className="w-full font-mono text-sm sm:w-44"
              aria-label="Indirizzo IP da bloccare"
            />
            <Input
              value={nuovoMotivo}
              onChange={(e) => setNuovoMotivo(e.target.value)}
              placeholder="Motivo (facoltativo)"
              className="w-full text-sm sm:w-64"
              aria-label="Motivo del blocco"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={nuovoIp.trim() === "" || azione !== null}
              onClick={() =>
                void esegui(
                  "blocca",
                  post("/api/crm-settings/session/ip", {
                    ip: nuovoIp.trim(),
                    motivo: nuovoMotivo.trim(),
                  }),
                  `IP ${nuovoIp.trim()} bloccato.`,
                ).then(() => {
                  setNuovoIp("")
                  setNuovoMotivo("")
                })
              }
            >
              <Plus className="size-4" />
              Blocca IP
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead>Bloccato il</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ipBloccati.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell>
                    <IpChip ip={ip.ipAddress} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ip.motivo}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {ip.bloccatoDaNome ?? "Automatico"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatTimestamp(ip.creatoIl)}
                  </TableCell>
                  <TableCell>
                    {ip.attivo ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
                          TONE_STYLE.bloccati.badge,
                        )}
                      >
                        <Ban className="size-3.5" />
                        {ip.scadenza ? `Fino a ${formatTimestamp(ip.scadenza)}` : "Permanente"}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
                          TONE_STYLE.neutro.badge,
                        )}
                      >
                        Scaduto
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={azione !== null}
                      onClick={() =>
                        void esegui(
                          ip.id,
                          () =>
                            fetch(`/api/crm-settings/session/ip?id=${encodeURIComponent(ip.id)}`, {
                              method: "DELETE",
                            }),
                          `IP ${ip.ipAddress} sbloccato.`,
                        )
                      }
                    >
                      {ip.attivo ? "Sblocca" : "Rimuovi"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {ipBloccati.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={Globe}
                      titolo="Nessun IP bloccato"
                      testo={`La tabella si popola da sola: un indirizzo che supera i tentativi consentiti in ${FINESTRA_TENTATIVI_MINUTI} minuti finisce qui per ${DURATA_BLOCCO_MINUTI} minuti. Puoi comunque bloccarne uno a mano dal campo qui sopra.`}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
