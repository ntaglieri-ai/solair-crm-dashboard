"use client"

import { useState } from "react"
import { Plus, Users } from "lucide-react"
import {
  permessiHighlights,
  RUOLO_COLOR_CLASS,
  PAGINE,
  MODULI_RECORD,
  RECORD_PERMESSI,
  type Ruolo,
  type RuoloPermessi,
  type PaginaId,
  type ModuloRecordId,
  type RecordPermesso,
  type VisibilitaScope,
} from "@/lib/ruoli-data"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export function PermissionManagementClient({
  ruoli: initialRuoli,
}: {
  ruoli: Ruolo[]
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
  const [rolePermessi, setRolePermessi] = useState<RuoloPermessi>(() =>
    emptyPermessi(),
  )
  const [creatingRole, setCreatingRole] = useState(false)

  const active = ruoli.find((r) => r.id === activeId) ?? null

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
    setRolePermessi(emptyPermessi())
    setRoleDialogOpen(true)
  }

  function openDuplicateRole() {
    if (!active) return
    setError(null)
    setRoleName(`Copia di ${active.nome}`)
    setRoleDescription(active.descrizione)
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
          colore: "gray",
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

      {/* Card ruoli */}
      <div className="grid gap-4 md:grid-cols-3">
        {ruoli.map((r) => {
          const isActive = activeId === r.id
          return (
            <div
              key={r.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors",
                isActive ? "border-teal ring-1 ring-teal/30" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
                    RUOLO_COLOR_CLASS[r.colore],
                  )}
                >
                  {r.nome}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {r.utenti} utenti
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {r.descrizione}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {permessiHighlights(r.permessi).map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <Button
                variant={isActive ? "secondary" : "outline"}
                className="mt-1 w-full"
                onClick={() => openConfig(r)}
              >
                {isActive ? "Chiudi" : "Configura"}
              </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo ruolo</DialogTitle>
            <DialogDescription>
              Crea un ruolo e inizializza la sua matrice permessi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
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
              <Label htmlFor="role-description">Descrizione</Label>
              <Input
                id="role-description"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Sintesi operativa del ruolo"
              />
            </div>
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
