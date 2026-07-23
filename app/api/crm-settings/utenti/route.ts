import { NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import {
  accountUserErrorMessage,
  resolveRole,
} from "@/lib/crm-settings/roles"
import { provisionNextcloudUser } from "@/lib/nextcloud/provisioning"
import { getNextcloudCredentialStatuses } from "@/lib/nextcloud/credentials"
import { generateTempPassword, provisionAuthUser } from "@/lib/auth/user-provisioning"

type UserPayload = {
  nome: string
  email: string
  ruolo: string
  sede: string
  attivo?: boolean
}

export async function GET() {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const supabase = await createClient()
  const [{ data: utenti, error: utentiError }, { data: ruoli, error: ruoliError }] =
    await Promise.all([
      supabase
        .from("utenti")
        .select(
          "id, nome, email, ruolo, ruolo_id, sede, attivo, created_at, must_change_password, welcome_email_status, welcome_email_error",
        )
        .order("nome"),
      supabase
        .from("ruoli")
        .select("id, code, nome")
        .order("ordinamento", { ascending: true }),
    ])

  const error = utentiError ?? ruoliError
  if (error) {
    console.error("[utenti] caricamento elenco fallito:", error)
    return NextResponse.json(
      { error: accountUserErrorMessage(error) },
      { status: 500 },
    )
  }

  // Arricchisce ogni utente con lo stato del provisioning Nextcloud.
  const ncStatuses = await getNextcloudCredentialStatuses(
    (utenti ?? []).map((u) => u.id),
  )
  const utentiConNc = (utenti ?? []).map((u) => {
    const nc = ncStatuses.get(u.id)
    return {
      ...u,
      nextcloud_status: nc?.status ?? "pending",
      nextcloud_error: nc?.last_error ?? null,
    }
  })

  return NextResponse.json({ utenti: utentiConNc, ruoli: ruoli ?? [] })
}

export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as UserPayload | null
  if (!body?.nome?.trim() || !body.email?.trim() || !body.ruolo || !body.sede) {
    return NextResponse.json({ error: "Payload utente non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const ruolo = await resolveRole(supabase, body.ruolo).catch(() => null)
  if (!ruolo) {
    return NextResponse.json(
      { error: "Il ruolo selezionato non esiste o non è più disponibile." },
      { status: 400 },
    )
  }
  const { data, error } = await supabase
    .from("utenti")
    .insert({
      nome: body.nome.trim(),
      email: body.email.trim().toLowerCase(),
      ruolo: ruolo.code,
      ruolo_id: ruolo.id,
      sede: body.sede,
      attivo: body.attivo ?? true,
    })
    .select(
      "id, nome, email, ruolo, ruolo_id, sede, attivo, created_at, must_change_password, welcome_email_status, welcome_email_error",
    )
    .single()

  if (error) {
    console.error("[utenti] creazione utente fallita:", error)
    return NextResponse.json(
      { error: accountUserErrorMessage(error) },
      { status: 500 },
    )
  }

  // Provisioning Nextcloud + Auth (creazione account speculare con la stessa
  // password temporanea, app-password WebDAV cifrata, invio email di
  // benvenuto): girano in BACKGROUND via after(), non bloccano piu' la
  // risposta HTTP. Prima erano sequenziali e sincroni (insert DB -> 3 call
  // Nextcloud OCS -> creazione Auth -> invio SMTP Aruba), causando lentezza
  // percepita di diversi secondi in creazione. Gli stati (welcome_email_status,
  // nextcloud_credentials.status) hanno gia' default 'pending' a livello DB, e
  // la UI ha gia' un pattern "pending + riprova" pronto (retryWelcomeEmail,
  // retry Nextcloud da /utenti/[id]/nextcloud) — stesso principio "loud, not
  // silent" gia' in uso, qui applicato anche al provisioning iniziale.
  after(async () => {
    // La password temporanea appartiene soltanto al CRM. Nextcloud genera
    // internamente una password tecnica casuale e l'utente accede via OIDC.
    const tempPassword = generateTempPassword()
    try {
      const provisioning = await provisionNextcloudUser({
        id: data.id,
        email: data.email,
        nome: data.nome,
      })
      if (provisioning.status !== "active") {
        console.error(
          `[nextcloud] provisioning ${provisioning.status} per utente ${data.id}:`,
          provisioning.error,
        )
      }
    } catch (err) {
      console.error(`[nextcloud] provisioning in background fallito per utente ${data.id}:`, err)
    }

    try {
      const authProvisioning = await provisionAuthUser({
        id: data.id,
        email: data.email,
        nome: data.nome,
        tempPassword,
      })
      if (authProvisioning.error) {
        console.error(`[auth] provisioning fallito per utente ${data.id}:`, authProvisioning.error)
      }
      if (authProvisioning.emailStatus !== "sent") {
        console.error(
          `[auth] invio email di benvenuto ${authProvisioning.emailStatus} per utente ${data.id}:`,
          authProvisioning.emailError,
        )
      }
    } catch (err) {
      console.error(`[auth] provisioning in background fallito per utente ${data.id}:`, err)
    }
  })

  return NextResponse.json(
    {
      utente: {
        ...data,
        must_change_password: true,
      },
      nextcloud: { status: "pending", error: null },
      auth: { error: null },
    },
    { status: 201 },
  )
}
