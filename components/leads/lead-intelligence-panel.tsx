"use client"

import {
  IconMailOpened,
  IconFlame,
  IconMapPin,
  IconExternalLink,
  IconPlus,
  IconLink,
  IconUserCheck,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
} from "@tabler/icons-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type Lead } from "@/lib/mock-data"
import { LeadMiniMap } from "./lead-mini-map"
import { scoreColor } from "./lead-utils"

interface ScoreFactor {
  label: string
  pts: number
  tone: "positive" | "negative" | "neutral"
}

// Deriva i contributi di score dai dati del lead (mock intelligence)
function scoreFactors(lead: Lead): ScoreFactor[] {
  const factors: ScoreFactor[] = []
  if (lead.emailAperture > 0)
    factors.push({
      label: `Email aperta ×${lead.emailAperture}`,
      pts: 30,
      tone: "positive",
    })
  if (lead.kWp > 0)
    factors.push({ label: "Preventivo configurato", pts: 25, tone: "positive" })
  if (
    ["Contattato", "Inviato Preventivo", "Convertito"].includes(
      lead["Stato Lead"],
    )
  )
    factors.push({ label: "Contattato", pts: 20, tone: "positive" })
  if (!lead.leadCaldo)
    factors.push({
      label: "Da 5 giorni senza risposta",
      pts: -10,
      tone: "negative",
    })
  factors.push({
    label: lead["Residente in Sicilia"]
      ? "Residente in Sicilia"
      : "Non residente in Sicilia",
    pts: 0,
    tone: "neutral",
  })
  return factors
}

function ScoreCircle({ score }: { score: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = scoreColor(score)
  return (
    <div className="relative flex size-[60px] items-center justify-center">
      <svg className="size-[60px] -rotate-90" viewBox="0 0 60 60">
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="6"
        />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span
        className="absolute text-base font-bold tabular-nums"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  )
}

const FACTOR_ICON = {
  positive: IconArrowUpRight,
  negative: IconArrowDownRight,
  neutral: IconMinus,
} as const

const FACTOR_TONE = {
  positive: "text-success",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
} as const

function ScoreBreakdownCard({ lead }: { lead: Lead }) {
  const factors = scoreFactors(lead)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">Punteggio lead</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ScoreCircle score={lead.Valutazione} />
          <div className="flex flex-col">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {lead.Valutazione}
              <span className="text-sm font-normal text-muted-foreground">
                /100
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              Valutazione complessiva
            </span>
          </div>
        </div>
        <ul className="flex flex-col gap-2.5">
          {factors.map((f) => {
            const Icon = FACTOR_ICON[f.tone]
            return (
              <li key={f.label} className="flex items-center gap-2.5">
                <Icon
                  size={15}
                  stroke={2}
                  className={cn("shrink-0", FACTOR_TONE[f.tone])}
                />
                <span className="flex-1 text-xs text-foreground">{f.label}</span>
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    FACTOR_TONE[f.tone],
                  )}
                >
                  {f.pts > 0 ? `+${f.pts}` : f.pts} pts
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function EmailTrackingCard({ lead }: { lead: Lead }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px]">
          <IconMailOpened size={17} stroke={1.8} className="text-teal" />
          Tracciamento email
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Stato</span>
          {lead.Stato === "Aperta" ? (
            <Badge className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              Aperta
            </Badge>
          ) : (
            <span className="text-xs font-medium text-foreground">
              {lead.Stato}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Aperture</span>
          <span className="text-xs font-bold tabular-nums text-foreground">
            {lead.emailAperture}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Ultima apertura</span>
          <span className="text-xs font-medium text-foreground">
            {lead["Ora ultima attività"]}
          </span>
        </div>
        {lead.leadCaldo ? (
          <Badge className="w-fit gap-1.5 rounded-md bg-warning/15 px-2.5 py-1 text-[11px] font-medium text-warning">
            <IconFlame size={14} stroke={2} />
            Lead caldo · aperta nelle ultime 24h
          </Badge>
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

function upcomingTasks(lead: Lead): UpcomingTask[] {
  const tasks: UpcomingTask[] = [
    {
      oggetto: "Richiamare per conferma preventivo",
      scadenza: "18 Giu",
      priorita: lead.Valutazione > 80 ? "Alta" : "Media",
    },
  ]
  if (lead.leadCaldo)
    tasks.push({
      oggetto: "Inviare scheda tecnica",
      scadenza: "20 Giu",
      priorita: "Media",
    })
  return tasks
}

function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" })
}

function UpcomingTasksCard({ lead }: { lead: Lead }) {
  const tasks = upcomingTasks(lead)
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
                    t.priorita === "Alta"
                      ? "text-destructive"
                      : "text-warning",
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
          onClick={() => {
            scrollToSection("section-attivita-aperte")
            // I due componenti (questo pannello laterale e il contenuto
            // principale con il dialog compito) non condividono props: uno
            // scroll da solo lasciava l'utente a dover cliccare un secondo
            // pulsante identico piu' in basso, sembrando "non funzionare".
            // Un evento leggero apre direttamente il dialog dall'altro lato.
            window.dispatchEvent(new CustomEvent("solair:open-task-dialog"))
          }}
          className="w-full border-teal/40 bg-card text-teal hover:bg-teal/5"
        >
          <IconPlus size={15} stroke={1.8} data-icon="inline-start" />
          Aggiungi compito
        </Button>
      </CardContent>
    </Card>
  )
}

function PosizioneCard({ lead }: { lead: Lead }) {
  const label = [
    [lead["Codice postale"], lead["Città"]].filter(Boolean).join(" "),
    lead.Provincia,
    lead.Paese,
  ]
    .filter(Boolean)
    .join(", ")
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    label,
  )}`
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px]">
          <IconMapPin size={17} stroke={1.8} className="text-teal" />
          Posizione
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <LeadMiniMap lead={lead} />
        <span className="text-xs text-muted-foreground">{label || "—"}</span>
        <Link
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
        >
          <IconExternalLink size={14} stroke={1.8} />
          Apri in Maps
        </Link>
      </CardContent>
    </Card>
  )
}

function ConnessioniCard({ lead }: { lead: Lead }) {
  const account = lead["Account convertito"]
  const connesso = lead["Connesso a"]
  if (!account && !connesso) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px]">
          <IconLink size={17} stroke={1.8} className="text-navy" />
          Connessioni
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {account ? (
          <Link
            href="#"
            className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 p-2.5 transition-colors hover:bg-secondary"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-teal/10 text-teal">
              <IconUserCheck size={16} stroke={1.8} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] text-muted-foreground">
                Convertito a cliente
              </span>
              <span className="truncate text-xs font-medium text-foreground">
                {account}
              </span>
            </div>
          </Link>
        ) : null}
        {connesso ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 p-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy/10 text-navy">
              <IconLink size={16} stroke={1.8} />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] text-muted-foreground">
                Connesso a
              </span>
              <span className="truncate text-xs font-medium text-foreground">
                {connesso}
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function LeadIntelligencePanel({ lead }: { lead: Lead }) {
  return (
    <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-20 lg:w-[340px] lg:shrink-0">
      <ScoreBreakdownCard lead={lead} />
      <EmailTrackingCard lead={lead} />
      <UpcomingTasksCard lead={lead} />
      <PosizioneCard lead={lead} />
      <ConnessioniCard lead={lead} />
    </aside>
  )
}
