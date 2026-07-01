import { createClient } from "@/lib/supabase/server"

export type DashboardLead = {
  id: string
  nome: string
  stato: string | null
  valutazione: number
  sede: string | null
}

export type DashboardData = {
  counts: {
    leads: number
    clienti: number
    compiti: number
    scadenze: number
    installatori: number
  }
  hotLeads: DashboardLead[]
  clientiByStatus: Array<{ stato: string; count: number }>
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()
  const [
    leadsCount,
    clientiCount,
    compitiCount,
    scadenzeCount,
    installatoriCount,
    hotLeadsResult,
    clientiStatusResult,
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("clienti").select("id", { count: "exact", head: true }),
    supabase.from("compiti").select("id", { count: "exact", head: true }),
    supabase.from("scadenze").select("id", { count: "exact", head: true }),
    supabase.from("installatori").select("id", { count: "exact", head: true }),
    supabase
      .from("leads")
      .select("id,nome_lead,nome,cognome,stato_lead,valutazione,sede")
      .gt("valutazione", 80)
      .order("valutazione", { ascending: false })
      .limit(5),
    supabase.from("clienti").select("stato"),
  ])

  const errors = [
    leadsCount.error,
    clientiCount.error,
    compitiCount.error,
    scadenzeCount.error,
    installatoriCount.error,
    hotLeadsResult.error,
    clientiStatusResult.error,
  ].filter(Boolean)
  if (errors.length > 0) {
    throw new Error(`Dashboard Supabase: ${errors[0]?.message}`)
  }

  const statusCounts = new Map<string, number>()
  for (const row of clientiStatusResult.data ?? []) {
    const stato = row.stato ?? "Senza stato"
    statusCounts.set(stato, (statusCounts.get(stato) ?? 0) + 1)
  }

  return {
    counts: {
      leads: leadsCount.count ?? 0,
      clienti: clientiCount.count ?? 0,
      compiti: compitiCount.count ?? 0,
      scadenze: scadenzeCount.count ?? 0,
      installatori: installatoriCount.count ?? 0,
    },
    hotLeads: (hotLeadsResult.data ?? []).map((lead) => ({
      id: lead.id,
      nome:
        lead.nome_lead ||
        [lead.nome, lead.cognome].filter(Boolean).join(" ") ||
        "Lead senza nome",
      stato: lead.stato_lead,
      valutazione: lead.valutazione ?? 0,
      sede: lead.sede,
    })),
    clientiByStatus: Array.from(statusCounts, ([stato, count]) => ({
      stato,
      count,
    })).sort((a, b) => b.count - a.count),
  }
}
