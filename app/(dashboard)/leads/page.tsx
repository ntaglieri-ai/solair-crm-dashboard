import { cookies } from "next/headers"
import {
  getInitialLeadsParams,
  buildLeadsSearchParams,
} from "@/lib/leads/api-types"
import { computeStats, queryLeads } from "@/lib/leads/repository"
import { LEAD_RECORD_APP_FIELD_TO_COLUMN } from "@/lib/leads/field-map"
import type { Lead } from "@/lib/mock-data"
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

  const initialVisibleCols = initialPreferences?.visibleCols ?? DEFAULT_VISIBLE_COLUMNS
  const permittedInitialCols = initialVisibleCols.filter((id) => {
    const campo = LEAD_RECORD_APP_FIELD_TO_COLUMN[id as keyof Lead]
    return !campo || permissions.canField("lead", campo, "view")
  })
  const initialParams = {
    ...getInitialLeadsParams(),
    fields: permittedInitialCols as unknown as string[],
  }
  const initialSp = buildLeadsSearchParams(initialParams).toString()
  const [initialLeads, initialStats] = await Promise.all([
    queryLeads(initialParams),
    computeStats().catch((error) => {
      console.error("[leads] statistiche non calcolate lato server:", error)
      return null
    }),
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
