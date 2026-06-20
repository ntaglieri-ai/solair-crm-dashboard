"use client"

import {
  IconCircleCheck,
  IconCircle,
  IconPlus,
  IconPhone,
  IconMail,
  IconCopy,
  IconWriting,
  IconWind,
  IconReceipt2,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type ClienteRecord } from "@/lib/mock-data"

/* ---------- Util ---------- */

function parseImporto(v: number | string | null | undefined): number {
  if (typeof v === "number") return v
  if (!v) return 0
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function euro(n: number): string {
  return n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  })
}

/* ---------- Step iter ---------- */

interface IterStep {
  label: string
  done: boolean
}

function iterSteps(cliente: ClienteRecord): IterStep[] {
  return [
    { label: "GSE", done: Boolean(cliente["Inserimento pratica GSE"]) },
    {
      label: "E-Distribuzione",
      done: Boolean(cliente["Inserimento pratica E-Distribuzione"]),
    },
    {
      label: "Sopralluogo",
      done: cliente["Stato sopralluogo"] === "Completato",
    },
    { label: "TICA", done: cliente["Stato TICA"] === "Accettata" },
    { label: "Iter Enel", done: Boolean(cliente["Data iter Enel Concluso"]) },
  ]
}

function ProgressCircle({ pct }: { pct: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative flex size-[60px] items-center justify-center">
      <svg className="size-[60px] -rotate-90" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke="var(--teal)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums text-teal">
        {pct}%
      </span>
    </div>
  )
}

function AvanzamentoCard({ cliente }: { cliente: ClienteRecord }) {
  const steps = iterSteps(cliente)
  const done = steps.filter((s) => s.done).length
  const pct = Math.round((done / steps.length) * 100)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">Avanzamento pratica</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ProgressCircle pct={pct} />
          <div className="flex flex-col">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {done}
              <span className="text-sm font-normal text-muted-foreground">
                /{steps.length}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">Step completati</span>
          </div>
        </div>
        <ul className="flex flex-col gap-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5">
              {s.done ? (
                <IconCircleCheck size={16} stroke={1.8} className="shrink-0 text-success" />
              ) : (
                <IconCircle size={16} stroke={1.8} className="shrink-0 text-muted-foreground/50" />
              )}
              <span
                className={cn(
                  "text-xs",
                  s.done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function RiepilogoEconomicoCard({ cliente }: { cliente: ClienteRecord }) {
  const tot = parseImporto(cliente["Tot Contratto"] ?? cliente["Importo Contrattuale"])
  const incassato = parseImporto(cliente.Bonifico1) + parseImporto(cliente.Bonifico2)
  const residuo = Math.max(tot - incassato, 0)
  const pct = tot > 0 ? Math.min(Math.round((incassato / tot) * 100), 100) : 0

  if (tot === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px]">
          <IconReceipt2 size={17} stroke={1.8} className="text-teal" />
          Riepilogo economico
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-[11px] text-muted-foreground">Totale contratto</span>
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {euro(tot)}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Incassato</span>
            <span className="font-semibold tabular-nums text-foreground">
              {euro(incassato)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-teal transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">Da incassare</span>
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              residuo > 0 ? "text-destructive" : "text-success",
            )}
          >
            {euro(residuo)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function ProvvigioniCard({ cliente }: { cliente: ClienteRecord }) {
  const stato = cliente["Stato Provvigione"]
  const codice = cliente["Codice rintracciabilità"]
  if (!stato && !codice) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">Provvigioni</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {stato ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Stato</span>
            <Badge className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              {stato}
            </Badge>
          </div>
        ) : null}
        {codice ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cod. rintracciabilità</span>
            <span className="text-xs font-medium tabular-nums text-foreground">
              {codice}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface UpcomingTask {
  oggetto: string
  scadenza: string
  priorita: "Alta" | "Media"
}

function upcomingTasks(cliente: ClienteRecord): UpcomingTask[] {
  const tasks: UpcomingTask[] = []
  if (cliente["Data appuntamento allaccio"])
    tasks.push({
      oggetto: "Appuntamento allaccio",
      scadenza: String(cliente["Data appuntamento allaccio"]).split(" ")[0],
      priorita: "Alta",
    })
  if (cliente["Data scadenza TICA"])
    tasks.push({
      oggetto: "Scadenza TICA",
      scadenza: String(cliente["Data scadenza TICA"]),
      priorita: "Media",
    })
  if (tasks.length === 0)
    tasks.push({
      oggetto: "Verifica avanzamento pratica",
      scadenza: "Da pianificare",
      priorita: "Media",
    })
  return tasks.slice(0, 3)
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

function ProssimeAttivitaCard({ cliente }: { cliente: ClienteRecord }) {
  const tasks = upcomingTasks(cliente)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">Prossime attività</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => (
            <li
              key={t.oggetto}
              className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-2.5"
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  t.priorita === "Alta" ? "bg-destructive" : "bg-warning",
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-medium leading-snug text-foreground">
                  {t.oggetto}
                </span>
                <span
                  className={cn(
                    "text-[11px]",
                    t.priorita === "Alta" ? "text-destructive" : "text-warning",
                  )}
                >
                  {t.scadenza} · {t.priorita}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          onClick={() => scrollToSection("section-attivita")}
          className="w-full border-teal/40 bg-card text-teal hover:bg-teal/5"
        >
          <IconPlus size={15} stroke={1.8} data-icon="inline-start" />
          Aggiungi compito
        </Button>
      </CardContent>
    </Card>
  )
}

function ContattiRapidiCard({ cliente }: { cliente: ClienteRecord }) {
  const cell = cliente.Cellulare
  const email = cliente["E-mail"]
  const installatore = cliente.Installatore

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v)
    toast.success("Copiato!", { description: v, duration: 1800 })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">Contatti rapidi</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {cell ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 p-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-teal/10 text-teal">
              <IconPhone size={16} stroke={1.8} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] text-muted-foreground">Cellulare</span>
              <span className="truncate text-xs font-medium text-foreground">{cell}</span>
            </div>
            <button
              type="button"
              aria-label="Copia cellulare"
              onClick={() => copy(cell)}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-navy transition-colors hover:bg-secondary"
            >
              <IconCopy size={15} stroke={1.8} />
            </button>
          </div>
        ) : null}
        {email ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 p-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy/10 text-navy">
              <IconMail size={16} stroke={1.8} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] text-muted-foreground">E-mail</span>
              <span className="truncate text-xs font-medium text-foreground">{email}</span>
            </div>
            <button
              type="button"
              aria-label="Scrivi email"
              onClick={() => toast.info("Nuova email", { description: email })}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-navy transition-colors hover:bg-secondary"
            >
              <IconWriting size={15} stroke={1.8} />
            </button>
          </div>
        ) : null}
        {installatore ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 p-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
              <IconWind size={16} stroke={1.8} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] text-muted-foreground">Installatore</span>
              <span className="truncate text-xs font-medium text-foreground">
                {installatore}
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function ClienteIntelligencePanel({ cliente }: { cliente: ClienteRecord }) {
  return (
    <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-20 lg:w-[340px] lg:shrink-0">
      <AvanzamentoCard cliente={cliente} />
      <RiepilogoEconomicoCard cliente={cliente} />
      <ProvvigioniCard cliente={cliente} />
      <ProssimeAttivitaCard cliente={cliente} />
      <ContattiRapidiCard cliente={cliente} />
    </aside>
  )
}
