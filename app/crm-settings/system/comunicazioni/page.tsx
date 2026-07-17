"use client"

import type { ReactNode } from "react"
import { useEffect, useId, useMemo, useState } from "react"
import {
  BellRing,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  PhoneCall,
  Save,
  Server,
  ShieldCheck,
  Webhook,
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

type MailServerConfig = {
  enabled: boolean
  host: string
  port: string
  secure: boolean
  username: string
  password: string
}

type CommunicationSettings = {
  smtp: MailServerConfig & {
    fromEmail: string
    fromName: string
    replyTo: string
  }
  imap: MailServerConfig & {
    mailbox: string
  }
  crx: {
    enabled: boolean
    baseUrl: string
    tenant: string
    apiKey: string
    mainNumber: string
    extensionPrefix: string
  }
  spoki: {
    enabled: boolean
    whatsappNumber: string
    businessName: string
    apiToken: string
    webhookUrl: string
    defaultTemplate: string
  }
  pec: {
    enabled: boolean
    address: string
    provider: string
  }
  sms: {
    enabled: boolean
    provider: string
    sender: string
    apiKey: string
  }
  webchat: {
    enabled: boolean
    provider: string
    widgetId: string
    scriptUrl: string
  }
  webhook: {
    enabled: boolean
    inboundUrl: string
    signingSecret: string
  }
  notes: string
}

const EMPTY_MAIL_SERVER: MailServerConfig = {
  enabled: false,
  host: "",
  port: "",
  secure: true,
  username: "",
  password: "",
}

const EMPTY_SETTINGS: CommunicationSettings = {
  smtp: {
    ...EMPTY_MAIL_SERVER,
    port: "465",
    fromEmail: "",
    fromName: "Solair CRM",
    replyTo: "",
  },
  imap: {
    ...EMPTY_MAIL_SERVER,
    port: "993",
    mailbox: "INBOX",
  },
  crx: {
    enabled: false,
    baseUrl: "",
    tenant: "",
    apiKey: "",
    mainNumber: "",
    extensionPrefix: "",
  },
  spoki: {
    enabled: false,
    whatsappNumber: "",
    businessName: "Solair Group",
    apiToken: "",
    webhookUrl: "",
    defaultTemplate: "",
  },
  pec: {
    enabled: false,
    address: "",
    provider: "Aruba",
  },
  sms: {
    enabled: false,
    provider: "",
    sender: "SOLAIR",
    apiKey: "",
  },
  webchat: {
    enabled: false,
    provider: "",
    widgetId: "",
    scriptUrl: "",
  },
  webhook: {
    enabled: false,
    inboundUrl: "",
    signingSecret: "",
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
    queueMicrotask(() => setForm(mergeSettings(stored)))
  }, [stored])

  const activeChannels = useMemo(() => {
    return [
      form.smtp.enabled,
      form.imap.enabled,
      form.crx.enabled,
      form.spoki.enabled,
      form.pec.enabled,
      form.sms.enabled,
      form.webchat.enabled,
      form.webhook.enabled,
    ].filter(Boolean).length
  }, [form])

  function save() {
    setStored(mergeSettings(form))
    toast.success("Canali di comunicazione salvati")
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Canali e mail server"
        description={
          store.saving
            ? "Salvataggio configurazione..."
            : "Configura SMTP, IMAP, centralino CRX, WhatsApp Spoki e gli altri canali operativi del CRM."
        }
        action={
          canEdit ? (
            <Button onClick={save} disabled={store.saving} className="bg-navy text-navy-foreground hover:bg-navy/90">
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
        <SummaryCard label="Canali attivi" value={activeChannels} icon={<BellRing className="size-5" />} />
        <SummaryCard label="Mail server" value={mailStateLabel(form.smtp, form.imap)} icon={<Mail className="size-5" />} />
        <SummaryCard label="Messaggistica" value={messageStateLabel(form)} icon={<MessageCircle className="size-5" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ConfigCard
          title="SMTP in uscita"
          description="Invio password temporanee, reset account, notifiche e automazioni email."
          icon={<Server className="size-5" />}
          state={serverState(form.smtp, ["host", "port", "username", "fromEmail"])}
          enabled={form.smtp.enabled}
          disabled={!canEdit}
          onEnabledChange={(enabled) => update("smtp", { enabled })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Host" value={form.smtp.host} disabled={!canEdit} onChange={(host) => update("smtp", { host })} placeholder="smtps.aruba.it" />
            <TextField label="Porta" value={form.smtp.port} disabled={!canEdit} onChange={(port) => update("smtp", { port })} placeholder="465" />
            <TextField label="Username" value={form.smtp.username} disabled={!canEdit} onChange={(username) => update("smtp", { username })} placeholder="mail@dominio.it" />
            <SecretField label="Password" value={form.smtp.password} disabled={!canEdit} onChange={(password) => update("smtp", { password })} />
            <TextField label="Mittente email" value={form.smtp.fromEmail} disabled={!canEdit} onChange={(fromEmail) => update("smtp", { fromEmail })} placeholder="crm@solairgroup.it" />
            <TextField label="Nome mittente" value={form.smtp.fromName} disabled={!canEdit} onChange={(fromName) => update("smtp", { fromName })} placeholder="Solair CRM" />
            <TextField label="Reply-to" value={form.smtp.replyTo} disabled={!canEdit} onChange={(replyTo) => update("smtp", { replyTo })} placeholder="support@solairgroup.it" />
            <ToggleField label="SSL/TLS" checked={form.smtp.secure} disabled={!canEdit} onChange={(secure) => update("smtp", { secure })} />
          </div>
        </ConfigCard>

        <ConfigCard
          title="IMAP in entrata"
          description="Lettura caselle, ticket da email e riconciliazione conversazioni cliente."
          icon={<Mail className="size-5" />}
          state={serverState(form.imap, ["host", "port", "username"])}
          enabled={form.imap.enabled}
          disabled={!canEdit}
          onEnabledChange={(enabled) => update("imap", { enabled })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Host" value={form.imap.host} disabled={!canEdit} onChange={(host) => update("imap", { host })} placeholder="imaps.aruba.it" />
            <TextField label="Porta" value={form.imap.port} disabled={!canEdit} onChange={(port) => update("imap", { port })} placeholder="993" />
            <TextField label="Username" value={form.imap.username} disabled={!canEdit} onChange={(username) => update("imap", { username })} placeholder="mail@dominio.it" />
            <SecretField label="Password" value={form.imap.password} disabled={!canEdit} onChange={(password) => update("imap", { password })} />
            <TextField label="Cartella" value={form.imap.mailbox} disabled={!canEdit} onChange={(mailbox) => update("imap", { mailbox })} placeholder="INBOX" />
            <ToggleField label="SSL/TLS" checked={form.imap.secure} disabled={!canEdit} onChange={(secure) => update("imap", { secure })} />
          </div>
        </ConfigCard>

        <ConfigCard
          title="Centralino CRX"
          description="Click-to-call, log chiamate, interni e numero principale aziendale."
          icon={<PhoneCall className="size-5" />}
          state={channelState(form.crx.enabled, [form.crx.baseUrl, form.crx.mainNumber])}
          enabled={form.crx.enabled}
          disabled={!canEdit}
          onEnabledChange={(enabled) => update("crx", { enabled })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="URL API" value={form.crx.baseUrl} disabled={!canEdit} onChange={(baseUrl) => update("crx", { baseUrl })} placeholder="https://centralino.example.it/api" />
            <TextField label="Tenant / azienda" value={form.crx.tenant} disabled={!canEdit} onChange={(tenant) => update("crx", { tenant })} />
            <TextField label="Numero principale" value={form.crx.mainNumber} disabled={!canEdit} onChange={(mainNumber) => update("crx", { mainNumber })} placeholder="+39..." />
            <TextField label="Prefisso interni" value={form.crx.extensionPrefix} disabled={!canEdit} onChange={(extensionPrefix) => update("crx", { extensionPrefix })} />
            <div className="sm:col-span-2">
              <SecretField label="API key" value={form.crx.apiKey} disabled={!canEdit} onChange={(apiKey) => update("crx", { apiKey })} />
            </div>
          </div>
        </ConfigCard>

        <ConfigCard
          title="WhatsApp Spoki"
          description="Numero WhatsApp aziendale, template e webhook per conversazioni commerciali."
          icon={<MessageCircle className="size-5" />}
          state={channelState(form.spoki.enabled, [form.spoki.whatsappNumber, form.spoki.apiToken])}
          enabled={form.spoki.enabled}
          disabled={!canEdit}
          onEnabledChange={(enabled) => update("spoki", { enabled })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Numero WhatsApp" value={form.spoki.whatsappNumber} disabled={!canEdit} onChange={(whatsappNumber) => update("spoki", { whatsappNumber })} placeholder="+39..." />
            <TextField label="Nome business" value={form.spoki.businessName} disabled={!canEdit} onChange={(businessName) => update("spoki", { businessName })} />
            <TextField label="Webhook URL" value={form.spoki.webhookUrl} disabled={!canEdit} onChange={(webhookUrl) => update("spoki", { webhookUrl })} />
            <TextField label="Template default" value={form.spoki.defaultTemplate} disabled={!canEdit} onChange={(defaultTemplate) => update("spoki", { defaultTemplate })} />
            <div className="sm:col-span-2">
              <SecretField label="API token" value={form.spoki.apiToken} disabled={!canEdit} onChange={(apiToken) => update("spoki", { apiToken })} />
            </div>
          </div>
        </ConfigCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ConfigCard
          title="PEC"
          description="Riferimento PEC ufficiale per comunicazioni amministrative."
          icon={<ShieldCheck className="size-5" />}
          state={channelState(form.pec.enabled, [form.pec.address])}
          enabled={form.pec.enabled}
          disabled={!canEdit}
          onEnabledChange={(enabled) => update("pec", { enabled })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Indirizzo PEC" value={form.pec.address} disabled={!canEdit} onChange={(address) => update("pec", { address })} placeholder="azienda@pec.it" />
            <TextField label="Provider" value={form.pec.provider} disabled={!canEdit} onChange={(provider) => update("pec", { provider })} />
          </div>
        </ConfigCard>

        <ConfigCard
          title="SMS"
          description="Provider SMS per OTP, promemoria appuntamenti e notifiche rapide."
          icon={<BellRing className="size-5" />}
          state={channelState(form.sms.enabled, [form.sms.provider, form.sms.apiKey])}
          enabled={form.sms.enabled}
          disabled={!canEdit}
          onEnabledChange={(enabled) => update("sms", { enabled })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Provider" value={form.sms.provider} disabled={!canEdit} onChange={(provider) => update("sms", { provider })} placeholder="Twilio, Skebby..." />
            <TextField label="Sender" value={form.sms.sender} disabled={!canEdit} onChange={(sender) => update("sms", { sender })} />
            <div className="sm:col-span-2">
              <SecretField label="API key" value={form.sms.apiKey} disabled={!canEdit} onChange={(apiKey) => update("sms", { apiKey })} />
            </div>
          </div>
        </ConfigCard>

        <ConfigCard
          title="Web chat"
          description="Widget chat sito web, tracking richieste e lead in ingresso."
          icon={<MessageCircle className="size-5" />}
          state={channelState(form.webchat.enabled, [form.webchat.provider, form.webchat.widgetId])}
          enabled={form.webchat.enabled}
          disabled={!canEdit}
          onEnabledChange={(enabled) => update("webchat", { enabled })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Provider" value={form.webchat.provider} disabled={!canEdit} onChange={(provider) => update("webchat", { provider })} placeholder="Crisp, Tawk, Intercom..." />
            <TextField label="Widget ID" value={form.webchat.widgetId} disabled={!canEdit} onChange={(widgetId) => update("webchat", { widgetId })} />
            <div className="sm:col-span-2">
              <TextField label="Script URL" value={form.webchat.scriptUrl} disabled={!canEdit} onChange={(scriptUrl) => update("webchat", { scriptUrl })} />
            </div>
          </div>
        </ConfigCard>

        <ConfigCard
          title="Webhook e API"
          description="Endpoint per ricevere eventi da form, campagne, portali e sistemi esterni."
          icon={<Webhook className="size-5" />}
          state={channelState(form.webhook.enabled, [form.webhook.inboundUrl])}
          enabled={form.webhook.enabled}
          disabled={!canEdit}
          onEnabledChange={(enabled) => update("webhook", { enabled })}
        >
          <div className="grid gap-3">
            <TextField label="Inbound URL" value={form.webhook.inboundUrl} disabled={!canEdit} onChange={(inboundUrl) => update("webhook", { inboundUrl })} />
            <SecretField label="Signing secret" value={form.webhook.signingSecret} disabled={!canEdit} onChange={(signingSecret) => update("webhook", { signingSecret })} />
          </div>
        </ConfigCard>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-5 text-navy" />
          <h3 className="text-base font-black text-foreground">Note operative e segreti</h3>
        </div>
        <Textarea
          value={form.notes}
          disabled={!canEdit}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          rows={4}
          placeholder="Es. SMTP Aruba attivo dopo verifica DNS SPF/DKIM, token Spoki da rigenerare ogni 6 mesi..."
        />
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Questa pagina salva la configurazione nel CRM. Le credenziali sono mascherate nell&apos;interfaccia; per l&apos;uso in produzione possiamo poi collegare questi valori al servizio di invio o spostarli in un vault dedicato.
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

function mergeSettings(value: CommunicationSettings): CommunicationSettings {
  return {
    ...EMPTY_SETTINGS,
    ...value,
    smtp: { ...EMPTY_SETTINGS.smtp, ...value.smtp },
    imap: { ...EMPTY_SETTINGS.imap, ...value.imap },
    crx: { ...EMPTY_SETTINGS.crx, ...value.crx },
    spoki: { ...EMPTY_SETTINGS.spoki, ...value.spoki },
    pec: { ...EMPTY_SETTINGS.pec, ...value.pec },
    sms: { ...EMPTY_SETTINGS.sms, ...value.sms },
    webchat: { ...EMPTY_SETTINGS.webchat, ...value.webchat },
    webhook: { ...EMPTY_SETTINGS.webhook, ...value.webhook },
  }
}

function serverState<T extends MailServerConfig>(server: T, required: Array<keyof T>): SectionState {
  if (!server.enabled) return "missing"
  return required.every((field) => String(server[field] ?? "").trim()) ? "active" : "ready"
}

function channelState(enabled: boolean, required: string[]): SectionState {
  if (!enabled) return "missing"
  return required.every((value) => value.trim()) ? "active" : "ready"
}

function mailStateLabel(smtp: CommunicationSettings["smtp"], imap: CommunicationSettings["imap"]) {
  if (smtp.enabled && imap.enabled) return "SMTP + IMAP"
  if (smtp.enabled) return "Solo SMTP"
  if (imap.enabled) return "Solo IMAP"
  return "Non attivo"
}

function messageStateLabel(form: CommunicationSettings) {
  const active = [form.spoki.enabled, form.sms.enabled, form.webchat.enabled, form.webhook.enabled].filter(Boolean).length
  return active > 0 ? `${active} attivi` : "Da configurare"
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
  const label = state === "active" ? "Completo" : state === "ready" ? "Parziale" : "Spento"
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

function ToggleField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
