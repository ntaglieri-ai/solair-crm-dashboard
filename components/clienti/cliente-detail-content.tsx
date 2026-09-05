"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { AllegatiSection } from "@/components/shared/allegati-section"
import { NoteInterneSection } from "./note-interne-section"
import { CalendarioRecordSection } from "@/components/calendario/calendario-record-section"
import { usePermissions } from "@/lib/permissions/provider"
import { canAccessNoteInterne } from "@/lib/clienti/note-interne"
import {
  IconChevronDown,
  IconUser,
  IconBolt,
  IconReceipt2,
  IconRoute,
  IconTruck,
  IconPaperclip,
  IconMessages,
  IconNote,
  IconChecklist,
  IconCircleCheck,
  IconMail,
  IconPhone,
  IconSolarPanel,
  IconPlug,
  IconBattery,
  IconTool,
  IconCalendarEvent,
  IconPlus,
  IconLock,
  IconAdjustmentsAlt,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MentionText, MentionTextarea } from "@/components/shared/note-mentions"
import type { NoteMention, NoteMentionDraft } from "@/lib/notes/mentions"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { CampoProtetto, useCampoVisibile } from "@/components/shared/campo-protetto"
import {
  InlineEditableField,
  InlineEditableValue,
  type InlineEditableValueProps,
} from "@/components/shared/inline-edit-field"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { type ClienteRecord, type Compito, type CustomFieldValue, OPEN_TASK_STATI } from "@/lib/mock-data"
import { ClienteAvatar } from "./cliente-utils"
import { InstallatoreAssegnatoSelect } from "./installatore-assegnato-select"
import { QuickCompitoDialog } from "@/components/compiti/quick-compito-dialog"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { displayClienteOwner } from "@/lib/clienti/owner-display"
import { CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"
import { CUSTOM_FIELD_PREFIX } from "@/lib/clienti/custom-fields"

/* ---------- Helpers ---------- */

function val(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Sì" : "No"
  return String(v)
}

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ""
}

/**
 * Stesso trattamento visivo di val()/DataField, esteso ai tipi che i campi
 * custom possono avere (date/timestamptz formattate, non ISO grezzo).
 */
function valCustomField(tipo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (tipo === "boolean") return v ? "Sì" : "No"
  if (tipo === "date" || tipo === "timestamptz") {
    const d = new Date(String(v))
    if (Number.isNaN(d.getTime())) return String(v)
    return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(d)
  }
  return String(v)
}

const ClienteInlineEditContext = createContext<ClienteRecord | null>(null)

const CLIENTI_INLINE_LABEL_ALIASES: Record<string, string> = {
  "Stratigrafia superficie": "Stratigrafia superficie di installazione",
  "Conferma Iter E-distribuzione": "Data conferma Iter E-distribuzione",
  "Potenza (Wp)": "Potenza Moduli Wp",
  "COD. Moduli": "COD- MODULI",
  "Potenza": "Potenza Inverter",
  "Tot Potenza AC (kW)": "Tot Potenza AC KW",
  "Capacità": "Capacità Batterie",
  "COD. Storage": "COD. STORAGE",
}

const CLIENTI_INLINE_FIELD_BY_LABEL = new Map(
  CLIENTI_RECORD_FIELDS.map((field) => [field.appField, field]),
)

function clienteInlineType(
  fieldType: "text" | "numeric" | "boolean" | "timestamp",
  appField: string,
): InlineEditableValueProps["type"] {
  if (fieldType === "boolean") return "boolean"
  if (fieldType === "numeric") return "number"
  if (fieldType === "timestamp") return "date"
  return /descrizione|note|materiali|assistenza|stratigrafia/i.test(appField) ? "textarea" : "text"
}

function clienteInlineEdit(
  cliente: ClienteRecord | null,
  label: string,
): Omit<InlineEditableValueProps, "label"> | null {
  if (!cliente) return null
  const appField = CLIENTI_INLINE_LABEL_ALIASES[label] ?? label
  const field = CLIENTI_INLINE_FIELD_BY_LABEL.get(appField)
  if (!field) return null
  const value = (cliente as unknown as Record<string, unknown>)[field.appField]
  if (
    value !== null &&
    value !== undefined &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return null
  }
  return {
    module: "clienti",
    field: field.column,
    endpoint: `/api/clienti/${cliente.id}`,
    patchKey: field.appField,
    value,
    type: clienteInlineType(field.type, field.appField),
    emptyLabel: "—",
  }
}

function customInlineType(campo: CustomFieldValue): InlineEditableValueProps["type"] {
  if (campo.tipo === "boolean") return "boolean"
  if (campo.tipo === "number" || campo.tipo === "currency") return "number"
  if (campo.tipo === "date") return "date"
  if (campo.tipo === "datetime") return "datetime-local"
  if (campo.tipo === "email") return "email"
  if (campo.tipo === "phone") return "tel"
  if (campo.tipo === "textarea" || campo.tipo === "multiselect") return "textarea"
  if (campo.tipo === "select" && campo.options?.length) return "select"
  return "text"
}

/**
 * Campi aggiunti da CRM Settings → Attributi (report Vito, punto 6): prima
 * la colonna veniva creata davvero nel database ma non compariva in nessuna
 * scheda — mancava proprio questa lettura/rendering. Stessa identica resa
 * grafica di DataField, cosi' un campo custom e' indistinguibile da uno
 * nativo. Sezione nascosta del tutto se non e' stato aggiunto nulla (il
 * caso comune oggi), per non introdurre disordine visivo gratuito.
 *
 * Non raggruppati sotto un'unica sezione "Campi personalizzati": ogni campo
 * e' la SUA sezione, con il suo nome vero in nav — Nando ha chiesto
 * esplicitamente di vedere "Verifica", non "Campi personalizzati" (03/09).
 */
function CampoPersonalizzato({ campo }: { campo: CustomFieldValue }) {
  const cliente = useContext(ClienteInlineEditContext)
  if (cliente && campo.column) {
    return (
      <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-3">
        <Badge
          variant="outline"
          className="mb-2 h-4 w-fit border-violet-300 bg-violet-100 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700"
        >
          Personalizzato
        </Badge>
        <InlineEditableField
          module="clienti"
          field={campo.column}
          label={campo.label}
          endpoint={`/api/clienti/${cliente.id}`}
          patchKey={`${CUSTOM_FIELD_PREFIX}${campo.key}`}
          value={campo.value}
          type={customInlineType(campo)}
          options={campo.options}
          custom={campo}
          displayValue={valCustomField(campo.tipo, campo.value)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-3">
      <Badge
        variant="outline"
        className="h-4 w-fit border-violet-300 bg-violet-100 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700"
      >
        Personalizzato
      </Badge>
      <div className="text-[13px] text-foreground">{valCustomField(campo.tipo, campo.value)}</div>
    </div>
  )
}

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
  icon: typeof IconUser
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
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Campi ---------- */

function DataField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const cliente = useContext(ClienteInlineEditContext)
  const edit = clienteInlineEdit(cliente, label)
  if (edit) return <InlineEditableField label={label} {...edit} displayValue={children} />

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
  value: string | undefined
  icon: typeof IconMail
}) {
  const cliente = useContext(ClienteInlineEditContext)
  const edit = clienteInlineEdit(cliente, label)
  if (edit) {
    return (
      <InlineEditableField
        label={label}
        {...edit}
        type={label.toLowerCase().includes("mail") ? "email" : label.toLowerCase().includes("telefono") || label === "Cellulare" ? "tel" : edit.type}
        displayValue={val(value)}
      />
    )
  }

  const v = value ?? ""
  const copy = () => {
    if (!v) return
    navigator.clipboard?.writeText(v)
    toast.success("Copiato!", { description: v, duration: 1800 })
  }
  return (
    <div className="group flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="truncate text-[13px] text-foreground">{val(v)}</span>
        {v ? (
          <button
            type="button"
            aria-label={`Copia ${label}`}
            onClick={copy}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-navy opacity-0 transition-all duration-150 hover:bg-secondary group-hover:opacity-100"
          >
            <Icon size={14} stroke={1.8} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function BoolChip({ label, on }: { label: string; on: boolean | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        on ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          on ? "bg-success" : "bg-muted-foreground/50",
        )}
      />
      {label}
    </span>
  )
}

/* ---------- Navigazione correlato ---------- */

const NAV_ITEMS = [
  { id: "section-anagrafica", label: "Anagrafica" },
  { id: "section-documenti", label: "Documenti" },
  { id: "section-iter", label: "Iter burocratico" },
  { id: "section-impianto", label: "Impianto" },
  { id: "section-pagamenti", label: "Pagamenti" },
  { id: "section-logistica", label: "Logistica" },
  { id: "section-comunicazioni", label: "Comunicazioni" },
  { id: "section-note", label: "Note cliente" },
  { id: "section-note-interne", label: "Note interne" },
  { id: "section-calendario", label: "Calendario" },
  { id: "section-attivita", label: "Attività" },
] as const

function RelatedNav({
  vediNoteInterne,
  customFields,
}: {
  vediNoteInterne: boolean
  customFields: CustomFieldValue[]
}) {
  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  // La voce "Note interne" sparisce con la sezione: lasciarla porterebbe
  // a uno scroll verso un'ancora inesistente, e soprattutto rivelerebbe
  // che quella sezione esiste per qualcun altro. I campi personalizzati non
  // sono raggruppati sotto un'unica voce "Campi personalizzati": ognuno ha
  // la sua, col suo nome vero, inserita subito dopo Anagrafica.
  const base = NAV_ITEMS.filter(
    (item) => vediNoteInterne || item.id !== "section-note-interne",
  )
  const items: { id: string; label: string }[] = [
    base[0],
    ...customFields.map((c) => ({ id: `section-campo-${c.key}`, label: c.label })),
    ...base.slice(1),
  ]
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => go(item.id)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

/* ---------- Anagrafica ---------- */

function Anagrafica({ cliente }: { cliente: ClienteRecord }) {
  const { ownerNames } = useClienteTags()
  const ownerName = displayClienteOwner(cliente, ownerNames, "Non assegnato")

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <DataField label="Nome">{val(cliente.Nome)}</DataField>
            <DataField label="Cognome">{val(cliente.Cognome)}</DataField>
          </div>
          <DataField label="Saluti">{val(cliente.Saluti)}</DataField>
          <CampoProtetto modulo="clienti" campo="codice_fiscale">
            <DataField label="Codice fiscale">{val(cliente["Codice fiscale"])}</DataField>
          </CampoProtetto>
          <CopyField label="E-mail" value={cliente["E-mail"]} icon={IconMail} />
          <CopyField
            label="E-mail secondaria"
            value={cliente["E-mail secondaria"]}
            icon={IconMail}
          />
          {/* Sta accanto agli indirizzi e non in fondo alla scheda: e' cio' che
              decide se quegli indirizzi sono utilizzabili. */}
          <DataField label="Consenso e-mail">
            {cliente["Consenso e-mail"] ? "Sì" : "No"}
          </DataField>
        </div>
        <div className="flex flex-col gap-4">
          <CopyField label="Cellulare" value={cliente.Cellulare} icon={IconPhone} />
          <CopyField label="Altro telefono" value={cliente["Altro telefono"]} icon={IconPhone} />
          <DataField label="Clienti Proprietario">
            {ownerName}
          </DataField>
          <DataField label="Origine Lead">{val(cliente["Origine Lead"])}</DataField>
          <DataField label="Creato da">
            {val(cliente["Creato da"])}
            {cliente["Ora creazione"] ? (
              <span className="text-muted-foreground"> · {cliente["Ora creazione"]}</span>
            ) : null}
          </DataField>
        </div>
      </div>

      {/* Indirizzo */}
      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
          Indirizzo
        </span>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <DataField label="Via indirizzo postale">{val(cliente["Via indirizzo postale"])}</DataField>
          <DataField label="Città indirizzo postale">{val(cliente["Città indirizzo postale"])}</DataField>
          <DataField label="Provincia indirizzo postale">{val(cliente["Provincia indirizzo postale"])}</DataField>
          <DataField label="Codice postale indirizzo">{val(cliente["Codice postale indirizzo"])}</DataField>
        </div>
        {/* Report Vito (1): Zona subito sotto l'indirizzo — prima stava in
            Iter burocratico, lontana dal resto dei dati di localizzazione. */}
        <DataField label="Zona">{val(cliente.Zona)}</DataField>
      </div>

      {/* Descrizione */}
      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
          Descrizione
        </span>
        <InlineEditableValue
          module="clienti"
          field="descrizione"
          label="Descrizione"
          endpoint={`/api/clienti/${cliente.id}`}
          patchKey="Descrizione"
          value={cliente.Descrizione}
          type="textarea"
          emptyLabel="Nessuna descrizione"
          className="w-full rounded-lg border border-border bg-secondary/40 p-3 text-left text-[13px] leading-relaxed"
          valueClassName="whitespace-pre-wrap"
        />
      </div>
    </div>
  )
}

/* ---------- Impianto ---------- */

function ImpiantoCard({
  title,
  icon: Icon,
  rows,
}: {
  title: string
  icon: typeof IconSolarPanel
  rows: [string, string][]
}) {
  const cliente = useContext(ClienteInlineEditContext)
  const filled = rows.filter(([, v]) => v !== "—")
  if (filled.length === 0) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-navy">
        <Icon size={15} stroke={1.8} />
        {title}
      </div>
      <dl className="flex flex-col gap-1.5">
        {rows.map(([k, v]) => {
          const edit = clienteInlineEdit(cliente, k)
          return (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-[11px] text-muted-foreground">{k}</dt>
              <dd className="min-w-0 text-right text-[12px] font-medium text-foreground">
                {edit ? (
                  <InlineEditableValue
                    label={k}
                    {...edit}
                    displayValue={v}
                    className="justify-end"
                    valueClassName="text-right"
                  />
                ) : (
                  v
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/**
 * Switch per i flag di previsione EPS/CER (procedura Vito, Fase 2.5).
 *
 * Componente dedicato invece del solito `saveToggle` locale perche' questi due
 * campi sono tri-stato: `undefined` (colonna null) significa "non ancora
 * valutato" ed e' un'informazione diversa da "valutato, non previsto". Lo
 * Switch resta binario, ma finche' nessuno ha deciso lo dichiariamo accanto
 * al controllo invece di far sembrare un "no" quello che e' un "non lo so".
 */
function FlagPrevisione({
  clienteId,
  label,
  field,
  iniziale,
}: {
  clienteId: string
  label: string
  field: "EPS previsto" | "Adesione CER prevista"
  iniziale: boolean | undefined
}) {
  const [valore, setValore] = useState(iniziale)

  async function handleChange(v: boolean) {
    const precedente = valore
    setValore(v)
    try {
      const res = await fetch(`/api/clienti/${clienteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: v }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      toast.success("Aggiornato")
    } catch {
      setValore(precedente)
      toast.error("Errore nel salvataggio")
    }
  }

  return (
    <DataField label={label}>
      <div className="flex items-center gap-2">
        <Switch checked={valore === true} onCheckedChange={handleChange} />
        {valore === undefined ? (
          <span className="text-[11px] text-muted-foreground">Non ancora valutato</span>
        ) : null}
      </div>
    </DataField>
  )
}

function Impianto({ cliente }: { cliente: ClienteRecord }) {
  const attivo = cliente["Impianto Attivo"]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            attivo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {attivo ? "Impianto Attivo" : "Non attivo"}
        </Badge>
        {hasValue(cliente["DISPONIBILITA' MAGAZZINO"]) ? (
          <Badge className="rounded-full bg-info/10 px-2.5 py-0.5 text-[11px] font-medium text-info">
            Magazzino: {cliente["DISPONIBILITA' MAGAZZINO"]}
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ImpiantoCard
          title="Moduli"
          icon={IconSolarPanel}
          rows={[
            ["Nr. Moduli", val(cliente["Nr. Moduli"])],
            ["Potenza (Wp)", val(cliente["Potenza Moduli Wp"])],
            ["COD. Moduli", val(cliente["COD- MODULI"])],
            ["Tot Potenza DC", val(cliente["Tot Potenza DC"])],
            ["Tipologia", val(cliente.Tipologia)],
          ]}
        />
        <ImpiantoCard
          title="Inverter"
          icon={IconPlug}
          rows={[
            ["Nr. Inverter", val(cliente["Nr. Inverter"])],
            ["Potenza", val(cliente["Potenza Inverter"])],
            ["COD. Inverter", val(cliente["COD. INVERTER"])],
            ["Tot Potenza AC (kW)", val(cliente["Tot Potenza AC KW"])],
          ]}
        />
        <ImpiantoCard
          title="Storage"
          icon={IconBattery}
          rows={[
            ["Nr. Batterie", val(cliente["Nr. Batterie"])],
            ["Capacità", val(cliente["Capacità Batterie"])],
            ["Totale Storage", val(cliente["Totale Storage"])],
            ["COD. Storage", val(cliente["COD. STORAGE"])],
          ]}
        />
        <ImpiantoCard
          title="Accessori e termico"
          icon={IconTool}
          rows={[
            ["ST300", val(cliente.ST300)],
            ["Scaldacqua PDC", val(cliente["Scaldacqua PDC"])],
            ["PDC idronica", val(cliente["PDC idronica"])],
            ["STF", val(cliente.STF)],
            ["Accessori", val(cliente.Accessori)],
            ["Litri Accumulo", val(cliente["Litri Accumulo"])],
            ["N. Collettori", val(cliente["N. Collettori"])],
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <BoolChip label="Retrofit" on={cliente.Retrofit} />
        <BoolChip label="EPS" on={cliente.EPS} />
        <BoolChip label="Edilizia libera" on={cliente["Impianto in edilizia libera"]} />
        <BoolChip label="Area vincolata" on={cliente["Area vincolata"]} />
        <BoolChip label=">20kW Pot. Nom." on={cliente[">20kW Pot. Nom."]} />
      </div>

      {/* Flag EPS/CER: modificabili, a differenza dei chip qui sopra che
          mostrano i valori storici importati da Zoho in sola lettura. */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
        <FlagPrevisione
          clienteId={cliente.id}
          label="EPS previsto"
          field="EPS previsto"
          iniziale={cliente["EPS previsto"]}
        />
        <FlagPrevisione
          clienteId={cliente.id}
          label="Adesione CER prevista"
          field="Adesione CER prevista"
          iniziale={cliente["Adesione CER prevista"]}
        />
      </div>
    </div>
  )
}

/* ---------- Pagamenti ---------- */

function Pagamenti({ cliente }: { cliente: ClienteRecord }) {
  const [fin, setFin] = useState(Boolean(cliente["Finanziamento approvato"]))
  const [reverse, setReverse] = useState(Boolean(cliente["Iva Reverse charge"]))

  async function saveToggle(field: string, value: boolean, onError: () => void) {
    try {
      const res = await fetch(`/api/clienti/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
    } catch {
      onError()
      toast.error("Errore nel salvataggio")
    }
  }

  const euro = (n: number | undefined) =>
    typeof n === "number"
      ? n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
      : "—"

  // Ogni riga della tabella tranche mescola due campi con restrizioni proprie
  // (l'importo e il riferimento del bonifico): si costruisce filtrando, perche'
  // qui non c'e' un nodo JSX da avvolgere.
  const vediTotContratto = useCampoVisibile("clienti", "tot_contratto")
  const vediCt3 = useCampoVisibile("clienti", "di_cui_ct3")
  const vediFtv = useCampoVisibile("clienti", "di_cui_ftv")
  const vediTranche1 = useCampoVisibile("clienti", "n_1_tranche")
  const vediTranche2 = useCampoVisibile("clienti", "n_2tranche")
  const vediBonifico1 = useCampoVisibile("clienti", "bonifico1")
  const vediBonifico2 = useCampoVisibile("clienti", "bonifico2")
  const vediBonificoPdc = useCampoVisibile("clienti", "bonificopdc")
  const vediFatturaPdc = useCampoVisibile("clienti", "fatturapdc")
  const vediSaldo = useCampoVisibile("clienti", "saldo")
  // Report Vito (1): Note pagamenti vicino agli importi contrattuali — prima
  // stava dentro "Note cliente", lontana dagli importi a cui si riferisce.
  const vediNotePagamenti = useCampoVisibile("clienti", "note_pagamenti")

  const nascosto = "—"
  const tranche: [string, string, string][] = [
    ["1° Tranche",
      vediTranche1 ? val(cliente["1° Tranche"]) : nascosto,
      vediBonifico1 ? val(cliente.Bonifico1) : nascosto],
    ["2° Tranche",
      vediTranche2 ? val(cliente["2°Tranche"]) : nascosto,
      vediBonifico2 ? val(cliente.Bonifico2) : nascosto],
    ["PDC",
      vediBonificoPdc ? val(cliente.BonificoPDC) : nascosto,
      vediFatturaPdc ? val(cliente.FatturaPDC) : nascosto],
  ].filter((riga) => riga[1] !== nascosto || riga[2] !== nascosto) as [string, string, string][]

  return (
    <div className="flex flex-col gap-5">
      {/* Riepilogo */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Totale contratto
        </span>
        <div className="text-3xl font-bold tabular-nums text-foreground">
          {vediTotContratto
            ? euro(cliente["Tot Contratto"] ?? cliente["Importo Contrattuale"])
            : "—"}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[12px]">
          {vediCt3 ? (
            <span className="text-muted-foreground">
              di cui CT3:{" "}
              <span className="font-semibold text-foreground">{euro(cliente["di cui CT3"])}</span>
            </span>
          ) : null}
          {vediFtv ? (
            <span className="text-muted-foreground">
              di cui FTV:{" "}
              <span className="font-semibold text-foreground">{euro(cliente["di cui FTV"])}</span>
            </span>
          ) : null}
          {cliente["Corrispettivo pagato"] ? (
            <Badge className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              Corrispettivo pagato ✓
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <CampoProtetto modulo="clienti" campo="modalita_di_pagamento">
          <DataField label="Modalità di Pagamento">
            {val(cliente["Modalità di Pagamento"])}
          </DataField>
        </CampoProtetto>
        <CampoProtetto modulo="clienti" campo="importo_contrattuale">
          <DataField label="Importo Contrattuale">{euro(cliente["Importo Contrattuale"])}</DataField>
        </CampoProtetto>
        <CampoProtetto modulo="clienti" campo="iban">
          <CopyField label="IBAN" value={cliente.IBAN} icon={IconReceipt2} />
        </CampoProtetto>
        <CampoProtetto modulo="clienti" campo="finanziamento_approvato">
        <DataField label="Finanziamento approvato">
          <Switch
            checked={fin}
            onCheckedChange={(v) => {
              setFin(v)
              toast.success(v ? "Finanziamento approvato" : "Finanziamento non approvato")
              saveToggle("Finanziamento approvato", v, () => setFin(!v))
            }}
          />
        </DataField>
        </CampoProtetto>
      </div>

      {vediNotePagamenti && hasValue(cliente["Note pagamenti"]) ? (
        <div className="rounded-lg border border-border bg-secondary/20 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Note pagamenti
          </span>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">
            {cliente["Note pagamenti"]}
          </p>
        </div>
      ) : null}

      {/* Tranche */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Tranche</th>
              <th className="px-3 py-2 font-medium">Importo / Bonifico</th>
              <th className="px-3 py-2 font-medium">Riferimento</th>
            </tr>
          </thead>
          <tbody>
            {tranche.map(([k, a, b]) => (
              <tr key={k} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 font-medium text-foreground">{k}</td>
                <td className="px-3 py-2 text-foreground">{a}</td>
                <td className="px-3 py-2 text-muted-foreground">{b}</td>
              </tr>
            ))}
            {vediSaldo ? (
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">Saldo</td>
                <td className="px-3 py-2 text-foreground" colSpan={2}>
                  {euro(cliente.Saldo)}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <CampoProtetto modulo="clienti" campo="importo_finanziamento">
          <DataField label="Importo Finanziamento">{euro(cliente["Importo Finanziamento"])}</DataField>
        </CampoProtetto>
        <CampoProtetto modulo="clienti" campo="n_rate_e_importo_rata">
          <DataField label="N. rate e importo rata">{val(cliente["N. rate e importo rata"])}</DataField>
        </CampoProtetto>
        <CampoProtetto modulo="clienti" campo="sconto_combo">
          <DataField label="Sconto COMBO">{euro(cliente["Sconto COMBO"])}</DataField>
        </CampoProtetto>
        <CampoProtetto modulo="clienti" campo="importo_da_listino">
          <DataField label="Importo da Listino">{euro(cliente["Importo da Listino"])}</DataField>
        </CampoProtetto>
        <CampoProtetto modulo="clienti" campo="importo_tica">
          <DataField label="Importo TICA">{euro(cliente["Importo TICA"])}</DataField>
        </CampoProtetto>
        <CampoProtetto modulo="clienti" campo="iva">
          <DataField label="IVA">{cliente.IVA ? `${cliente.IVA}%` : "—"}</DataField>
        </CampoProtetto>
        <DataField label="Iva Reverse charge">
          <Switch
            checked={reverse}
            onCheckedChange={(v) => {
              setReverse(v)
              toast.success("Aggiornato")
              saveToggle("Iva Reverse charge", v, () => setReverse(!v))
            }}
          />
        </DataField>
        <DataField label="MOD. PAGAMENTO CT3.0">{val(cliente["MOD. PAGAMENTO CT3.0"])}</DataField>
      </div>
    </div>
  )
}

/* ---------- Iter burocratico ---------- */

function IterStepper({ cliente }: { cliente: ClienteRecord }) {
  const steps = [
    { label: "GSE", done: hasValue(cliente["Inserimento pratica GSE"]) },
    { label: "E-Distribuzione", done: hasValue(cliente["Inserimento pratica E-Distribuzione"]) },
    { label: "Ammissibilità", done: hasValue(cliente["Data ammissibilità"]) },
    { label: "Sopralluogo", done: cliente["Stato sopralluogo"] === "Completato" },
    { label: "TICA", done: cliente["Stato TICA"] === "Accettata" },
    { label: "Iter Enel Concluso", done: hasValue(cliente["Data iter Enel Concluso"]) },
  ]
  return (
    <ol className="flex flex-wrap items-center gap-y-3">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 text-[12px] font-bold",
                s.done
                  ? "border-teal bg-teal text-teal-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {s.done ? <IconCircleCheck size={18} stroke={2} /> : i + 1}
            </span>
            <span
              className={cn(
                "max-w-[72px] text-center text-[10px] font-medium leading-tight",
                s.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 ? (
            <span
              className={cn(
                "mx-1 h-0.5 w-6 sm:w-10",
                s.done ? "bg-teal" : "bg-border",
              )}
            />
          ) : null}
        </li>
      ))}
    </ol>
  )
}

/**
 * Costi extra emersi dal sopralluogo (procedura Vito, Fase 4.1).
 *
 * Il totale accanto al campo e' solo calcolato a schermo (importo
 * contrattuale + extra) e non viene mai salvato: e' una somma di due valori
 * che cambiano ognuno per conto proprio, quindi persisterla significherebbe
 * conservare un numero che smette di essere vero appena uno dei due si muove.
 *
 * Campo vuoto = null in colonna = "non ancora rilevato", che e' diverso da 0
 * ("sopralluogo fatto, nessun costo extra"): finche' nessuno ha rilevato
 * niente lo dichiariamo invece di mostrare un totale che sembrerebbe una
 * conferma.
 */
function CostiExtraSopralluogo({ cliente }: { cliente: ClienteRecord }) {
  const iniziale = cliente["Costi extra sopralluogo"]
  const [salvato, setSalvato] = useState(iniziale)
  const [draft, setDraft] = useState(iniziale === undefined ? "" : String(iniziale))
  const [saving, setSaving] = useState(false)

  const euro = (n: number) =>
    n.toLocaleString("it-IT", { style: "currency", currency: "EUR" })

  const contrattuale = cliente["Importo Contrattuale"]
  const grezzo = draft.trim()
  // Mentre si digita il totale segue il campo, cosi' l'effetto della cifra si
  // vede prima di salvare; se il testo non e' un numero si resta sull'ultimo
  // valore salvato invece di mostrare NaN.
  const digitato = grezzo === "" ? undefined : Number(grezzo.replace(",", "."))
  const valido = digitato === undefined || Number.isFinite(digitato)
  const extra = valido ? digitato : salvato

  async function handleSave() {
    if (!valido) {
      setDraft(salvato === undefined ? "" : String(salvato))
      toast.error("Valore non valido")
      return
    }
    if (digitato === salvato) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clienti/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "Costi extra sopralluogo": digitato ?? null }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      setSalvato(digitato)
      setDraft(digitato === undefined ? "" : String(digitato))
      toast.success("Costi extra aggiornati")
    } catch {
      setDraft(salvato === undefined ? "" : String(salvato))
      toast.error("Errore nel salvataggio")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
        Costi extra sopralluogo
      </span>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={draft}
            disabled={saving}
            placeholder="0,00"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            className="h-8 w-36 bg-card text-[13px]"
          />
          <span className="text-[12px] text-muted-foreground">€</span>
        </div>
        {typeof contrattuale === "number" ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            <span>{euro(contrattuale)}</span>
            <span>+</span>
            <span>{euro(extra ?? 0)}</span>
            <span>=</span>
            <span className="font-semibold text-foreground">
              {euro(contrattuale + (extra ?? 0))}
            </span>
            <span className="text-[11px]">totale aggiornato</span>
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground">
            Importo contrattuale non presente: totale non calcolabile
          </span>
        )}
      </div>
      {extra === undefined ? (
        <span className="text-[11px] text-muted-foreground">Non ancora rilevato</span>
      ) : null}
    </div>
  )
}

function Iter({ cliente }: { cliente: ClienteRecord }) {
  const [notifica, setNotifica] = useState(Boolean(cliente["Notifica pred. reg. esercizio"]))
  const [disp, setDisp] = useState(Boolean(cliente["Disponibilità Fine lavori"]))

  async function saveToggle(field: string, value: boolean, onError: () => void) {
    try {
      const res = await fetch(`/api/clienti/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      toast.success("Aggiornato")
    } catch {
      onError()
      toast.error("Errore nel salvataggio")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <IterStepper cliente={cliente} />
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <DataField label="POD">{val(cliente.POD)}</DataField>
        <DataField label="Data ammissibilità">{val(cliente["Data ammissibilità"])}</DataField>
        <DataField label="Data sopralluogo">{val(cliente["Data sopralluogo"])}</DataField>
        <DataField label="Data affidamento sopralluogo">
          {val(cliente["Data affidamento sopralluogo"])}
        </DataField>
        <DataField label="Stato sopralluogo">{val(cliente["Stato sopralluogo"])}</DataField>
        <DataField label="Conferma Iter E-distribuzione">
          {val(cliente["Data conferma Iter E-distribuzione"])}
        </DataField>
        <DataField label="Tica">{val(cliente.Tica)}</DataField>
        <DataField label="Stato TICA">{val(cliente["Stato TICA"])}</DataField>
        <DataField label="Data scadenza TICA">{val(cliente["Data scadenza TICA"])}</DataField>
        <DataField label="TIPO CTR">{val(cliente["TIPO CTR"])}</DataField>
        <DataField label="Stato Sollecito">{val(cliente["Stato Sollecito"])}</DataField>
        <DataField label="Data interlocutorio">{val(cliente["Data interlocutorio"])}</DataField>
        <DataField label="Codice contratto PNRR">{val(cliente["Codice contratto PNRR"])}</DataField>
        <DataField label="Notifica pred. reg. esercizio">
          <Switch
            checked={notifica}
            onCheckedChange={(v) => {
              setNotifica(v)
              saveToggle("Notifica pred. reg. esercizio", v, () => setNotifica(!v))
            }}
          />
        </DataField>
        <DataField label="Disponibilità Fine lavori">
          <Switch
            checked={disp}
            onCheckedChange={(v) => {
              setDisp(v)
              saveToggle("Disponibilità Fine lavori", v, () => setDisp(!v))
            }}
          />
        </DataField>
      </div>
      <CostiExtraSopralluogo cliente={cliente} />
    </div>
  )
}

/* ---------- Logistica ---------- */

function Logistica({ cliente }: { cliente: ClienteRecord }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <DataField label="Stratigrafia superficie">
          {val(cliente["Stratigrafia superficie di installazione"])}
        </DataField>
        <DataField label="C/o magazzino installatore">
          {val(cliente["C/o magazzino installatore"])}
        </DataField>
        <DataField label="Indirizzo di ritiro merce">
          {val(cliente["Indirizzo di ritiro merce"])}
        </DataField>
        <DataField label="Merce ordinata e da ritirare">
          {val(cliente["Merce ordinata e da ritirare"])}
        </DataField>
        <DataField label="C/o cantiere del cliente">
          {val(cliente["C/o cantiere del cliente"])}
        </DataField>
        <DataField label="Altri materiali">{val(cliente["Altri materiali"])}</DataField>
        <DataField label="Data installazione ultimata">
          {val(cliente["Data installazione ultimata"])}
        </DataField>
        <DataField label="Data appuntamento allaccio">
          {val(cliente["Data appuntamento allaccio"])}
        </DataField>
        <DataField label="Intervento 1">{val(cliente["Intervento 1"])}</DataField>
        <DataField label="Intervento 2">{val(cliente["Intervento 2"])}</DataField>
      </div>
      <div className="border-t border-border pt-4">
        <InstallatoreAssegnatoSelect
          clienteId={cliente.id}
          provincia={cliente["Provincia indirizzo postale"]}
          installatoreAttuale={cliente.Installatore}
        />
      </div>
    </div>
  )
}

/* ---------- Documenti ---------- */

function Documenti({ cliente }: { cliente: ClienteRecord }) {
  const [verifica, setVerifica] = useState(Boolean(cliente["Verifica documentale"]))
  const [layout, setLayout] = useState(Boolean(cliente["Layout verificato"]))
  const [confermando, setConfermando] = useState(false)

  // Fase 5.5 — conferma manuale: crea il Compito di passaggio pratica per il
  // responsabile configurato. L'azione non cambia nulla sul cliente, quindi
  // qui non c'e' stato da ribaltare in caso di errore: si riporta solo l'esito.
  async function confermaDocumentazioneCompleta() {
    setConfermando(true)
    try {
      const res = await fetch(`/api/clienti/${cliente.id}/documentazione-completa`, {
        method: "POST",
      })
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; messaggio?: string; error?: string }
        | null
      if (!res.ok) throw new Error(payload?.error ?? "Richiesta non riuscita")
      const messaggio = payload?.messaggio ?? "Operazione completata."
      if (payload?.ok) toast.success("Documentazione completa", { description: messaggio })
      else toast.warning("Documentazione completa", { description: messaggio })
    } catch {
      toast.error("Errore nella conferma della documentazione")
    } finally {
      setConfermando(false)
    }
  }

  async function saveToggle(field: string, value: boolean, onError: () => void) {
    try {
      const res = await fetch(`/api/clienti/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      toast.success("Aggiornato")
    } catch {
      onError()
      toast.error("Errore nel salvataggio")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6 border-b border-border pb-4">
        <DataField label="Verifica documentale">
          <Switch
            checked={verifica}
            onCheckedChange={(v) => {
              setVerifica(v)
              saveToggle("Verifica documentale", v, () => setVerifica(!v))
            }}
          />
        </DataField>
        <DataField label="Layout verificato">
          <Switch
            checked={layout}
            onCheckedChange={(v) => {
              setLayout(v)
              saveToggle("Layout verificato", v, () => setLayout(!v))
            }}
          />
        </DataField>
        <div className="ml-auto flex items-center">
          <Button
            variant="outline"
            size="sm"
            disabled={confermando}
            onClick={confermaDocumentazioneCompleta}
            className="h-8 gap-1.5 text-[12px]"
          >
            <IconCircleCheck size={15} stroke={1.8} />
            {confermando ? "Invio…" : "Documentazione completa"}
          </Button>
        </div>
      </div>

      {/* cognomeConvenzione attiva il dialog nomi documenti (spec 5.3) qui e
          solo qui: e' la sezione allegati generica del Cliente. Fallback
          sull'ultima parola di "Nome Clienti" perche' Cognome e' vuoto sui
          clienti aziendali importati da Zoho, dove il nominativo sta tutto
          nel campo unico. */}
      <AllegatiSection
        recordTipo="cliente"
        recordId={cliente.id}
        nomeRecord={cliente["Nome Clienti"]}
        cognomeConvenzione={cognomePerNomeFile(cliente)}
      />
    </div>
  )
}

function cognomePerNomeFile(cliente: ClienteRecord): string {
  const cognome = cliente.Cognome?.trim()
  if (cognome) return cognome
  const parole = (cliente["Nome Clienti"] ?? "").trim().split(/\s+/).filter(Boolean)
  return parole.length > 0 ? parole[parole.length - 1] : ""
}

/* ---------- Comunicazioni automatiche ---------- */

function Comunicazioni({ cliente }: { cliente: ClienteRecord }) {
  const items: { label: string; sent: boolean }[] = [
    { label: "Messaggio di benvenuto", sent: Boolean(cliente["Messaggio di benvenuto"]) },
    { label: "Messaggio prog. preliminare", sent: Boolean(cliente["Messaggio prog. preliminare"]) },
    { label: "Messaggio ordine merce", sent: Boolean(cliente["Messaggio ordine merce"]) },
    { label: "Messaggio in esecuzione", sent: Boolean(cliente["Messaggio in esecuzione"]) },
    { label: "Telefonata post installazione", sent: Boolean(cliente["Telefonata post installazione"]) },
    { label: "Messaggio Fattura", sent: Boolean(cliente["Messaggio Fattura"]) },
  ]
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li
            key={it.label}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                it.sent ? "bg-success/10 text-success" : "bg-muted text-muted-foreground/60",
              )}
            >
              <IconCircleCheck size={16} stroke={1.8} />
            </span>
            <span
              className={cn(
                "flex-1 text-[13px]",
                it.sent ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {it.label}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {it.sent ? "Inviato" : "In attesa"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Gestiti automaticamente da Make.
      </p>
    </div>
  )
}

/* ---------- Note ---------- */

interface Nota {
  id: string
  autore: string
  quando: string
  testo: string
  menzioni?: NoteMention[]
}

function NoteSection({ cliente }: { cliente: ClienteRecord }) {
  const seed: Nota[] = cliente.Note
    ? [
        {
          id: "n1",
          autore: "Sistema/importazione",
          quando: "2 ore fa",
          testo: cliente.Note,
        },
      ]
    : []
  const [note, setNote] = useState<Nota[]>(seed)
  const [nuova, setNuova] = useState("")
  const [menzioni, setMenzioni] = useState<NoteMentionDraft[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/clienti/${cliente.id}/notes`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body: { notes?: Array<{ id: string; testo: string; created_at: string; autore: string; menzioni?: NoteMention[] }> }) => {
        if (cancelled) return
        setNote((body.notes ?? []).map((item) => ({
          id: item.id,
          autore: item.autore,
          quando: new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)),
          testo: item.testo,
          menzioni: item.menzioni,
        })))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [cliente.id])

  const aggiungi = async () => {
    if (nuova.trim() === "") return
    const response = await fetch(`/api/clienti/${cliente.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: nuova, mentions: menzioni }),
    })
    if (!response.ok) {
      toast.error("Creazione nota non riuscita")
      return
    }
    const created = (await response.json()) as { id: string; testo: string; autore: string; menzioni?: NoteMention[]; notificationFailures?: number }
    setNote((prev) => [
      {
        id: created.id,
        autore: created.autore,
        quando: "adesso",
        testo: created.testo,
        menzioni: created.menzioni,
      },
      ...prev,
    ])
    setNuova("")
    setMenzioni([])
    toast.success("Nota aggiunta")
    if (created.notificationFailures) toast.warning("Nota salvata, ma una o più notifiche email non sono state inviate")
  }

  // "Note ufficio" non ha restrizioni configurate; "Note Provvigioni" si',
  // ed e' l'unica voce di un array costruito prima del render qui filtrata.
  // "Note pagamenti" e' stata spostata dentro la sezione Pagamenti (report
  // Vito, punto 1: vicino agli importi contrattuali a cui si riferisce).
  const vediNoteProvvigioni = useCampoVisibile("clienti", "note_provvigioni")

  const extra: { label: string; value: string | undefined }[] = [
    { label: "Note ufficio", value: cliente["Note ufficio"] },
    ...(vediNoteProvvigioni
      ? [{ label: "Note Provvigioni", value: cliente["Note Provvigioni"] }]
      : []),
  ].filter((e) => hasValue(e.value))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {note.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {note.map((n) => (
              <li key={n.id} className="group flex gap-3">
                <ClienteAvatar nome={n.autore} className="size-8 text-[11px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{n.autore}</span>
                    <span className="text-[11px] text-muted-foreground">{n.quando}</span>
                  </div>
                  <MentionText text={n.testo} mentions={n.menzioni} className="text-[13px] text-foreground" />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
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

      {extra.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {extra.map((e) => (
            <div key={e.label} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
                {e.label}
              </span>
              <p className="rounded-lg border border-border bg-secondary/40 p-3 text-[13px] text-foreground">
                {e.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ---------- Attività ---------- */

function Attivita({ cliente }: { cliente: ClienteRecord }) {
  const [tab, setTab] = useState<"aperte" | "chiuse">("aperte")
  const [tasks, setTasks] = useState(cliente.compiti ?? [])
  const [dialogOpen, setDialogOpen] = useState(false)

  const aperte = tasks.filter((t) => OPEN_TASK_STATI.includes(t.stato))
  const chiuse = tasks.filter((t) => !OPEN_TASK_STATI.includes(t.stato))
  const list = tab === "aperte" ? aperte : chiuse

  const handleCreated = (compito: Compito) => {
    setTasks((prev) => [
      {
        id: compito.id,
        oggetto: compito.Oggetto,
        scadenza: compito["Data di scadenza"],
        priorita: compito.Priorità,
        assegnato: compito["Proprietario del compito"],
        stato: compito.Stato,
      },
      ...prev,
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          {(["aperte", "chiuse"] as const).map((t) => (
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
        <Button
          size="sm"
          variant="outline"
          className="h-7 bg-card text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <IconPlus size={14} stroke={1.8} data-icon="inline-start" />
          Compito
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {list.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Nessuna attività {tab === "aperte" ? "aperta" : "chiusa"}.
          </li>
        ) : null}
        {list.map((t) => (
          <li
            key={t.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
              tab === "chiuse" && "opacity-60",
            )}
          >
            <Checkbox
              checked={tab === "chiuse"}
              disabled
              aria-label="Stato compito"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  "text-[13px] font-medium text-foreground",
                  tab === "chiuse" && "line-through",
                )}
              >
                {t.oggetto}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <IconCalendarEvent size={13} stroke={1.8} />
                  {t.scadenza || "Da pianificare"}
                </span>
                <span className="text-border">·</span>
                {t.assegnato}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <QuickCompitoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        correlato={{ tipo: "cliente", id: cliente.id, nome: cliente["Nome Clienti"] }}
        onCreated={handleCreated}
      />
    </div>
  )
}

/* ---------- Componente principale ---------- */

export function ClienteDetailContent({ cliente }: { cliente: ClienteRecord }) {
  const permissions = usePermissions()
  const vediNoteInterne = canAccessNoteInterne(permissions.snapshot.subject.ruoloCode)

  return (
    <ClienteInlineEditContext.Provider value={cliente}>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <RelatedNav vediNoteInterne={vediNoteInterne} customFields={cliente.customFields ?? []} />

      <Section id="section-anagrafica" title="Anagrafica" icon={IconUser}>
        <Anagrafica cliente={cliente} />
      </Section>

      {(cliente.customFields ?? []).map((c) => (
        <Section key={c.key} id={`section-campo-${c.key}`} title={c.label} icon={IconAdjustmentsAlt}>
          <CampoPersonalizzato campo={c} />
        </Section>
      ))}

      {/* Documenti e Iter spostati subito dopo Anagrafica (report Vito, punti
          1/10): verifica documentale/layout e sopralluogo sono tra le prime
          attività operative, prima erano in fondo alla pagina. */}
      <Section id="section-documenti" title="Documenti e pratiche" icon={IconPaperclip}>
        <Documenti cliente={cliente} />
      </Section>

      <Section id="section-iter" title="Iter burocratico" icon={IconRoute}>
        <Iter cliente={cliente} />
      </Section>

      <Section id="section-impianto" title="Impianto" icon={IconBolt}>
        <Impianto cliente={cliente} />
      </Section>

      <Section id="section-pagamenti" title="Pagamenti" icon={IconReceipt2}>
        <Pagamenti cliente={cliente} />
      </Section>

      <Section id="section-logistica" title="Logistica e cantiere" icon={IconTruck}>
        <Logistica cliente={cliente} />
      </Section>

      <Section
        id="section-comunicazioni"
        title="Comunicazioni automatiche"
        icon={IconMessages}
        defaultOpen={false}
      >
        <Comunicazioni cliente={cliente} />
      </Section>

      <Section id="section-note" title="Note cliente" icon={IconNote}>
        <NoteSection cliente={cliente} />
      </Section>

      {vediNoteInterne ? (
        <Section id="section-note-interne" title="Note interne" icon={IconLock}>
          <NoteInterneSection clienteId={cliente.id} />
        </Section>
      ) : null}

      <Section
        id="section-calendario"
        title="Calendario"
        icon={IconCalendarEvent}
        defaultOpen={false}
      >
        <CalendarioRecordSection
          recordTipo="cliente"
          recordId={cliente.id}
          nomeRecord={cliente["Nome Clienti"]}
        />
      </Section>

      <Section id="section-attivita" title="Attività" icon={IconChecklist}>
        <Attivita cliente={cliente} />
      </Section>
    </div>
    </ClienteInlineEditContext.Provider>
  )
}
