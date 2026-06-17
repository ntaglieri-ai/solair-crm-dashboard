import { notFound } from "next/navigation"
import { getLeadById } from "@/lib/mock-data"
import { LeadDetailHeader } from "@/components/leads/lead-detail-header"
import { LeadDetailContent } from "@/components/leads/lead-detail-content"
import { LeadIntelligencePanel } from "@/components/leads/lead-intelligence-panel"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const lead = getLeadById(id)

  if (!lead) notFound()

  return (
    <div className="flex flex-col gap-6">
      <LeadDetailHeader lead={lead} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <LeadDetailContent lead={lead} />
        <LeadIntelligencePanel lead={lead} />
      </div>
    </div>
  )
}
