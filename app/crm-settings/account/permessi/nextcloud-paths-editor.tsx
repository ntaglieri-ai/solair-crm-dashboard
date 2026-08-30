"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight, FolderTree, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export const NEXTCLOUD_MANUAL_RULE_EVENT = "solair:nextcloud-manual-rule"

const ACCESS_OPTIONS: { value: NcAccess; label: string }[] = [
  { value: "editable", label: "Pieno" },
  { value: "readonly", label: "Lettura" },
  { value: "hidden", label: "Nessuno" },
]

const ACCESS_CLASS: Record<NcAccess, string> = {
  editable: "border-teal/25 bg-teal/8 text-teal",
  readonly: "border-amber-300/50 bg-amber-50 text-amber-700",
  hidden: "border-rose-200 bg-rose-50 text-rose-700",
}

const ROLE_CODES_DIRECTOR_PLUS = new Set(["SUPERADMIN", "ADMIN", "DIRECTOR"])

let localIdCounter = 0
function nextLocalId() {
  localIdCounter += 1
  return `nc-rule-${localIdCounter}`
}

function normalizeEditorPath(path: string): string {
  return path.trim().replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/")
}

function roleCode(role: RoleColumn): string {
  return (role.code ?? role.nome ?? "").toUpperCase()
}

function defaultTreeRuleAccess(roles: RoleColumn[]): Record<string, NcAccess> {
  return Object.fromEntries(
    roles.map((role) => [
      role.id,
      ROLE_CODES_DIRECTOR_PLUS.has(roleCode(role)) ? "editable" : "hidden",
    ]),
  ) as Record<string, NcAccess>
}

function defaultBlankRuleAccess(roles: RoleColumn[]): Record<string, NcAccess> {
  return Object.fromEntries(roles.map((role) => [role.id, "hidden" as NcAccess]))
}

function nextPriorityFor(rules: EditorRule[]): number {
  const max = rules.reduce((acc, r) => Math.max(acc, r.priorita), 0)
  return Math.ceil((max + 10) / 10) * 10
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
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<EditorRule | null>(null)

  const nextPriorita = useMemo(() => nextPriorityFor(rules), [rules])

  const coveredPaths = useMemo(
    () => new Set(rules.map((r) => normalizeEditorPath(r.pathPrefix)).filter(Boolean)),
    [rules],
  )

  const addManualRule = useCallback((showDialog = false) => {
    setSavedAt(null)
    setRules((prev) => [
      ...prev,
      {
        localId: nextLocalId(),
        pathPrefix: "",
        priorita: nextPriorityFor(prev),
        access: defaultBlankRuleAccess(roles),
      },
    ])
    if (showDialog) setManualDialogOpen(true)
  }, [roles])

  useEffect(() => {
    if (!canManage) return
    const handler = () => addManualRule(true)
    window.addEventListener(NEXTCLOUD_MANUAL_RULE_EVENT, handler)
    return () => window.removeEventListener(NEXTCLOUD_MANUAL_RULE_EVENT, handler)
  }, [addManualRule, canManage])

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
    setDeleteCandidate(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        rules: rules.map((r) => ({
          path_prefix: normalizeEditorPath(r.pathPrefix),
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
    const normalizedPath = normalizeEditorPath(path)
    if (!normalizedPath) return
    setSavedAt(null)
    setRules((prev) => {
      const access = defaultTreeRuleAccess(roles)
      if (prev.some((r) => normalizeEditorPath(r.pathPrefix) === normalizedPath)) return prev
      return [
        ...prev,
        {
          localId: nextLocalId(),
          pathPrefix: normalizedPath,
          priorita: nextPriorita,
          access,
        },
      ]
    })
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <FolderTree className="size-4 text-teal" />
            Cartelle Nextcloud
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Le regole governano sia il CRM sia le condivisioni Nextcloud. AGENT vede solo
            cartelle configurate esplicitamente; le altre restano chiuse.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="h-7 px-2.5 text-muted-foreground">
            {rules.length} regole
          </Badge>
          {savedAt ? (
            <Badge variant="outline" className="h-7 border-teal/25 bg-teal/8 px-2.5 text-teal">
              Salvato
            </Badge>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <NextcloudTreeBrowser
          roles={roles}
          onAddRule={addRuleForPath}
          coveredPaths={coveredPaths}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Regole attive
          </p>
        </div>

        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            Nessuna regola configurata. AGENT non vede path non configurati; gli altri ruoli mantengono il default storico.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((rule) => (
              <div key={rule.localId} className="rounded-lg border border-border bg-background p-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_6rem_auto] lg:items-start">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Prefisso path
                    </label>
                    <Input
                      value={rule.pathPrefix}
                      disabled={!canManage}
                      placeholder="Es. Solair/Vendita-Digitale/Finanziaria"
                      onChange={(e) => updateRule(rule.localId, { pathPrefix: e.target.value })}
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Priorità
                    </label>
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
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="flex justify-end pt-5 lg:pt-6">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={!canManage}
                      aria-label="Elimina regola"
                      onClick={() => setDeleteCandidate(rule)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {roles.map((role) => {
                    const value = rule.access[role.id] ?? "hidden"
                    return (
                      <div key={role.id} className="rounded-lg border border-border/70 p-2">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "inline-flex min-w-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                              RUOLO_COLOR_CLASS[role.colore],
                            )}
                          >
                            <span className="truncate">{role.nome}</span>
                          </span>
                        </div>
                        <Select
                          value={value}
                          disabled={!canManage}
                          onValueChange={(v) => setAccess(rule.localId, role.id, v as NcAccess)}
                        >
                          <SelectTrigger className={cn("h-8 w-full text-xs", ACCESS_CLASS[value])}>
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
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
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

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regola pronta per esser configurata</DialogTitle>
            <DialogDescription>
              Ho aggiunto una nuova regola vuota: compila il prefisso path, controlla i permessi dei ruoli e poi salva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => setManualDialogOpen(false)}
            >
              Ok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteCandidate !== null} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminare questa regola?</DialogTitle>
            <DialogDescription>
              La regola verra rimossa dalla bozza. La modifica diventa effettiva solo dopo il salvataggio.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-foreground">
            {deleteCandidate?.pathPrefix || "Regola senza prefisso"}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCandidate(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteCandidate && removeRule(deleteCandidate.localId)}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  roles,
  onAddRule,
  coveredPaths,
}: {
  roles: RoleColumn[]
  onAddRule: (path: string) => void
  coveredPaths: Set<string>
}) {
  const [refreshVersion, setRefreshVersion] = useState(0)

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Albero reale Nextcloud
          </p>
          <p className="text-xs text-muted-foreground">
            Aggiungi una cartella per renderla governata dai permessi.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRefreshVersion((v) => v + 1)}
        >
          <RefreshCw className="size-3.5" />
          Aggiorna
        </Button>
      </div>
      <div className="max-h-80 overflow-auto rounded-lg border border-border bg-background p-2">
        <TreeNode
          key={refreshVersion}
          path="Solair"
          nome="Solair"
          roles={roles}
          onAddRule={onAddRule}
          coveredPaths={coveredPaths}
          depth={0}
          refreshVersion={refreshVersion}
          autoExpand
        />
      </div>
    </div>
  )
}

function TreeNode({
  path,
  nome,
  roles,
  onAddRule,
  coveredPaths,
  depth,
  refreshVersion,
  autoExpand,
}: {
  path: string
  nome: string
  roles: RoleColumn[]
  onAddRule: (path: string) => void
  coveredPaths: Set<string>
  depth: number
  refreshVersion: number
  autoExpand?: boolean
}) {
  const [expanded, setExpanded] = useState(Boolean(autoExpand))
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [figli, setFigli] = useState<Cartella[]>([])

  useEffect(() => {
    if (!expanded || loaded) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(
      `/api/crm-settings/permessi-cartelle/browse?path=${encodeURIComponent(path)}&v=${refreshVersion}`,
      { cache: "no-store" },
    )
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
  }, [expanded, loaded, path, refreshVersion])

  const coperta = path !== "" && coveredPaths.has(normalizeEditorPath(path))
  const canCreateRule = path !== "Solair"

  return (
    <div>
      <div
        className="flex min-w-0 items-center gap-2 rounded-md py-1 pr-1 hover:bg-muted/60"
        style={{ paddingLeft: depth * 14 }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label={expanded ? "Comprimi" : "Espandi"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {nome}
        </span>
        {coperta ? (
          <Badge variant="outline" className="text-[10px]">
            regolata
          </Badge>
        ) : canCreateRule ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => onAddRule(path)}
            title={`Crea una regola: ${roles
              .filter((role) => ROLE_CODES_DIRECTOR_PLUS.has(roleCode(role)))
              .map((role) => role.nome)
              .join(", ")} con accesso, Standard e Agente nascosti`}
          >
            <Plus className="size-3" />
            Regola
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
                roles={roles}
                onAddRule={onAddRule}
                coveredPaths={coveredPaths}
                depth={depth + 1}
                refreshVersion={refreshVersion}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
