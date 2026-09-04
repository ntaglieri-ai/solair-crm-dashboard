import { NextResponse } from "next/server"
import { getFullLeadById } from "@/lib/leads/repository"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { resolveOwnerScope, type OwnerScope } from "@/lib/permissions/data-scope"
import { applicaTagItalia } from "@/lib/clienti/tag-italia"

function scopeIds(scope: OwnerScope): string[] | null {
  return scope.kind === "all" ? null : scope.kind === "owners" ? scope.ownerIds : []
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guardLead = await requireApiRecord("lead", "edit")
  if (guardLead.response) return guardLead.response
  const guardCliente = await requireApiRecord("clienti", "create")
  if (guardCliente.response) return guardCliente.response
  const { id } = await params
  const lead = await getFullLeadById(id)
  if (!lead) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  if (lead["Stato Lead"] === "Convertito" || lead["Account convertito"]) {
    return NextResponse.json({ error: "Questo lead è già stato convertito in cliente." }, { status: 409 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "Servizio conversione non disponibile" }, { status: 503 })
  const [leadScope, clienteScope] = await Promise.all([
    resolveOwnerScope(guardLead.permissions.snapshot, "lead"),
    resolveOwnerScope(guardCliente.permissions.snapshot, "clienti"),
  ])
  // Lock, scope check and both writes in one transaction. No unsafe fallback.
  const { data: clienteId, error } = await admin.rpc("crm_convert_lead_atomic", {
    p_lead_id: id, p_lead_owner_ids: scopeIds(leadScope), p_cliente_owner_ids: scopeIds(clienteScope),
  })
  if (error) {
    const status = error.code === "23505" ? 409 : error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 503
    const message = status === 409 ? "Questo lead è già stato convertito in cliente."
      : status === 404 ? "Lead non trovato" : status === 403 ? "Conversione non consentita per questo proprietario"
        : "Conversione non riuscita. Ricarica il Lead per verificarne lo stato prima di riprovare."
    console.error("[converti] RPC", error.code)
    return NextResponse.json({ error: message }, { status })
  }
  // Preserve the ancillary tag rule using the committed province.
  // Its failure must not turn a committed conversion into an apparent failure.
  try {
    const supabase = await createClient()
    const { data: cliente } = await supabase.from("clienti").select("provincia_indirizzo_postale").eq("id", clienteId).single()
    if (cliente) await applicaTagItalia(clienteId, cliente.provincia_indirizzo_postale)
  } catch {
    console.warn("[converti] Verifica tag Italia non riuscita")
  }
  return NextResponse.json({ clienteId }, { status: 201 })
}
