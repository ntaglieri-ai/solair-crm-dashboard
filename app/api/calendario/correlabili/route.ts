import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiPage } from "@/lib/permissions/server"
import type { CorrelatoValue } from "@/components/shared/correlato-picker"
import { applyOwnerScope, resolveOwnerScope } from "@/lib/permissions/data-scope"

/**
 * Ricerca dei record collegabili a un evento di calendario: lead,
 * clienti e installatori. Gemella di /api/search/correlabili, che serve
 * i compiti e cerca invece fra lead, clienti e scadenze.
 *
 * Sono due route e non una con un parametro perche' differiscono nella
 * guardia: quella e' dietro compiti.view, questa dietro la pagina
 * Calendario. Un ruolo puo' avere l'una e non l'altra.
 */
export async function GET(request: Request) {
  const guard = await requireApiPage("calendario")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 50)
  if (!q) return NextResponse.json({ results: [] })

  const supabase = await createClient()
  const pattern = `%${q}%`

  const [leadScope, clientiScope, installatoriScope] = await Promise.all([
    resolveOwnerScope(guard.permissions.snapshot, "lead"),
    resolveOwnerScope(guard.permissions.snapshot, "clienti"),
    resolveOwnerScope(guard.permissions.snapshot, "installatori"),
  ])
  const [leads, clienti, installatori] = await Promise.all([
    applyOwnerScope(supabase.from("leads").select("id, nome_lead").ilike("nome_lead", pattern).limit(limit), "lead_proprietario_id", leadScope),
    applyOwnerScope(supabase.from("clienti").select("id, nome_clienti").ilike("nome_clienti", pattern).limit(limit), "clienti_proprietario_id", clientiScope),
    applyOwnerScope(supabase.from("installatori").select("id, nome").ilike("nome", pattern).limit(limit), "proprietario_id", installatoriScope),
  ])

  if (leads.error) console.error("[api/calendario/correlabili] leads:", leads.error.message)
  if (clienti.error) console.error("[api/calendario/correlabili] clienti:", clienti.error.message)
  if (installatori.error) {
    console.error("[api/calendario/correlabili] installatori:", installatori.error.message)
  }

  const results: CorrelatoValue[] = [
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
    ...(installatori.data ?? []).map((row) => ({
      tipo: "installatore" as const,
      id: row.id as string,
      nome: (row.nome as string) ?? "",
    })),
  ].slice(0, limit)

  return NextResponse.json({ results })
}
