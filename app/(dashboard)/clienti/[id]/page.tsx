import { notFound } from "next/navigation"
import { getClienteById } from "@/lib/clienti/repository"
import { ClienteDetailHeader } from "@/components/clienti/cliente-detail-header"
import { ClienteDetailContent } from "@/components/clienti/cliente-detail-content"
import { ClienteIntelligencePanel } from "@/components/clienti/cliente-intelligence-panel"
import { requirePage } from "@/lib/permissions/server"

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("clienti")

  const { id } = await params
  const cliente = await getClienteById(id)

  if (!cliente) notFound()

  return (
    <div className="flex flex-col gap-6">
      <ClienteDetailHeader cliente={cliente} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ClienteDetailContent cliente={cliente} />
        <ClienteIntelligencePanel cliente={cliente} />
      </div>
    </div>
  )
}
