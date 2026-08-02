"use client"

import { useEffect, useState } from "react"
import { Bot, Database, Plus, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

type KnowledgeStatus = {
  sources: number
  chunks: number
  catalogItems: number
  recentSources: {
    nome: string
    cartella: string
    stato: "ready" | "scan_pending" | "empty" | "error"
    testo_chars: number
    synced_at: string
    errore: string | null
  }[]
}

type SyncResult = {
  sources: number
  updated: number
  reused: number
  chunks: number
  catalogItems: number
  scansPending: number
  errors: string[]
}

type RobertaSourceCategory =
  | "listini"
  | "componenti"
  | "offerte"
  | "prezzi"
  | "finanziarie"
  | "varie"

type RobertaSource = {
  id: string
  label: string
  categoria: RobertaSourceCategory
  path: string
  active: boolean
}

type CategoryOption = {
  value: RobertaSourceCategory
  label: string
}

const STATO_LABEL: Record<KnowledgeStatus["recentSources"][number]["stato"], string> = {
  ready: "Pronto",
  scan_pending: "Scansione",
  empty: "Vuoto",
  error: "Errore",
}

const STATO_TONE: Record<KnowledgeStatus["recentSources"][number]["stato"], string> = {
  ready: "bg-teal/10 text-teal",
  scan_pending: "bg-warning/10 text-warning",
  empty: "bg-muted text-muted-foreground",
  error: "bg-destructive/10 text-destructive",
}

export default function RobertaKnowledgePage() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)
  const [sources, setSources] = useState<RobertaSource[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSources, setSavingSources] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [newSource, setNewSource] = useState({
    label: "",
    categoria: "listini" as RobertaSourceCategory,
    path: "",
  })

  async function loadSources() {
    const response = await fetch("/api/crm-settings/roberta/sources", {
      cache: "no-store",
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? "Errore fonti Roberta")
    setSources(body.sources ?? [])
    setCategories(body.categories ?? [])
  }

  async function loadStatus(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      const response = await fetch("/api/crm-settings/roberta/knowledge/sync", {
        cache: "no-store",
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Errore stato Roberta")
      setStatus(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore stato Roberta")
    } finally {
      setLoading(false)
    }
  }

  async function saveSources(nextSources = sources) {
    setSavingSources(true)
    try {
      const response = await fetch("/api/crm-settings/roberta/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: nextSources }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Errore salvataggio fonti")
      setSources(body.sources ?? nextSources)
      toast.success("Fonti Roberta salvate")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore salvataggio fonti")
    } finally {
      setSavingSources(false)
    }
  }

  function addSource() {
    if (!newSource.label.trim() || !newSource.path.trim()) {
      toast.error("Inserisci nome e path Nextcloud")
      return
    }
    const next = [
      ...sources,
      {
        id: crypto.randomUUID(),
        label: newSource.label.trim(),
        categoria: newSource.categoria,
        path: newSource.path.trim().replace(/^\/+|\/+$/g, ""),
        active: true,
      },
    ]
    setSources(next)
    setNewSource({ label: "", categoria: "listini", path: "" })
    void saveSources(next)
  }

  async function sync(force = false) {
    setSyncing(true)
    try {
      await saveSources()
      const response = await fetch("/api/crm-settings/roberta/knowledge/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      })
      const body = (await response.json()) as SyncResult & { error?: string }
      if (!response.ok) throw new Error(body.error ?? "Errore aggiornamento Roberta")

      toast.success(
        `Roberta aggiornata: ${body.updated} documenti aggiornati, ${body.reused} invariati`,
      )
      if (body.errors.length > 0) {
        toast.warning(`${body.errors.length} avvisi durante la sincronizzazione`)
      }
      await loadStatus()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Errore aggiornamento Roberta",
      )
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        await loadSources()
        const response = await fetch("/api/crm-settings/roberta/knowledge/sync", {
          cache: "no-store",
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? "Errore stato Roberta")
        if (!cancelled) setStatus(body)
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Errore stato Roberta")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Roberta"
        description="Conoscenza veloce del chatbot ricostruita da listini, offerte e documenti Nextcloud."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => sync(true)} disabled={syncing}>
              <RotateCcw className="size-4" />
              Ricostruisci
            </Button>
            <Button onClick={() => sync(false)} disabled={syncing}>
              <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
              Aggiorna
            </Button>
          </div>
        }
      />

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">Fonti controllate</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scegli quali cartelle Nextcloud Roberta puo&apos; usare e con quale categoria.
          </p>
        </div>
        <div className="divide-y divide-border">
          {sources.map((source) => (
            <article
              key={source.id}
              className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(180px,1fr)_180px_minmax(280px,1.4fr)_auto_auto]"
            >
              <Input
                value={source.label}
                onChange={(event) =>
                  setSources((current) =>
                    current.map((item) =>
                      item.id === source.id ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
                aria-label="Nome fonte"
              />
              <Select
                value={source.categoria}
                onValueChange={(value) =>
                  setSources((current) =>
                    current.map((item) =>
                      item.id === source.id
                        ? { ...item, categoria: value as RobertaSourceCategory }
                        : item,
                    ),
                  )
                }
              >
                <SelectTrigger aria-label="Categoria fonte">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={source.path}
                onChange={(event) =>
                  setSources((current) =>
                    current.map((item) =>
                      item.id === source.id ? { ...item, path: event.target.value } : item,
                    ),
                  )
                }
                aria-label="Path Nextcloud"
              />
              <Switch
                checked={source.active}
                onCheckedChange={(active) =>
                  setSources((current) =>
                    current.map((item) =>
                      item.id === source.id ? { ...item, active } : item,
                    ),
                  )
                }
                aria-label={`Fonte ${source.label} attiva`}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const next = sources.filter((item) => item.id !== source.id)
                  setSources(next)
                  void saveSources(next)
                }}
                aria-label={`Rimuovi ${source.label}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </article>
          ))}

          <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(180px,1fr)_180px_minmax(280px,1.4fr)_auto]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="roberta-source-label">Nome</Label>
              <Input
                id="roberta-source-label"
                value={newSource.label}
                onChange={(event) =>
                  setNewSource((current) => ({ ...current, label: event.target.value }))
                }
                placeholder="Offerte estate"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Categoria</Label>
              <Select
                value={newSource.categoria}
                onValueChange={(value) =>
                  setNewSource((current) => ({
                    ...current,
                    categoria: value as RobertaSourceCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="roberta-source-path">Path Nextcloud</Label>
              <Input
                id="roberta-source-path"
                value={newSource.path}
                onChange={(event) =>
                  setNewSource((current) => ({ ...current, path: event.target.value }))
                }
                placeholder="Solair/Vendita-Digitale/OFFERTE"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addSource} disabled={savingSources}>
                <Plus className="size-4" />
                Aggiungi
              </Button>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button variant="outline" onClick={() => saveSources()} disabled={savingSources}>
            Salva fonti
          </Button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          icon={Database}
          label="Documenti"
          value={loading ? "..." : String(status?.sources ?? 0)}
        />
        <MetricCard
          icon={Search}
          label="Blocchi conoscenza"
          value={loading ? "..." : String(status?.chunks ?? 0)}
        />
        <MetricCard
          icon={Bot}
          label="Righe catalogo"
          value={loading ? "..." : String(status?.catalogItems ?? 0)}
        />
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">Ultimi documenti</h2>
        </div>
        <div className="divide-y divide-border">
          {!loading && (status?.recentSources.length ?? 0) === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Nessuna conoscenza sincronizzata.
            </div>
          ) : null}
          {status?.recentSources.map((source) => (
            <article
              key={`${source.cartella}/${source.nome}`}
              className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-foreground">
                  {source.nome}
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  {source.cartella} · {source.testo_chars.toLocaleString("it-IT")} caratteri
                </p>
                {source.errore ? (
                  <p className="mt-1 text-xs text-destructive">{source.errore}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge className={STATO_TONE[source.stato]}>
                  {STATO_LABEL[source.stato]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(source.synced_at).toLocaleString("it-IT")}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database
  label: string
  value: string
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-teal/10 text-teal">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </article>
  )
}
