import { NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import {
  accountUserErrorMessage,
  resolveRole,
} from "@/lib/crm-settings/roles"
import {
  deleteNextcloudUser,
  setNextcloudUserEnabled,
  syncNextcloudUserGroup,
} from "@/lib/nextcloud/provisioning"
import { nextcloudUsernameFromEmail } from "@/lib/nextcloud/config"
import {
  getNextcloudUsername,
  storeNextcloudCredential,
} from "@/lib/nextcloud/credentials"
import { createAdminClient } from "@/lib/supabase/admin"

type PatchPayload = {
  nome?: string
  email?: string
  ruolo?: string
  sede?: string
  attivo?: boolean
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const { id } = await params
  const body = (await request.json().catch(() => null)) as PatchPayload | null
  if (!body) {
    return NextResponse.json({ error: "Payload utente non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const patch: Record<string, unknown> = {}
  if (body.nome !== undefined) patch.nome = body.nome.trim()
  if (body.email !== undefined) patch.email = body.email.trim().toLowerCase()
  if (body.sede !== undefined) patch.sede = body.sede
  if (body.attivo !== undefined) patch.attivo = body.attivo
  if (body.ruolo !== undefined) {
    const ruolo = await resolveRole(supabase, body.ruolo).catch(() => null)
    if (!ruolo) {
      return NextResponse.json(
        { error: "Il ruolo selezionato non esiste o non è più disponibile." },
        { status: 400 },
      )
    }
    patch.ruolo = ruolo.code
    patch.ruolo_id = ruolo.id
  }

  const { data, error } = await supabase
    .from("utenti")
    .update(patch)
    .eq("id", id)
    .select("id, nome, email, ruolo, ruolo_id, sede, attivo, created_at")
    .single()

  if (error) {
    console.error(`[utenti] aggiornamento utente ${id} fallito:`, error)
    return NextResponse.json(
      { error: accountUserErrorMessage(error) },
      { status: 500 },
    )
  }

  // Sincronizza lo stato/gruppo Nextcloud in BACKGROUND via after(): sia
  // l'abilita/disabilita (quando cambia "attivo") sia la proiezione del
  // ruolo CRM nel gruppo Nextcloud (quando cambia "ruolo") comportano
  // chiamate di rete verso Nextcloud — il secondo caso in particolare ne fa
  // diverse in sequenza (crea gruppo, assegna, leggi, rimuovi i vecchi). Un
  // primo tentativo (23/07) le eseguiva in modo sincrono nella risposta PATCH
  // e bloccava/appesantiva il salvataggio del cambio ruolo (stesso problema
  // gia' risolto per creazione/cancellazione account) — e' stato revertito
  // per questo. Best-effort, non blocca mai il salvataggio CRM: eventuali
  // errori restano solo nello stato della credenziale, riconciliabili dalla
  // UI con "Riprova provisioning".
  if (body.attivo !== undefined || body.ruolo !== undefined) {
    after(async () => {
      const storedUsername = await getNextcloudUsername(data.id)
      const username = storedUsername ?? nextcloudUsernameFromEmail(data.email)
      let lastError: string | null = null

      if (body.attivo !== undefined) {
        const result = await setNextcloudUserEnabled(username, data.attivo)
        if (!result.ok) {
          console.error(`[nextcloud] enable/disable fallito per ${username}:`, result.error)
          lastError = result.error
        }
      }

      if (body.ruolo !== undefined) {
        const groupSync = await syncNextcloudUserGroup(username, data.ruolo)
        if (!groupSync.ok) {
          console.error(`[nextcloud] sincronizzazione gruppo fallita per ${username}:`, groupSync.error)
          lastError = groupSync.error
        }
      }

      // Aggiorna lo stato della credenziale SOLO se l'utente e' gia'
      // provisionato su Nextcloud (riga esistente). Per un utente mai
      // provisionato un semplice cambio ruolo/attivo non deve fabbricare una
      // nuova riga "failed": l'eventuale errore resta nei log, senza sporcare
      // lo stato mostrato in UI. Le chiamate enable/disable e group-sync
      // restano comunque best-effort (username derivato dall'email come
      // fallback), per non perdere l'intento di sicurezza del disable.
      if (storedUsername) {
        await storeNextcloudCredential({
          utenteId: data.id,
          username,
          status: lastError ? "failed" : data.attivo ? "active" : "disabled",
          lastError,
        })
      }
    })
  }

  return NextResponse.json({ utente: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const { id } = await params
  const supabase = await createClient()

  // Recupera lo userid Nextcloud e l'auth_user_id PRIMA di cancellare la riga
  // utenti: la FK di nextcloud_credentials e' `on delete cascade`, quindi la
  // delete rimuove la credenziale e con essa nc_username, lasciando l'account
  // NC orfano senza modo di risalire a quale account rimuovere. null = utente
  // mai provisionato (Nextcloud) / mai collegato (Auth).
  const ncUsername = await getNextcloudUsername(id)
  const { data: existing } = await supabase
    .from("utenti")
    .select("auth_user_id")
    .eq("id", id)
    .maybeSingle()
  const authUserId = existing?.auth_user_id ?? null

  const { error } = await supabase.from("utenti").delete().eq("id", id)

  if (error) {
    console.error(`[utenti] eliminazione utente ${id} fallita:`, error)
    return NextResponse.json(
      { error: accountUserErrorMessage(error) },
      { status: 500 },
    )
  }

  // Elimina l'account Nextcloud e l'account Supabase Auth associati, in
  // BACKGROUND via after(): la riga utenti e' gia' cancellata sopra (la
  // cancellazione CRM e' gia' avvenuta a tutti gli effetti), quindi non ha
  // senso far aspettare il browser per due chiamate di rete di pulizia
  // (Nextcloud OCS delete + Supabase Auth admin delete). Stesso approccio
  // "loud, not silent, best-effort" di prima: se falliscono, loggano forte
  // per riconciliazione manuale, ma non bloccano piu' la risposta HTTP.
  after(async () => {
    if (ncUsername) {
      try {
        const result = await deleteNextcloudUser(ncUsername)
        if (!result.ok) {
          console.error(
            `[nextcloud] delete account fallita per "${ncUsername}" (utente ${id}): ${result.error} — rimuovere manualmente`,
          )
        }
      } catch (err) {
        console.error(
          `[nextcloud] delete account in background fallita per "${ncUsername}" (utente ${id}):`,
          err,
        )
      }
    }

    if (authUserId) {
      const admin = createAdminClient()
      if (!admin) {
        console.error(
          `[auth] SUPABASE_SERVICE_ROLE_KEY non configurata: account Auth ${authUserId} (utente ${id}) non rimosso — rimuovere manualmente`,
        )
      } else {
        try {
          const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUserId)
          if (deleteAuthError) {
            console.error(
              `[auth] delete account fallita per ${authUserId} (utente ${id}): ${deleteAuthError.message} — rimuovere manualmente`,
            )
          }
        } catch (err) {
          console.error(
            `[auth] delete account in background fallita per ${authUserId} (utente ${id}):`,
            err,
          )
        }
      }
    }
  })

  return NextResponse.json({ ok: true })
}
