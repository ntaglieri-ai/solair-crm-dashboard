import { NextResponse } from "next/server"

import { requireApiPage } from "@/lib/permissions/server"
import { leggiImpostazioniAI } from "@/lib/solair-ai/settings"

/**
 * Dati minimi che il popup della chat (montato nel layout, fuori dalla
 * pagina /solair-ai/assistente) deve conoscere prima di renderizzare
 * SolairAiClient: stessi tre valori che la pagina calcola server-side.
 */
export async function GET() {
  const { permissions, response } = await requireApiPage("solair_ai")
  if (response) return response

  const impostazioni = await leggiImpostazioniAI()

  return NextResponse.json({
    canRun: permissions.canAction("solair_ai.run"),
    canReview: permissions.canAction("solair_ai.revisioni.view"),
    cartelleConfigurate: impostazioni.filter((riga) => riga.nextcloudPath !== "").length,
  })
}
