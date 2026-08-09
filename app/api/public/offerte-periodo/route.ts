import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const expectedKey = process.env.LISTINO_READ_KEY
  if (!expectedKey) {
    console.error("[offerte-periodo] LISTINO_READ_KEY non configurata")
    return NextResponse.json({ error: "Sorgente non configurata" }, { status: 503 })
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const providedKey = authHeader.replace(/^Bearer\s+/i, "")
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client non configurato" }, { status: 503 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("offerta_commerciale_offerte")
    .select("id, titolo, descrizione, tipo, url_pubblico, valido_dal, valido_al, ordinamento, configurazioni, aggiornato_at")
    .eq("pubblicata", true)
    .or(`valido_dal.is.null,valido_dal.lte.${today}`)
    .or(`valido_al.is.null,valido_al.gte.${today}`)
    .order("ordinamento", { ascending: true })
    .order("titolo", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    {
      offerte: (data ?? []).map((offerta) => ({
        id: offerta.id,
        titolo: offerta.titolo,
        descrizione: offerta.descrizione,
        tipo: offerta.tipo,
        url: offerta.url_pubblico,
        validoDal: offerta.valido_dal,
        validoAl: offerta.valido_al,
        configurazioni: offerta.configurazioni,
        aggiornatoAt: offerta.aggiornato_at,
      })),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    },
  )
}
