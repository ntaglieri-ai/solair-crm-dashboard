import { createClient } from "@/lib/supabase/server"
import { clearCrmSessionCookies } from "@/lib/auth/session-policy"
import { nextcloudBaseUrl } from "@/lib/nextcloud/config"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Risposta vuota, non un redirect: entrambi i chiamanti (il menu profilo
  // nella sidebar e la guardia di inattività) navigano già per conto loro.
  // Rispondendo con un redirect, la fetch lo seguiva — di default `redirect:
  // "follow"` — e faceva renderizzare /login per intero al server solo per
  // buttarne via il risultato un istante dopo. Un render di pagina sprecato
  // a ogni logout.
  //
  // `nextcloudLogoutUrl` nella risposta: il logout CRM chiude solo la
  // sessione Supabase. Nextcloud ha una sessione nativa SEPARATA (cookie
  // sul suo stesso dominio), che l'SSO OIDC riusa silenziosamente se e'
  // ancora valida — su un device condiviso, il prossimo utente che fa
  // "Apri Nextcloud" si ritrova loggato come l'account precedente, non
  // come se stesso. Solo il browser puo' far scadere quel cookie (e' sul
  // dominio Nextcloud, non instradabile server-to-server da qui): il
  // client deve fare una richiesta reale a quell'URL dopo il logout CRM.
  const response = NextResponse.json({ ok: true, nextcloudLogoutUrl: `${nextcloudBaseUrl()}/logout` })
  response.headers.set("Cache-Control", "no-store")
  clearCrmSessionCookies(response)
  return response
}
