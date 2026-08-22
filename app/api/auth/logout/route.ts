import { createClient } from "@/lib/supabase/server"
import { clearCrmSessionCookies } from "@/lib/auth/session-policy"
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
  const response = NextResponse.json({ ok: true })
  response.headers.set("Cache-Control", "no-store")
  clearCrmSessionCookies(response)
  return response
}
