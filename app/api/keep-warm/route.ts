import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Pingato da Vercel Cron ogni 5 minuti (vedi vercel.json) per tenere calda
// la connessione tra il pooler di Supabase e Postgres — trovato 25/07 che
// dopo ~12 minuti di inattivita' quella connessione si chiude da sola
// (log Supabase: "closing because: server idle timeout (age=706s)"), e la
// richiesta successiva di un utente reale paga il costo di riaprirla da
// zero (1-3+ secondi, contro i 30-40ms a connessione calda). Nessuna
// sessione utente qui: protetto solo dal segreto condiviso con Vercel
// Cron (header Authorization automatico), non da requireApiRecord/Page.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const started = Date.now()
  const supabase = await createClient()
  const { error } = await supabase.from("utenti").select("id", { head: true, count: "exact" })

  return NextResponse.json({
    ok: !error,
    latencyMs: Date.now() - started,
    error: error?.message ?? null,
  })
}
