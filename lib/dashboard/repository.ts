import { createClient } from "@/lib/supabase/server"
import type { DashboardMapMarker } from "@/components/dashboard/italy-map"
import type { SystemSede } from "@/lib/system-settings-data"
import type { NoticeboardItem } from "@/components/dashboard/noticeboard"
import { regionFromProvince } from "@/lib/dashboard/italy-regions"
import type { PermissionSnapshot } from "@/lib/permissions/types"
import { applyDashboardScope } from "@/lib/dashboard/scope"
import { getNextcloudAppPassword, getNextcloudUsername } from "@/lib/nextcloud/credentials"
import { nextcloudUsernameFromEmail } from "@/lib/nextcloud/config"
import { recentFiles } from "@/lib/nextcloud/webdav"
import { canAccessNcPath, loadNcPathRules } from "@/lib/nextcloud/path-permissions"

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

export type DashboardTask = {
  id: string
  title: string
  dueDate: string | null
  status: string | null
  priority: string | null
  relatedType: string | null
  relatedId: string | null
  relatedName: string | null
}

export type DashboardSystemIssue = {
  userId: string
  name: string
  status: string
  error: string | null
}

export type DashboardHealthIndicator = {
  id: string
  label: string
  status: "operational" | "degraded" | "unconfigured"
  detail: string
}

export type EconomicWidgetData = {
  count: number
  available: boolean
  detail: string
}

export type AgentDashboardData = {
  noticeboard: NoticeboardItem[]
  counts: {
    activeLeads: number
    clients: number
    overdueTasks: number
  }
  upcomingTasks: DashboardTask[]
  staleLeads: DashboardLead[]
}

export type SystemSemaphoreData = {
  regular: boolean
}

export type SuperadminDashboardData = {
  noticeboard: NoticeboardItem[]
  nextcloudIssues: DashboardSystemIssue[]
  welcomeEmailIssues: DashboardSystemIssue[]
  health: DashboardHealthIndicator[]
}

export const STALE_LEAD_DAYS = 3

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

function noticeboardCutoff() {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 3)
  return cutoff
}

function normalizeNoticeboardItems(value: unknown): NoticeboardItem[] {
  if (!Array.isArray(value)) return []
  const cutoff = noticeboardCutoff().getTime()
  return value
    .filter((item): item is NoticeboardItem => {
      if (!item || typeof item !== "object") return false
      const candidate = item as Record<string, unknown>
      return (
        typeof candidate.id === "string" &&
        typeof candidate.title === "string" &&
        typeof candidate.body === "string" &&
        typeof candidate.author === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.pinned === "boolean" &&
        new Date(candidate.createdAt).getTime() >= cutoff
      )
    })
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
}

async function loadNoticeboard(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<NoticeboardItem[]> {
  const { data } = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", "dashboard.noticeboard")
    .maybeSingle()

  const rawItems = Array.isArray(data?.valore) ? data.valore : []
  const items = normalizeNoticeboardItems(rawItems)
  if (items.length !== rawItems.length) {
    await supabase.from("crm_settings").upsert(
      {
        chiave: "dashboard.noticeboard",
        valore: items,
        descrizione: "Comunicazioni della bacheca aziendale",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chiave" },
    )
  }
  return items
}

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
    noticeboard,
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
    loadNoticeboard(supabase),
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
    noticeboard,
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

function mapTask(row: Record<string, unknown>): DashboardTask {
  return {
    id: String(row.id),
    title: String(row.oggetto ?? "Compito senza oggetto"),
    dueDate: typeof row.scadenza === "string" ? row.scadenza : null,
    status: typeof row.stato === "string" ? row.stato : null,
    priority: typeof row.priorita === "string" ? row.priorita : null,
    relatedType: typeof row.correlato_tipo === "string" ? row.correlato_tipo : null,
    relatedId: typeof row.correlato_id === "string" ? row.correlato_id : null,
    relatedName: typeof row.correlato_nome === "string" ? row.correlato_nome : null,
  }
}

function economicPath(path: string) {
  const value = path.toLocaleLowerCase("it")
  return (
    value.includes("finanziaria") ||
    value.includes("finanziamenti") ||
    value.includes("contratti") ||
    value.includes("preventivi")
  )
}

async function countEconomicRecentFiles(snapshot: PermissionSnapshot): Promise<EconomicWidgetData> {
  const subject = snapshot.subject
  if (!subject.userId || !subject.email) {
    return { count: 0, available: false, detail: "Utente non risolto" }
  }

  const appPassword = await getNextcloudAppPassword(subject.userId)
  if (!appPassword) {
    return { count: 0, available: false, detail: "Account Nextcloud non collegato" }
  }

  try {
    const username =
      (await getNextcloudUsername(subject.userId)) ?? nextcloudUsernameFromEmail(subject.email)
    const rules = await loadNcPathRules()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const files = await recentFiles(username, appPassword, 80)
    return {
      count: files.filter((file) => {
        const modified = file.lastModified ? new Date(file.lastModified) : null
        return (
          !file.isDir &&
          modified !== null &&
          modified >= cutoff &&
          economicPath(file.path) &&
          canAccessNcPath(file.path, subject.ruoloCode, rules)
        )
      }).length,
      available: true,
      detail: "File recenti accessibili negli ultimi 30 giorni",
    }
  } catch (error) {
    return {
      count: 0,
      available: false,
      detail: error instanceof Error ? error.message : "Conteggio Nextcloud non disponibile",
    }
  }
}

export async function getEconomicWidgetData(
  snapshot: PermissionSnapshot,
): Promise<EconomicWidgetData> {
  return countEconomicRecentFiles(snapshot)
}

export async function getSystemSemaphoreData(): Promise<SystemSemaphoreData> {
  const supabase = await createClient()
  const [nextcloud, email] = await Promise.all([
    supabase
      .from("nextcloud_credentials")
      .select("utente_id", { count: "exact", head: true })
      .eq("status", "failed"),
    supabase
      .from("utenti")
      .select("id", { count: "exact", head: true })
      .eq("welcome_email_status", "failed"),
  ])

  return {
    regular: (nextcloud.count ?? 0) === 0 && (email.count ?? 0) === 0,
  }
}

export async function getAgentDashboardData(
  snapshot: PermissionSnapshot,
): Promise<AgentDashboardData> {
  const supabase = await createClient()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const staleCutoff = new Date(today)
  staleCutoff.setDate(staleCutoff.getDate() - STALE_LEAD_DAYS)

  const leadsActiveQ = applyDashboardScope(
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .neq("stato_lead", "Perso")
      .neq("stato_lead", "Rifiutato"),
    snapshot,
    "lead",
  )
  const clientsQ = applyDashboardScope(
    supabase.from("clienti").select("id", { count: "exact", head: true }),
    snapshot,
    "clienti",
  )
  const overdueTasksQ = applyDashboardScope(
    supabase
      .from("compiti")
      .select("id", { count: "exact", head: true })
      .lt("scadenza", today.toISOString())
      .neq("stato", "Completato"),
    snapshot,
    "compiti",
  )
  const upcomingTasksQ = applyDashboardScope(
    supabase
      .from("compiti")
      .select("id,oggetto,scadenza,priorita,stato,correlato_id,correlato_tipo,correlato_nome")
      .neq("stato", "Completato")
      .order("scadenza", { ascending: true, nullsFirst: false })
      .limit(5),
    snapshot,
    "compiti",
  )
  const staleLeadsQ = applyDashboardScope(
    supabase
      .from("leads")
      .select("id,nome_lead,nome,cognome,stato_lead,valutazione,sede,created_at")
      .in("stato_lead", ["Non contattato", "Tentato di contattare"])
      .lte("updated_at", staleCutoff.toISOString())
      .order("updated_at", { ascending: true, nullsFirst: false })
      .limit(5),
    snapshot,
    "lead",
  )

  const [noticeboard, activeLeads, clients, overdueTasks, upcomingTasks, staleLeads] =
    await Promise.all([
      loadNoticeboard(supabase),
      leadsActiveQ,
      clientsQ,
      overdueTasksQ,
      upcomingTasksQ,
      staleLeadsQ,
    ])

  return {
    noticeboard,
    counts: {
      activeLeads: activeLeads.count ?? 0,
      clients: clients.count ?? 0,
      overdueTasks: overdueTasks.count ?? 0,
    },
    upcomingTasks: ((upcomingTasks.data ?? []) as Array<Record<string, unknown>>).map(mapTask),
    staleLeads: ((staleLeads.data ?? []) as Array<Record<string, unknown>>).map(mapLead),
  }
}

export async function getSuperadminDashboardData(): Promise<SuperadminDashboardData> {
  const supabase = await createClient()
  const [noticeboard, nextcloud, welcome] = await Promise.all([
    loadNoticeboard(supabase),
    supabase
      .from("nextcloud_credentials")
      .select("utente_id,status,last_error,utenti:utente_id(nome)")
      .neq("status", "active")
      .limit(12),
    supabase
      .from("utenti")
      .select("id,nome,welcome_email_status,welcome_email_error")
      .eq("welcome_email_status", "failed")
      .limit(12),
  ])

  const nextcloudIssues = ((nextcloud.data ?? []) as Array<Record<string, unknown>>).map(
    (row) => {
      const user = row.utenti as { nome?: string } | null
      return {
        userId: String(row.utente_id),
        name: user?.nome ?? "Utente CRM",
        status: String(row.status ?? "unknown"),
        error: typeof row.last_error === "string" ? row.last_error : null,
      }
    },
  )
  const welcomeEmailIssues = ((welcome.data ?? []) as Array<Record<string, unknown>>).map(
    (row) => ({
      userId: String(row.id),
      name: String(row.nome ?? "Utente CRM"),
      status: String(row.welcome_email_status ?? "failed"),
      error:
        typeof row.welcome_email_error === "string" ? row.welcome_email_error : null,
    }),
  )

  return {
    noticeboard,
    nextcloudIssues,
    welcomeEmailIssues,
    health: [
      {
        id: "nextcloud",
        label: "Nextcloud",
        status: nextcloudIssues.length > 0 || nextcloud.error ? "degraded" : "operational",
        detail: nextcloud.error
          ? nextcloud.error.message
          : nextcloudIssues.length > 0
            ? "Provisioning da verificare"
            : "Credenziali operative",
      },
      {
        id: "smtp",
        label: "Email SMTP",
        status: welcomeEmailIssues.length > 0 || welcome.error ? "degraded" : "operational",
        detail: welcome.error
          ? welcome.error.message
          : welcomeEmailIssues.length > 0
            ? "Invii welcome email da riprovare"
            : "Invii recenti regolari",
      },
    ],
  }
}
