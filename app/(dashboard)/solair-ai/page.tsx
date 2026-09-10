import { requirePage } from "@/lib/permissions/server"
import { leggiImpostazioniAI } from "@/lib/solair-ai/settings"
import { SolairAiClient } from "./solair-ai-client"

export const dynamic = "force-dynamic"

export default async function SolairAiPage() {
  const permissions = await requirePage("solair_ai")
  const impostazioni = await leggiImpostazioniAI()

  return (
    <SolairAiClient
      canRun={permissions.canAction("solair_ai.run")}
      canReview={permissions.canAction("solair_ai.revisioni.view")}
      // Serve solo a dire in chiaro che manca la configurazione, invece di
      // farlo scoprire al primo messaggio.
      cartelleConfigurate={impostazioni.filter((riga) => riga.nextcloudPath !== "").length}
    />
  )
}
