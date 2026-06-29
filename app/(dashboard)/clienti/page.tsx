// Server Component: pre-carica la prima pagina di clienti da Supabase
// e passa i dati a ClientiClient come initialData (nessun loading al mount).
import {
  DEFAULT_CLIENTI_PARAMS,
  buildClientiSearchParams,
} from "@/lib/clienti/api-types"
import { queryClienti } from "@/lib/clienti/repository"
import { ClientiClient } from "./clienti-client"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function ClientiPage() {
  const initialParams = DEFAULT_CLIENTI_PARAMS
  const initialSp = buildClientiSearchParams(initialParams).toString()
  const initialData = await queryClienti(initialParams)

  return (
    <ClientiClient
      initialSp={initialSp}
      initialData={initialData}
    />
  )
}
