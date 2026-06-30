import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ChevronRight,
  Mail,
  Phone,
  Building2,
  UserCircle,
  CalendarDays,
  FileText,
  MapPin,
  Hash,
  ShieldAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getInstallatoreById } from "@/lib/mock-data"
import { requirePage } from "@/lib/permissions/server"
import {
  InstallatoreAvatar,
  StatoInstallatoreBadge,
} from "@/components/installatori/installatore-utils"

function val(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Sì" : "No"
  return String(v)
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
        {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
        {value}
      </span>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

export default async function InstallatoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("installatori")

  const { id } = await params
  const installatore = getInstallatoreById(id)

  if (!installatore) notFound()

  const nome = installatore["Nome Installatore"]

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/installatori" className="hover:text-foreground">
          Installatori
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{nome}</span>
      </nav>

      {/* Intestazione */}
      <div className="flex flex-wrap items-start gap-4">
        <InstallatoreAvatar nome={nome} className="size-12 text-base" />
        <div className="flex flex-col gap-2">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">
            {nome}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatoInstallatoreBadge stato={installatore.Stato} />
            {installatore.Tag.map((t) => (
              <Badge
                key={t}
                className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-medium text-navy"
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <span className="ml-auto text-xs text-muted-foreground/70">
          Ultimo aggiornamento: {val(installatore["Ora modifica"])}
        </span>
      </div>

      {/* Dettagli */}
      <Section title="Anagrafica">
        <Field
          icon={UserCircle}
          label="Persona di riferimento"
          value={val(installatore["Persona di riferimento"])}
        />
        <Field icon={Mail} label="E-mail" value={val(installatore["E-mail"])} />
        <Field
          icon={Mail}
          label="E-mail secondaria"
          value={val(installatore["E-mail secondaria"])}
        />
        <Field
          icon={Phone}
          label="Cellulare"
          value={val(installatore.Cellulare)}
        />
        <Field
          icon={Phone}
          label="Altro telefono"
          value={val(installatore["Altro telefono"])}
        />
        <Field
          icon={Hash}
          label="Partita IVA"
          value={val(installatore["Partita IVA"])}
        />
        <Field
          icon={Building2}
          label="Connesso a"
          value={val(installatore["Connesso a"])}
        />
        <Field
          icon={UserCircle}
          label="Proprietario di Installatore"
          value={val(installatore["Proprietario di Installatore"])}
        />
      </Section>

      <Section title="Indirizzo postale">
        <Field
          icon={MapPin}
          label="Via"
          value={val(installatore["Via indirizzo postale"])}
        />
        <Field
          icon={MapPin}
          label="Città"
          value={val(installatore["Città indirizzo postale"])}
        />
        <Field
          label="Provincia"
          value={val(installatore["Provincia indirizzo postale"])}
        />
        <Field
          label="Codice postale"
          value={val(installatore["Codice postale indirizzo"])}
        />
      </Section>

      <Section title="Stato e tracciamento">
        <Field
          icon={ShieldAlert}
          label="Bloccato"
          value={val(installatore.Bloccato)}
        />
        <Field
          label="Opt-out e-mail"
          value={val(installatore["Opt-out e-mail"])}
        />
        <Field
          label="Modalità iscrizione annullata"
          value={val(installatore["Modalità iscrizione annullata"])}
        />
        <Field
          icon={CalendarDays}
          label="Ora iscrizione annullata"
          value={val(installatore["Ora iscrizione annullata"])}
        />
        <Field
          icon={UserCircle}
          label="Creato da"
          value={val(installatore["Creato da"])}
        />
        <Field
          icon={UserCircle}
          label="Modificato da"
          value={val(installatore["Modificato da"])}
        />
        <Field
          icon={CalendarDays}
          label="Ora creazione"
          value={val(installatore["Ora creazione"])}
        />
        <Field
          icon={CalendarDays}
          label="Ora ultima attività"
          value={val(installatore["Ora ultima attività"])}
        />
      </Section>

      {installatore.Note ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="size-4 text-muted-foreground" />
            Note
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {installatore.Note}
          </p>
        </section>
      ) : null}
    </div>
  )
}
