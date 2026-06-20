import { notFound } from "next/navigation"
import { getCompitoById, mockCompiti } from "@/lib/mock-data"
import { CompitoDetailView } from "@/components/compiti/compito-detail-view"

export default async function CompitoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const compito = getCompitoById(id)

  if (!compito) notFound()

  const index = mockCompiti.findIndex((c) => c.id === id)
  const prevId = index > 0 ? mockCompiti[index - 1].id : null
  const nextId =
    index >= 0 && index < mockCompiti.length - 1
      ? mockCompiti[index + 1].id
      : null

  return <CompitoDetailView compito={compito} prevId={prevId} nextId={nextId} />
}
