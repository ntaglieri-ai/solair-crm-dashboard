// Server Component: pre-carica la prima pagina di scadenze da Supabase
// e passa i dati a ScadenzeClient come initialData (nessun loading al mount).
import {
  DEFAULT_SCADENZE_PARAMS,
  buildScadenzeSearchParams,
} from "@/lib/scadenze/api-types"
import { queryScadenze } from "@/lib/scadenze/repository"
import { ScadenzeClient } from "./scadenze-client"
import { requirePage } from "@/lib/permissions/server"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function ScadenzePage() {
  await requirePage("scadenze")

  const initialParams = DEFAULT_SCADENZE_PARAMS
  const initialSp = buildScadenzeSearchParams(initialParams).toString()
  const initialData = await queryScadenze(initialParams)

  return <ScadenzeClient initialSp={initialSp} initialData={initialData} />
}
