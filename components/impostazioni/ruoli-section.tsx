"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Plus,
  ChevronLeft,
  ChevronDown,
  Users,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import {
  mockRuoli,
  PAGINE,
  MODULI_RECORD,
  RECORD_PERMESSI,
  RUOLO_COLOR_CLASS,
  permessiHighlights,
  type Ruolo,
  type RuoloPermessi,
  type PaginaId,
  type ModuloRecordId,
  type RecordPermesso,
  type VisibilitaScope,
} from "@/lib/ruoli-data"

/** Badge colorato con il numero di utenti del ruolo. */
function RuoloBadge({ ruolo }: { ruolo: Ruolo }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        RUOLO_COLOR_CLASS[ruolo.colore],
      )}
    >
      {ruolo.nome}
    </span>
  )
}

/** Card di anteprima di un ruolo nella lista. */
function RuoloCard({
  ruolo,
  onConfigure,
}: {
  ruolo: Ruolo
  onConfigure: (r: Ruolo) => void
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">
            {ruolo.nome}
          </h3>
          <RuoloBadge ruolo={ruolo} />
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {ruolo.utenti} {ruolo.utenti === 1 ? "utente" : "utenti"}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {ruolo.descrizione}
      </p>

      <div className="flex flex-wrap gap-2">
        {permessiHighlights(ruolo.permessi).map((p) => (
          <span
            key={p}
            className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-foreground"
          >
            {p}
          </span>
        ))}
      </div>

      <div>
        <Button variant="outline" onClick={() => onConfigure(ruolo)}>
          Configura permessi
        </Button>
      </div>
    </Card>
  )
}

/** Sezione collassabile del pannello dettaglio. */
function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-4">{children}</div>
      ) : null}
    </Card>
  )
}

/** Radio singolo controllato (non esiste un componente RadioGroup nel progetto). */
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
      onClick={onSelect}
      className="flex items-center gap-2.5 text-left"
      role="radio"
      aria-checked={checked}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? "border-primary" : "border-input",
        )}
      >
        {checked ? (
          <span className="size-2 rounded-full bg-primary" />
        ) : null}
      </span>
      <span className="text-sm text-foreground">{label}</span>
    </button>
  )
}

/** Pannello dettaglio per la configurazione dei permessi di un ruolo. */
function RuoloDetail({
  ruolo,
  onBack,
}: {
  ruolo: Ruolo
  onBack: () => void
}) {
  const [permessi, setPermessi] = useState<RuoloPermessi>(() => ({
    pagine: { ...ruolo.permessi.pagine },
    record: {
      lead: [...ruolo.permessi.record.lead],
      clienti: [...ruolo.permessi.record.clienti],
      compiti: [...ruolo.permessi.record.compiti],
      scadenze: [...ruolo.permessi.record.scadenze],
    },
    visibilita_sedi: ruolo.permessi.visibilita_sedi,
    riconfigurazioni: ruolo.permessi.riconfigurazioni,
  }))

  function togglePagina(id: PaginaId) {
    setPermessi((p) => ({
      ...p,
      pagine: { ...p.pagine, [id]: !p.pagine[id] },
    }))
  }

  function toggleRecord(modulo: ModuloRecordId, perm: RecordPermesso) {
    setPermessi((p) => {
      const current = p.record[modulo]
      const next = current.includes(perm)
        ? current.filter((x) => x !== perm)
        : [...current, perm]
      return { ...p, record: { ...p.record, [modulo]: next } }
    })
  }

  function setVisibilita(key: "visibilita_sedi", value: VisibilitaScope) {
    setPermessi((p) => ({ ...p, [key]: value }))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Torna ai ruoli
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Permessi · {ruolo.nome}
          </h2>
          <RuoloBadge ruolo={ruolo} />
        </div>
        <p className="text-sm text-muted-foreground">{ruolo.descrizione}</p>
      </div>

      {/* 1. Pagine visibili */}
      <CollapsibleSection title="Pagine visibili">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PAGINE.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground">{p.label}</span>
              <Switch
                checked={permessi.pagine[p.id]}
                onCheckedChange={() => togglePagina(p.id)}
                aria-label={`Pagina ${p.label} visibile`}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* 2. Permessi sui record */}
      <CollapsibleSection title="Permessi sui record">
        <div className="flex flex-col gap-4">
          {MODULI_RECORD.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">{m.label}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {RECORD_PERMESSI.map((perm) => {
                  const checked = permessi.record[m.id].includes(perm.id)
                  return (
                    <label
                      key={perm.id}
                      className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleRecord(m.id, perm.id)}
                      />
                      {perm.label}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* 3. Visibilità sedi */}
      <CollapsibleSection title="Visibilità sedi">
        <div className="flex flex-col gap-3">
          <RadioRow
            checked={permessi.visibilita_sedi === "all"}
            onSelect={() => setVisibilita("visibilita_sedi", "all")}
            label="Tutte le sedi"
          />
          <RadioRow
            checked={permessi.visibilita_sedi === "own"}
            onSelect={() => setVisibilita("visibilita_sedi", "own")}
            label="Solo sede assegnata all'utente"
          />
        </div>
      </CollapsibleSection>

      {/* 4. Riconfigurazioni CRM */}
      <CollapsibleSection title="Riconfigurazioni CRM">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <Label className="text-sm leading-relaxed text-foreground">
            Può modificare impostazioni CRM, Page Settings e valori
            configurabili
          </Label>
          <Switch
            checked={permessi.riconfigurazioni}
            onCheckedChange={(v) =>
              setPermessi((p) => ({ ...p, riconfigurazioni: v }))
            }
            aria-label="Permesso di riconfigurazione CRM"
          />
        </div>
      </CollapsibleSection>

      {/* Azioni */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          Annulla
        </Button>
        <Button
          onClick={() => {
            toast.success(`Permessi del ruolo ${ruolo.nome} salvati`)
            onBack()
          }}
          className="bg-teal text-teal-foreground hover:bg-teal/90"
        >
          <Check className="size-4" />
          Salva modifiche
        </Button>
      </div>
    </div>
  )
}

export function RuoliSection() {
  const [selected, setSelected] = useState<Ruolo | null>(null)

  if (selected) {
    return <RuoloDetail ruolo={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Ruoli e permessi"
        description="Definisci cosa può vedere e fare ciascun ruolo all'interno del CRM."
        action={
          <Button
            onClick={() => toast.info("Creazione nuovo ruolo in arrivo")}
            className="bg-teal text-teal-foreground hover:bg-teal/90"
          >
            <Plus className="size-4" />
            Nuovo ruolo
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        {mockRuoli.map((r) => (
          <RuoloCard key={r.id} ruolo={r} onConfigure={setSelected} />
        ))}
      </div>
    </div>
  )
}
