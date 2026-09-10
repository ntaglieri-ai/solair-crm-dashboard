import { requirePage } from "@/lib/permissions/server"
import { leggiImpostazioniAI } from "@/lib/solair-ai/settings"
import { SolairAiSettingsClient } from "./solair-ai-settings-client"

export const dynamic = "force-dynamic"

export default async function SolairAiSettingsPage() {
  const permissions = await requirePage("crm_settings.system.solair_ai")
  const impostazioni = await leggiImpostazioniAI()

  return (
    <SolairAiSettingsClient
      impostazioni={impostazioni}
      canManage={permissions.canAction("crm_settings.system.schema.manage")}
    />
  )
}
