// Server Component: pre-carica la prima pagina di clienti da Supabase
// e passa i dati a ClientiClient come initialData (nessun loading al mount).
import { cookies } from "next/headers"
import {
  DEFAULT_CLIENTI_PARAMS,
  buildClientiSearchParams,
} from "@/lib/clienti/api-types"
import { queryClienti } from "@/lib/clienti/repository"
import { CLIENTE_COLUMNS, DEFAULT_CLIENTE_COLUMNS } from "@/lib/mock-data"
import {
  CLIENTI_VIEW_COOKIE,
  parseClienteViewPreferences,
} from "@/lib/clienti/view-preferences"
import { ClientiClient } from "./clienti-client"
import { requirePage } from "@/lib/permissions/server"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function ClientiPage() {
  const permissions = await requirePage("clienti")
  const cookieStore = await cookies()
  const subject = permissions.snapshot.subject
  const preferenceOwner = subject.userId ?? subject.authUserId ?? "anonymous"
  const initialPreferences = parseClienteViewPreferences(
    cookieStore.get(CLIENTI_VIEW_COOKIE)?.value,
    preferenceOwner,
    new Set(CLIENTE_COLUMNS.map((column) => column.id)),
  )

  const initialParams = {
    ...DEFAULT_CLIENTI_PARAMS,
    fields: (initialPreferences?.visibleCols ??
      DEFAULT_CLIENTE_COLUMNS) as unknown as string[],
  }
  const initialSp = buildClientiSearchParams(initialParams).toString()
  const initialData = await queryClienti(initialParams)

  return (
    <ClientiClient
      initialSp={initialSp}
      initialData={initialData}
      initialPreferences={initialPreferences}
    />
  )
}
