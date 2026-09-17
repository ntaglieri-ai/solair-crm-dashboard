import { NextResponse, after } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { invalidatePermissionSnapshotCache } from "@/lib/permissions/load-permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  conteggiUtente,
  riassegnaEDisattiva,
  totaleProprieta,
} from "@/lib/crm-settings/eliminazione-utente"
import { getNextcloudUsername } from "@/lib/nextcloud/credentials"
import { nextcloudUsernameFromEmail } from "@/lib/nextcloud/config"
import { setNextcloudUserEnabled } from "@/lib/nextcloud/provisioning"
import { revocaRefreshPerUtente } from "@/lib/mcp/oauth/archivio"

/**
 * Passaggio 1 dell'eliminazione account: riassegnazione obbligatoria + blocco
 * dell'accesso. La cancellazione fisica e' un'altra azione (DELETE su
 * ../[id]), che senza questo passaggio viene rifiutata.
 *
 * GET  -> conteggi di cosa verrebbe spostato e di cosa resta come storico,
 *         mostrati nel popup prima che l'admin confermi.
 * POST -> esegue la riassegnazione verso `destinatarioId` e disattiva l'account.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function adminOppureErrore() {
  const admin = createAdminClient()
  if (!admin) {
    return {
      admin: null,
      response: NextResponse.json(
        { error: "Configurazione server incompleta: gestione account non disponibile." },
        { status: 500 },
      ),
    }
  }
  return { admin, response: null }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const { id } = await params
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Identificativo utente non valido" }, { status: 400 })
  }

  const { admin, response } = adminOppureErrore()
  if (response) return response

  const { data: utente, error } = await admin
    .from("utenti")
    .select("id, nome, email, attivo, eliminato_il, riassegnato_a")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error(`[utenti] lettura utente ${id} fallita:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!utente) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 })
  }

  const { conteggi, error: conteggiError } = await conteggiUtente(admin, id)
  if (conteggiError) {
    return NextResponse.json({ error: conteggiError }, { status: 500 })
  }

  return NextResponse.json({ utente, conteggi })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const { id } = await params
  const body = (await request.json().catch(() => null)) as { destinatarioId?: unknown } | null
  const destinatarioId = typeof body?.destinatarioId === "string" ? body.destinatarioId : ""

  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Identificativo utente non valido" }, { status: 400 })
  }
  // La riassegnazione e' obbligatoria: senza destinatario non si procede. La UI
  // tiene il pulsante disabilitato, ma la regola vale anche per chi chiama l'API
  // a mano.
  if (!UUID.test(destinatarioId)) {
    return NextResponse.json(
      { error: "Seleziona l'utente che riceve i record prima di eliminare l'account." },
      { status: 400 },
    )
  }
  if (destinatarioId === id) {
    return NextResponse.json(
      { error: "Il destinatario non può essere l'utente da eliminare." },
      { status: 400 },
    )
  }

  const { admin, response } = adminOppureErrore()
  if (response) return response

  const { data: utente, error: letturaError } = await admin
    .from("utenti")
    .select("id, nome, email, auth_user_id, eliminato_il")
    .eq("id", id)
    .maybeSingle()

  if (letturaError) {
    console.error(`[utenti] lettura utente ${id} fallita:`, letturaError)
    return NextResponse.json({ error: letturaError.message }, { status: 500 })
  }
  if (!utente) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 })
  }

  const { esito, error } = await riassegnaEDisattiva(admin, id, destinatarioId)
  if (error || !esito) {
    return NextResponse.json({ error: error ?? "Riassegnazione non riuscita." }, { status: 409 })
  }

  const spostatiTotale = totaleProprieta(esito.spostati)

  after(() =>
    logAudit({
      tipo_evento: "operazione_admin",
      attore: attoreDaPermessi(guard.permissions),
      modulo: "utenti",
      record_id: id,
      descrizione:
        `Account ${esito.utente.nome ?? id} eliminato (passaggio 1): ${spostatiTotale} record riassegnati a ` +
        `${esito.destinatario.nome ?? destinatarioId} e accesso disattivato`,
      dati_prima: { nome: utente.nome, email: utente.email },
      dati_dopo: { destinatario: esito.destinatario, spostati: esito.spostati },
      request,
    }),
  )

  // Chiusura degli accessi in BACKGROUND, stesso principio del resto del file:
  // la parte CRM e' gia' committata, e sono quattro chiamate di rete (sessioni
  // Supabase, token MCP, Nextcloud OCS, ban Auth) che non devono far aspettare
  // il browser. Best effort e rumoroso sui log: nessuna di queste puo' annullare
  // una riassegnazione gia' avvenuta.
  after(async () => {
    const authUserId = utente.auth_user_id ?? null

    if (authUserId) {
      const { error: sessioniError } = await admin.rpc("crm_revoca_sessioni_utente", {
        p_auth_user_id: authUserId,
        p_escludi_sessione: null,
      })
      if (sessioniError) {
        console.error(`[utenti] revoca sessioni di ${id} fallita:`, sessioniError.message)
      }

      // ban_duration lungo invece di delete: l'account Auth deve restare
      // finche' la riga CRM esiste (il passaggio 2 lo rimuove davvero), ma da
      // adesso non deve piu' poter fare login.
      const { error: banError } = await admin.auth.admin.updateUserById(authUserId, {
        ban_duration: "876000h",
      })
      if (banError) {
        console.error(`[auth] blocco account ${authUserId} (utente ${id}) fallito:`, banError.message)
      }
    }

    try {
      const revocati = await revocaRefreshPerUtente(id)
      if (revocati > 0) console.info(`[mcp] revocati ${revocati} refresh token dell'utente ${id}`)
    } catch (err) {
      console.error(`[mcp] revoca token dell'utente ${id} fallita:`, err)
    }

    const storedUsername = await getNextcloudUsername(id)
    const username = storedUsername ?? (utente.email ? nextcloudUsernameFromEmail(utente.email) : null)
    if (username) {
      const result = await setNextcloudUserEnabled(username, false)
      if (!result.ok) {
        console.error(
          `[nextcloud] disabilitazione di "${username}" (utente ${id}) fallita: ${result.error} — disabilitare a mano`,
        )
      }
    }
  })

  // attivo = false cambia il perimetro dei permessi: lo snapshot in cache non
  // e' piu' valido.
  invalidatePermissionSnapshotCache()

  return NextResponse.json({ esito })
}
