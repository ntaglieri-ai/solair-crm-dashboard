import { createClient } from "@/lib/supabase/server"
import type { DashboardMapMarker } from "@/components/dashboard/italy-map"
import type { SystemSede } from "@/lib/system-settings-data"
import type { NoticeboardItem } from "@/components/dashboard/noticeboard"
import { regionFromProvince } from "@/lib/dashboard/italy-regions"

export type DashboardLead = {
  id: string
  nome: string
  stato: string | null
  valutazione: number
  sede: string | null
  createdAt: string | null
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
  recentLeads: DashboardLead[]
  leadsByStatus: Array<{ label: string; count: number }>
  clientiByStatus: Array<{ label: string; count: number }>
  mapMarkers: DashboardMapMarker[]
  noticeboard: NoticeboardItem[]
  leadsByRegion: Array<{ region: string; count: number }>
  unmappedLeadLocations: number
}

const CITY_COORDINATES: Array<{
  aliases: string[]
  coordinates: [number, number]
}> = [
  { aliases: ["catania"], coordinates: [15.0873, 37.5027] },
  { aliases: ["giarre"], coordinates: [15.1819, 37.7245] },
  { aliases: ["treviso"], coordinates: [12.243, 45.6669] },
  { aliases: ["torino", "turin"], coordinates: [7.6869, 45.0703] },
  { aliases: ["porto sant'elpidio", "porto sant elpidio"], coordinates: [13.7583, 43.2583] },
  { aliases: ["milano", "milan"], coordinates: [9.19, 45.4642] },
  { aliases: ["roma", "rome"], coordinates: [12.4964, 41.9028] },
  { aliases: ["palermo"], coordinates: [13.3615, 38.1157] },
  { aliases: ["napoli", "naples"], coordinates: [14.2681, 40.8518] },
  { aliases: ["bologna"], coordinates: [11.3426, 44.4949] },
  { aliases: ["firenze", "florence"], coordinates: [11.2558, 43.7696] },
  { aliases: ["bari"], coordinates: [16.8719, 41.1171] },
]

function coordinatesFor(sede: Pick<SystemSede, "nome" | "indirizzo">) {
  const haystack = `${sede.nome} ${sede.indirizzo}`.toLocaleLowerCase("it")
  return CITY_COORDINATES.find(({ aliases }) =>
    aliases.some((alias) => haystack.includes(alias)),
  )?.coordinates
}

function countValues(
  rows: Array<Record<string, unknown>>,
  key: string,
  emptyLabel: string,
) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = typeof row[key] === "string" ? row[key].trim() : ""
    const label = value || emptyLabel
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count,
  )
}

function mapLead(row: Record<string, unknown>): DashboardLead {
  const fullName = [row.nome, row.cognome].filter(Boolean).join(" ")
  return {
    id: String(row.id),
    nome: String(row.nome_lead || fullName || "Lead senza nome"),
    stato: typeof row.stato_lead === "string" ? row.stato_lead : null,
    valutazione: typeof row.valutazione === "number" ? row.valutazione : 0,
    sede: typeof row.sede === "string" ? row.sede : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  }
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
    recentLeadsResult,
    leadDistributionResult,
    clientiStatusResult,
    settingsResult,
    usersResult,
    noticeboardResult,
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("clienti").select("id", { count: "exact", head: true }),
    supabase.from("compiti").select("id", { count: "exact", head: true }),
    supabase.from("scadenze").select("id", { count: "exact", head: true }),
    supabase.from("installatori").select("id", { count: "exact", head: true }),
    supabase
      .from("leads")
      .select("id,nome_lead,nome,cognome,stato_lead,valutazione,sede,created_at")
      .gt("valutazione", 80)
      .order("valutazione", { ascending: false })
      .limit(5),
    supabase
      .from("leads")
      .select("id,nome_lead,nome,cognome,stato_lead,valutazione,sede,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("leads").select("stato_lead,sede,provincia").limit(10000),
    supabase.from("clienti").select("stato").limit(10000),
    supabase
      .from("crm_settings")
      .select("valore")
      .eq("chiave", "system.sedi")
      .maybeSingle(),
    supabase.from("utenti").select("sede").not("sede", "is", null),
    supabase
      .from("crm_settings")
      .select("valore")
      .eq("chiave", "dashboard.noticeboard")
      .maybeSingle(),
  ])

  const requiredErrors = [
    leadsCount.error,
    clientiCount.error,
    compitiCount.error,
    scadenzeCount.error,
    installatoriCount.error,
    hotLeadsResult.error,
    recentLeadsResult.error,
    leadDistributionResult.error,
    clientiStatusResult.error,
    usersResult.error,
  ].filter(Boolean)
  if (requiredErrors.length > 0) {
    throw new Error(`Dashboard Supabase: ${requiredErrors[0]?.message}`)
  }

  const leadRows = (leadDistributionResult.data ?? []) as Array<Record<string, unknown>>
  const leadSedeCounts = new Map<string, number>()
  const regionCounts = new Map<string, number>()
  let unmappedLeadLocations = 0
  for (const row of leadRows) {
    if (typeof row.sede === "string" && row.sede.trim()) {
      leadSedeCounts.set(row.sede, (leadSedeCounts.get(row.sede) ?? 0) + 1)
    }
    const region = regionFromProvince(row.provincia)
    if (region) regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1)
    else unmappedLeadLocations += 1
  }

  const configuredSedi = Array.isArray(settingsResult.data?.valore)
    ? (settingsResult.data.valore as SystemSede[])
    : []
  const userSedi = Array.from(
    new Set((usersResult.data ?? []).map((user) => user.sede?.trim()).filter(Boolean)),
  ) as string[]
  const sedi =
    configuredSedi.length > 0
      ? configuredSedi.filter((sede) => sede.attiva)
      : userSedi.map((nome) => ({
          id: `sede_${nome.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          nome,
          indirizzo: "",
          attiva: true,
          utenti: 0,
        }))

  const mapMarkers = sedi.flatMap((sede) => {
    const coordinates = coordinatesFor(sede)
    return coordinates
      ? [{
          id: sede.id,
          nome: sede.nome,
          coordinates,
          leads: leadSedeCounts.get(sede.nome) ?? 0,
        }]
      : []
  })

  return {
    counts: {
      leads: leadsCount.count ?? 0,
      clienti: clientiCount.count ?? 0,
      compiti: compitiCount.count ?? 0,
      scadenze: scadenzeCount.count ?? 0,
      installatori: installatoriCount.count ?? 0,
    },
    hotLeads: ((hotLeadsResult.data ?? []) as Array<Record<string, unknown>>).map(mapLead),
    recentLeads: ((recentLeadsResult.data ?? []) as Array<Record<string, unknown>>).map(mapLead),
    leadsByStatus: countValues(leadRows, "stato_lead", "Senza stato"),
    clientiByStatus: countValues(
      (clientiStatusResult.data ?? []) as Array<Record<string, unknown>>,
      "stato",
      "Senza stato",
    ),
    mapMarkers,
    noticeboard: Array.isArray(noticeboardResult.data?.valore)
      ? (noticeboardResult.data.valore as NoticeboardItem[])
      : [],
    leadsByRegion: Array.from(regionCounts, ([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count),
    unmappedLeadLocations,
  }
}
