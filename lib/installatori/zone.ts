// Zone installatori (spec FASE 3, punto 3.3): dato una provincia del cliente,
// quali installatori sono compatibili. Il match regionale riusa
// regionFromProvince (stessa mappa provincia->regione del tag "Italia"), i
// nomi regione a DB (installatore_zone.regione) sono seminati con gli stessi
// valori canonici, quindi il confronto e' diretto.
//
// Le sovrapposizioni NON vengono risolte con priorita' automatica (decisione
// di spec): si ritorna la lista completa dei compatibili e la scelta resta
// manuale in UI.
import { createClient } from "@/lib/supabase/server"
import { regionFromProvince } from "@/lib/dashboard/italy-regions"

export type InstallatoreSuggerito = {
  id: string
  nome: string
  /** Perche' e' suggerito (o da verificare): mostrato in UI cosi' com'e'. */
  motivo: string
}

export type InstallatoriSuggeritiResult = {
  provincia: string
  /** Regione riconosciuta dalla provincia, null se non riconoscibile. */
  regione: string | null
  /** Compatibili certi: coprono la regione (o sono entro il raggio). */
  suggeriti: InstallatoreSuggerito[]
  /**
   * Copertura a raggio non valutabile: i clienti non hanno coordinate a DB,
   * quindi senza coordinate esplicite il caso "Miradolo Terme + 100km" non e'
   * decidibile in automatico. Esce come voce separata, mai scartato in
   * silenzio.
   */
  daVerificare: InstallatoreSuggerito[]
  /** Tutti gli altri installatori attivi: la scelta fuori lista resta libera. */
  altri: { id: string; nome: string }[]
}

/** Distanza in km sulla sfera (haversine) — basta per un raggio di copertura. */
function distanzaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const raggioTerraKm = 6371
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * raggioTerraKm * Math.asin(Math.sqrt(h))
}

export async function getInstallatoriSuggeriti(
  provincia: string,
  coordinateCliente?: { lat: number; lng: number },
): Promise<InstallatoriSuggeritiResult> {
  const supabase = await createClient()
  const regione = regionFromProvince(provincia)

  const { data: attiviData, error: attiviError } = await supabase
    .from("installatori")
    .select("id,nome")
    .eq("attivo", true)
    .order("nome", { ascending: true })
  if (attiviError) {
    throw new Error(`Lettura installatori attivi: ${attiviError.message}`)
  }
  const attivi = new Map(
    (attiviData ?? []).map((row) => [row.id as string, row.nome as string]),
  )

  const suggeriti = new Map<string, InstallatoreSuggerito>()
  const daVerificare = new Map<string, InstallatoreSuggerito>()

  if (regione) {
    // ilike senza wildcard = uguaglianza case-insensitive: regge anche una
    // riga inserita a mano con maiuscole diverse dal seed.
    const { data: zoneData, error: zoneError } = await supabase
      .from("installatore_zone")
      .select("installatore_id")
      .ilike("regione", regione)
    if (zoneError) {
      throw new Error(`Lettura zone installatori: ${zoneError.message}`)
    }
    for (const row of zoneData ?? []) {
      const id = row.installatore_id as string
      const nome = attivi.get(id)
      if (!nome) continue // non attivo: mai suggerito
      suggeriti.set(id, { id, nome, motivo: `Copre la regione ${regione}` })
    }
  }

  const { data: raggioData, error: raggioError } = await supabase
    .from("installatore_zone_raggio")
    .select("installatore_id,etichetta,lat,lng,raggio_km")
  if (raggioError) {
    throw new Error(`Lettura zone a raggio installatori: ${raggioError.message}`)
  }
  for (const row of raggioData ?? []) {
    const id = row.installatore_id as string
    const nome = attivi.get(id)
    if (!nome || suggeriti.has(id)) continue
    const etichetta = row.etichetta as string
    const raggioKm = Number(row.raggio_km)
    if (coordinateCliente) {
      const km = distanzaKm(
        coordinateCliente.lat,
        coordinateCliente.lng,
        Number(row.lat),
        Number(row.lng),
      )
      if (km <= raggioKm) {
        suggeriti.set(id, {
          id,
          nome,
          motivo: `A ~${Math.round(km)} km da ${etichetta} (copre ${raggioKm} km)`,
        })
      }
      // Fuori raggio con distanza calcolata: escluso a ragion veduta, non
      // finisce nemmeno tra i "da verificare".
    } else {
      daVerificare.set(id, {
        id,
        nome,
        motivo: `Copre ${etichetta} + ${raggioKm} km — coordinate del cliente non disponibili, distanza da verificare a mano`,
      })
    }
  }

  const altri = [...attivi.entries()]
    .filter(([id]) => !suggeriti.has(id) && !daVerificare.has(id))
    .map(([id, nome]) => ({ id, nome }))

  return {
    provincia,
    regione,
    suggeriti: [...suggeriti.values()].sort((a, b) => a.nome.localeCompare(b.nome, "it")),
    daVerificare: [...daVerificare.values()].sort((a, b) => a.nome.localeCompare(b.nome, "it")),
    altri,
  }
}
