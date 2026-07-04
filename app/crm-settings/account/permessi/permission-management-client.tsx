"use client"

import { useState } from "react"
import { Check, Copy, Plus, ShieldCheck, Sparkles, Users } from "lucide-react"
import {
  permessiHighlights,
  RUOLO_COLOR_CLASS,
  PAGINE,
  MODULI_RECORD,
  RECORD_PERMESSI,
  type Ruolo,
  type RuoloColore,
  type RuoloPermessi,
  type PaginaId,
  type ModuloRecordId,
  type RecordPermesso,
  type VisibilitaScope,
} from "@/lib/ruoli-data"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { AccountProfileCard } from "@/components/crm-settings/account-profile-card"
import type { CurrentAccountProfile } from "@/lib/crm-settings/current-account"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ACTION_KEYS, MODULE_KEYS } from "@/lib/permissions/constants"
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
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"

/** Radio accessibile minimale (manca un componente radio-group nel progetto). */
function RadioRow({
  checked,
  onSelect,
  label,
}: {
  checked: boolean
  onSelect: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex items-center gap-2.5 text-left text-sm"
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-teal" : "border-input",
        )}
      >
        {checked ? <span className="size-2 rounded-full bg-teal" /> : null}
      </span>
      <span className="text-foreground">{label}</span>
    </button>
  )
}

function emptyPermessi(): RuoloPermessi {
  const record = Object.fromEntries(
    MODULI_RECORD.map((m) => [m.id, [] as RecordPermesso[]]),
  ) as unknown as Record<ModuloRecordId, RecordPermesso[]>

  return {
    pagine: Object.fromEntries(PAGINE.map((p) => [p.id, false])) as Record<
      PaginaId,
      boolean
    >,
    record,
    visibilita_sedi: "own",
    cartelle_nextcloud: "own",
    riconfigurazioni: false,
  }
}

type RoleTemplate = "empty" | "readonly" | "agent" | "backoffice" | "admin_limited" | "copy"

const TEMPLATE_OPTIONS: {
  id: RoleTemplate
  label: string
  description: string
}[] = [
  {
    id: "backoffice",
    label: "Back office",
    description: "Lead, clienti, compiti e scadenze operativi, senza aree sensibili.",
  },
  {
    id: "agent",
    label: "Agente",
    description: "Accesso commerciale con tag e colonne personali, niente configurazioni globali.",
  },
  {
    id: "admin_limited",
    label: "Admin limitato",
    description: "Gestione CRM Settings senza audit, sessioni e backup.",
  },
  {
    id: "readonly",
    label: "Solo lettura",
    description: "Visibilità ampia ma nessuna modifica ai record.",
  },
  {
    id: "empty",
    label: "Vuoto",
    description: "Nessun accesso iniziale. Configurazione manuale completa dopo la creazione.",
  },
  {
    id: "copy",
    label: "Copia ruolo",
    description: "Duplica permessi e scope da un ruolo esistente.",
  },
]

const ROLE_COLORS: { id: RuoloColore; label: string }[] = [
  { id: "teal", label: "Operativo" },
  { id: "navy", label: "Direzionale" },
  { id: "violet", label: "Tecnico" },
  { id: "amber", label: "Coordinamento" },
  { id: "rose", label: "Limitato" },
  { id: "gray", label: "Neutro" },
]

const ACTION_LABELS: Record<string, string> = {
  "crm_settings.account.audit.view": "Vede Audit & Log",
  "crm_settings.account.session.view": "Vede Session & Access",
  "crm_settings.account.users.manage": "Gestisce utenti",
  "crm_settings.account.roles.manage": "Gestisce ruoli",
  "crm_settings.system.backup.view": "Vede Backup",
  "crm_settings.system.backup.run": "Esegue Backup",
  "crm_settings.system.maintenance.run": "Task manutenzione",
  "crm_settings.system.default_values.manage": "Gestisce valori predefiniti",
  "lead.columns.customize_own": "Personalizza colonne Lead",
  "lead.tags.edit": "Modifica tag Lead",
  "lead.default_values.manage": "Gestisce default Lead",
  "lead.assignment_rules.manage": "Gestisce assegnazioni Lead",
  "lead.workflows.manage": "Gestisce flussi Lead",
  "clienti.default_values.manage": "Gestisce valori Clienti",
  "clienti.assignment_rules.manage": "Gestisce assegnazioni Clienti",
  "clienti.workflows.manage": "Gestisce flussi Clienti",
  "compiti.default_values.manage": "Gestisce valori Compiti",
  "compiti.assignment_rules.manage": "Gestisce assegnazioni Compiti",
  "compiti.workflows.manage": "Gestisce flussi Compiti",
  "scadenze.default_values.manage": "Gestisce valori Scadenze",
  "scadenze.assignment_rules.manage": "Gestisce assegnazioni Scadenze",
  "scadenze.workflows.manage": "Gestisce flussi Scadenze",
  "installatori.default_values.manage": "Gestisce valori Installatori",
  "installatori.assignment_rules.manage": "Gestisce assegnazioni Installatori",
  "installatori.workflows.manage": "Gestisce flussi Installatori",
}

function withAdvanced(
  permessi: RuoloPermessi,
  config: {
    actions?: string[]
    scope?: string
    fieldAccess?: string
  } = {},
): RuoloPermessi {
  return {
    ...permessi,
    azioni: Object.fromEntries(
      ACTION_KEYS.map((action) => [action, config.actions?.includes(action) ?? false]),
    ),
    scope_dati: Object.fromEntries(MODULE_KEYS.map((moduleKey) => [moduleKey, config.scope ?? "none"])),
    campi: Object.fromEntries(
      MODULE_KEYS.map((moduleKey) => [moduleKey, { "*": config.fieldAccess ?? "hidden" }]),
    ),
  }
}

function allRecordPerms(includeDelete = false): Record<ModuloRecordId, RecordPermesso[]> {
  const perms: RecordPermesso[] = includeDelete
    ? ["view", "create", "edit", "delete", "export"]
    : ["view", "create", "edit", "export"]
  return Object.fromEntries(MODULI_RECORD.map((m) => [m.id, perms])) as Record<
    ModuloRecordId,
    RecordPermesso[]
  >
}

function readonlyRecordPerms(): Record<ModuloRecordId, RecordPermesso[]> {
  return Object.fromEntries(MODULI_RECORD.map((m) => [m.id, ["view"]])) as Record<
    ModuloRecordId,
    RecordPermesso[]
  >
}

function templatePermessi(template: RoleTemplate, source?: Ruolo): RuoloPermessi {
  if (template === "copy" && source) return structuredClone(source.permessi)

  const base = emptyPermessi()
  if (template === "readonly") {
    return withAdvanced(
      {
        ...base,
        pagine: Object.fromEntries(PAGINE.map((p) => [p.id, p.id !== "crm_settings"])) as Record<PaginaId, boolean>,
        record: readonlyRecordPerms(),
        visibilita_sedi: "all",
      },
      { scope: "all", fieldAccess: "readonly" },
    )
  }

  if (template === "agent") {
    return withAdvanced(
      {
        ...base,
        pagine: {
          ...base.pagine,
          dashboard: true,
          lead: true,
          clienti: true,
          compiti: true,
          scadenze: true,
          documenti: true,
        },
        record: {
          ...base.record,
          lead: ["view", "create", "edit"],
          clienti: ["view", "create", "edit"],
          compiti: ["view", "create", "edit"],
          scadenze: ["view", "create"],
        },
      },
      {
        actions: ["lead.columns.customize_own", "lead.tags.edit"],
        scope: "assigned",
        fieldAccess: "editable",
      },
    )
  }

  if (template === "admin_limited") {
    return withAdvanced(
      {
        ...base,
        pagine: {
          dashboard: true,
          lead: true,
          clienti: true,
          compiti: true,
          scadenze: true,
          documenti: true,
          installatori: true,
          crm_settings: true,
        },
        record: allRecordPerms(true),
        visibilita_sedi: "all",
        riconfigurazioni: true,
      },
      {
        actions: [
          "crm_settings.account.users.manage",
          "crm_settings.account.roles.manage",
          "crm_settings.system.default_values.manage",
          "lead.columns.customize_own",
          "lead.tags.edit",
          "lead.default_values.manage",
          "lead.fields.view",
          "lead.fields.create",
          "lead.fields.edit",
          "lead.fields.visibility.manage",
          "lead.fields.required.manage",
        ],
        scope: "all",
        fieldAccess: "editable",
      },
    )
  }

  if (template === "backoffice") {
    return withAdvanced(
      {
        ...base,
        pagine: {
          ...base.pagine,
          dashboard: true,
          lead: true,
          clienti: true,
          compiti: true,
          scadenze: true,
          documenti: true,
        },
        record: allRecordPerms(false),
        visibilita_sedi: "own",
      },
      {
        actions: ["lead.columns.customize_own", "lead.tags.edit"],
        scope: "own_sede",
        fieldAccess: "editable",
      },
    )
  }

  return withAdvanced(base)
}

function countEnabledPages(permessi: RuoloPermessi) {
  return Object.values(permessi.pagine).filter(Boolean).length
}

function countEnabledRecordActions(permessi: RuoloPermessi) {
  return Object.values(permessi.record).reduce((sum, actions) => sum + actions.length, 0)
}

function countEnabledActions(permessi: RuoloPermessi) {
  return Object.values(permessi.azioni ?? {}).filter(Boolean).length
}

export function PermissionManagementClient({
  ruoli: initialRuoli,
  currentProfile,
}: {
  ruoli: Ruolo[]
  currentProfile: CurrentAccountProfile | null
}) {
  const [ruoli, setRuoli] = useState<Ruolo[]>(initialRuoli)
  const [activeId, setActiveId] = useState<string | null>(null)
  // Bozza di permessi in editing, separata dallo stato salvato.
  const [draft, setDraft] = useState<RuoloPermessi | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")
  const [roleColor, setRoleColor] = useState<RuoloColore>("teal")
  const [roleTemplate, setRoleTemplate] = useState<RoleTemplate>("backoffice")
  const [copyFromRoleId, setCopyFromRoleId] = useState("")
  const [rolePermessi, setRolePermessi] = useState<RuoloPermessi>(() =>
    templatePermessi("backoffice"),
  )
  const [creatingRole, setCreatingRole] = useState(false)

  const active = ruoli.find((r) => r.id === activeId) ?? null
  const copySource = ruoli.find((r) => r.id === copyFromRoleId) ?? active ?? ruoli[0]

  function applyTemplate(template: RoleTemplate, source = copySource) {
    setRoleTemplate(template)
    if (template === "copy" && source) {
      setCopyFromRoleId(source.id)
      setRoleColor(source.colore)
      setRolePermessi(templatePermessi("copy", source))
      return
    }
    setRolePermessi(templatePermessi(template))
  }

  function openConfig(r: Ruolo) {
    if (activeId === r.id) {
      setActiveId(null)
      setDraft(null)
      return
    }
    setError(null)
    setActiveId(r.id)
    setDraft(structuredClone(r.permessi))
  }

  function openNewRole() {
    setError(null)
    setRoleName("")
    setRoleDescription("")
    setRoleColor("teal")
    setRoleTemplate("backoffice")
    setCopyFromRoleId("")
    setRolePermessi(templatePermessi("backoffice"))
    setRoleDialogOpen(true)
  }

  function openDuplicateRole() {
    if (!active) return
    setError(null)
    setRoleName(`Copia di ${active.nome}`)
    setRoleDescription(active.descrizione)
    setRoleColor(active.colore)
    setRoleTemplate("copy")
    setCopyFromRoleId(active.id)
    setRolePermessi(structuredClone(draft ?? active.permessi))
    setRoleDialogOpen(true)
  }

  async function createRole() {
    if (!roleName.trim()) return
    setCreatingRole(true)
    setError(null)
    try {
      const res = await fetch("/api/crm-settings/permessi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: roleName,
          descrizione: roleDescription,
          colore: roleColor,
          permessi: rolePermessi,
        }),
      })
      const body = (await res.json().catch(() => null)) as {
        ruolo?: Ruolo
        error?: string
      } | null
      if (!res.ok || !body?.ruolo) {
        throw new Error(body?.error ?? "Creazione ruolo non riuscita")
      }
      setRuoli((prev) => [...prev, body.ruolo!])
      setRoleDialogOpen(false)
      setActiveId(body.ruolo.id)
      setDraft(structuredClone(body.ruolo.permessi))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creazione ruolo non riuscita")
    } finally {
      setCreatingRole(false)
    }
  }

  async function save() {
    if (!active || !draft) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/crm-settings/permessi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruoloId: active.id, permessi: draft }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? "Salvataggio non riuscito")
      }
      const saved = draft
      setRuoli((prev) =>
        prev.map((r) =>
          r.id === active.id ? { ...r, permessi: saved } : r,
        ),
      )
      setActiveId(null)
      setDraft(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio non riuscito")
    } finally {
      setSaving(false)
    }
  }

  function togglePagina(id: PaginaId) {
    setDraft((d) =>
      d ? { ...d, pagine: { ...d.pagine, [id]: !d.pagine[id] } } : d,
    )
  }

  function toggleRecord(modulo: ModuloRecordId, perm: RecordPermesso) {
    setDraft((d) => {
      if (!d) return d
      const current = d.record[modulo]
      const next = current.includes(perm)
        ? current.filter((p) => p !== perm)
        : [...current, perm]
      return { ...d, record: { ...d.record, [modulo]: next } }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Permission Management"
        description="Configura i permessi per ogni ruolo. Controlla l'accesso a pagine, record, cartelle e funzionalità di riconfigurazione."
        action={
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={openNewRole}
          >
            <Plus className="size-4" />
            Nuovo ruolo
          </Button>
        }
      />
      <AccountProfileCard profile={currentProfile} />

      {/* Card ruoli */}
      <div className="grid gap-4 md:grid-cols-3">
        {ruoli.map((r) => {
          const isActive = activeId === r.id
          const isCurrentRole = currentProfile?.ruoloId === r.id
          return (
            <div
              key={r.id}
              className={cn(
                "group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-all hover:-translate-y-px hover:border-foreground/25 hover:shadow-sm focus-within:ring-2 focus-within:ring-teal/30",
                isActive
                  ? "border-teal ring-1 ring-teal/30"
                  : isCurrentRole
                    ? "border-navy/40"
                    : "border-border",
              )}
            >
              <button
                type="button"
                className="absolute inset-0 rounded-xl"
                aria-label={`${isActive ? "Chiudi configurazione" : "Configura"} ruolo ${r.nome}`}
                aria-pressed={isActive}
                onClick={() => openConfig(r)}
              >
                <span className="sr-only">
                  {isActive ? "Chiudi" : "Configura"} {r.nome}
                </span>
              </button>
              <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
                      RUOLO_COLOR_CLASS[r.colore],
                    )}
                  >
                    {r.nome}
                  </span>
                  {isCurrentRole ? (
                    <Badge variant="outline" className="shrink-0 gap-1 text-[11px]">
                      <Check className="size-3" />
                      Il tuo ruolo
                    </Badge>
                  ) : null}
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {r.utenti} utenti
                </span>
              </div>
              <p className="pointer-events-none relative z-10 text-sm leading-relaxed text-muted-foreground">
                {r.descrizione}
              </p>
              <div className="pointer-events-none relative z-10 flex flex-wrap gap-1.5">
                {permessiHighlights(r.permessi).map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <span
                className={cn(
                  "pointer-events-none relative z-10 mt-1 inline-flex h-9 w-full items-center justify-center rounded-md border text-sm font-medium transition-colors",
                  isActive
                    ? "border-transparent bg-secondary text-secondary-foreground"
                    : "border-input bg-background group-hover:bg-accent group-hover:text-accent-foreground",
                )}
              >
                {isActive ? "Chiudi" : "Configura"}
              </span>
            </div>
          )
        })}
      </div>

      {/* Pannello configurazione permessi */}
      {active && draft ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Configura permessi · {active.nome}
            </h3>
          </div>

          <Accordion defaultValue={["pagine"]} className="border-t border-border">
            {/* 1. Pagine visibili */}
            <AccordionItem value="pagine">
              <AccordionTrigger>Pagine visibili</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PAGINE.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate text-foreground">{p.label}</span>
                      <Switch
                        checked={draft.pagine[p.id]}
                        onCheckedChange={() => togglePagina(p.id)}
                      />
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Permessi sui record */}
            <AccordionItem value="record">
              <AccordionTrigger>Permessi sui record</AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4">
                  {MODULI_RECORD.map((m) => (
                    <div key={m.id} className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-foreground">{m.label}</span>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {RECORD_PERMESSI.map((perm) => (
                          <label key={perm.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={draft.record[m.id].includes(perm.id)}
                              onCheckedChange={() => toggleRecord(m.id, perm.id)}
                            />
                            <span className="text-foreground">{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Visibilità sedi */}
            <AccordionItem value="sedi">
              <AccordionTrigger>Visibilità sedi</AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3">
                  {(
                    [
                      ["all", "Tutte le sedi"],
                      ["own", "Solo sede assegnata all'utente"],
                    ] as [VisibilitaScope, string][]
                  ).map(([val, label]) => (
                    <RadioRow
                      key={val}
                      label={label}
                      checked={draft.visibilita_sedi === val}
                      onSelect={() => setDraft({ ...draft, visibilita_sedi: val })}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Cartelle Nextcloud */}
            <AccordionItem value="nextcloud">
              <AccordionTrigger>Cartelle Nextcloud</AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-3">
                  {(
                    [
                      ["all", "Tutte le cartelle"],
                      ["own", "Solo cartelle della propria sede"],
                    ] as [VisibilitaScope, string][]
                  ).map(([val, label]) => (
                    <RadioRow
                      key={val}
                      label={label}
                      checked={draft.cartelle_nextcloud === val}
                      onSelect={() => setDraft({ ...draft, cartelle_nextcloud: val })}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 5. Riconfigurazioni CRM */}
            <AccordionItem value="riconfig">
              <AccordionTrigger>Riconfigurazioni CRM</AccordionTrigger>
              <AccordionContent>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
                  <span className="text-foreground">
                    Può modificare CRM Settings, Page Settings e valori configurabili
                  </span>
                  <Switch
                    checked={draft.riconfigurazioni}
                    onCheckedChange={(v) =>
                      setDraft({ ...draft, riconfigurazioni: v === true })
                    }
                  />
                </label>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Salvataggio…" : "Salva modifiche"}
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setActiveId(null)
                setDraft(null)
                setError(null)
              }}
            >
              Annulla
            </Button>
            <Button
              variant="outline"
              className="ml-auto"
              disabled={saving}
              onClick={openDuplicateRole}
            >
              Duplica ruolo
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-teal" />
              Nuovo ruolo
            </DialogTitle>
            <DialogDescription>
              Crea un profilo operativo completo: identità, preset, scope dati
              e azioni avanzate.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 gap-5 overflow-y-auto py-2 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="flex flex-col gap-5">
              <section className="rounded-lg border border-border p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="size-4 text-teal" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Identità ruolo
                  </h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="role-name">Nome ruolo</Label>
                    <Input
                      id="role-name"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="Es. Back office"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Colore badge</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {ROLE_COLORS.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => setRoleColor(color.id)}
                          className={cn(
                            "flex h-10 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                            roleColor === color.id
                              ? "border-teal ring-1 ring-teal/30"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5",
                              RUOLO_COLOR_CLASS[color.id],
                            )}
                          >
                            {color.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="role-description">Descrizione</Label>
                    <Input
                      id="role-description"
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                      placeholder="Sintesi operativa del ruolo"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-border p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Copy className="size-4 text-teal" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Preset di partenza
                  </h4>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TEMPLATE_OPTIONS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template.id)}
                      className={cn(
                        "flex min-h-24 flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                        roleTemplate === template.id
                          ? "border-teal bg-teal/5 ring-1 ring-teal/20"
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {roleTemplate === template.id ? (
                          <Check className="size-4 text-teal" />
                        ) : null}
                        {template.label}
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {template.description}
                      </span>
                    </button>
                  ))}
                </div>
                {roleTemplate === "copy" ? (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <Label>Ruolo sorgente</Label>
                    <Select
                      value={copyFromRoleId}
                      onValueChange={(value) => {
                        const source = ruoli.find((r) => r.id === value)
                        if (!source) return
                        setCopyFromRoleId(source.id)
                        setRoleColor(source.colore)
                        setRolePermessi(templatePermessi("copy", source))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona ruolo da copiare" />
                      </SelectTrigger>
                      <SelectContent>
                        {ruoli.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </section>
            </div>

            <aside className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Anteprima permessi
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Il ruolo verrà creato con questa matrice iniziale. Dopo la
                  creazione si apre subito il pannello completo per rifinire.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-background p-3">
                  <span className="text-lg font-semibold text-foreground">
                    {countEnabledPages(rolePermessi)}
                  </span>
                  <p className="text-xs text-muted-foreground">pagine</p>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <span className="text-lg font-semibold text-foreground">
                    {countEnabledRecordActions(rolePermessi)}
                  </span>
                  <p className="text-xs text-muted-foreground">record</p>
                </div>
                <div className="rounded-lg bg-background p-3">
                  <span className="text-lg font-semibold text-foreground">
                    {countEnabledActions(rolePermessi)}
                  </span>
                  <p className="text-xs text-muted-foreground">azioni</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  Highlights
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {permessiHighlights(rolePermessi).map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                  {Object.entries(rolePermessi.azioni ?? {})
                    .filter(([, enabled]) => enabled)
                    .slice(0, 5)
                    .map(([key]) => (
                      <Badge key={key} className="bg-teal/15 text-teal">
                        {ACTION_LABELS[key] ?? key}
                      </Badge>
                    ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  Scope dati
                </span>
                {MODULE_KEYS.slice(0, 4).map((moduleKey) => (
                  <div
                    key={moduleKey}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="capitalize text-foreground">{moduleKey}</span>
                    <Badge variant="outline">
                      {rolePermessi.scope_dati?.[moduleKey] ?? "none"}
                    </Badge>
                  </div>
                ))}
              </div>
            </aside>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={creatingRole}
            >
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={createRole}
              disabled={creatingRole || !roleName.trim()}
            >
              {creatingRole ? "Creazione..." : "Crea ruolo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
