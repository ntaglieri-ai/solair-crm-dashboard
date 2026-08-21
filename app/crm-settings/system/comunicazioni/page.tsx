"use client"

import type { ReactNode } from "react"
import { useEffect, useId, useMemo, useState } from "react"
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  Save,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
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
    region: "eu-south-1",
    domain: "solairgroup.it",
    fromEmail: "",
    fromName: "Solair CRM",
    replyTo: "",
    bulkReplyTo: "agente",
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

  const emailState = emailPolicyState(form.email)
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
        <SummaryCard label="Provider email CRM" value="AWS SES" icon={<Mail className="size-5" />} />
        <SummaryCard label="Aree configurate" value={`${configuredAreas}/3`} icon={<ShieldCheck className="size-5" />} />
        <SummaryCard
          label="Segreti produzione"
          value="Vercel env"
          icon={<KeyRound className="size-5" />}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy">
            <Server className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-foreground">Email CRM via Amazon SES</h3>
              <StateBadge state={emailState} />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Dati non sensibili della policy email. Access key, secret e credenziali SMTP non
              vengono salvati nel CRM.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm leading-relaxed text-amber-800">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Il mailer legacy usa ancora le variabili SMTP attuali; questa sezione prepara il
              passaggio a SES senza introdurre nuovi segreti in `crm_settings`.
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Regione SES"
            value={form.email.region}
            disabled={!canEdit}
            onChange={(region) => update("email", { region })}
            placeholder="eu-south-1"
          />
          <TextField
            label="Dominio verificato"
            value={form.email.domain}
            disabled={!canEdit}
            onChange={(domain) => update("email", { domain })}
            placeholder="solairgroup.it"
          />
          <TextField
            label="Mittente CRM"
            value={form.email.fromEmail}
            disabled={!canEdit}
            onChange={(fromEmail) => update("email", { fromEmail })}
            placeholder="crm@solairgroup.it"
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
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <EnvPill label="EMAIL_PROVIDER" value="ses" />
          <EnvPill label="SES_REGION" value={form.email.region || "da impostare"} />
          <EnvPill label="SES_FROM_EMAIL" value={form.email.fromEmail || "da impostare"} />
          <EnvPill label="AWS credentials" value="solo env" />
        </div>
      </section>

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
  const email = value.email ?? {
    ...EMPTY_SETTINGS.email,
    fromEmail: value.smtp?.fromEmail ?? EMPTY_SETTINGS.email.fromEmail,
    fromName: value.smtp?.fromName ?? EMPTY_SETTINGS.email.fromName,
    replyTo: value.smtp?.replyTo ?? EMPTY_SETTINGS.email.replyTo,
  }

  return {
    ...EMPTY_SETTINGS,
    ...value,
    email: { ...EMPTY_SETTINGS.email, ...email, provider: "aws-ses" },
    spoki: { ...EMPTY_SETTINGS.spoki, ...value.spoki },
    automazioni: { ...EMPTY_SETTINGS.automazioni, ...value.automazioni },
    notes: value.notes ?? "",
  }
}

function emailPolicyState(email: EmailPolicy): SectionState {
  return requiredState([email.region, email.domain, email.fromEmail])
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

function SegmentedField<T extends string>({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string
  value: T
  disabled: boolean
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <Label id={id}>{label}</Label>
      <div className="grid min-h-10 grid-cols-2 rounded-lg border border-border bg-muted/30 p-1" aria-labelledby={id}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
              value === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
