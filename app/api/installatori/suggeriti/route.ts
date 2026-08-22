import { NextResponse } from "next/server"
import { getInstallatoriSuggeriti } from "@/lib/installatori/zone"
import { getCurrentPermissions } from "@/lib/permissions/server"

// GET /api/installatori/suggeriti?provincia=CT[&lat=..&lng=..]
// Suggerimento automatico zone installatori (spec FASE 3.3). La provincia puo'
// anche mancare o non essere riconoscibile: si risponde comunque con la lista
// completa in "altri" (la scelta manuale resta sempre possibile) e con le
// coperture a raggio tra i "da verificare".
export async function GET(request: Request) {
  // Questa lista serve al selettore "Installatore assegnato" nella scheda
  // Cliente. Richiedere installatori.view era incoerente: salvare
  // l'assegnazione richiede clienti.edit, quindi STANDARD e DIRECTOR potevano
  // assegnare un installatore ma non leggere l'elenco da cui sceglierlo — e il
  // riquadro andava in errore. Basta uno dei due permessi: chi puo' assegnare
  // deve poter vedere le opzioni.
  const permissions = await getCurrentPermissions()
  if (
    !permissions.canRecord("installatori", "view") &&
    !permissions.canRecord("clienti", "edit")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const provincia = (searchParams.get("provincia") ?? "").trim()
  const lat = Number.parseFloat(searchParams.get("lat") ?? "")
  const lng = Number.parseFloat(searchParams.get("lng") ?? "")
  const coordinate =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined

  const result = await getInstallatoriSuggeriti(provincia, coordinate)
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  })
}
