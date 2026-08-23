import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { sessionIdCorrente } from "@/lib/session-access/queries"

// Revoca di sessioni Supabase.
//
// Tre forme, tutte servite dalle funzioni SECURITY DEFINER della migration
// 20260823 (auth.sessions non e' raggiungibile da PostgREST):
//   { sessionId }    → una sola sessione
//   { authUserId }   → tutte quelle di un utente
//   { tutte: true }  → tutte, tranne la propria
//
// Sul ritardo di propagazione: cancellare la riga in auth.sessions porta via
// anche i refresh token (FK ON DELETE CASCADE), quindi il rinnovo fallisce.
// L'access token gia' emesso resta pero' valido fino alla scadenza, perche' il
// middleware verifica il JWT localmente via JWKS e non interroga Supabase a
// ogni richiesta. La UI dichiara questa finestra invece di nasconderla; qui si
// restituisce solo il numero di sessioni effettivamente cancellate.

interface Corpo {
  sessionId?: string
  authUserId?: string
  tutte?: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const guard = await requireApiPage("crm_settings.account.session")
  if (guard.response) return guard.response

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY non configurata" },
      { status: 500 },
    )
  }

  const body = (await request.json().catch(() => null)) as Corpo | null
  if (!body) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 })

  const attore = attoreDaPermessi(guard.permissions)
  const propria = await sessionIdCorrente()

  let revocate = 0
  let descrizione: string

  if (body.tutte === true) {
    // L'esclusione della propria sessione non e' una scorciatoia: chi preme il
    // pulsante deve restare dentro per verificare l'effetto di cio' che ha
    // appena fatto. La UI lo scrive esplicitamente sul pulsante.
    const { data, error } = await admin.rpc("crm_revoca_tutte_sessioni", {
      p_escludi_sessione: propria,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revocate = (data as number) ?? 0
    descrizione = `Terminate ${revocate} sessioni (tutte tranne la propria)`
  } else if (typeof body.authUserId === "string" && UUID.test(body.authUserId)) {
    const { data, error } = await admin.rpc("crm_revoca_sessioni_utente", {
      p_auth_user_id: body.authUserId,
      p_escludi_sessione: propria,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revocate = (data as number) ?? 0
    descrizione = `Terminate ${revocate} sessioni dell'utente ${body.authUserId}`
  } else if (typeof body.sessionId === "string" && UUID.test(body.sessionId)) {
    const { data, error } = await admin.rpc("crm_revoca_sessione", {
      p_session_id: body.sessionId,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    revocate = (data as number) ?? 0
    descrizione =
      revocate > 0
        ? `Terminata la sessione ${body.sessionId}`
        : `Sessione ${body.sessionId} gia' non attiva`
  } else {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 })
  }

  await logAudit({
    tipo_evento: "operazione_admin",
    modulo: "auth",
    descrizione,
    esito: "success",
    attore,
    request,
  })

  const response = NextResponse.json({ ok: true, revocate })
  response.headers.set("Cache-Control", "no-store")
  return response
}
