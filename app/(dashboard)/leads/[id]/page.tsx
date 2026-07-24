import { notFound } from "next/navigation"
import { getLeadById } from "@/lib/leads/server-store"
import { getClienteById } from "@/lib/clienti/repository"
import { LeadDetailHeader } from "@/components/leads/lead-detail-header"
import { LeadDetailContent } from "@/components/leads/lead-detail-content"
import { LeadIntelligencePanel } from "@/components/leads/lead-intelligence-panel"
import { requirePage } from "@/lib/permissions/server"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("lead")

  const { id } = await params
  const lead = await getLeadById(id)
  if (!lead) notFound()

  // Se il lead e' stato convertito, recupera il nome del cliente collegato
  // per la sezione "Record collegati" (altrimenti mostrerebbe solo l'id).
  const clienteCollegatoId = lead["Account convertito"]
  const clienteCollegato = clienteCollegatoId
    ? await getClienteById(clienteCollegatoId)
    : null

  return (
    <div className="flex flex-col gap-6">
      <LeadDetailHeader lead={lead} />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <LeadDetailContent
          lead={lead}
          clienteCollegatoNome={clienteCollegato?.["Nome Clienti"]}
        />
        <LeadIntelligencePanel lead={lead} />
      </div>
    </div>
  )
}
