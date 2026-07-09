// Server Component: pre-carica la prima pagina di installatori da Supabase
// e passa i dati a InstallatoriClient come initialData (nessun loading al mount).
import {
  DEFAULT_INSTALLATORI_PARAMS,
  buildInstallatoriSearchParams,
} from "@/lib/installatori/api-types"
import { queryInstallatori } from "@/lib/installatori/repository"
import { InstallatoriClient } from "./installatori-client"
import { requirePage } from "@/lib/permissions/server"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function InstallatoriPage() {
  await requirePage("installatori")

  const initialParams = DEFAULT_INSTALLATORI_PARAMS
  const initialSp = buildInstallatoriSearchParams(initialParams).toString()
  const initialData = await queryInstallatori(initialParams)

  return <InstallatoriClient initialSp={initialSp} initialData={initialData} />
}
