import { NextResponse } from "next/server"
import {
  SHARED_ACCOUNT_COLUMNS,
  requireEmailAccountManager,
} from "@/lib/email/email-accounts-admin"

// CRUD delle caselle CONDIVISE (crm_email_accounts con condivisa = true), per
// Impostazioni CRM -> Comunicazioni.
//
// Le righe personali degli utenti (condivisa = false) non passano mai da qui:
// ogni query di questo file e' vincolata a condivisa = true, sia in lettura
// che in scrittura. Un id di riga personale passato a mano non trova nulla.
//
// Alcune righe condivise appartengono comunque a un utente (utente_id
// valorizzato: info@ e commerciale@ sono la casella di default di un'utenza di
// servizio e insieme una casella scegliibile da tutti). Sono modificabili e
// disattivabili, ma non eliminabili — vedi [id]/route.ts.

type SharedAccountPayload = {
  nomeVisualizzato?: unknown
  email?: unknown
}

export async function GET() {
  const guard = await requireEmailAccountManager()
  if (guard.response) return guard.response

  const { data, error } = await guard.admin
    .from("crm_email_accounts")
    .select(SHARED_ACCOUNT_COLUMNS)
    .eq("condivisa", true)
    .order("nome_visualizzato")

  if (error) {
    console.error("[email-accounts] elenco caselle condivise fallito:", error.message)
    return NextResponse.json({ error: "Impossibile leggere le caselle condivise." }, { status: 500 })
  }

  return NextResponse.json({ accounts: data ?? [] })
}

export async function POST(request: Request) {
  const guard = await requireEmailAccountManager()
  if (guard.response) return guard.response

  const payload = (await request.json().catch(() => null)) as SharedAccountPayload | null
  const nomeVisualizzato =
    typeof payload?.nomeVisualizzato === "string" ? payload.nomeVisualizzato.trim() : ""
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : ""

  if (!nomeVisualizzato) {
    return NextResponse.json({ error: "Il nome visualizzato e' obbligatorio." }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Indirizzo email non valido." }, { status: 400 })
  }

  const { data, error } = await guard.admin
    .from("crm_email_accounts")
    .insert({
      utente_id: null,
      nome_visualizzato: nomeVisualizzato,
      email,
      condivisa: true,
      attivo: true,
      is_default: false,
    })
    .select(SHARED_ACCOUNT_COLUMNS)
    .single()

  if (error) {
    // 23505 = violazione della unique su `email`. L'indirizzo puo' essere gia'
    // in uso come casella personale di un utente, che non e' visibile qui: il
    // messaggio deve dirlo, altrimenti sembra un elenco incoerente.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Questo indirizzo e' gia' registrato come casella CRM (anche personale)." },
        { status: 409 },
      )
    }
    console.error("[email-accounts] creazione casella condivisa fallita:", error.message)
    return NextResponse.json({ error: "Impossibile creare la casella." }, { status: 500 })
  }

  return NextResponse.json({ account: data }, { status: 201 })
}
