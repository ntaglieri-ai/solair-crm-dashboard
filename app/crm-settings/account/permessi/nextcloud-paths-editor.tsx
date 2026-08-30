"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronRight, FolderTree, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RUOLO_COLOR_CLASS, type RuoloColore } from "@/lib/ruoli-data"
import { cn } from "@/lib/utils"

type NcAccess = "hidden" | "readonly" | "editable"

type RoleColumn = {
  id: string
  code: string | null
  nome: string
  colore: RuoloColore
}

type NcRuleRow = {
  path_prefix: string
  ruolo_id: string
  accesso: NcAccess
  priorita: number
}

type EditorRule = {
  localId: string
  pathPrefix: string
  priorita: number
  access: Record<string, NcAccess>
}

const ACCESS_OPTIONS: { value: NcAccess; label: string }[] = [
  { value: "editable", label: "Pieno" },
  { value: "readonly", label: "Lettura" },
  { value: "hidden", label: "Nessuno" },
]

let localIdCounter = 0
function nextLocalId() {
  localIdCounter += 1
  return `nc-rule-${localIdCounter}`
}

function groupRules(rows: NcRuleRow[]): EditorRule[] {
  const byPrefix = new Map<string, EditorRule>()
  for (const row of rows) {
    const rule =
      byPrefix.get(row.path_prefix) ??
      { localId: nextLocalId(), pathPrefix: row.path_prefix, priorita: row.priorita, access: {} }
    rule.priorita = Math.min(rule.priorita, row.priorita)
    rule.access[row.ruolo_id] = row.accesso
    byPrefix.set(row.path_prefix, rule)
  }
  return [...byPrefix.values()].sort(
    (a, b) => a.priorita - b.priorita || a.pathPrefix.localeCompare(b.pathPrefix),
  )
}

export function NextcloudPathsEditor({
  roles,
  initialRules,
  canManage,
}: {
  roles: RoleColumn[]
  initialRules: NcRuleRow[]
  canManage: boolean
}) {
  const [rules, setRules] = useState<EditorRule[]>(() => groupRules(initialRules))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const nextPriorita = useMemo(() => {
    const max = rules.reduce((acc, r) => Math.max(acc, r.priorita), 0)
    return Math.ceil((max + 10) / 10) * 10
  }, [rules])

  function addRule() {
    setSavedAt(null)
    setRules((prev) => [
      ...prev,
      {
        localId: nextLocalId(),
        pathPrefix: "",
        priorita: nextPriorita,
        access: Object.fromEntries(roles.map((r) => [r.id, "hidden" as NcAccess])),
      },
    ])
  }

  function updateRule(localId: string, patch: Partial<EditorRule>) {
    setSavedAt(null)
    setRules((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)))
  }

  function setAccess(localId: string, roleId: string, value: NcAccess) {
    setSavedAt(null)
    setRules((prev) =>
      prev.map((r) =>
        r.localId === localId ? { ...r, access: { ...r.access, [roleId]: value } } : r,
      ),
    )
  }

  function removeRule(localId: string) {
    setSavedAt(null)
    setRules((prev) => prev.filter((r) => r.localId !== localId))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        rules: rules.map((r) => ({
          path_prefix: r.pathPrefix.trim(),
          priorita: r.priorita,
          access: Object.fromEntries(roles.map((role) => [role.id, r.access[role.id] ?? "hidden"])),
        })),
      }
      const res = await fetch("/api/crm-settings/permessi-cartelle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(b?.error ?? "Salvataggio non riuscito")
      }
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio non riuscito")
    } finally {
      setSaving(false)
    }
  }

  function addRuleForPath(path: string) {
    setSavedAt(null)
    // Se esiste gia' una regola su questo path esatto, non duplicarla: si
    // scorre a quella (l'operatore la modifica invece di crearne un'altra
    // che confliggerebbe per stessa priorita').
    const esistente = rules.find((r) => r.pathPrefix === path)
    if (esistente) return
    setRules((prev) => [
      ...prev,
      {
        localId: nextLocalId(),
        pathPrefix: path,
        priorita: nextPriorita,
        access: Object.fromEntries(roles.map((r) => [r.id, "hidden" as NcAccess])),
      },
    ])
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <FolderTree className="size-4 text-teal" />
          Cartelle Nextcloud · regole di accesso
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ogni regola vale per tutti i path che iniziano con il prefisso indicato
          (match case-sensitive). Vince la regola con priorità più bassa fra quelle
          che matchano. Per AGENT i path senza alcuna regola restano nascosti.
          «Nessuno» nasconde la cartella al ruolo; «Lettura» e «Pieno» la rendono
          visibile (l’enforcement dei documenti è attualmente binario: visibile/nascosta).
        </p>
      </div>

      {canManage ? (
        <NextcloudTreeBrowser
          onAddRule={addRuleForPath}
          coveredPaths={new Set(rules.map((r) => r.pathPrefix).filter(Boolean))}
        />
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="min-w-[16rem] py-2 pr-3 font-medium text-muted-foreground">
                Prefisso path
              </th>
              <th className="w-24 py-2 pr-3 font-medium text-muted-foreground">Priorità</th>
              {roles.map((role) => (
                <th key={role.id} className="w-32 py-2 pr-3 font-medium">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      RUOLO_COLOR_CLASS[role.colore],
                    )}
                  >
                    {role.nome}
                  </span>
                </th>
              ))}
              <th className="w-10 py-2" />
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td
                  colSpan={roles.length + 3}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Nessuna regola. AGENT non vede path non configurati; gli altri ruoli mantengono il default storico.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.localId} className="border-b border-border/60">
                  <td className="py-2 pr-3">
                    <Input
                      value={rule.pathPrefix}
                      disabled={!canManage}
                      placeholder="Es. Vendita-Digitale/Finanziaria/"
                      onChange={(e) => updateRule(rule.localId, { pathPrefix: e.target.value })}
                      className="h-8 font-mono text-xs"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      value={rule.priorita}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateRule(rule.localId, {
                          priorita: Number.isFinite(e.target.valueAsNumber)
                            ? Math.trunc(e.target.valueAsNumber)
                            : 0,
                        })
                      }
                      className="h-8 w-20 text-xs"
                    />
                  </td>
                  {roles.map((role) => (
                    <td key={role.id} className="py-2 pr-3">
                      <Select
                        value={rule.access[role.id] ?? "hidden"}
                        disabled={!canManage}
                        onValueChange={(v) => setAccess(rule.localId, role.id, v as NcAccess)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCESS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  ))}
                  <td className="py-2 text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={!canManage}
                      aria-label="Elimina regola"
                      onClick={() => removeRule(rule.localId)}
                      className="size-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={addRule} disabled={saving}>
            <Plus className="size-4" />
            Aggiungi regola
          </Button>
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Salvataggio…" : "Salva regole cartelle"}
          </Button>
          {savedAt ? (
            <Badge variant="outline" className="text-teal">
              Salvato
            </Badge>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          Solo SUPERADMIN e ADMIN possono modificare queste regole.
        </p>
      )}
    </div>
  )
}

type Cartella = { nome: string; path: string }

/**
 * Sfoglia l'albero REALE di Nextcloud (via /api/crm-settings/permessi-cartelle/browse,
 * un livello per chiamata) invece di far scrivere il path a mano: e' il gap
 * che ha causato l'accesso troppo ampio degli agenti (path di primo livello
 * mai coperti da nessuna regola perche' nessuno li aveva mai visti elencati).
 * Click su una cartella = aggiunge una regola precompilata su quel path
 * esatto (default "Nessuno" per tutti i ruoli, poi si regola per riga sotto).
 */
function NextcloudTreeBrowser({
  onAddRule,
  coveredPaths,
}: {
  onAddRule: (path: string) => void
  coveredPaths: Set<string>
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Sfoglia l’albero reale su Nextcloud — clic su una cartella per aggiungerla come regola.
      </p>
      <TreeNode path="" nome="Solair (radice)" onAddRule={onAddRule} coveredPaths={coveredPaths} depth={0} autoExpand />
    </div>
  )
}

function TreeNode({
  path,
  nome,
  onAddRule,
  coveredPaths,
  depth,
  autoExpand,
}: {
  path: string
  nome: string
  onAddRule: (path: string) => void
  coveredPaths: Set<string>
  depth: number
  autoExpand?: boolean
}) {
  const [expanded, setExpanded] = useState(Boolean(autoExpand))
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [figli, setFigli] = useState<Cartella[]>([])

  useEffect(() => {
    if (!expanded || loaded || loading) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/crm-settings/permessi-cartelle/browse?path=${encodeURIComponent(path)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { cartelle?: Cartella[]; error?: string } | null
        if (!res.ok) throw new Error(body?.error ?? "Lettura cartella fallita")
        if (!cancelled) setFigli(body?.cartelle ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lettura cartella fallita")
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [expanded, loaded, loading, path])

  const coperta = path !== "" && coveredPaths.has(path)

  return (
    <div>
      <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: depth * 16 }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex size-5 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Comprimi" : "Espandi"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        <span className="flex-1 truncate text-sm">{nome}</span>
        {coperta ? (
          <Badge variant="outline" className="text-[10px]">
            regola già presente
          </Badge>
        ) : path !== "" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => onAddRule(path)}
          >
            <Plus className="size-3" />
            Aggiungi regola
          </Button>
        ) : null}
      </div>
      {expanded ? (
        <div>
          {loading ? (
            <p className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 16 }}>
              Caricamento…
            </p>
          ) : error ? (
            <p className="py-1 text-xs text-destructive" style={{ paddingLeft: (depth + 1) * 16 }}>
              {error}
            </p>
          ) : figli.length === 0 && loaded ? (
            <p className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 16 }}>
              (vuota)
            </p>
          ) : (
            figli.map((c) => (
              <TreeNode
                key={c.path}
                path={c.path}
                nome={c.nome}
                onAddRule={onAddRule}
                coveredPaths={coveredPaths}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
