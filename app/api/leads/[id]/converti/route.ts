import { NextResponse } from "next/server"
import { getFullLeadById } from "@/lib/leads/repository"
import { patchLead } from "@/lib/leads/server-store"
import { createClienteRecord } from "@/lib/clienti/repository"
import { requireApiRecord } from "@/lib/permissions/server"

// Conversione reale Lead -> Cliente: prima "Converti a cliente" chiudeva
// solo il dialog, nessuna azione reale (audit "funzionalità finte" 24/07).
// Crea un cliente collegato (clienti.lead_id) con i dati anagrafici del
// lead, poi marca il lead come "Convertito" e salva l'id del cliente creato
// (leads.account_convertito_id) — cosi' il lead resta nello storico con il
// riferimento a dove è confluito, invece di sparire o duplicarsi in modo
// scollegato.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guardLead = await requireApiRecord("lead", "edit")
  if (guardLead.response) return guardLead.response
  const guardCliente = await requireApiRecord("clienti", "create")
  if (guardCliente.response) return guardCliente.response

  const { id } = await params
  const lead = await getFullLeadById(id)
  if (!lead) {
    return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  }

  const cliente = await createClienteRecord(
    {
      "Nome Clienti": lead["Nome Lead"],
      Nome: lead.Nome || undefined,
      Cognome: lead.Cognome || undefined,
      "E-mail": lead["E-mail"] || undefined,
      Cellulare: lead.Telefono || undefined,
      Sede: lead.Sede,
      "Clienti Proprietario": lead["Lead Proprietario"] || undefined,
    },
    lead.id,
  )

  const updated = await patchLead(id, {
    "Stato Lead": "Convertito",
    "Account convertito": cliente.id,
  })
  if (!updated) {
    // Il cliente e' comunque stato creato: non blocchiamo la risposta per
    // questo, ma lo segnaliamo per non far credere che sia andato storto.
    console.error(`[converti] cliente ${cliente.id} creato ma lead ${id} non aggiornato`)
  }

  return NextResponse.json({ clienteId: cliente.id }, { status: 201 })
}
