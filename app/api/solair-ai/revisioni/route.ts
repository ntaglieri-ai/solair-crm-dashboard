import { NextResponse, after } from "next/server"

import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { requireApiAction } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import { normalizzaValore, risolviCampoAI } from "@/lib/solair-ai/campi"
import { aggiornaRecord, leggiRecord } from "@/lib/solair-ai/records"
import { ENTITA_LABEL, isEntitaAI } from "@/lib/solair-ai/tipi"
import type { EntitaAI, RevisionePending } from "@/lib/solair-ai/tipi"

export const dynamic = "force-dynamic"

type RigaRevisione = {
  id: string
  record_tipo: string
  record_id: string
  campo: string
  campo_etichetta: string | null
  valore_attuale: string | null
  valore_proposto: string
  fonte_documento: string
  stato: string
  creato_il: string
  creato_da: string | null
}

/** La coda: solo le pendenti, dalla piu' recente. */
export async function GET() {
  const guard = await requireApiAction("solair_ai.revisioni.view")
  if (guard.response) return guard.response

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crm_revisioni_pending")
    .select(
      "id, record_tipo, record_id, campo, campo_etichetta, valore_attuale, valore_proposto, fonte_documento, stato, creato_il, creato_da",
    )
    .eq("stato", "pending")
    .order("creato_il", { ascending: false })
    .limit(200)

  if (error) {
    // Tabella assente = migration non applicata. La pagina deve poter
    // aprirsi e dirlo, non rispondere 500 a chi apre il tab.
    return NextResponse.json({ revisioni: [], errore: error.message })
  }

  const righe = ((data ?? []) as RigaRevisione[]).filter((riga) => isEntitaAI(riga.record_tipo))

  // Gli autori arrivano come id: senza risolverli la coda e' una colonna di
  // uuid illeggibili.
  const autori = [...new Set(righe.map((riga) => riga.creato_da).filter(Boolean))] as string[]
  const nomi = new Map<string, string>()
  if (autori.length > 0) {
    const { data: utenti } = await supabase.from("utenti").select("id, nome").in("id", autori)
    for (const utente of (utenti ?? []) as { id: string; nome: string | null }[]) {
      if (utente.nome) nomi.set(utente.id, utente.nome)
    }
  }

  const revisioni: RevisionePending[] = righe.map((riga) => ({
    id: riga.id,
    record_tipo: riga.record_tipo as EntitaAI,
    record_id: riga.record_id,
    campo: riga.campo,
    campo_etichetta: riga.campo_etichetta,
    valore_attuale: riga.valore_attuale,
    valore_proposto: riga.valore_proposto,
    fonte_documento: riga.fonte_documento,
    stato: "pending",
    creato_il: riga.creato_il,
    creato_da_nome: riga.creato_da ? (nomi.get(riga.creato_da) ?? null) : null,
  }))

  return NextResponse.json({ revisioni, errore: null })
}

type PatchPayload = { id?: string; decisione?: "accetta" | "rifiuta" }

/**
 * Decide una revisione.
 *
 * "accetta" e' l'unico punto in cui un valore proposto finisce davvero sopra
 * un valore esistente, ed e' per questo che serve una decisione esplicita:
 * il resto del giro di SolairAI non sovrascrive mai niente.
 */
export async function PATCH(request: Request) {
  const guard = await requireApiAction("solair_ai.revisioni.view")
  if (guard.response) return guard.response

  const utenteId = guard.permissions.snapshot.subject.userId
  if (!utenteId) {
    return NextResponse.json({ error: "Utente CRM non risolto." }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as PatchPayload | null
  if (!body?.id || (body.decisione !== "accetta" && body.decisione !== "rifiuta")) {
    return NextResponse.json({ error: "Payload non valido." }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: riga, error: erroreLettura } = await supabase
    .from("crm_revisioni_pending")
    .select("id, record_tipo, record_id, campo, campo_etichetta, valore_proposto, fonte_documento, stato")
    .eq("id", body.id)
    .maybeSingle()

  if (erroreLettura) {
    return NextResponse.json({ error: erroreLettura.message }, { status: 500 })
  }
  if (!riga) {
    return NextResponse.json({ error: "Revisione non trovata." }, { status: 404 })
  }

  const revisione = riga as RigaRevisione
  if (revisione.stato !== "pending") {
    return NextResponse.json({ error: "Questa revisione e' gia' stata decisa." }, { status: 409 })
  }
  if (!isEntitaAI(revisione.record_tipo)) {
    return NextResponse.json({ error: "Tipo di record non riconosciuto." }, { status: 400 })
  }

  const entita = revisione.record_tipo as EntitaAI

  if (body.decisione === "accetta") {
    // Il permesso di modifica del modulo vale anche qui: vedere la coda non
    // e' di per se' il permesso di scrivere sul record.
    const moduloRecord = entita === "cliente" ? "clienti" : entita
    if (!guard.permissions.canRecord(moduloRecord, "edit")) {
      return NextResponse.json(
        { error: `Non hai il permesso di modificare ${ENTITA_LABEL[entita]}.` },
        { status: 403 },
      )
    }

    const campo = risolviCampoAI(entita, revisione.campo)
    if (!campo) {
      return NextResponse.json(
        { error: `Il campo "${revisione.campo}" non e' fra quelli che SolairAI puo' scrivere.` },
        { status: 400 },
      )
    }

    const record = await leggiRecord(entita, revisione.record_id)
    if (!record) {
      return NextResponse.json(
        { error: `${ENTITA_LABEL[entita]} non trovato: forse e' stato eliminato.` },
        { status: 404 },
      )
    }

    // Il valore in tabella e' testo: va riportato al tipo della colonna
    // prima di scriverlo, o un numero finirebbe come stringa e una data
    // come testo libero. E' la stessa normalizzazione dell'applicazione.
    const valore = normalizzaValore(campo, revisione.valore_proposto)
    if (valore === undefined) {
      return NextResponse.json(
        { error: `Il valore proposto non e' un ${campo.tipo} valido per "${campo.etichetta}".` },
        { status: 400 },
      )
    }

    await aggiornaRecord(entita, revisione.record_id, [
      {
        campo: {
          campo: campo.column,
          etichetta: campo.etichetta,
          valore: revisione.valore_proposto,
          fonte: revisione.fonte_documento,
        },
        valore,
      },
    ])
  }

  const { error: erroreDecisione } = await supabase
    .from("crm_revisioni_pending")
    .update({
      stato: body.decisione === "accetta" ? "accettata" : "rifiutata",
      deciso_da: utenteId,
      deciso_il: new Date().toISOString(),
    })
    .eq("id", revisione.id)
    .eq("stato", "pending")

  if (erroreDecisione) {
    return NextResponse.json({ error: erroreDecisione.message }, { status: 500 })
  }

  after(() =>
    logAudit({
      tipo_evento: "modifica_record",
      attore: attoreDaPermessi(guard.permissions),
      modulo: entita,
      record_id: revisione.record_id,
      descrizione:
        `SolairAI — revisione ${body.decisione === "accetta" ? "accettata" : "rifiutata"} ` +
        `sul campo "${revisione.campo_etichetta ?? revisione.campo}"`,
      request,
    }),
  )

  return NextResponse.json({ ok: true })
}
