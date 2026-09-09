import { notFound } from "next/navigation"
import { getClienteById } from "@/lib/clienti/repository"
import { ClienteDetailHeader } from "@/components/clienti/cliente-detail-header"
import { StickyDetailHeader } from "@/components/shared/sticky-detail-header"
import { ClienteDetailContent } from "@/components/clienti/cliente-detail-content"
import { ClienteIntelligencePanel } from "@/components/clienti/cliente-intelligence-panel"
import { requirePage } from "@/lib/permissions/server"
import { listEmailLog } from "@/lib/email/email-log"
import { createClient } from "@/lib/supabase/server"
import { loadLayout, loadOrdinePersonale } from "@/lib/crm-settings/layout-server"
import {
  applicaOrdineBlocchi,
  applicaOrdineCampi,
  applicaOrdinePersonale,
  soloVisibili,
} from "@/lib/crm-settings/layout"

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // requirePage carica gia' lo snapshot dei permessi, memorizzato per
  // richiesta: riusarlo qui non costa una seconda lettura.
  const permissions = await requirePage("clienti")
  const { id } = await params
  const supabase = await createClient()
  const utenteId = permissions.snapshot.subject.userId

  // Tutto in parallelo. Le quattro letture non dipendono l'una dall'altra, e
  // incatenarle aggiungerebbe un giro di rete verso il database per ciascuna
  // — su una scheda che si apre decine di volte al giorno si sente.
  const [cliente, emailLog, pagine, ordine] = await Promise.all([
    getClienteById(id),
    listEmailLog("cliente", id),
    loadLayout(supabase, "clienti"),
    utenteId
      ? loadOrdinePersonale(supabase, utenteId, "clienti")
      : Promise.resolve({ pagine: [], blocchi: {}, campi: {} }),
  ])

  if (!cliente) notFound()

  // Layout configurabile: se ci sono pagine configurate la scheda si disegna
  // da queste, altrimenti resta il rendering scritto nel codice. Il riordino
  // personale si applica qui, sui dati gia' in memoria, senza altre letture.
  const layout = soloVisibili(
    applicaOrdineCampi(
      applicaOrdineBlocchi(applicaOrdinePersonale(pagine, ordine.pagine), ordine.blocchi),
      ordine.campi,
    ),
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
