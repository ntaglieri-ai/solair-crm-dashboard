// Server Component: pre-carica i primi 50 lead + statistiche da Supabase
// (selezione colonne mirata, ordine updated_at desc) e li passa a LeadsClient
// come initialData, evitando il loading lato client dopo il mount.
import { cookies } from "next/headers"
import {
  getInitialLeadsParams,
  buildLeadsSearchParams,
} from "@/lib/leads/api-types"
import { queryLeads, computeStats } from "@/lib/leads/repository"
import { LEAD_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from "@/lib/mock-data"
import {
  LEADS_VIEW_COOKIE,
  parseLeadViewPreferences,
} from "@/lib/leads/view-preferences"
import { LeadsClient } from "./leads-client"
import { requirePage } from "@/lib/permissions/server"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function LeadsPage() {
  const permissions = await requirePage("lead")

  // Preferenze di vista dal cookie lette PRIMA di costruire i params: il
  // client ricostruisce la query con le colonne reali dell'utente (cookie),
  // non con DEFAULT_VISIBLE_COLUMNS. Se qui usassimo sempre il default, la
  // chiave di prefetch non coinciderebbe con quella del client per chi ha
  // colonne personalizzate, React Query scarterebbe l'initialData e
  // rilancerebbe una fetch da zero: da qui il flash di tabella vuota al
  // primo accesso.
  const cookieStore = await cookies()
  const subject = permissions.snapshot.subject
  const preferenceOwner = subject.userId ?? subject.authUserId ?? "anonymous"
  const initialPreferences = parseLeadViewPreferences(
    cookieStore.get(LEADS_VIEW_COOKIE)?.value,
    preferenceOwner,
    new Set(LEAD_COLUMNS.map((column) => column.id)),
  )

  const initialParams = {
    ...getInitialLeadsParams(),
    fields: (initialPreferences?.visibleCols ??
      DEFAULT_VISIBLE_COLUMNS) as unknown as string[],
  }
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
      initialPreferences={initialPreferences}
    />
  )
}
