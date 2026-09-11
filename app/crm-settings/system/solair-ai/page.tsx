import { requirePage } from "@/lib/permissions/server"
import { leggiStatoIndiceSolairAI } from "@/lib/solair-ai/indice"
import { leggiImpostazioniAI } from "@/lib/solair-ai/settings"
import { getActiveSolairAiSyncJobs } from "@/lib/solair-ai/sync-job-store"
import { SolairAiSettingsClient } from "./solair-ai-settings-client"

export const dynamic = "force-dynamic"

export default async function SolairAiSettingsPage() {
  const permissions = await requirePage("crm_settings.system.solair_ai")
  const [impostazioni, statoIndice, jobAttivi] = await Promise.all([
    leggiImpostazioniAI(),
    leggiStatoIndiceSolairAI(),
    getActiveSolairAiSyncJobs(),
  ])

  return (
    <SolairAiSettingsClient
      impostazioni={impostazioni}
      statoIndice={statoIndice}
      jobAttivi={jobAttivi}
      canManage={permissions.canAction("crm_settings.system.schema.manage")}
    />
  )
}
