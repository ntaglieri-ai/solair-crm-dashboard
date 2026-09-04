import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAction } from "@/lib/permissions/server"

const TONI_VALIDI = ["muted", "success", "warning", "info", "teal", "destructive"] as const

// Lista configurabile di Stato Cliente (report Vito, cap. 5 + richiesta
// Nando 04/09: "solo quelli Zoho e la possibilita' di crearne"). Prima era
// un elenco fisso nel codice — aggiungere uno stato nuovo richiedeva un
// deploy. GET e' aperto a chiunque sia autenticato (la RLS lo garantisce
// gia', ma il controllo qui evita una chiamata inutile se manca la sessione).
// POST e' riservato a chi gestisce lo schema, stessa soglia di permesso dei
// Campi personalizzati: aggiungere stati resta un'azione di configurazione,
// non qualcosa che ogni utente fa al volo — se Vito vuole aprirlo a tutti,
// e' un cambio di una riga qui.
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_stato_cliente")
    .select("id, valore, tono, ordinamento")
    .eq("attivo", true)
    .order("ordinamento", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ stati: data ?? [] })
}

export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as { valore?: string; tono?: string } | null
  const valore = body?.valore?.trim()
  if (!valore) {
    return NextResponse.json({ error: "Nome stato mancante" }, { status: 400 })
  }
  const tono = TONI_VALIDI.includes(body?.tono as (typeof TONI_VALIDI)[number])
    ? body!.tono
    : "muted"

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  }

  const { data: max } = await admin
    .from("crm_stato_cliente")
    .select("ordinamento")
    .order("ordinamento", { ascending: false })
    .limit(1)
    .maybeSingle()
  const prossimoOrdine = ((max?.ordinamento as number | undefined) ?? 0) + 1

  const { data, error } = await admin
    .from("crm_stato_cliente")
    .insert({ valore, tono, ordinamento: prossimoOrdine, creato_da: guard.permissions.snapshot.subject.authUserId })
    .select("id, valore, tono, ordinamento")
    .single()

  if (error) {
    // Violazione unique su "valore" = stato gia' esistente, non un errore
    // di sistema: messaggio chiaro invece del testo grezzo di Postgres.
    if (error.code === "23505") {
      return NextResponse.json({ error: `Lo stato "${valore}" esiste già` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ stato: data })
}
