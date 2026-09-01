import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { applyOwnerScope, resolveOwnerScope } from "@/lib/permissions/data-scope"

export interface CorrelabileResult {
  tipo: "lead" | "cliente" | "scadenza"
  id: string
  nome: string
}

// Endpoint di ricerca condiviso per il linking "Correlato a" dei compiti:
// usato da Compiti (modalità libera) e dai dialog di creazione rapida su
// Lead/Cliente/Scadenza. Richiede solo autenticazione + view su compiti,
// dato che i risultati alimentano esclusivamente la creazione di un compito
// e non espongono più campi di quanto già visibile nelle rispettive liste.
export async function GET(request: Request) {
  const guard = await requireApiRecord("compiti", "view")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 10, 1),
    50,
  )

  if (!q) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()
  const pattern = `%${q}%`

  const [leadScope, clientiScope, scadenzeScope] = await Promise.all([
    resolveOwnerScope(guard.permissions.snapshot, "lead"),
    resolveOwnerScope(guard.permissions.snapshot, "clienti"),
    resolveOwnerScope(guard.permissions.snapshot, "scadenze"),
  ])
  const [leads, clienti, scadenze] = await Promise.all([
    applyOwnerScope(supabase
      .from("leads")
      .select("id, nome_lead")
      .ilike("nome_lead", pattern)
      .limit(limit), "lead_proprietario_id", leadScope),
    applyOwnerScope(supabase
      .from("clienti")
      .select("id, nome_clienti")
      .ilike("nome_clienti", pattern)
      .limit(limit), "clienti_proprietario_id", clientiScope),
    applyOwnerScope(supabase
      .from("scadenze")
      .select("id, nome")
      .ilike("nome", pattern)
      .limit(limit), "proprietario_id", scadenzeScope),
  ])

  if (leads.error) console.error("[api/search/correlabili] leads:", leads.error.message)
  if (clienti.error) console.error("[api/search/correlabili] clienti:", clienti.error.message)
  if (scadenze.error) console.error("[api/search/correlabili] scadenze:", scadenze.error.message)

  const results: CorrelabileResult[] = [
    ...(leads.data ?? []).map((row) => ({
      tipo: "lead" as const,
      id: row.id as string,
      nome: (row.nome_lead as string) ?? "",
    })),
    ...(clienti.data ?? []).map((row) => ({
      tipo: "cliente" as const,
      id: row.id as string,
      nome: (row.nome_clienti as string) ?? "",
    })),
    ...(scadenze.data ?? []).map((row) => ({
      tipo: "scadenza" as const,
      id: row.id as string,
      nome: (row.nome as string) ?? "",
    })),
  ].slice(0, limit)

  return NextResponse.json({ results })
}
