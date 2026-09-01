import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { triggerDocumentazioneCompleta } from "@/lib/automazioni/handoff"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"

// Fase 5.5 — conferma "documentazione completa" su un Cliente: crea il Compito
// di passaggio pratica per il responsabile configurato (Paola, via
// Impostazioni > Comunicazioni > Automazioni handoff).
//
// Azione volutamente senza stato proprio: non scrive nessuna colonna sul
// cliente, perche' non esiste un campo "documentazione completa" nello schema
// e inventarne uno richiederebbe una migration per un dato che nessuna altra
// parte dell'app legge. La ripetibilita' e' gia' coperta a monte: se esiste
// gia' un Compito di passaggio pratica aperto per questo cliente,
// creaCompitoHandoff non ne crea un secondo e la risposta lo dice.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("clienti", "edit")
  if (guard.response) return guard.response

  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "clienti", "clienti", "clienti_proprietario_id", id)) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  const supabase = await createClient()
  const { data: cliente, error } = await supabase
    .from("clienti")
    .select("nome_clienti")
    .eq("id", id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!cliente) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  }

  // triggerDocumentazioneCompleta non lancia mai: l'esito arriva tipizzato e
  // viene tradotto qui in un messaggio per l'utente. La risposta resta 200
  // anche quando il Compito non e' stato creato — l'azione dell'utente
  // (confermare la documentazione) e' comunque andata a buon fine, e un 500
  // farebbe pensare il contrario.
  const esito = await triggerDocumentazioneCompleta(
    id,
    (cliente.nome_clienti as string) || "Cliente",
  )

  if (esito.ok) {
    return NextResponse.json({
      ok: true,
      creato: esito.creato,
      messaggio: esito.creato
        ? `Compito di passaggio pratica assegnato a ${esito.responsabile}.`
        : "Esiste già un Compito di passaggio pratica aperto per questo cliente.",
    })
  }

  return NextResponse.json({
    ok: false,
    messaggio:
      esito.motivo === "non_configurato"
        ? "Responsabile passaggio pratica non configurato in Impostazioni > Comunicazioni > Automazioni handoff: nessun Compito creato."
        : "Creazione del Compito di passaggio pratica non riuscita. Riprova o controlla i log.",
  })
}
