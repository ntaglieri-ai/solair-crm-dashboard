"use client"

import { useState } from "react"
import { Plus, Users } from "lucide-react"
import {
  mockRuoli,
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
import { cn } from "@/lib/utils"
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

export default function PermissionManagementPage() {
  const [ruoli, setRuoli] = useState<Ruolo[]>(mockRuoli)
  const [activeId, setActiveId] = useState<string | null>(null)
  // Bozza di permessi in editing, separata dallo stato salvato.
  const [draft, setDraft] = useState<RuoloPermessi | null>(null)

  const active = ruoli.find((r) => r.id === activeId) ?? null

  function openConfig(r: Ruolo) {
    if (activeId === r.id) {
      setActiveId(null)
      setDraft(null)
      return
    }
    setActiveId(r.id)
    setDraft(structuredClone(r.permessi))
  }

  function save() {
    if (!active || !draft) return
    setRuoli((prev) =>
      prev.map((r) => (r.id === active.id ? { ...r, permessi: draft } : r)),
    )
    setActiveId(null)
    setDraft(null)
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
          <Button className="bg-teal text-teal-foreground hover:bg-teal/90">
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

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button className="bg-teal text-teal-foreground hover:bg-teal/90" onClick={save}>
              Salva modifiche
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setActiveId(null)
                setDraft(null)
              }}
            >
              Annulla
            </Button>
            <Button variant="outline" className="ml-auto">
              Duplica ruolo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
