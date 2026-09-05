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
  IconPencil,
  IconStar,
  IconTag,
  IconNote as IconNoteEvent,
  IconFilter,
  IconCalendarEvent,
  IconChevronRight,
} from "@tabler/icons-react"
import { CalendarioRecordSection } from "@/components/calendario/calendario-record-section"
import { Button } from "@/components/ui/button"
import { MentionText, MentionTextarea } from "@/components/shared/note-mentions"
import type { NoteMention, NoteMentionDraft } from "@/lib/notes/mentions"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  InlineEditableField,
  InlineEditableValue,
  type InlineEditableValueProps,
} from "@/components/shared/inline-edit-field"
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
import { cn } from "@/lib/utils"
import {
  type Lead,
  type Compito,
  STATO_LEAD_ORDER,
} from "@/lib/mock-data"
import { option, withCurrentColumnOption } from "@/lib/crm-settings/column-values"
import { useColumnValueOptions } from "@/lib/crm-settings/use-column-values"
import type { EmailLogEntry } from "@/lib/email/email-log"
import { formatEmailLogDate } from "./email-log-format"
import { LeadAvatar } from "./lead-utils"
import { QuickCompitoDialog } from "@/components/compiti/quick-compito-dialog"
import { AllegatiSection } from "@/components/shared/allegati-section"
import { DOCUMENTI_OBBLIGATORI_FOLDER } from "@/lib/allegati/paths"
import { notificaDocumentiObbligatoriCambiati } from "@/lib/allegati/hooks"

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
  edit,
}: {
  label: string
  children: React.ReactNode
  edit?: Omit<InlineEditableValueProps, "label">
}) {
  if (edit) return <InlineEditableField label={label} {...edit} displayValue={edit.displayValue ?? children} />

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="text-[13px] text-foreground">{children}</div>
    </div>
  )
}

/* ---------- Navigazione correlato ---------- */

const NAV_ITEMS = [
  { id: "section-note", label: "Note" },
  { id: "section-documenti-obbligatori", label: "Documenti obbligatori" },
  { id: "section-allegati", label: "Allegati" },
  { id: "section-attivita-aperte", label: "Attività aperte" },
  { id: "section-attivita-chiuse", label: "Attività chiuse" },
  { id: "section-email", label: "E-mail" },
  { id: "section-calendario", label: "Calendario" },
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
  menzioni?: NoteMention[]
}

interface Task {
  id: string
  oggetto: string
  scadenza: string
  priorita: "Alta" | "Media" | "Bassa"
  assegnato: string
  completato: boolean
}

const PRIORITY_TONE: Record<string, string> = {
  Alta: "bg-destructive/10 text-destructive",
  Media: "bg-warning/10 text-warning",
  Bassa: "bg-muted text-muted-foreground",
}

/* ---------- Sezione Informazioni principali ---------- */

function InfoPrincipali({ lead }: { lead: Lead }) {
  const [showMore, setShowMore] = useState(false)
  const endpoint = `/api/leads/${lead.id}`
  const configuredStatoOptions = useColumnValueOptions(
    "Lead",
    "stato_lead",
    STATO_LEAD_ORDER.map((value) => option(value)),
    { includeFallback: true },
  ).options
  const statoOptions = withCurrentColumnOption(configuredStatoOptions, lead["Stato Lead"])
  const statoValues = statoOptions.map((item) => item.value)
  const statoLabels = Object.fromEntries(statoOptions.map((item) => [item.value, item.label]))

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {/* Colonna sinistra */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <DataField label="Nome" edit={{ module: "lead", field: "nome", endpoint, patchKey: "Nome", value: lead.Nome }}>
              {val(lead.Nome)}
            </DataField>
            <DataField label="Cognome" edit={{ module: "lead", field: "cognome", endpoint, patchKey: "Cognome", value: lead.Cognome }}>
              {val(lead.Cognome)}
            </DataField>
          </div>
          <DataField label="E-mail" edit={{ module: "lead", field: "email", endpoint, patchKey: "E-mail", value: lead["E-mail"], type: "email" }}>
            {val(lead["E-mail"])}
          </DataField>
          <DataField label="Telefono" edit={{ module: "lead", field: "telefono", endpoint, patchKey: "Telefono", value: lead.Telefono, type: "tel" }}>
            {val(lead.Telefono)}
          </DataField>
          <DataField label="Mobile / Fisso" edit={{ module: "lead", field: "mobile_fisso", endpoint, patchKey: "Mobile/Fisso", value: lead["Mobile/Fisso"], type: "tel" }}>
            {val(lead["Mobile/Fisso"])}
          </DataField>
          <DataField label="Consenso telefono" edit={{ module: "lead", field: "consenso_contatto_telefono", endpoint, patchKey: "Consenso telefono", value: lead["Consenso telefono"] === true, type: "boolean" }}>
            {lead["Consenso telefono"] ? "Sì" : "No"}
          </DataField>
          <DataField label="Consenso WhatsApp" edit={{ module: "lead", field: "consenso_contatto_whatsapp", endpoint, patchKey: "Consenso WhatsApp", value: lead["Consenso WhatsApp"] === true, type: "boolean" }}>
            {lead["Consenso WhatsApp"] ? "Sì" : "No"}
          </DataField>
          <DataField label="Consenso e-mail" edit={{ module: "lead", field: "consenso_contatto_email", endpoint, patchKey: "Consenso e-mail", value: lead["Consenso e-mail"] === true, type: "boolean" }}>
            {lead["Consenso e-mail"] ? "Sì" : "No"}
          </DataField>
          <DataField label="Stato Lead" edit={{ module: "lead", field: "stato_lead", endpoint, patchKey: "Stato Lead", value: lead["Stato Lead"], type: "select", options: statoValues, optionLabels: statoLabels }}>
            {val(lead["Stato Lead"])}
          </DataField>
        </div>

        {/* Colonna destra */}
        <div className="flex flex-col gap-4">
          <DataField label="campaign name" edit={{ module: "lead", field: "campaign_name", endpoint, patchKey: "campaign name", value: lead["campaign name"] }}>
            <span className="break-words">{val(lead["campaign name"])}</span>
          </DataField>
          <DataField label="kWp" edit={{ module: "lead", field: "kwp", endpoint, patchKey: "kWp", value: lead.kWp, type: "number" }}>
            {val(lead.kWp)}
          </DataField>
          <DataField label="kWh" edit={{ module: "lead", field: "kwh", endpoint, patchKey: "kWh", value: lead.kWh, type: "number" }}>
            {val(lead.kWh)}
          </DataField>
          <DataField label="Modello pannello" edit={{ module: "lead", field: "modello_pannello", endpoint, patchKey: "Modello pannello", value: lead["Modello pannello"] }}>
            {val(lead["Modello pannello"])}
          </DataField>
          <DataField label="Data Click" edit={{ module: "lead", field: "data_click", endpoint, patchKey: "Data Click", value: lead["Data Click"], type: "datetime-local" }}>
            {val(lead["Data Click"])}
          </DataField>
          <DataField label="Social Lead ID" edit={{ module: "lead", field: "social_lead_id", endpoint, patchKey: "Social Lead ID", value: lead["Social Lead ID"] }}>
            {val(lead["Social Lead ID"])}
          </DataField>
          <DataField label="Residente in Sicilia" edit={{ module: "lead", field: "residente_in_sicilia", endpoint, patchKey: "Residente in Sicilia", value: lead["Residente in Sicilia"] === true, type: "boolean" }}>
            {lead["Residente in Sicilia"] ? "Sì" : "No"}
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
            <DataField label="Stato email" edit={{ module: "lead", field: "stato_email", endpoint, patchKey: "Stato", value: lead.Stato }}>
              {val(lead.Stato)}
            </DataField>
            <DataField label="Tempo conversione" edit={{ module: "lead", field: "tempo_conversione_lead", endpoint, patchKey: "Tempo di conversione Lead", value: lead["Tempo di conversione Lead"] }}>
              {val(lead["Tempo di conversione Lead"])}
            </DataField>
            <DataField label="Connesso a" edit={{ module: "lead", field: "connesso_a", endpoint, patchKey: "Connesso a", value: lead["Connesso a"] }}>
              {val(lead["Connesso a"])}
            </DataField>
            <DataField label="Ora ultima attività">
              {val(lead["Ora ultima attività"])}
            </DataField>
            <DataField label="Account convertito" edit={{ module: "lead", field: "account_convertito_id", endpoint, patchKey: "Account convertito", value: lead["Account convertito"] }}>
              {val(lead["Account convertito"])}
            </DataField>
            <DataField label="Contatto convertito" edit={{ module: "lead", field: "contatto_convertito", endpoint, patchKey: "Contatto convertito", value: lead["Contatto convertito"] }}>
              {val(lead["Contatto convertito"])}
            </DataField>
            <DataField label="Modalità iscrizione annullata" edit={{ module: "lead", field: "modalita_iscrizione_annullata", endpoint, patchKey: "Modalità iscrizione annullata", value: lead["Modalità iscrizione annullata"] }}>
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
  const endpoint = `/api/leads/${lead.id}`
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DataField label="Paese" edit={{ module: "lead", field: "paese", endpoint, patchKey: "Paese", value: lead.Paese }}>
          {val(lead.Paese)}
        </DataField>
        <DataField label="Città" edit={{ module: "lead", field: "citta", endpoint, patchKey: "Città", value: lead["Città"] }}>
          {val(lead["Città"])}
        </DataField>
        <DataField label="Provincia" edit={{ module: "lead", field: "provincia", endpoint, patchKey: "Provincia", value: lead.Provincia }}>
          {val(lead.Provincia)}
        </DataField>
        <DataField label="Codice postale" edit={{ module: "lead", field: "codice_postale", endpoint, patchKey: "Codice postale", value: lead["Codice postale"] }}>
          {val(lead["Codice postale"])}
        </DataField>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
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
  return (
    <InlineEditableValue
      module="lead"
      field="descrizione"
      label="Descrizione"
      endpoint={`/api/leads/${lead.id}`}
      patchKey="Descrizione"
      value={lead.Descrizione}
      type="textarea"
      emptyLabel="Nessuna descrizione"
      className="w-full rounded-lg border border-border bg-secondary/40 p-3 text-left text-[13px] leading-relaxed"
      valueClassName="whitespace-pre-wrap"
    />
  )
}

/* ---------- Sezione Sopralluogo ---------- */

function Sopralluogo({ lead }: { lead: Lead }) {
  const { installers } = useTags()
  const installerOptions = installers.map((installer) => installer.id)
  const installerLabels = Object.fromEntries(installers.map((installer) => [installer.id, installer.nome]))
  const currentInstaller = lead.InstallatoreSopralluogoId ?? ""
  if (currentInstaller && !installerOptions.includes(currentInstaller)) {
    installerOptions.push(currentInstaller)
    installerLabels[currentInstaller] =
      lead["Installatore - Incaricato sopralluogo"] ?? "Installatore storico"
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DataField label="Data sopralluogo" edit={{ module: "lead", field: "data_sopralluogo", endpoint: `/api/leads/${lead.id}`, patchKey: "Data sopralluogo", value: lead["Data sopralluogo"], type: "date", emptyLabel: "Nessuno" }}>
        {val(lead["Data sopralluogo"])}
      </DataField>
      <DataField
        label="Installatore incaricato"
        edit={{
          module: "lead",
          field: "installatore_sopralluogo_id",
          endpoint: `/api/leads/${lead.id}`,
          patchKey: "Installatore - Incaricato sopralluogo",
          value: currentInstaller,
          type: "select",
          options: installerOptions,
          optionLabels: installerLabels,
          allowEmptyOption: true,
          emptyLabel: "Nessuno",
          nullWhenEmpty: true,
        }}
      >
        {val(lead["Installatore - Incaricato sopralluogo"])}
      </DataField>
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
        menzioni: item.menzioni,
      })),
  )
  const [nuova, setNuova] = useState("")
  const [menzioni, setMenzioni] = useState<NoteMentionDraft[]>([])

  const aggiungi = async () => {
    if (nuova.trim() === "") return
    const response = await fetch(`/api/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: nuova, mentions: menzioni }),
    })
    if (!response.ok) {
      toast.error("Creazione nota non riuscita")
      return
    }
    const created = (await response.json()) as { id: string; testo: string; created_at: string; autore: string; menzioni?: NoteMention[]; notificationFailures?: number }
    setNote((prev) => [{
      id: created.id,
      autore: created.autore,
      quando: "adesso",
      testo: created.testo,
      menzioni: created.menzioni,
    }, ...prev])
    setNuova("")
    setMenzioni([])
    toast.success("Nota aggiunta")
    if (created.notificationFailures) toast.warning("Nota salvata, ma una o più notifiche email non sono state inviate")
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
              <MentionText text={n.testo} mentions={n.menzioni} className="text-[13px] text-foreground" />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
        <MentionTextarea
          value={nuova}
          onChange={setNuova}
          mentions={menzioni}
          onMentionsChange={setMenzioni}
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

/* ---------- Sezione Allegati (vedi components/shared/allegati-section.tsx) ---------- */

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

function EmailSection({ emailLog }: { emailLog: EmailLogEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {emailLog.length === 0 ? (
        <li className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Nessuna email inviata a questo lead dal CRM.
        </li>
      ) : null}
      {emailLog.map((email) => (
        <li
          key={email.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <IconMail size={16} stroke={1.8} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-foreground">
              {email.oggetto}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {[
                formatEmailLogDate(email.dataInvio),
                `da ${email.fromEmail}`,
                email.inviataDaNome ? `inviata da ${email.inviataDaNome}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ---------- Sezione Record collegati ---------- */

function RecordCollegati({
  lead,
  clienteCollegatoNome,
}: {
  lead: Lead
  clienteCollegatoNome?: string | null
}) {
  const account = lead["Account convertito"]
  if (account) {
    return (
      <Link
        href={`/clienti/${account}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
          <IconLink size={18} stroke={1.8} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[11px] text-muted-foreground">Cliente</span>
          <span className="truncate text-[13px] font-medium text-foreground">
            {clienteCollegatoNome || account}
          </span>
        </div>
      </Link>
    )
  }
  return (
    <div className="flex items-center rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-3">
      <span className="text-sm text-muted-foreground">
        Nessun record collegato — verrà mostrato qui dopo la conversione in cliente.
      </span>
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

function formatTimelineDay(value: string | null | undefined) {
  if (!value) return "Senza data"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatTimelineHour(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function activityToTimelineEvent(activity: Lead["attivita"][number]): TimelineEvent {
  const tipo =
    activity.tipo === "nota"
      ? "nota"
      : activity.tipo === "nuovo-lead"
        ? "creato"
        : "modifica"
  return {
    id: activity.id,
    tipo,
    testo: activity.descrizione || "Attività registrata",
    autore: activity.autore ?? "Sistema",
    ora: formatTimelineHour(activity.timestamp),
  }
}

function groupTimelineEvents(
  events: Array<{ date: string; event: TimelineEvent }>,
) {
  const grouped = new Map<string, TimelineEvent[]>()
  for (const item of events) {
    const current = grouped.get(item.date) ?? []
    current.push(item.event)
    grouped.set(item.date, current)
  }
  return Array.from(grouped.entries()).map(([data, eventi]) => ({ data, eventi }))
}

function SequenzaTemporale({ lead }: { lead: Lead }) {
  const [tab, setTab] = useState<"cronologia" | "interazioni">("cronologia")
  const { tagEvents } = useTags()
  const liveTagEvents = tagEvents[lead.id] ?? []
  const activityEvents = lead.attivita.map((activity) => ({
    date: formatTimelineDay(activity.timestamp),
    event: activityToTimelineEvent(activity),
  }))
  const fallbackEvents =
    activityEvents.length === 0
      ? [
          {
            date: formatTimelineDay(lead["Ora creazione"]),
            event: {
              id: "lead-created",
              tipo: "creato" as const,
              testo: "Lead creato",
              autore: lead["Creato da"] || "Sistema",
              ora: formatTimelineHour(lead["Ora creazione"]),
            },
          },
        ]
      : []
  const liveEvents = liveTagEvents.map((ev) => ({
    date: "Oggi",
    event: {
      id: ev.id,
      tipo: "tag" as const,
      testo: ev.testo,
      autore: ev.autore,
      ora: ev.ora,
    },
  }))
  const giorni = groupTimelineEvents([...liveEvents, ...activityEvents, ...fallbackEvents])

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

export function LeadDetailContent({
  lead,
  clienteCollegatoNome,
  emailLog,
}: {
  lead: Lead
  clienteCollegatoNome?: string | null
  /** Storico invii reali (crm_email_log), risolto lato server dalla pagina. */
  emailLog: EmailLogEntry[]
}) {
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
    "section-note": lead.attivita.filter((activity) => activity.tipo === "nota").length,
    "section-attivita-aperte": openTasks.length,
    "section-attivita-chiuse": (lead.compiti ?? []).filter((task) => task.completato).length,
    "section-email": emailLog.length,
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
        id="section-documenti-obbligatori"
        title="Documenti obbligatori"
        icon={IconClipboardCheck}
      >
        {/* Stessa UI allegati puntata sulla sottocartella dedicata: sono
            questi tre file, e solo questi, a sbloccare la conversione a
            cliente (il conteggio nell'intestazione legge la stessa
            cartella). */}
        <AllegatiSection
          recordTipo="lead"
          recordId={lead.id}
          nomeRecord={lead["Nome Lead"]}
          sottocartella={DOCUMENTI_OBBLIGATORI_FOLDER}
          titolo="Documenti obbligatori per la conversione"
          onChanged={notificaDocumentiObbligatoriCambiati}
        />
      </Section>

      <Section
        id="section-allegati"
        title="Allegati"
        icon={IconPaperclip}
      >
        <AllegatiSection recordTipo="lead" recordId={lead.id} nomeRecord={lead["Nome Lead"]} />
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
        <EmailSection emailLog={emailLog} />
      </Section>

      <Section
        id="section-calendario"
        title="Calendario"
        icon={IconCalendarEvent}
        defaultOpen={false}
      >
        <CalendarioRecordSection
          recordTipo="lead"
          recordId={lead.id}
          nomeRecord={lead["Nome Lead"]}
        />
      </Section>

      <Section id="section-record" title="Record collegati" icon={IconLink}>
        <RecordCollegati lead={lead} clienteCollegatoNome={clienteCollegatoNome} />
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
