// Server Component: precarica il payload della pagina (tre query Supabase in
// parallelo) e lo passa al client come initialData. Prima la pagina era
// interamente client e, finché la fetch post-mount non rispondeva, mostrava
// uno spinner su schermo vuoto a ogni ingresso.
import { requirePage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildOffertaCommercialePayload } from "@/lib/offerta-commerciale/store"
import type { OffertaCommercialePayload } from "@/lib/offerta-commerciale/types"
import { OffertaCommercialeClient } from "./offerta-commerciale-client"

// I dati dipendono dallo stato corrente del DB.
export const dynamic = "force-dynamic"

export default async function OffertaCommercialePage() {
  const permissions = await requirePage("offerta_commerciale")

  // Il precaricamento è un'ottimizzazione, non un requisito: se l'admin client
  // non è configurato o la lettura fallisce, il client rifà la fetch da solo
  // come prima, mostrando lo spinner solo in quel caso.
  let initialData: OffertaCommercialePayload | null = null
  const supabase = createAdminClient()
  if (supabase) {
    try {
      initialData = await buildOffertaCommercialePayload(
        supabase,
        permissions.canAction("offerta_commerciale.manage"),
      )
    } catch {
      initialData = null
    }
  }

  return <OffertaCommercialeClient initialData={initialData} />
}
