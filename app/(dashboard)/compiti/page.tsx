// Server Component: pre-carica la prima pagina di compiti da Supabase
// e passa i dati a CompitiClient come initialData (nessun loading al mount).
import {
  DEFAULT_COMPITI_PARAMS,
  buildCompitiSearchParams,
} from "@/lib/compiti/api-types"
import { queryCompiti } from "@/lib/compiti/repository"
import { CompitiClient } from "./compiti-client"
import { requirePage } from "@/lib/permissions/server"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function CompitiPage() {
  await requirePage("compiti")

  const initialParams = DEFAULT_COMPITI_PARAMS
  const initialSp = buildCompitiSearchParams(initialParams).toString()
  const initialData = await queryCompiti(initialParams)

  return (
    <CompitiClient
      initialSp={initialSp}
      initialData={initialData}
    />
  )
}
