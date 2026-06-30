// Server Component: pre-carica i primi 50 lead + statistiche da Supabase
// (selezione colonne mirata, ordine created_at desc) e li passa a LeadsClient
// come initialData, evitando il loading lato client dopo il mount.
import {
  getInitialLeadsParams,
  buildLeadsSearchParams,
} from "@/lib/leads/api-types"
import { queryLeads, computeStats } from "@/lib/leads/repository"
import { LeadsClient } from "./leads-client"
import { requirePage } from "@/lib/permissions/server"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  await requirePage("lead")

  const initialParams = getInitialLeadsParams()
  const initialSp = buildLeadsSearchParams(initialParams).toString()

  // Fetch server-side in parallelo: prima pagina (50 righe) + conteggi header.
  const [initialLeads, initialStats] = await Promise.all([
    queryLeads(initialParams),
    computeStats(),
  ])

  return (
    <LeadsClient
      initialSp={initialSp}
      initialLeads={initialLeads}
      initialStats={initialStats}
    />
  )
}
