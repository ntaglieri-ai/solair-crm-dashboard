"use client"

import type { ReactNode } from "react"
import { useEffect, useId, useMemo, useState } from "react"
import {
  CheckCircle2,
  Cloud,
  Fingerprint,
  Gauge,
  KeyRound,
  LockKeyhole,
  Loader2,
  Mail,
  MessageCircle,
  RadioTower,
  Save,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { ConsensoEnforcementCard } from "@/components/crm-settings/consenso-enforcement-card"
import { CaselleCondiviseCard } from "@/components/crm-settings/caselle-condivise-card"
import { usePersistentSystemSetting } from "@/lib/crm-settings/use-persistent-system-setting"
import { usePermissions } from "@/lib/permissions/provider"
import { cn } from "@/lib/utils"

type EmailPolicy = {
  provider: "aws-ses"
  region: string
  domain: string
  fromEmail: string
  fromName: string
  replyTo: string
  bulkReplyTo: "agente" | "azienda"
  bulkPacing: "prudente" | "ses"
}

type SpokiSettings = {
  enabled: boolean
  whatsappNumber: string
  businessName: string
  apiToken: string
  webhookUrl: string
  defaultTemplate: string
}

type CommunicationSettings = {
  email: EmailPolicy
  spoki: SpokiSettings
  /**
   * Responsabili delle automazioni di handoff (procedura Vito 4.4 e 5.5).
   * Le chiavi sono lette per nome esatto da lib/automazioni/handoff.ts.
   */
  automazioni: {
    responsabile_fatturazione: string
    responsabile_passaggio_pratica: string
  }
  notes: string
}

type LegacyCommunicationSettings = Partial<CommunicationSettings> & {
  smtp?: {
    fromEmail?: string
    fromName?: string
    replyTo?: string
  }
}

const EMPTY_SETTINGS: CommunicationSettings = {
  email: {
    provider: "aws-ses",
    region: "eu-west-1",
    domain: "solairgroup.it",
    fromEmail: "commerciale@solairgroup.it",
    fromName: "Solair CRM",
    replyTo: "commerciale@solairgroup.it",
    bulkReplyTo: "agente",
    bulkPacing: "ses",
  },
  spoki: {
    enabled: false,
    whatsappNumber: "",
    businessName: "Solair Group",
    apiToken: "",
    webhookUrl: "",
    defaultTemplate: "",
  },
  automazioni: {
    responsabile_fatturazione: "",
    responsabile_passaggio_pratica: "",
  },
  notes: "",
}

type SectionState = "active" | "ready" | "missing"
type CommunicationSectionKey = Exclude<keyof CommunicationSettings, "notes">

const EMAIL_RUNTIME = {
  provider: "Amazon SES",
  region: "eu-west-1",
  endpoint: "email-smtp.eu-west-1.amazonaws.com",
  port: "465",
  fromEmail: "commerciale@solairgroup.it",
  replyTo: "commerciale@solairgroup.it",
}

export default function CommunicationsPage() {
  const permissions = usePermissions()
  const canEdit = permissions.canAction("company.communication.manage")
  const [stored, setStored, store] = usePersistentSystemSetting<CommunicationSettings>(
    "system.communication",
    EMPTY_SETTINGS,
  )
  const [form, setForm] = useState(stored)

  useEffect(() => {
    queueMicrotask(() => setForm(mergeSettings(stored as LegacyCommunicationSettings)))
  }, [stored])

  const emailState: SectionState = "active"
  const spokiState = channelState(form.spoki.enabled, [form.spoki.webhookUrl, form.spoki.apiToken])
  const handoffState = requiredState([
    form.automazioni.responsabile_fatturazione,
    form.automazioni.responsabile_passaggio_pratica,
  ])
  const configuredAreas = useMemo(
    () => [emailState, spokiState, handoffState].filter((state) => state === "active").length,
    [emailState, spokiState, handoffState],
  )

function save() {
    setStored(mergeSettings(form))
    toast.success("Configurazione comunicazioni salvata")
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Comunicazioni"
        description={
          store.saving
            ? "Salvataggio configurazione..."
            : "Policy email CRM, WhatsApp Spoki e responsabili delle automazioni operative."
        }
        action={
          canEdit ? (
            <Button
              onClick={save}
              disabled={store.saving}
              className="bg-navy text-navy-foreground hover:bg-navy/90"
            >
              {store.saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salva
            </Button>
          ) : undefined
        }
      />

      {store.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {store.error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Email transazionali" value="Attive" icon={<Mail className="size-5" />} />
        <SummaryCard label="Aree configurate" value={`${configuredAreas}/3`} icon={<ShieldCheck className="size-5" />} />
        <SummaryCard
          label="Sorgente segreti"
          value="Vercel env"
          icon={<KeyRound className="size-5" />}
        />
      </div>

      {/* Sta in cima e non in fondo: e' l'unica impostazione di questa pagina
          che, spenta, cambia CHI riceve le email invece di come partono. */}
      <ConsensoEnforcementCard />

      <section className="overflow-hidden rounded-xl border border-[#d8dde6] bg-card shadow-sm">
        <div className="border-b border-[#d8dde6] bg-[#f3f7fb] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#0176d3] text-white shadow-sm">
                <Cloud className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-foreground">Email CRM via Amazon SES</h3>
                  <span className="inline-flex h-7 items-center gap-1 rounded-full bg-emerald-100 px-2.5 text-xs font-black text-emerald-800">
                    <CheckCircle2 className="size-3.5" />
                    Attivo via AWS SES
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  Stato reale della produzione: il CRM invia account, reset, lead, clienti e massa
                  tramite SES quando gli SMTP di sistema sono configurati.
                </p>
              </div>
            </div>
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#0176d3]/20 bg-white px-3 text-xs font-black uppercase tracking-wide text-[#0176d3]">
              <Sparkles className="size-3.5" />
              Production source of truth
            </span>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-[#d8dde6] p-5 lg:border-b-0 lg:border-r">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <RuntimeMetric
                label="Provider"
                value={EMAIL_RUNTIME.provider}
                tone="blue"
                icon={<Server className="size-4" />}
              />
              <RuntimeMetric
                label="Regione"
                value={EMAIL_RUNTIME.region}
                tone="cyan"
                icon={<RadioTower className="size-4" />}
              />
              <RuntimeMetric
                label="Mittente"
                value={form.email.fromEmail}
                tone="green"
                icon={<Send className="size-4" />}
              />
              <RuntimeMetric
                label="Reply-to massa"
                value={form.email.bulkReplyTo === "agente" ? "Agente" : "Azienda"}
                tone="violet"
                icon={<Mail className="size-4" />}
              />
              <RuntimeMetric
                label="Segreti"
                value="Vercel env"
                tone="violet"
                icon={<LockKeyhole className="size-4" />}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <EmailFlowCard title="Nuovo account" description="Welcome email e password temporanea" />
              <EmailFlowCard title="Reset password" description="Credenziali temporanee da recupero accesso" />
              <EmailFlowCard title="Lead e massa" description="From Solair, reply-to secondo policy" />
            </div>

            <div className="mt-5 rounded-xl border border-[#d8dde6] bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-[#0176d3]" />
                <h4 className="text-sm font-black uppercase tracking-wide text-foreground">Policy operative</h4>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <TextField
                  label="Mittente CRM"
                  value={form.email.fromEmail}
                  disabled={!canEdit}
                  onChange={(fromEmail) => update("email", { fromEmail })}
                  placeholder="commerciale@solairgroup.it"
                />
                <TextField
                  label="Nome mittente"
                  value={form.email.fromName}
                  disabled={!canEdit}
                  onChange={(fromName) => update("email", { fromName })}
                  placeholder="Solair CRM"
                />
                <TextField
                  label="Reply-to aziendale"
                  value={form.email.replyTo}
                  disabled={!canEdit}
                  onChange={(replyTo) => update("email", { replyTo })}
                  placeholder="commerciale@solairgroup.it"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SegmentedField
                    label="Reply-to invii massa"
                    value={form.email.bulkReplyTo}
                    disabled={!canEdit}
                    options={[
                      { value: "agente", label: "Agente" },
                      { value: "azienda", label: "Azienda" },
                    ]}
                    onChange={(bulkReplyTo) => update("email", { bulkReplyTo })}
                  />
                  <SegmentedField
                    label="Ritmo invii massa"
                    value={form.email.bulkPacing}
                    disabled={!canEdit}
                    options={[
                      { value: "ses", label: "SES" },
                      { value: "prudente", label: "Prudente" },
                    ]}
                    onChange={(bulkPacing) => update("email", { bulkPacing })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#fbfcfe] p-5">
            <div className="flex items-center gap-2">
              <Fingerprint className="size-4 text-[#0176d3]" />
              <h4 className="text-sm font-black uppercase tracking-wide text-foreground">Confini operativi</h4>
            </div>
            <div className="mt-3 grid gap-2">
              <BoundaryRow label="Segreti letti dal codice" value="SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD" />
              <BoundaryRow label="Policy letta dal codice" value="Mittente, reply-to massa, ritmo invio" />
              <BoundaryRow label="Non salvato qui" value="Access key, SMTP password, secret AWS" />
              <BoundaryRow label="Fallback" value="Aruba personale solo se SES non disponibile" />
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-[#d8dde6] bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
          <EnvPill label="SMTP_HOST" value={EMAIL_RUNTIME.endpoint} />
          <EnvPill label="SMTP_PORT" value={EMAIL_RUNTIME.port} />
          <EnvPill label="SMTP_FROM" value={form.email.fromEmail} />
          <EnvPill label="AWS credentials" value="solo Vercel env" />
        </div>
      </section>

      <CaselleCondiviseCard />

      <ConfigCard
        title="WhatsApp Spoki"
        description="Configurazione realmente letta dall'inoltro scheda installatore quando il canale preferito e' WhatsApp."
        icon={<MessageCircle className="size-5" />}
        state={spokiState}
        enabled={form.spoki.enabled}
        disabled={!canEdit}
        onEnabledChange={(enabled) => update("spoki", { enabled })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Numero WhatsApp"
            value={form.spoki.whatsappNumber}
            disabled={!canEdit}
            onChange={(whatsappNumber) => update("spoki", { whatsappNumber })}
            placeholder="+39..."
          />
          <TextField
            label="Nome business"
            value={form.spoki.businessName}
            disabled={!canEdit}
            onChange={(businessName) => update("spoki", { businessName })}
          />
          <TextField
            label="Webhook URL"
            value={form.spoki.webhookUrl}
            disabled={!canEdit}
            onChange={(webhookUrl) => update("spoki", { webhookUrl })}
          />
          <TextField
            label="Template default"
            value={form.spoki.defaultTemplate}
            disabled={!canEdit}
            onChange={(defaultTemplate) => update("spoki", { defaultTemplate })}
          />
          <div className="sm:col-span-2">
            <SecretField
              label="API token"
              value={form.spoki.apiToken}
              disabled={!canEdit}
              onChange={(apiToken) => update("spoki", { apiToken })}
            />
          </div>
        </div>
      </ConfigCard>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Workflow className="size-5 text-navy" />
          <h3 className="text-base font-black text-foreground">Automazioni handoff</h3>
          <StateBadge state={handoffState} />
        </div>
        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
          Email degli utenti a cui assegnare i Compiti creati dai trigger cliente.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Responsabile fatturazione"
            value={form.automazioni.responsabile_fatturazione}
            disabled={!canEdit}
            onChange={(responsabile_fatturazione) =>
              update("automazioni", { responsabile_fatturazione })
            }
            placeholder="giulia.marano@solairgroup.it"
          />
          <TextField
            label="Responsabile passaggio pratica"
            value={form.automazioni.responsabile_passaggio_pratica}
            disabled={!canEdit}
            onChange={(responsabile_passaggio_pratica) =>
              update("automazioni", { responsabile_passaggio_pratica })
            }
            placeholder="paola.polimeni@solairgroup.it"
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Se un campo e&apos; vuoto o non corrisponde a un utente CRM, il trigger non crea il Compito.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-5 text-navy" />
          <h3 className="text-base font-black text-foreground">Registro operativo</h3>
        </div>
        <Textarea
          value={form.notes}
          disabled={!canEdit}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          rows={4}
          placeholder="Es. SES production access attivo, SPF/DKIM verificati, bounce handling da collegare..."
        />
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Non inserire password, access key o token AWS in questo campo.
        </p>
      </section>
    </div>
  )

  function update<K extends CommunicationSectionKey>(
    section: K,
    patch: Partial<CommunicationSettings[K]>,
  ) {
    setForm((current) => ({
      ...current,
      [section]: { ...current[section], ...patch },
    }))
  }
}

function mergeSettings(value: LegacyCommunicationSettings): CommunicationSettings {
  return {
    ...EMPTY_SETTINGS,
    ...value,
    email: {
      ...EMPTY_SETTINGS.email,
      ...value.email,
      fromEmail: value.email?.fromEmail ?? value.smtp?.fromEmail ?? EMPTY_SETTINGS.email.fromEmail,
      fromName: value.email?.fromName ?? value.smtp?.fromName ?? EMPTY_SETTINGS.email.fromName,
      replyTo: value.email?.replyTo ?? value.smtp?.replyTo ?? EMPTY_SETTINGS.email.replyTo,
      bulkReplyTo: value.email?.bulkReplyTo === "azienda" ? "azienda" : "agente",
      bulkPacing: value.email?.bulkPacing === "prudente" ? "prudente" : "ses",
    },
    spoki: { ...EMPTY_SETTINGS.spoki, ...value.spoki },
    automazioni: { ...EMPTY_SETTINGS.automazioni, ...value.automazioni },
    notes: value.notes ?? "",
  }
}

function requiredState(required: string[]): SectionState {
  const filled = required.filter((value) => value.trim()).length
  if (filled === 0) return "missing"
  return filled === required.length ? "active" : "ready"
}

function channelState(enabled: boolean, required: string[]): SectionState {
  if (!enabled) return "missing"
  return required.every((value) => value.trim()) ? "active" : "ready"
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className="flex size-9 items-center justify-center rounded-lg bg-navy/5 text-navy">{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-black text-foreground">{value}</div>
    </div>
  )
}

function RuntimeMetric({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone: "blue" | "cyan" | "green" | "violet"
  icon: ReactNode
}) {
  const toneClass = {
    blue: "border-[#0176d3]/20 bg-[#eaf5fe] text-[#0176d3]",
    cyan: "border-cyan-500/20 bg-cyan-50 text-cyan-700",
    green: "border-emerald-500/20 bg-emerald-50 text-emerald-700",
    violet: "border-violet-500/20 bg-violet-50 text-violet-700",
  }[tone]

  return (
    <div className="rounded-lg border border-[#d8dde6] bg-white p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("flex size-7 items-center justify-center rounded-lg border", toneClass)}>
          {icon}
        </span>
      </div>
      <div className="mt-3 truncate text-sm font-black text-foreground">{value}</div>
    </div>
  )
}

function EmailFlowCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-[#d8dde6] bg-white p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-3.5" />
        </span>
        <span className="text-sm font-black text-foreground">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function BoundaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d8dde6] bg-white px-3 py-2">
      <div className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-relaxed text-foreground">{value}</div>
    </div>
  )
}

function ConfigCard({
  title,
  description,
  icon,
  state,
  enabled,
  disabled,
  onEnabledChange,
  children,
}: {
  title: string
  description: string
  icon: ReactNode
  state: SectionState
  enabled: boolean
  disabled: boolean
  onEnabledChange: (enabled: boolean) => void
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-foreground">{title}</h3>
              <StateBadge state={state} />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} disabled={disabled} onCheckedChange={onEnabledChange} aria-label={`Attiva ${title}`} />
      </div>
      {children}
    </section>
  )
}

function StateBadge({ state }: { state: SectionState }) {
  const label = state === "active" ? "Completo" : state === "ready" ? "Parziale" : "Da configurare"
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-xs font-bold",
        state === "active" && "bg-emerald-100 text-emerald-800",
        state === "ready" && "bg-amber-100 text-amber-800",
        state === "missing" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  )
}

function EnvPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-foreground">{value}</div>
    </div>
  )
}

function TextField({
  label,
  value,
  disabled,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
  placeholder?: string
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function SegmentedField<TValue extends string>({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string
  value: TValue
  disabled: boolean
  options: Array<{ value: TValue; label: string }>
  onChange: (value: TValue) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <Label id={id}>{label}</Label>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="grid grid-cols-2 rounded-lg border border-border bg-muted/40 p-1"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 rounded-md px-3 text-sm font-bold text-muted-foreground transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === option.value && "bg-white text-navy shadow-sm",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SecretField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        value={value}
        disabled={disabled}
        autoComplete="new-password"
        placeholder="••••••••"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
