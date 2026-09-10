// Server Component: pre-carica la prima pagina di installatori da Supabase
// e passa i dati a InstallatoriClient come initialData (nessun loading al mount).
import {
  DEFAULT_INSTALLATORI_PARAMS,
  buildInstallatoriSearchParams,
} from "@/lib/installatori/api-types"
import { queryInstallatori } from "@/lib/installatori/repository"
import { InstallatoriClient } from "./installatori-client"
import { createClient } from "@/lib/supabase/server"
import { loadLayout } from "@/lib/crm-settings/layout-server"
import { soloVisibili } from "@/lib/crm-settings/layout"
import { requirePage } from "@/lib/permissions/server"

// Sempre dinamica: i dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function InstallatoriPage() {
  await requirePage("installatori")

  const initialParams = DEFAULT_INSTALLATORI_PARAMS
  const initialSp = buildInstallatoriSearchParams(initialParams).toString()
  // Le due letture non dipendono l'una dall'altra: il layout serve al
  // pannello filtri, che ne ricava campi e gruppi.
  const supabase = await createClient()
  const [initialData, layout] = await Promise.all([
    queryInstallatori(initialParams),
    loadLayout(supabase, "installatori").then(soloVisibili),
  ])

  return (
    <InstallatoriClient initialSp={initialSp} initialData={initialData} layout={layout} />
  )
}
