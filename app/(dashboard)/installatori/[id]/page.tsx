import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getInstallatoreById } from "@/lib/installatori/repository"
import { CANALE_PREFERITO_LABELS } from "@/lib/installatori/api-types"
import { Badge } from "@/components/ui/badge"
import { InstallatoreDetailActions } from "@/components/installatori/installatore-detail-actions"
import { InstallatoreTagBadges } from "@/components/installatori/installatore-tag-controls"
import { InstallatoreNoteSection } from "@/components/installatori/installatore-note-section"
import { InstallatoreDetailContent } from "@/components/installatori/installatore-detail-content"
import { AllegatiSection } from "@/components/shared/allegati-section"
import { EmailHistorySection } from "@/components/shared/email-history-section"
import { CalendarioRecordSection } from "@/components/calendario/calendario-record-section"
import { InlineEditableField } from "@/components/shared/inline-edit-field"
import { listEmailLog } from "@/lib/email/email-log"
import { createClient } from "@/lib/supabase/server"
import { loadLayout, loadOrdinePersonale } from "@/lib/crm-settings/layout-server"
import {
  applicaOrdineBlocchi,
  applicaOrdineCampi,
  applicaOrdinePersonale,
  soloVisibili,
} from "@/lib/crm-settings/layout"
import { paginePiene } from "@/lib/crm-settings/layout-render"

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
  // requirePage carica gia' lo snapshot dei permessi, memorizzato per
  // richiesta: riusarlo qui non costa una seconda lettura.
  const permissions = await requirePage("installatori")
  const { id } = await params
  const supabase = await createClient()
  const utenteId = permissions.snapshot.subject.userId

  // In parallelo: le letture non dipendono l'una dall'altra.
  const [installatore, emailLog, pagine, ordine] = await Promise.all([
    getInstallatoreById(id),
    listEmailLog("installatore", id),
    loadLayout(supabase, "installatori"),
    utenteId
      ? loadOrdinePersonale(supabase, utenteId, "installatori")
      : Promise.resolve({ pagine: [], blocchi: {}, campi: {} }),
  ])

  if (!installatore) notFound()
  const endpoint = `/api/installatori/${installatore.id}`
  const canaleOptions = Object.keys(CANALE_PREFERITO_LABELS)

  const layout = paginePiene(
    soloVisibili(
      applicaOrdineCampi(
        applicaOrdineBlocchi(applicaOrdinePersonale(pagine, ordine.pagine), ordine.blocchi),
        ordine.campi,
      ),
    ),
  )

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

      {layout.length > 0 ? (
        <InstallatoreDetailContent
          installatore={installatore}
          emailLog={emailLog}
          layout={layout}
        />
      ) : (
        <>
      <section className="border-y border-border py-5">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <InlineEditableField module="installatori" field="nome" label="Nome" endpoint={endpoint} patchKey="nome" value={installatore.nome} />
            <InlineEditableField module="installatori" field="email" label="Email" endpoint={endpoint} patchKey="email" value={installatore.email} type="email" />
            <InlineEditableField module="installatori" field="email_secondaria" label="Email secondaria" endpoint={endpoint} patchKey="email_secondaria" value={installatore.email_secondaria} type="email" />
            <InlineEditableField module="installatori" field="telefono" label="Telefono" endpoint={endpoint} patchKey="telefono" value={installatore.telefono} type="tel" />
            <InlineEditableField module="installatori" field="tag" label="Tag" endpoint={endpoint} patchKey="tag" value={installatore.tag} />
            <InlineEditableField module="installatori" field="attivo" label="Attivo" endpoint={endpoint} patchKey="attivo" value={installatore.attivo} type="boolean" />
            <InlineEditableField
              module="installatori"
              field="canale_preferito"
              label="Canale preferito"
              endpoint={endpoint}
              patchKey="canale_preferito"
              value={installatore.canale_preferito}
              type="select"
              options={canaleOptions}
              optionLabels={CANALE_PREFERITO_LABELS}
            />
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
              <InlineEditableField module="installatori" field="note" label="Note" endpoint={endpoint} patchKey="note" value={installatore.note} type="textarea" />
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
          <h2 className="mb-3 text-[13px] font-bold text-navy">Note</h2>
          <InstallatoreNoteSection installatoreId={installatore.id} nomeRecord={installatore.nome} />
        </section>
  
        <section className="border-b border-border pb-5">
          <h2 className="mb-3 text-[13px] font-bold text-navy">E-mail</h2>
          <EmailHistorySection
            emailLog={emailLog}
            emptyLabel="Nessuna email inviata a questo installatore dal CRM."
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
      </>
      )}
    </div>
  )
}
