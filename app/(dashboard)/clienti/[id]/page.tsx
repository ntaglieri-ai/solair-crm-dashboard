import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getClienteById } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { ClienteAvatar, StatoClienteBadge } from "@/components/clienti/cliente-utils"

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cliente = getClienteById(id)

  if (!cliente) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClienteAvatar nome={cliente["Nome Clienti"]} className="size-12 text-sm" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {cliente["Nome Clienti"]}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatoClienteBadge stato={cliente.Stato} />
              <span>·</span>
              <span>{cliente.Sede}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" className="bg-card" render={<Link href="/clienti" />}>
          <ArrowLeft data-icon="inline-start" />
          Torna ai clienti
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          La scheda dettaglio del cliente sarà disponibile in un prossimo step.
        </p>
      </div>
    </div>
  )
}
