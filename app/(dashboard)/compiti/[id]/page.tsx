import { notFound } from "next/navigation"
import { getCompitoById } from "@/lib/compiti/repository"
import { CompitoDetailView } from "@/components/compiti/compito-detail-view"
import { requirePage } from "@/lib/permissions/server"

export default async function CompitoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("compiti")

  const { id } = await params
  const compito = await getCompitoById(id)

  if (!compito) notFound()

  return <CompitoDetailView compito={compito} />
}
