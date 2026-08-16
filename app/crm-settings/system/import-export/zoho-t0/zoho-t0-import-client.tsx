"use client"

import { useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Play,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SectionHeader, StatCard } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"

type ZohoModule = "leads" | "clienti" | "compiti" | "scadenze" | "installatori"

type ZohoStats = {
  csvRows: number
  mappedRows: number
  create: number
  update: number
  skip: number
  conflict: number
  error: number
  duplicateZohoIds: number
  missingZohoIds: number
  unresolvedOwnerIds: string[]
  unresolvedInstallatoreIds?: string[]
  unmappedHeaders: string[]
}

type SampleEvent = {
  action: "create" | "update" | "skip" | "conflict" | "error"
  zohoId: string | null
  crmRecordId: string | null
  diffCount: number
  error: string | null
}

type DryRunResult = {
  mode: "dry_run"
  module: ZohoModule
  databaseLogging: boolean
  operativeWrites: false
  runId: string | null
  stats: ZohoStats
  sampleEvents: SampleEvent[]
}

const MODULES: Array<{ value: ZohoModule; label: string }> = [
  { value: "leads", label: "Lead" },
  { value: "clienti", label: "Clienti" },
  { value: "compiti", label: "Compiti" },
  { value: "scadenze", label: "Scadenze" },
  { value: "installatori", label: "Installatori" },
]

function formatNumber(value: number) {
  return value.toLocaleString("it-IT")
}

function actionVariant(action: SampleEvent["action"]) {
  if (action === "error") return "destructive"
  if (action === "conflict") return "outline"
  return "secondary"
}

export function ZohoT0ImportClient({ role }: { role: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [module, setModule] = useState<ZohoModule>("leads")
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DryRunResult | null>(null)

  const selectedModuleLabel = useMemo(
    () => MODULES.find((item) => item.value === module)?.label ?? "Modulo",
    [module],
  )

  function handleFiles(files: FileList | null) {
    const nextFile = files?.[0] ?? null
    if (!nextFile) return
    setFile(nextFile)
    setResult(null)
    setError(null)
  }

  async function runDryRun() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.set("mode", "dry_run")
    formData.set("module", module)
    formData.set("file", file)

    try {
      const response = await fetch("/api/crm-settings/zoho-t0", {
        method: "POST",
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Dry-run non riuscito")
      setResult(payload as DryRunResult)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dry-run non riuscito")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <SectionHeader
        title="Import Zoho T0"
        description="Import manuale server-side dei dati CRM da export CSV Zoho."
        action={
          <Badge variant="outline" className="h-7 rounded-lg px-2.5">
            <ShieldCheck className="size-3.5" />
            {role}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex flex-col gap-2">
                <Label>Modulo Zoho</Label>
                <Select value={module} onValueChange={(value) => setModule((value ?? "leads") as ZohoModule)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>CSV export Zoho</Label>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => handleFiles(event.target.files)}
                />

                {file ? (
                  <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border bg-muted/45 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="size-4 shrink-0 text-teal" />
                      <span className="truncate font-semibold">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatNumber(Math.ceil(file.size / 1024))} KB
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null)
                        setResult(null)
                        if (inputRef.current) inputRef.current.value = ""
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Rimuovi CSV"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(event) => {
                      event.preventDefault()
                      setDragOver(false)
                      handleFiles(event.dataTransfer.files)
                    }}
                    className={cn(
                      "flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
                      dragOver
                        ? "border-teal bg-teal/5"
                        : "border-border hover:border-teal/50 hover:bg-muted/50",
                    )}
                  >
                    <Upload className="size-6 text-muted-foreground" />
                    <span className="text-sm font-semibold">Seleziona CSV Zoho</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                disabled={!file || loading}
                onClick={() => void runDryRun()}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Play />}
                Dry-run
              </Button>
              <Button disabled title="Disponibile dopo implementazione write-mode">
                Import definitivo
              </Button>
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Stato cutover</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Il dry-run non scrive sui moduli operativi. Il write T0 resta bloccato fino al completamento del motore server-side.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <CheckCircle2 className="size-5 text-success" />
                Dry-run {selectedModuleLabel}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.runId ? `Run ${result.runId}` : "Run non salvato su database"}
              </p>
            </div>
            <Badge variant="secondary" className="h-7 rounded-lg px-2.5">
              Scritture operative: no
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Righe CSV" value={formatNumber(result.stats.csvRows)} />
            <StatCard label="Mappate" value={formatNumber(result.stats.mappedRows)} />
            <StatCard label="Da creare" value={formatNumber(result.stats.create)} />
            <StatCard label="Da aggiornare" value={formatNumber(result.stats.update)} />
            <StatCard label="Skip" value={formatNumber(result.stats.skip)} />
            <StatCard label="Conflitti" value={formatNumber(result.stats.conflict)} />
            <StatCard label="Errori" value={formatNumber(result.stats.error)} />
            <StatCard label="ID duplicati" value={formatNumber(result.stats.duplicateZohoIds)} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <IssueList title="Owner non risolti" items={result.stats.unresolvedOwnerIds} />
            <IssueList title="Installatori non risolti" items={result.stats.unresolvedInstallatoreIds ?? []} />
            <IssueList title="Header non mappati" items={result.stats.unmappedHeaders} />
          </div>

          {result.sampleEvents.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[120px_minmax(120px,1fr)_90px_minmax(0,1fr)] gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span>Azione</span>
                <span>Zoho ID</span>
                <span>Diff</span>
                <span>Errore</span>
              </div>
              <div className="max-h-80 divide-y divide-border overflow-auto">
                {result.sampleEvents.map((event, index) => (
                  <div
                    key={`${event.zohoId ?? "row"}-${index}`}
                    className="grid grid-cols-[120px_minmax(120px,1fr)_90px_minmax(0,1fr)] gap-3 px-3 py-2 text-sm"
                  >
                    <Badge variant={actionVariant(event.action)}>{event.action}</Badge>
                    <span className="truncate font-mono text-xs">{event.zohoId ?? "-"}</span>
                    <span className="tabular-nums">{event.diffCount}</span>
                    <span className="truncate text-muted-foreground">{event.error ?? "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function IssueList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm font-semibold tabular-nums">{items.length}</span>
      </div>
      {items.length > 0 ? (
        <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-auto">
          {items.slice(0, 80).map((item) => (
            <Badge key={item} variant="outline" className="font-mono">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nessun elemento.</p>
      )}
    </div>
  )
}
