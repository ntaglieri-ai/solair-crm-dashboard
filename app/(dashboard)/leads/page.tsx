// Server Component: pre-carica i primi 50 lead + statistiche da Supabase
// (selezione colonne mirata, ordine created_at desc) e li passa a LeadsClient
// come initialData, evitando il loading lato client dopo il mount.
import { cookies } from "next/headers"
import {
  getInitialLeadsParams,
  buildLeadsSearchParams,
} from "@/lib/leads/api-types"
import { queryLeads, computeStats } from "@/lib/leads/repository"
import { LEAD_COLUMNS } from "@/lib/mock-data"
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

  const initialParams = getInitialLeadsParams()
  const initialSp = buildLeadsSearchParams(initialParams).toString()

  // Fetch server-side in parallelo: prima pagina (50 righe) + conteggi header.
  const [initialLeads, initialStats, cookieStore] = await Promise.all([
    queryLeads(initialParams),
    computeStats(),
    cookies(),
  ])

  // Preferenze di vista dal cookie: servono a disegnare la tabella con le
  // colonne giuste già dal server, invece di farle saltare a idratazione
  // finita (vedi lib/leads/view-preferences.ts).
  const subject = permissions.snapshot.subject
  const preferenceOwner = subject.userId ?? subject.authUserId ?? "anonymous"
  const initialPreferences = parseLeadViewPreferences(
    cookieStore.get(LEADS_VIEW_COOKIE)?.value,
    preferenceOwner,
    new Set(LEAD_COLUMNS.map((column) => column.id)),
  )

  return (
    <LeadsClient
      initialSp={initialSp}
      initialLeads={initialLeads}
      initialStats={initialStats}
      initialPreferences={initialPreferences}
    />
  )
}
