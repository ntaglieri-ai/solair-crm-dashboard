"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useTags } from "@/lib/tag-store"
import {
  IconChevronDown,
  IconInfoCircle,
  IconMapPin,
  IconFileText,
  IconClipboardCheck,
  IconNote,
  IconPaperclip,
  IconChecklist,
  IconCircleCheck,
  IconMail,
  IconLink,
  IconTimeline,
  IconPlus,
  IconPhone,
  IconDownload,
  IconPhoto,
  IconSend,
  IconX,
  IconPencil,
  IconStar,
  IconTag,
  IconNote as IconNoteEvent,
  IconFilter,
  IconCalendarEvent,
  IconChevronRight,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  type Lead,
  type Compito,
  STATO_LEAD_ORDER,
} from "@/lib/mock-data"
import { LeadAvatar } from "./lead-utils"
import { QuickCompitoDialog } from "@/components/compiti/quick-compito-dialog"

/* ---------- Sezione collassabile ---------- */

function Section({
  id,
  title,
  icon: Icon,
  action,
  defaultOpen = true,
  children,
}: {
  id: string
  title: string
  icon: typeof IconInfoCircle
  action?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className="scroll-mt-24 border-b border-border last:border-b-0">
      <div className="flex items-center justify-between gap-2 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex items-center gap-2 text-[13px] font-bold text-navy"
        >
          <Icon size={16} stroke={1.8} className="text-navy" />
          {title}
          <IconChevronDown
            size={15}
            stroke={2}
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
        </button>
        {action ? <div onClick={(e) => e.stopPropagation()}>{action}</div> : null}
      </div>
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          open
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  return String(v)
}

/* ---------- Campo label/valore ---------- */

function DataField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="text-[13px] text-foreground">{children}</div>
    </div>
  )
}

function CopyField({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof IconMail
}) {
  const copy = () => {
    if (!value || value === "—") return
    navigator.clipboard?.writeText(value)
    toast.success("Copiato!", { description: value, duration: 1800 })
  }
  return (
    <div className="group flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="truncate text-[13px] text-foreground">
          {val(value)}
        </span>
        <button
          type="button"
          aria-label={`Copia ${label}`}
          onClick={copy}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-navy opacity-0 transition-all duration-150 hover:bg-secondary group-hover:opacity-100"
        >
          <Icon size={14} stroke={1.8} />
        </button>
      </div>
    </div>
  )
}

/* ---------- Navigazione correlato ---------- */

const NAV_ITEMS = [
  { id: "section-note", label: "Note" },
  { id: "section-allegati", label: "Allegati" },
  { id: "section-attivita-aperte", label: "Attività aperte" },
  { id: "section-attivita-chiuse", label: "Attività chiuse" },
  { id: "section-email", label: "E-mail" },
  { id: "section-record", label: "Record collegati" },
] as const

function RelatedNav({ counts }: { counts: Record<string, number> }) {
  const go = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-3">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => go(item.id)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {item.label}
          {counts[item.id] ? (
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {counts[item.id]}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  )
}

/* ---------- Tipi locali (mock) ---------- */

interface Nota {
  id: string
  autore: string
  quando: string
  testo: string
}

interface Task {
  id: string
  oggetto: string
  scadenza: string
  priorita: "Alta" | "Media" | "Bassa"
  assegnato: string
  completato: boolean
}

interface EmailItem {
  id: string
  oggetto: string
  data: string
  stato: "Aperta" | "Recapitata" | "Non recapitata"
  aperture: number
}

const PRIORITY_TONE: Record<string, string> = {
  Alta: "bg-destructive/10 text-destructive",
  Media: "bg-warning/10 text-warning",
  Bassa: "bg-muted text-muted-foreground",
}

const EMAIL_STATO_TONE: Record<string, string> = {
  Aperta: "bg-success/10 text-success",
  Recapitata: "bg-info/10 text-info",
  "Non recapitata": "bg-destructive/10 text-destructive",
}

/* ---------- Sezione Informazioni principali ---------- */

function InfoPrincipali({ lead }: { lead: Lead }) {
  const [stato, setStato] = useState(lead["Stato Lead"])
  const [savingStato, setSavingStato] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const statoItems = Object.fromEntries(STATO_LEAD_ORDER.map((s) => [s, s]))

  async function handleStatoChange(v: string | null) {
    if (v === null) return
    const prev = stato
    setStato(v as Lead["Stato Lead"])
    setSavingStato(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "Stato Lead": v }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      toast.success("Stato aggiornato", { description: v })
    } catch {
      setStato(prev)
      toast.error("Errore nell'aggiornamento dello stato")
    } finally {
      setSavingStato(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {/* Colonna sinistra */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <DataField label="Nome">{val(lead.Nome)}</DataField>
            <DataField label="Cognome">{val(lead.Cognome)}</DataField>
          </div>
          <CopyField label="E-mail" value={lead["E-mail"]} icon={IconMail} />
          <CopyField label="Telefono" value={lead.Telefono} icon={IconPhone} />
          <DataField label="Mobile / Fisso">
            {val(lead["Mobile/Fisso"])}
          </DataField>
          <DataField label="Stato Lead">
            <Select
              items={statoItems}
              value={stato}
              onValueChange={handleStatoChange}
              disabled={savingStato}
            >
              <SelectTrigger className="h-8 w-full bg-card text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STATO_LEAD_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </DataField>
        </div>

        {/* Colonna destra */}
        <div className="flex flex-col gap-4">
          <DataField label="campaign name">
            <span className="break-words">{val(lead["campaign name"])}</span>
          </DataField>
          <DataField label="Configurazione">
            <div className="flex flex-wrap gap-1.5">
              <Badge className="rounded-md bg-teal/10 px-2 py-0.5 text-[11px] font-medium text-teal">
                {lead.kWp} kWp
              </Badge>
              <Badge className="rounded-md bg-teal/10 px-2 py-0.5 text-[11px] font-medium text-teal">
                {lead.kWh} kWh
              </Badge>
              {lead["Modello pannello"] ? (
                <Badge className="rounded-md bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy">
                  {lead["Modello pannello"]}
                </Badge>
              ) : null}
            </div>
          </DataField>
          <DataField label="Data Click">{val(lead["Data Click"])}</DataField>
          {lead["Social Lead ID"] ? (
            <DataField label="Social Lead ID">
              {val(lead["Social Lead ID"])}
            </DataField>
          ) : null}
          <DataField label="Residente in Sicilia">
            {lead["Residente in Sicilia"] ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                Sì
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                No
              </span>
            )}
          </DataField>
        </div>
      </div>

      {/* Campi extra */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
        >
          <IconChevronRight
            size={14}
            stroke={2}
            className={cn("transition-transform", showMore && "rotate-90")}
          />
          {showMore ? "Nascondi campi" : "Mostra altri campi"}
        </button>
        {showMore ? (
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 animate-in fade-in duration-200">
            <DataField label="Stato email">{val(lead.Stato)}</DataField>
            <DataField label="Tempo conversione">
              {val(lead["Tempo di conversione Lead"])}
            </DataField>
            <DataField label="Connesso a">{val(lead["Connesso a"])}</DataField>
            <DataField label="Ora ultima attività">
              {val(lead["Ora ultima attività"])}
            </DataField>
            <DataField label="Account convertito">
              {val(lead["Account convertito"])}
            </DataField>
            <DataField label="Contatto convertito">
              {val(lead["Contatto convertito"])}
            </DataField>
            <DataField label="Modalità iscrizione annullata">
              {val(lead["Modalità iscrizione annullata"])}
            </DataField>
            <DataField label="Creato da">{val(lead["Creato da"])}</DataField>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ---------- Sezione Indirizzo ---------- */

function Indirizzo({ lead }: { lead: Lead }) {
  const [mapOpen, setMapOpen] = useState(false)
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-foreground">
        <span>{val(lead.Paese)}</span>
        <span className="text-border">·</span>
        <span>{val(lead["Città"])}</span>
        <span className="text-border">·</span>
        <span>{val(lead.Provincia)}</span>
        <span className="text-border">·</span>
        <span>{val(lead["Codice postale"])}</span>
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
        >
          <IconMapPin size={14} stroke={1.8} />
          Mostra su mappa
        </button>
      </div>
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Posizione lead</DialogTitle>
            <DialogDescription>
              {[lead["Città"], lead.Provincia, lead.Paese]
                .filter(Boolean)
                .join(", ")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-secondary/40">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <IconMapPin size={40} stroke={1.5} className="text-teal" />
              <span className="text-sm">
                {val(lead["Codice postale"])} {val(lead["Città"])} (
                {val(lead.Provincia)})
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ---------- Sezione Descrizione (edit inline) ---------- */

function Descrizione({ lead }: { lead: Lead }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(lead.Descrizione)
  const [draft, setDraft] = useState(lead.Descrizione)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Descrizione: draft }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      setText(draft)
      setEditing(false)
      toast.success("Descrizione aggiornata")
    } catch {
      toast.error("Errore nel salvataggio della descrizione")
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 animate-in fade-in duration-150">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          autoFocus
          className="bg-card text-[13px]"
        />
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setDraft(text)
              setEditing(false)
            }}
          >
            Annulla
          </Button>
          <Button
            size="sm"
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(text)
        setEditing(true)
      }}
      className="w-full rounded-lg border border-border bg-secondary/40 p-3 text-left text-[13px] leading-relaxed text-foreground transition-colors duration-150 hover:bg-secondary"
    >
      {text && text !== "" ? (
        text
      ) : (
        <span className="text-muted-foreground">
          Nessuna descrizione. Clicca per aggiungere…
        </span>
      )}
    </button>
  )
}

/* ---------- Sezione Sopralluogo ---------- */

function Sopralluogo({ lead }: { lead: Lead }) {
  const { installers } = useTags()
  const [data, setData] = useState(lead["Data sopralluogo"] ?? "")
  const [installatore, setInstallatore] = useState(
    lead["Installatore - Incaricato sopralluogo"] ?? "",
  )
  const items = Object.fromEntries(
    installers.map((installer) => [installer.id, installer.nome]),
  )
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Data sopralluogo
        </span>
        <Input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="h-9 bg-card text-[13px]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Installatore incaricato
        </span>
        <Select
          items={items}
          value={installatore || undefined}
          onValueChange={(next) => setInstallatore(next ?? "")}
        >
          <SelectTrigger className="h-9 w-full bg-card text-[13px]">
            <SelectValue placeholder="Seleziona installatore" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {installers.map((installer) => (
                <SelectItem key={installer.id} value={installer.id}>
                  {installer.nome}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

/* ---------- Sezione Note ---------- */

function NoteSection({ lead }: { lead: Lead }) {
  const [note, setNote] = useState<Nota[]>(
    () => (lead.attivita ?? [])
      .filter((item) => item.tipo === "nota")
      .map((item) => ({
        id: item.id,
        autore: item.autore ?? "Utente CRM",
        quando: item.timestamp
          ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" })
              .format(new Date(item.timestamp))
          : "",
        testo: item.descrizione,
      })),
  )
  const [nuova, setNuova] = useState("")

  const aggiungi = async () => {
    if (nuova.trim() === "") return
    const response = await fetch(`/api/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: nuova }),
    })
    if (!response.ok) {
      toast.error("Creazione nota non riuscita")
      return
    }
    const created = (await response.json()) as { id: string; testo: string; created_at: string }
    setNote((prev) => [{
      id: created.id,
      autore: lead["Lead Proprietario"],
      quando: "adesso",
      testo: created.testo,
    }, ...prev])
    setNuova("")
    toast.success("Nota aggiunta")
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {note.map((n) => (
          <li key={n.id} className="group flex gap-3">
            <LeadAvatar nome={n.autore} className="size-8 text-[11px]" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-foreground">
                  {n.autore}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {n.quando}
                </span>
                <button
                  type="button"
                  className="ml-auto text-[11px] font-medium text-teal opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                >
                  Modifica
                </button>
              </div>
              <p className="text-[13px] text-foreground">{n.testo}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
        <Textarea
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          rows={2}
          placeholder="Aggiungi nota…"
          className="bg-card text-[13px]"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={nuova.trim() === ""}
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={aggiungi}
          >
            Salva
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Sezione Allegati ---------- */

function Allegati({ lead }: { lead: Lead }) {
  const docs = lead.documenti ?? []
  if (docs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-secondary/30 py-6 text-center text-sm text-muted-foreground">
        Nessun allegato
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {docs.map((doc) => {
        const Icon = doc.formato === "jpg" || doc.formato === "png" ? IconPhoto : IconFileText
        return (
          <li
            key={doc.id}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-navy">
              <Icon size={18} stroke={1.8} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium text-foreground">
                {doc.nome}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {doc.dimensione} · {doc.dataUpload}
              </span>
            </div>
            <button
              type="button"
              aria-label="Scarica"
              className="flex size-7 items-center justify-center rounded-md text-navy opacity-0 transition-all hover:bg-secondary group-hover:opacity-100"
            >
              <IconDownload size={16} stroke={1.8} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- Sezioni Attività (aperte / chiuse) ---------- */

function TaskRow({
  task,
  onToggle,
  readOnly = false,
}: {
  task: Task
  onToggle?: () => void
  readOnly?: boolean
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
        readOnly && "opacity-60",
      )}
    >
      <Checkbox
        checked={task.completato}
        onCheckedChange={onToggle}
        disabled={readOnly}
        aria-label="Segna completato"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "text-[13px] font-medium text-foreground",
            task.completato && "line-through",
          )}
        >
          {task.oggetto}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <IconCalendarEvent size={13} stroke={1.8} />
            {task.scadenza}
          </span>
          <span className="text-border">·</span>
          {task.assegnato}
        </span>
      </div>
      {!readOnly ? (
        <Badge
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            PRIORITY_TONE[task.priorita],
          )}
        >
          {task.priorita}
        </Badge>
      ) : null}
    </li>
  )
}

function taskFromLeadTask(task: NonNullable<Lead["compiti"]>[number]): Task {
  return {
    ...task,
    priorita: task.priorita === "Alto" ? "Alta" : task.priorita === "Basso" ? "Bassa" : "Media",
  } as Task
}

function AttivitaAperte({
  tasks,
  onToggle,
}: {
  tasks: Task[]
  onToggle: (id: string) => void
}) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.length === 0 ? (
        <li className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Nessuna attività aperta.
        </li>
      ) : null}
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} onToggle={() => onToggle(t.id)} />
      ))}
    </ul>
  )
}

function AttivitaChiuse({ lead }: { lead: Lead }) {
  const tasks: Task[] = (lead.compiti ?? [])
    .filter((task) => task.completato)
    .map((task) => ({
      ...task,
      priorita: task.priorita === "Alto" ? "Alta" : task.priorita === "Basso" ? "Bassa" : "Media",
    } as Task))
  return (
    <ul className="flex flex-col gap-2">
      {tasks.length === 0 ? (
        <li className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Nessuna attività chiusa.
        </li>
      ) : null}
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} readOnly />
      ))}
    </ul>
  )
}

/* ---------- Sezione E-mail ---------- */

function EmailSection({ lead }: { lead: Lead }) {
  const [compose, setCompose] = useState(false)
  const emails: EmailItem[] = [
    {
      id: "e1",
      oggetto: "Preventivo impianto 9+21,2 kWp",
      data: "12 Giu",
      stato: "Aperta",
      aperture: lead.emailAperture || 2,
    },
  ]
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {emails.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <IconMail size={16} stroke={1.8} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium text-foreground">
                {e.oggetto}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {e.data} · Aperta {e.aperture} volte
              </span>
            </div>
            <Badge
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                EMAIL_STATO_TONE[e.stato],
              )}
            >
              {e.stato}
            </Badge>
          </li>
        ))}
      </ul>
      {compose ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Nuova email
            </span>
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => setCompose(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <IconX size={15} stroke={1.8} />
            </button>
          </div>
          <Input placeholder="Oggetto" className="h-8 bg-card text-[13px]" />
          <Textarea
            rows={3}
            placeholder="Scrivi il messaggio…"
            className="bg-card text-[13px]"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => {
                setCompose(false)
                toast.success("Email inviata", {
                  description: lead["E-mail"],
                })
              }}
            >
              <IconSend size={15} stroke={1.8} data-icon="inline-start" />
              Invia
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ---------- Sezione Record collegati ---------- */

function RecordCollegati({ lead }: { lead: Lead }) {
  const account = lead["Account convertito"]
  if (account) {
    return (
      <Link
        href="#"
        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
          <IconLink size={18} stroke={1.8} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] text-muted-foreground">Cliente</span>
          <span className="truncate text-[13px] font-medium text-foreground">
            {account}
          </span>
        </div>
      </Link>
    )
  }
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-3">
      <span className="text-sm text-muted-foreground">
        Nessun record collegato
      </span>
      <Button size="sm" variant="outline" className="bg-card">
        <IconPlus size={15} stroke={1.8} data-icon="inline-start" />
        Aggiungi nuovo
      </Button>
    </div>
  )
}

/* ---------- Sezione Sequenza temporale ---------- */

interface TimelineEvent {
  id: string
  tipo: "nota" | "tag" | "modifica" | "creato"
  testo: string
  bullets?: string[]
  autore: string
  ora: string
}

const TL_ICON = {
  nota: IconNoteEvent,
  tag: IconTag,
  modifica: IconPencil,
  creato: IconStar,
} as const

const TL_TONE = {
  nota: "bg-navy/10 text-navy",
  tag: "bg-warning/10 text-warning",
  modifica: "bg-muted text-muted-foreground",
  creato: "bg-teal/10 text-teal",
} as const

function SequenzaTemporale({ lead }: { lead: Lead }) {
  const [tab, setTab] = useState<"cronologia" | "interazioni">("cronologia")
  const { tagEvents } = useTags()
  const liveTagEvents = tagEvents[lead.id] ?? []

  const baseGiorni: { data: string; eventi: TimelineEvent[] }[] = [
    {
      data: "16/06/2026",
      eventi: [
        {
          id: "t1",
          tipo: "nota",
          testo: "Nota aggiunta — preventivo 9 + 20 eps",
          autore: "Ivan Lo Faro",
          ora: "01:02",
        },
        {
          id: "t2",
          tipo: "tag",
          testo: "Tag aggiunti — Inviare preventivo, Richiamare",
          autore: "Ivan Lo Faro",
          ora: "01:01",
        },
        {
          id: "t3",
          tipo: "modifica",
          testo:
            "Lead Proprietario aggiornata da Utenza di servizio a Commerciale",
          autore: "Matteo Saverino",
          ora: "09:13",
        },
      ],
    },
    {
      data: "15/06/2026",
      eventi: [
        {
          id: "t4",
          tipo: "modifica",
          testo: "5 campi aggiornati",
          bullets: [
            "Stato Lead → Contattato",
            "Telefono aggiunto",
            "campaign name aggiornato",
            "kWp → " + lead.kWp,
            "Origine Lead → " + lead["Origine Lead"],
          ],
          autore: "Utenza di servizio",
          ora: "07:44",
        },
        {
          id: "t5",
          tipo: "creato",
          testo: "Lead Creato",
          autore: "Utenza di servizio",
          ora: "07:28",
        },
      ],
    },
  ]

  const giorni: { data: string; eventi: TimelineEvent[] }[] =
    liveTagEvents.length
      ? [
          {
            data: "Oggi",
            eventi: liveTagEvents.map((ev) => ({
              id: ev.id,
              tipo: "tag" as const,
              testo: ev.testo,
              autore: ev.autore,
              ora: ev.ora,
            })),
          },
          ...baseGiorni,
        ]
      : baseGiorni

  return (
    <div className="flex flex-col gap-4">
      {/* sub-tab + filtro */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          {(["cronologia", "interazioni"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "bg-navy text-navy-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Filtra"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <IconFilter size={16} stroke={1.8} />
          </button>
          <button
            type="button"
            className="text-xs font-medium text-teal hover:underline"
          >
            Mostra azioni automatizzate imminenti
          </button>
        </div>
      </div>

      {tab === "cronologia" ? (
        <div className="flex flex-col gap-4">
          {giorni.map((g) => (
            <div key={g.data} className="flex flex-col gap-3">
              <div className="flex items-center justify-center">
                <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {g.data}
                </span>
              </div>
              <ul className="flex flex-col">
                {g.eventi.map((ev, i) => {
                  const Icon = TL_ICON[ev.tipo]
                  const isLast = i === g.eventi.length - 1
                  return (
                    <li key={ev.id} className="flex gap-3">
                      <div className="flex w-10 shrink-0 justify-end pt-1.5">
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {ev.ora}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full",
                            TL_TONE[ev.tipo],
                          )}
                        >
                          <Icon size={14} stroke={1.8} />
                        </span>
                        {!isLast ? (
                          <span className="w-px flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="flex flex-col pb-5">
                        <span className="text-[13px] text-foreground">
                          {ev.testo}
                        </span>
                        {ev.bullets ? (
                          <ul className="mt-1 flex flex-col gap-0.5 border-l border-border pl-3">
                            {ev.bullets.map((b) => (
                              <li
                                key={b}
                                className="text-[12px] text-muted-foreground"
                              >
                                {b}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <span className="text-[11px] text-muted-foreground">
                          {ev.autore}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nessuna interazione registrata.
        </p>
      )}
    </div>
  )
}

/* ---------- Componente principale ---------- */

export function LeadDetailContent({ lead }: { lead: Lead }) {
  const [openTasks, setOpenTasks] = useState<Task[]>(() =>
    (lead.compiti ?? []).filter((task) => !task.completato).map(taskFromLeadTask),
  )
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  // Il pulsante "Aggiungi compito" nel pannello laterale (sopra la mappa)
  // scrolla qui E manda questo evento, per aprire il dialog direttamente
  // invece di lasciare l'utente a dover ricliccare il bottone "Compito"
  // qui sotto — i due componenti non condividono props.
  useEffect(() => {
    function handleOpenTaskDialog() {
      setTaskDialogOpen(true)
    }
    window.addEventListener("solair:open-task-dialog", handleOpenTaskDialog)
    return () => {
      window.removeEventListener("solair:open-task-dialog", handleOpenTaskDialog)
    }
  }, [])

  const toggleOpenTask = (id: string) =>
    setOpenTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completato: !t.completato } : t)),
    )

  const handleTaskCreated = (compito: Compito) => {
    setOpenTasks((prev) => [
      {
        id: compito.id,
        oggetto: compito.Oggetto,
        scadenza: compito["Data di scadenza"],
        priorita:
          compito.Priorità === "Alto"
            ? "Alta"
            : compito.Priorità === "Basso"
              ? "Bassa"
              : "Media",
        assegnato: compito["Proprietario del compito"],
        completato: false,
      },
      ...prev,
    ])
  }

  const counts: Record<string, number> = {
    "section-note": 1,
    "section-allegati": lead.documenti?.length ?? 0,
    "section-attivita-aperte": openTasks.length,
    "section-attivita-chiuse": 1,
    "section-email": 1,
    "section-record": lead["Account convertito"] ? 1 : 0,
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <RelatedNav counts={counts} />

      <Section id="section-info" title="Informazioni principali" icon={IconInfoCircle}>
        <InfoPrincipali lead={lead} />
      </Section>

      <Section id="section-indirizzo" title="Indirizzo" icon={IconMapPin}>
        <Indirizzo lead={lead} />
      </Section>

      <Section id="section-descrizione" title="Descrizione" icon={IconFileText}>
        <Descrizione lead={lead} />
      </Section>

      <Section id="section-sopralluogo" title="Sopralluogo" icon={IconClipboardCheck}>
        <Sopralluogo lead={lead} />
      </Section>

      <Section
        id="section-note"
        title="Note"
        icon={IconNote}
        action={
          <Select items={{ recenti: "Più recenti", vecchie: "Meno recenti" }} defaultValue="recenti">
            <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="recenti">Più recenti</SelectItem>
                <SelectItem value="vecchie">Meno recenti</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      >
        <NoteSection lead={lead} />
      </Section>

      <Section
        id="section-allegati"
        title="Allegati"
        icon={IconPaperclip}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="outline" className="h-7 bg-card text-xs">
                  <IconPaperclip size={14} stroke={1.8} data-icon="inline-start" />
                  Allega
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem>Da computer</DropdownMenuItem>
                <DropdownMenuItem>Da URL</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <Allegati lead={lead} />
      </Section>

      <Section
        id="section-attivita-aperte"
        title="Attività aperte"
        icon={IconChecklist}
        action={
          <Button
            size="sm"
            variant="outline"
            className="h-7 bg-card text-xs"
            onClick={() => setTaskDialogOpen(true)}
          >
            <IconPlus size={14} stroke={1.8} data-icon="inline-start" />
            Compito
          </Button>
        }
      >
        <AttivitaAperte tasks={openTasks} onToggle={toggleOpenTask} />
      </Section>

      <Section
        id="section-attivita-chiuse"
        title="Attività chiuse"
        icon={IconCircleCheck}
        defaultOpen={false}
      >
        <AttivitaChiuse lead={lead} />
      </Section>

      <Section
        id="section-email"
        title="E-mail"
        icon={IconMail}
      >
        <EmailSection lead={lead} />
      </Section>

      <Section id="section-record" title="Record collegati" icon={IconLink}>
        <RecordCollegati lead={lead} />
      </Section>

      <Section id="section-timeline" title="Sequenza temporale" icon={IconTimeline}>
        <SequenzaTemporale lead={lead} />
      </Section>

      <QuickCompitoDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        correlato={{ tipo: "lead", id: lead.id, nome: lead["Nome Lead"] }}
        onCreated={handleTaskCreated}
      />
    </div>
  )
}
