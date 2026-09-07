import { notFound } from "next/navigation"
import { getClienteById } from "@/lib/clienti/repository"
import { ClienteDetailHeader } from "@/components/clienti/cliente-detail-header"
import { StickyDetailHeader } from "@/components/shared/sticky-detail-header"
import { ClienteDetailContent } from "@/components/clienti/cliente-detail-content"
import { ClienteIntelligencePanel } from "@/components/clienti/cliente-intelligence-panel"
import { requirePage } from "@/lib/permissions/server"
import { listEmailLog } from "@/lib/email/email-log"

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("clienti")

  const { id } = await params
  const cliente = await getClienteById(id)

  if (!cliente) notFound()
  const emailLog = await listEmailLog("cliente", id)

  return (
    <div className="flex flex-col gap-6">
      <StickyDetailHeader>
        <ClienteDetailHeader cliente={cliente} />
      </StickyDetailHeader>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ClienteDetailContent cliente={cliente} emailLog={emailLog} />
        <ClienteIntelligencePanel cliente={cliente} />
      </div>
    </div>
  )
}
