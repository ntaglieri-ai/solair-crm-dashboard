import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getInstallatoreById } from "@/lib/installatori/repository"
import { CANALE_PREFERITO_LABELS } from "@/lib/installatori/api-types"
import { Badge } from "@/components/ui/badge"
import { InstallatoreDetailActions } from "@/components/installatori/installatore-detail-actions"
import { InstallatoreTagBadges } from "@/components/installatori/installatore-tag-controls"
import { AllegatiSection } from "@/components/shared/allegati-section"
import { CalendarioRecordSection } from "@/components/calendario/calendario-record-section"

function value(text: string | null) {
  return text?.trim() || "—"
}

function formatDate(text: string | null) {
  if (!text) return "—"
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(text))
}

export default async function InstallatoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("installatori")
  const { id } = await params
  const installatore = await getInstallatoreById(id)
  if (!installatore) notFound()

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/installatori" className="hover:text-foreground">
          Installatori
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{installatore.nome}</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            {installatore.nome}
          </h1>
          <Badge variant={installatore.attivo ? "secondary" : "outline"}>
            {installatore.attivo ? "Attivo" : "Non attivo"}
          </Badge>
          <InstallatoreTagBadges installatoreId={installatore.id} empty="" animate />
        </div>
        <InstallatoreDetailActions installatore={installatore} />
      </header>

      <section className="border-y border-border py-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Email</dt>
            <dd className="mt-1 text-sm text-foreground">
              {value(installatore.email)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Email secondaria
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {value(installatore.email_secondaria)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Telefono</dt>
            <dd className="mt-1 text-sm text-foreground">
              {value(installatore.telefono)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Canale preferito
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {CANALE_PREFERITO_LABELS[installatore.canale_preferito]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Proprietario
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {value(installatore.proprietario_nome)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Creato</dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatDate(installatore.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Aggiornato</dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatDate(installatore.updated_at)}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-medium text-muted-foreground">Note</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {value(installatore.note)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="border-b border-border pb-5">
        <AllegatiSection
          recordTipo="installatore"
          recordId={installatore.id}
          nomeRecord={installatore.nome}
        />
      </section>

      <section className="border-b border-border pb-5">
        <h2 className="mb-3 text-[13px] font-bold text-navy">Calendario</h2>
        <CalendarioRecordSection
          recordTipo="installatore"
          recordId={installatore.id}
          nomeRecord={installatore.nome}
        />
      </section>
    </div>
  )
}
