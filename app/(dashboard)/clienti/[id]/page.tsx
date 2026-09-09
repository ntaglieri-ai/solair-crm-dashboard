import { notFound } from "next/navigation"
import { getClienteById } from "@/lib/clienti/repository"
import { ClienteDetailHeader } from "@/components/clienti/cliente-detail-header"
import { StickyDetailHeader } from "@/components/shared/sticky-detail-header"
import { ClienteDetailContent } from "@/components/clienti/cliente-detail-content"
import { ClienteIntelligencePanel } from "@/components/clienti/cliente-intelligence-panel"
import { requirePage } from "@/lib/permissions/server"
import { listEmailLog } from "@/lib/email/email-log"
import { createClient } from "@/lib/supabase/server"
import { loadLayoutPerUtente } from "@/lib/crm-settings/layout-server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { soloVisibili } from "@/lib/crm-settings/layout"

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

  // Layout configurabile: se ci sono pagine configurate la scheda si disegna
  // da queste, altrimenti resta il rendering scritto nel codice. Il loader
  // torna array vuoto quando le tabelle non ci sono o la lettura fallisce,
  // quindi un problema sul layout non lascia la scheda inaccessibile.
  const supabase = await createClient()
  const permissions = await getCurrentPermissions()
  const layout = soloVisibili(
    await loadLayoutPerUtente(supabase, "clienti", permissions.snapshot.subject.userId),
  )

  return (
    <div className="flex flex-col gap-6">
      <StickyDetailHeader>
        <ClienteDetailHeader cliente={cliente} />
      </StickyDetailHeader>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ClienteDetailContent cliente={cliente} emailLog={emailLog} layout={layout} />
        <ClienteIntelligencePanel cliente={cliente} />
      </div>
    </div>
  )
}
