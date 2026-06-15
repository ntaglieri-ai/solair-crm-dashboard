import { notFound } from "next/navigation"
import { getLeadById } from "@/lib/mock-data"
import { LeadDetailHeader } from "@/components/leads/lead-detail-header"
import { LeadDetailSidebar } from "@/components/leads/lead-detail-sidebar"
import { LeadTabs } from "@/components/leads/lead-tabs"

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeadTabs lead={lead} />
        </div>
        <div className="lg:col-span-1">
          <LeadDetailSidebar lead={lead} />
        </div>
      </div>
    </div>
  )
}
