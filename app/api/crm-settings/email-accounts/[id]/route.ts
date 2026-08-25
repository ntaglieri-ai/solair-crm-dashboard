import { NextResponse } from "next/server"
import {
  SHARED_ACCOUNT_COLUMNS,
  requireEmailAccountManager,
} from "@/lib/email/email-accounts-admin"

// Modifica e cancellazione di una singola casella CONDIVISA.
// Ogni query e' vincolata a condivisa = true: un id di riga personale non
// trova nulla e torna 404, non un 403 che ne confermerebbe l'esistenza.


type PatchPayload = {
  nomeVisualizzato?: unknown
  attivo?: unknown
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireEmailAccountManager()
  if (guard.response) return guard.response

  const { id } = await context.params
  const payload = (await request.json().catch(() => null)) as PatchPayload | null

  const patch: { nome_visualizzato?: string; attivo?: boolean } = {}

  if (payload?.nomeVisualizzato !== undefined) {
    const nome = typeof payload.nomeVisualizzato === "string" ? payload.nomeVisualizzato.trim() : ""
    if (!nome) {
      return NextResponse.json({ error: "Il nome visualizzato e' obbligatorio." }, { status: 400 })
    }
    patch.nome_visualizzato = nome
  }

  // Disattivazione soft: la riga resta, sparisce dai dropdown perche' le
  // query di selezione filtrano su attivo = true.
  if (typeof payload?.attivo === "boolean") patch.attivo = payload.attivo

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nessuna modifica richiesta." }, { status: 400 })
  }

  const { data, error } = await guard.admin
    .from("crm_email_accounts")
    .update(patch)
    .eq("id", id)
    .eq("condivisa", true)
    .select(SHARED_ACCOUNT_COLUMNS)
    .maybeSingle()

  if (error) {
    console.error("[email-accounts] modifica casella fallita:", error.message)
    return NextResponse.json({ error: "Impossibile modificare la casella." }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Casella condivisa non trovata." }, { status: 404 })
  }

  return NextResponse.json({ account: data })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireEmailAccountManager()
  if (guard.response) return guard.response

  const { id } = await context.params

  const { data: existing, error: readError } = await guard.admin
    .from("crm_email_accounts")
    .select(SHARED_ACCOUNT_COLUMNS)
    .eq("id", id)
    .eq("condivisa", true)
    .maybeSingle()

  if (readError) {
    console.error("[email-accounts] lettura pre-delete fallita:", readError.message)
    return NextResponse.json({ error: "Impossibile eliminare la casella." }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Casella condivisa non trovata." }, { status: 404 })
  }

  // email_massa_jobs non registra la casella usata, quindi non esiste uno
  // storico di invii da preservare e la cancellazione e' diretta.
  //
  // L'unico vincolo e' l'appartenenza: una casella condivisa che e' anche il
  // mittente di default di un utente non si cancella, perche' lascerebbe
  // quell'utente senza mittente proprio. Per toglierla dai menu c'e' la
  // disattivazione, che e' reversibile.
  if (existing.utente_id) {
    return NextResponse.json(
      {
        error:
          "Questa casella e' anche il mittente di default di un utente e non puo' essere eliminata. Disattivala per toglierla dai menu.",
      },
      { status: 409 },
    )
  }

  const { error } = await guard.admin
    .from("crm_email_accounts")
    .delete()
    .eq("id", id)
    .eq("condivisa", true)

  if (error) {
    console.error("[email-accounts] eliminazione casella fallita:", error.message)
    return NextResponse.json({ error: "Impossibile eliminare la casella." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
