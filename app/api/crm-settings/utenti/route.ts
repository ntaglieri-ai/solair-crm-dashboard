import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import {
  accountRoleErrorMessage,
  resolveRole,
} from "@/lib/crm-settings/roles"
import { provisionNextcloudUser } from "@/lib/nextcloud/provisioning"
import { getNextcloudCredentialStatuses } from "@/lib/nextcloud/credentials"
import { provisionAuthUser } from "@/lib/auth/user-provisioning"

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
    return NextResponse.json({ error: error.message }, { status: 500 })
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
    return NextResponse.json(
      { error: accountRoleErrorMessage(error.message) },
      { status: 500 },
    )
  }

  // Provisioning Nextcloud: crea l'account speculare + app-password cifrata.
  // Non blocca la creazione CRM: in caso di errore l'utente resta creato ma la
  // credenziale e' marcata pending/failed ed e' rilanciabile dalla UI.
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

  // Provisioning Auth: crea l'account Supabase Auth con password temporanea
  // e la invia via email. Stesso approccio "loud, not silent" del Nextcloud:
  // l'utente CRM resta creato anche se Auth/email falliscono, ma lo stato e'
  // visibile e rilanciabile dalla UI (retryWelcomeEmail).
  const authProvisioning = await provisionAuthUser({
    id: data.id,
    email: data.email,
    nome: data.nome,
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

  return NextResponse.json(
    {
      utente: {
        ...data,
        must_change_password: true,
        welcome_email_status: authProvisioning.emailStatus,
        welcome_email_error: authProvisioning.emailError,
      },
      nextcloud: { status: provisioning.status, error: provisioning.error },
      auth: { error: authProvisioning.error },
    },
    { status: 201 },
  )
}
