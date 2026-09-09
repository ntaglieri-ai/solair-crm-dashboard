import { notFound } from "next/navigation"
import { getLeadById } from "@/lib/leads/server-store"
import { getClienteById } from "@/lib/clienti/repository"
import { LeadDetailHeader } from "@/components/leads/lead-detail-header"
import { StickyDetailHeader } from "@/components/shared/sticky-detail-header"
import { LeadDetailContent } from "@/components/leads/lead-detail-content"
import { LeadIntelligencePanel } from "@/components/leads/lead-intelligence-panel"
import { requirePage } from "@/lib/permissions/server"
import { listEmailLog } from "@/lib/email/email-log"
import { createClient } from "@/lib/supabase/server"
import { loadLayout, loadOrdinePersonale } from "@/lib/crm-settings/layout-server"
import {
  applicaOrdineBlocchi,
  applicaOrdineCampi,
  applicaOrdinePersonale,
  soloVisibili,
} from "@/lib/crm-settings/layout"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // requirePage carica gia' lo snapshot dei permessi, memorizzato per
  // richiesta: riusarlo qui non costa una seconda lettura.
  const permissions = await requirePage("lead")
  const { id } = await params
  const supabase = await createClient()
  const utenteId = permissions.snapshot.subject.userId

  // In parallelo: le tre letture non dipendono l'una dall'altra, e
  // incatenarle aggiungerebbe un giro di rete verso il database per ciascuna.
  const [lead, emailLog, pagine, ordine] = await Promise.all([
    getLeadById(id),
    listEmailLog("lead", id),
    loadLayout(supabase, "lead"),
    utenteId
      ? loadOrdinePersonale(supabase, utenteId, "lead")
      : Promise.resolve({ pagine: [], blocchi: {}, campi: {} }),
  ])

  if (!lead) notFound()

  // Il nome del cliente collegato serve solo a lead convertiti, e dipende da
  // un valore del lead: qui la lettura in sequenza e' inevitabile, ma scatta
  // di rado.
  const clienteCollegatoId = lead["Account convertito"]
  const clienteCollegato = clienteCollegatoId ? await getClienteById(clienteCollegatoId) : null

  const layout = soloVisibili(
    applicaOrdineCampi(
      applicaOrdineBlocchi(applicaOrdinePersonale(pagine, ordine.pagine), ordine.blocchi),
      ordine.campi,
    ),
  )

  return (
    <div className="flex flex-col gap-6">
      <StickyDetailHeader>
        <LeadDetailHeader lead={lead} />
      </StickyDetailHeader>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <LeadDetailContent
          lead={lead}
          clienteCollegatoNome={clienteCollegato?.["Nome Clienti"]}
          emailLog={emailLog}
          layout={layout}
        />
        <LeadIntelligencePanel lead={lead} emailLog={emailLog} />
      </div>
    </div>
  )
}
