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
  leadTrend: Array<{ label: string; count: number }>
  tasksByStatus: Array<{ label: string; count: number }>
  overdueTasks: number
  deadlines: {
    overdue: number
    next7Days: number
    later: number
  }
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

type AggregateCount = { label: string; count: number }
type AggregateLocation = {
  sede: string | null
  provincia: string | null
  count: number
}
type AggregateTrend = { key: string; count: number }

function groupedCounts(
  rows: Array<Record<string, unknown>>,
  key: string,
  emptyLabel = "Senza stato",
) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const raw = row[key]
    const label = typeof raw === "string" && raw.trim() ? raw.trim() : emptyLabel
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count,
  )
}

async function loadDashboardAggregateFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const [leads, clienti, tasks, deadlines] = await Promise.all([
    supabase.from("leads").select("stato_lead,sede,provincia,created_at").limit(10000),
    supabase.from("clienti").select("stato").limit(10000),
    supabase.from("compiti").select("stato,scadenza").limit(10000),
    supabase.from("scadenze").select("data_scadenza").limit(10000),
  ])
  const error = leads.error ?? clienti.error ?? tasks.error ?? deadlines.error
  if (error) throw new Error(`Dashboard Supabase: ${error.message}`)

  const leadRows = (leads.data ?? []) as Array<Record<string, unknown>>
  const taskRows = (tasks.data ?? []) as Array<Record<string, unknown>>
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const locations = new Map<string, AggregateLocation>()
  const trend = new Map<string, number>()

  for (const row of leadRows) {
    const sede = typeof row.sede === "string" ? row.sede : null
    const provincia = typeof row.provincia === "string" ? row.provincia : null
    const locationKey = `${sede ?? ""}\u0000${provincia ?? ""}`
    const current = locations.get(locationKey)
    locations.set(locationKey, {
      sede,
      provincia,
      count: (current?.count ?? 0) + 1,
    })
    if (typeof row.created_at === "string") {
      const date = new Date(row.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      trend.set(key, (trend.get(key) ?? 0) + 1)
    }
  }

  const deadlineBuckets = { overdue: 0, next7Days: 0, later: 0 }
  for (const row of deadlines.data ?? []) {
    if (typeof row.data_scadenza !== "string") continue
    const date = new Date(row.data_scadenza)
    if (date < today) deadlineBuckets.overdue += 1
    else if (date < nextWeek) deadlineBuckets.next7Days += 1
    else deadlineBuckets.later += 1
  }

  return {
    leadsByStatus: groupedCounts(leadRows, "stato_lead"),
    leadLocations: Array.from(locations.values()),
    leadTrend: Array.from(trend, ([key, count]) => ({ key, count })),
    clientiByStatus: groupedCounts(
      (clienti.data ?? []) as Array<Record<string, unknown>>,
      "stato",
    ),
    tasksByStatus: groupedCounts(taskRows, "stato"),
    overdueTasks: taskRows.filter(
      (row) =>
        row.stato !== "Completato" &&
        typeof row.scadenza === "string" &&
        new Date(row.scadenza) < today,
    ).length,
    deadlines: deadlineBuckets,
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
    aggregatesResult,
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
    supabase.rpc("get_dashboard_aggregates"),
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
    usersResult.error,
  ].filter(Boolean)
  if (requiredErrors.length > 0) {
    throw new Error(`Dashboard Supabase: ${requiredErrors[0]?.message}`)
  }

  const aggregates =
    !aggregatesResult.error &&
    aggregatesResult.data &&
    typeof aggregatesResult.data === "object"
      ? (aggregatesResult.data as Record<string, unknown>)
      : await loadDashboardAggregateFallback(supabase)
  const leadLocations = Array.isArray(aggregates.leadLocations)
    ? (aggregates.leadLocations as AggregateLocation[])
    : []
  const leadSedeCounts = new Map<string, number>()
  const regionCounts = new Map<string, number>()
  let unmappedLeadLocations = 0
  for (const row of leadLocations) {
    const count = Number(row.count ?? 0)
    if (typeof row.sede === "string" && row.sede.trim()) {
      leadSedeCounts.set(row.sede, (leadSedeCounts.get(row.sede) ?? 0) + count)
    }
    const region = regionFromProvince(row.provincia)
    if (region) regionCounts.set(region, (regionCounts.get(region) ?? 0) + count)
    else unmappedLeadLocations += count
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

  const now = new Date()
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date),
      count: 0,
    }
  })
  const monthMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]))
  const aggregateTrend = Array.isArray(aggregates.leadTrend)
    ? (aggregates.leadTrend as AggregateTrend[])
    : []
  for (const row of aggregateTrend) {
    const bucket = monthMap.get(row.key)
    if (bucket) bucket.count = Number(row.count ?? 0)
  }
  const deadlines =
    aggregates.deadlines && typeof aggregates.deadlines === "object"
      ? (aggregates.deadlines as Record<string, unknown>)
      : {}

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
    leadsByStatus: (aggregates.leadsByStatus ?? []) as AggregateCount[],
    clientiByStatus: (aggregates.clientiByStatus ?? []) as AggregateCount[],
    mapMarkers,
    noticeboard: Array.isArray(noticeboardResult.data?.valore)
      ? (noticeboardResult.data.valore as NoticeboardItem[])
      : [],
    leadsByRegion: Array.from(regionCounts, ([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count),
    unmappedLeadLocations,
    leadTrend: monthBuckets.map(({ label, count }) => ({ label, count })),
    tasksByStatus: (aggregates.tasksByStatus ?? []) as AggregateCount[],
    overdueTasks: Number(aggregates.overdueTasks ?? 0),
    deadlines: {
      overdue: Number(deadlines.overdue ?? 0),
      next7Days: Number(deadlines.next7Days ?? 0),
      later: Number(deadlines.later ?? 0),
    },
  }
}
