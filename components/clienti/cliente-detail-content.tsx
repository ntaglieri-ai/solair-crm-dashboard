"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  IconChevronDown,
  IconChevronRight,
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
  IconMapPin,
  IconSolarPanel,
  IconPlug,
  IconBattery,
  IconTool,
  IconBuildingWarehouse,
  IconFileText,
  IconPhoto,
  IconUpload,
  IconCalendarEvent,
  IconPlus,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { type ClienteRecord, type Compito, OPEN_TASK_STATI } from "@/lib/mock-data"
import { ClienteAvatar } from "./cliente-utils"
import { QuickCompitoDialog } from "@/components/compiti/quick-compito-dialog"

/* ---------- Helpers ---------- */

function val(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Sì" : "No"
  return String(v)
}

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ""
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
  { id: "section-impianto", label: "Impianto" },
  { id: "section-pagamenti", label: "Pagamenti" },
  { id: "section-iter", label: "Iter burocratico" },
  { id: "section-logistica", label: "Logistica" },
  { id: "section-documenti", label: "Documenti" },
  { id: "section-comunicazioni", label: "Comunicazioni" },
  { id: "section-note", label: "Note" },
  { id: "section-attivita", label: "Attività" },
] as const

function RelatedNav() {
  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
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
        </button>
      ))}
    </nav>
  )
}

/* ---------- Anagrafica ---------- */

function Anagrafica({ cliente }: { cliente: ClienteRecord }) {
  const [editing, setEditing] = useState(false)
  const [descr, setDescr] = useState(cliente.Descrizione ?? "")
  const [draft, setDraft] = useState(cliente.Descrizione ?? "")
  const [savingDescr, setSavingDescr] = useState(false)

  async function handleSaveDescr() {
    setSavingDescr(true)
    try {
      const res = await fetch(`/api/clienti/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Descrizione: draft }),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      setDescr(draft)
      setEditing(false)
      toast.success("Descrizione aggiornata")
    } catch {
      toast.error("Errore nel salvataggio della descrizione")
    } finally {
      setSavingDescr(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <DataField label="Nome">{val(cliente.Nome)}</DataField>
            <DataField label="Cognome">{val(cliente.Cognome)}</DataField>
          </div>
          <DataField label="Saluti">{val(cliente.Saluti)}</DataField>
          <DataField label="Codice fiscale">{val(cliente["Codice fiscale"])}</DataField>
          <CopyField label="E-mail" value={cliente["E-mail"]} icon={IconMail} />
          <CopyField
            label="E-mail secondaria"
            value={cliente["E-mail secondaria"]}
            icon={IconMail}
          />
        </div>
        <div className="flex flex-col gap-4">
          <CopyField label="Cellulare" value={cliente.Cellulare} icon={IconPhone} />
          <CopyField label="Altro telefono" value={cliente["Altro telefono"]} icon={IconPhone} />
          <DataField label="Clienti Proprietario">
            {val(cliente["Clienti Proprietario"])}
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-foreground">
          <IconMapPin size={14} stroke={1.8} className="text-muted-foreground" />
          <span>{val(cliente["Via indirizzo postale"])}</span>
          <span className="text-border">·</span>
          <span>{val(cliente["Città indirizzo postale"])}</span>
          <span className="text-border">·</span>
          <span>{val(cliente["Provincia indirizzo postale"])}</span>
          <span className="text-border">·</span>
          <span>{val(cliente["Codice postale indirizzo"])}</span>
        </div>
      </div>

      {/* Descrizione */}
      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
          Descrizione
        </span>
        {editing ? (
          <div className="flex flex-col gap-2 animate-in fade-in duration-150">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="bg-card text-[13px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={savingDescr}
                onClick={() => {
                  setDraft(descr)
                  setEditing(false)
                }}
              >
                Annulla
              </Button>
              <Button
                size="sm"
                className="bg-teal text-teal-foreground hover:bg-teal/90"
                disabled={savingDescr}
                onClick={handleSaveDescr}
              >
                {savingDescr ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(descr)
              setEditing(true)
            }}
            className="w-full rounded-lg border border-border bg-secondary/40 p-3 text-left text-[13px] leading-relaxed text-foreground transition-colors duration-150 hover:bg-secondary"
          >
            {descr ? (
              descr
            ) : (
              <span className="text-muted-foreground">
                Nessuna descrizione. Clicca per aggiungere…
              </span>
            )}
          </button>
        )}
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
  const filled = rows.filter(([, v]) => v !== "—")
  if (filled.length === 0) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-navy">
        <Icon size={15} stroke={1.8} />
        {title}
      </div>
      <dl className="flex flex-col gap-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="text-right text-[12px] font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
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
    </div>
  )
}

/* ---------- Pagamenti ---------- */

function Pagamenti({ cliente }: { cliente: ClienteRecord }) {
  const [fin, setFin] = useState(Boolean(cliente["Finanziamento approvato"]))
  const [reverse, setReverse] = useState(Boolean(cliente["Iva Reverse charge"]))
  const euro = (n: number | undefined) =>
    typeof n === "number"
      ? n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
      : "—"

  const tranche: [string, string, string][] = [
    ["1° Tranche", val(cliente["1° Tranche"]), val(cliente.Bonifico1)],
    ["2° Tranche", val(cliente["2°Tranche"]), val(cliente.Bonifico2)],
    ["PDC", val(cliente.BonificoPDC), val(cliente.FatturaPDC)],
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Riepilogo */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Totale contratto
        </span>
        <div className="text-3xl font-bold tabular-nums text-foreground">
          {euro(cliente["Tot Contratto"] ?? cliente["Importo Contrattuale"])}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[12px]">
          <span className="text-muted-foreground">
            di cui CT3:{" "}
            <span className="font-semibold text-foreground">{euro(cliente["di cui CT3"])}</span>
          </span>
          <span className="text-muted-foreground">
            di cui FTV:{" "}
            <span className="font-semibold text-foreground">{euro(cliente["di cui FTV"])}</span>
          </span>
          {cliente["Corrispettivo pagato"] ? (
            <Badge className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              Corrispettivo pagato ✓
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <DataField label="Modalità di Pagamento">
          {val(cliente["Modalità di Pagamento"])}
        </DataField>
        <DataField label="Importo Contrattuale">{euro(cliente["Importo Contrattuale"])}</DataField>
        <CopyField label="IBAN" value={cliente.IBAN} icon={IconReceipt2} />
        <DataField label="Finanziamento approvato">
          <Switch
            checked={fin}
            onCheckedChange={(v) => {
              setFin(v)
              toast.success(v ? "Finanziamento approvato" : "Finanziamento non approvato")
            }}
          />
        </DataField>
      </div>

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
            <tr>
              <td className="px-3 py-2 font-medium text-foreground">Saldo</td>
              <td className="px-3 py-2 text-foreground" colSpan={2}>
                {euro(cliente.Saldo)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <DataField label="Importo Finanziamento">{euro(cliente["Importo Finanziamento"])}</DataField>
        <DataField label="N. rate e importo rata">{val(cliente["N. rate e importo rata"])}</DataField>
        <DataField label="Sconto COMBO">{euro(cliente["Sconto COMBO"])}</DataField>
        <DataField label="Importo da Listino">{euro(cliente["Importo da Listino"])}</DataField>
        <DataField label="Importo TICA">{euro(cliente["Importo TICA"])}</DataField>
        <DataField label="IVA">{cliente.IVA ? `${cliente.IVA}%` : "—"}</DataField>
        <DataField label="Iva Reverse charge">
          <Switch
            checked={reverse}
            onCheckedChange={(v) => {
              setReverse(v)
              toast.success("Aggiornato")
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

function Iter({ cliente }: { cliente: ClienteRecord }) {
  const [notifica, setNotifica] = useState(Boolean(cliente["Notifica pred. reg. esercizio"]))
  const [disp, setDisp] = useState(Boolean(cliente["Disponibilità Fine lavori"]))
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <IterStepper cliente={cliente} />
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <DataField label="POD">{val(cliente.POD)}</DataField>
        <DataField label="Zona">{val(cliente.Zona)}</DataField>
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
          <Switch checked={notifica} onCheckedChange={setNotifica} />
        </DataField>
        <DataField label="Disponibilità Fine lavori">
          <Switch checked={disp} onCheckedChange={setDisp} />
        </DataField>
      </div>
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
      {hasValue(cliente.Installatore) ? (
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Installatore assegnato
          </span>
          <Badge className="rounded-full bg-warning/10 px-2.5 py-0.5 text-[11px] font-medium text-warning">
            {cliente.Installatore}
          </Badge>
        </div>
      ) : null}
    </div>
  )
}

/* ---------- Documenti ---------- */

function Documenti({ cliente }: { cliente: ClienteRecord }) {
  const [verifica, setVerifica] = useState(Boolean(cliente["Verifica documentale"]))
  const [layout, setLayout] = useState(Boolean(cliente["Layout verificato"]))

  const docs: { label: string; value: string | undefined }[] = [
    { label: "Mappa catastale", value: cliente["Mappa catastale"] },
    { label: "Regolamento di esercizio", value: cliente["Regolamento di esecizio"] },
    { label: "Attestato Terna", value: cliente["Attestato Terna"] },
    { label: "Scheda ENEA", value: cliente["Scheda ENEA"] },
    { label: "Fattura 1", value: cliente.Fattura1 },
    { label: "Fattura 2", value: cliente.Fattura2 },
  ]
  const allegati = cliente.Allegati ?? []
  const anyDoc = docs.some((d) => hasValue(d.value)) || allegati.length > 0

  if (!anyDoc) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-secondary/30 py-6 text-center text-sm text-muted-foreground">
        Nessun documento caricato
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {docs.map((d) => {
          const present = hasValue(d.value)
          return (
            <li
              key={d.label}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-navy">
                <IconFileText size={18} stroke={1.8} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {d.label}
                </span>
                {present ? (
                  <span className="truncate text-[11px] text-muted-foreground">{d.value}</span>
                ) : null}
              </div>
              <Badge
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  present ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {present ? "Presente" : "Mancante"}
              </Badge>
              <button
                type="button"
                aria-label={present ? "Visualizza" : "Carica"}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-navy transition-colors hover:bg-secondary"
              >
                {present ? <IconPhoto size={16} stroke={1.8} /> : <IconUpload size={16} stroke={1.8} />}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-6 border-t border-border pt-4">
        <DataField label="Verifica documentale">
          <Switch checked={verifica} onCheckedChange={setVerifica} />
        </DataField>
        <DataField label="Layout verificato">
          <Switch checked={layout} onCheckedChange={setLayout} />
        </DataField>
      </div>

      {/* Allegati generici */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-navy">
          Allegati generici
        </span>
        {allegati.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {allegati.map((a) => (
              <li
                key={a}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <IconPaperclip size={16} stroke={1.8} className="text-navy" />
                <span className="truncate text-[13px] text-foreground">{a}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-secondary/30 py-6 text-center">
          <IconUpload size={22} stroke={1.6} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Trascina qui i file o clicca per caricare
          </span>
        </div>
      </div>
    </div>
  )
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
}

function NoteSection({ cliente }: { cliente: ClienteRecord }) {
  const seed: Nota[] = cliente.Note
    ? [
        {
          id: "n1",
          autore: cliente["Clienti Proprietario"] ?? "Sistema",
          quando: "2 ore fa",
          testo: cliente.Note,
        },
      ]
    : []
  const [note, setNote] = useState<Nota[]>(seed)
  const [nuova, setNuova] = useState("")

  const aggiungi = () => {
    if (nuova.trim() === "") return
    setNote((prev) => [
      {
        id: `n${Date.now()}`,
        autore: cliente["Clienti Proprietario"] ?? "Tu",
        quando: "adesso",
        testo: nuova.trim(),
      },
      ...prev,
    ])
    setNuova("")
    toast.success("Nota aggiunta")
  }

  const extra: { label: string; value: string | undefined }[] = [
    { label: "Note ufficio", value: cliente["Note ufficio"] },
    { label: "Note pagamenti", value: cliente["Note pagamenti"] },
    { label: "Note Provvigioni", value: cliente["Note Provvigioni"] },
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
                  <p className="text-[13px] text-foreground">{n.testo}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
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
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <RelatedNav />

      <Section id="section-anagrafica" title="Anagrafica" icon={IconUser}>
        <Anagrafica cliente={cliente} />
      </Section>

      <Section id="section-impianto" title="Impianto" icon={IconBolt}>
        <Impianto cliente={cliente} />
      </Section>

      <Section id="section-pagamenti" title="Pagamenti" icon={IconReceipt2}>
        <Pagamenti cliente={cliente} />
      </Section>

      <Section id="section-iter" title="Iter burocratico" icon={IconRoute}>
        <Iter cliente={cliente} />
      </Section>

      <Section id="section-logistica" title="Logistica e cantiere" icon={IconTruck}>
        <Logistica cliente={cliente} />
      </Section>

      <Section id="section-documenti" title="Documenti e pratiche" icon={IconPaperclip}>
        <Documenti cliente={cliente} />
      </Section>

      <Section
        id="section-comunicazioni"
        title="Comunicazioni automatiche"
        icon={IconMessages}
        defaultOpen={false}
      >
        <Comunicazioni cliente={cliente} />
      </Section>

      <Section id="section-note" title="Note" icon={IconNote}>
        <NoteSection cliente={cliente} />
      </Section>

      <Section id="section-attivita" title="Attività" icon={IconChecklist}>
        <Attivita cliente={cliente} />
      </Section>
    </div>
  )
}
