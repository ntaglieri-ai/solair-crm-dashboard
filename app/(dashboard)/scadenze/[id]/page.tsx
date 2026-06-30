import { notFound } from "next/navigation"
import { getScadenzaById, mockScadenze } from "@/lib/mock-data"
import { ScadenzaDetailView } from "@/components/scadenze/scadenza-detail-view"
import { requirePage } from "@/lib/permissions/server"

export default async function ScadenzaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("scadenze")

  const { id } = await params
  const scadenza = getScadenzaById(id)

  if (!scadenza) notFound()

  const index = mockScadenze.findIndex((s) => s.id === id)
  const prevId = index > 0 ? mockScadenze[index - 1].id : null
  const nextId =
    index >= 0 && index < mockScadenze.length - 1
      ? mockScadenze[index + 1].id
      : null

  return (
    <ScadenzaDetailView scadenza={scadenza} prevId={prevId} nextId={nextId} />
  )
}
