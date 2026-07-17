import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  CircleDollarSign,
  DatabaseZap,
  FileCog,
  Flame,
  Gauge,
  HeartPulse,
  KeyRound,
  MailWarning,
  MapPinned,
  Megaphone,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCog,
  UserRoundCheck,
  Users,
} from "lucide-react"

import { LazyItalyMap } from "@/components/dashboard/lazy-italy-map"
import { Noticeboard } from "@/components/dashboard/noticeboard"
import { SystemRetryButton } from "@/components/dashboard/system-retry-actions"
import { requirePage } from "@/lib/permissions/server"
import {
  getAgentDashboardData,
  getDashboardData,
  getEconomicWidgetData,
  getSuperadminDashboardData,
  getSystemSemaphoreData,
  STALE_LEAD_DAYS,
  type DashboardData,
  type DashboardLead,
  type DashboardTask,
  type EconomicWidgetData,
  type SuperadminDashboardData,
  type SystemSemaphoreData,
} from "@/lib/dashboard/repository"

const ROLE_MANAGERS = new Set(["SUPERADMIN", "ADMIN", "DIRECTOR"])
const BUSINESS_ROLES = new Set(["STANDARD", "DIRECTOR", "ADMIN"])

const CHART_COLORS = ["#315fc5", "#20a47a", "#f2b84b", "#ef6a47", "#8b6bd6", "#2b9fb3"]

function formatNumber(value: number) {
  return value.toLocaleString("it-IT")
}

function PremiumCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <section className={`dashboard-premium-card ${className}`}>{children}</section>
}

function Greeting({
  name,
  subtitle,
  action,
}: {
  name: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
          <Sparkles className="size-4" />
          Il tuo spazio di lavoro
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Buongiorno, {name.split(" ")[0]}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </header>
  )
}

function BigMetric({
  label,
  value,
  tone,
  icon: Icon,
  helper,
  accent,
}: {
  label: string
  value: number
  tone: string
  icon: typeof Users
  helper?: string
  accent?: string
}) {
  return (
    <div className="dashboard-metric" style={{ "--metric-tone": tone } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-4">
        <span className="dashboard-metric-icon">
          <Icon className="size-5" />
        </span>
        <span className="dashboard-metric-label">{label}</span>
      </div>
      <strong>{formatNumber(value)}</strong>
      <div className="mt-4 flex items-center justify-between gap-3">
        {helper ? <small>{helper}</small> : <small>{accent ?? "dato corrente"}</small>}
        <span className="dashboard-metric-signal" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  )
}

function ExecutiveSummary({
  total,
  primary,
  secondary,
  tone,
}: {
  total: number
  primary: string
  secondary: string
  tone: string
}) {
  return (
    <div className="dashboard-executive-summary" style={{ "--summary-tone": tone } as React.CSSProperties}>
      <div>
        <p>{primary}</p>
        <strong>{formatNumber(total)}</strong>
      </div>
      <span>{secondary}</span>
    </div>
  )
}

function BarChart({ items }: { items: Array<{ label: string; count: number }> }) {
  const max = Math.max(...items.map((item) => item.count), 1)
  return (
    <div className="dashboard-column-chart">
      {items.map((item, index) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
          <span className="text-sm font-black tabular-nums text-foreground">
            {formatNumber(item.count)}
          </span>
          <div className="flex h-44 w-full items-end overflow-hidden rounded-md bg-muted/70 shadow-inner">
            <div
              className="w-full rounded-md shadow-lg transition-[height] duration-500"
              style={{
                height: `${Math.max(item.count > 0 ? 18 : 7, (item.count / max) * 100)}%`,
                background: `linear-gradient(180deg, ${CHART_COLORS[index % CHART_COLORS.length]}, ${CHART_COLORS[(index + 2) % CHART_COLORS.length]})`,
              }}
            />
          </div>
          <span className="truncate text-xs font-bold capitalize text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function DistributionBars({
  items,
  total,
  limit = 5,
}: {
  items: Array<{ label: string; count: number }>
  total: number
  limit?: number
}) {
  return (
    <div className="grid gap-3">
      {items.slice(0, limit).map((item, index) => {
        const percentage = total ? Math.round((item.count / total) * 100) : 0
        return (
          <div key={item.label} className="dashboard-distribution-row">
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="truncate text-sm font-extrabold text-foreground">{item.label}</span>
              <span className="text-xl font-black tabular-nums" style={{ color: CHART_COLORS[index % CHART_COLORS.length] }}>
                {formatNumber(item.count)}
              </span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-muted shadow-inner">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(percentage, item.count > 0 ? 5 : 2)}%`,
                  background: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
            <p className="mt-1 text-xs font-bold text-muted-foreground">{percentage}% del totale</p>
          </div>
        )
      })}
    </div>
  )
}

function LeadQueue({
  leads,
  empty = "Nessun lead da mostrare.",
}: {
  leads: DashboardLead[]
  empty?: string
}) {
  if (leads.length === 0) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-6 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {leads.slice(0, 5).map((lead) => (
        <Link
          key={lead.id}
          href={`/leads/${lead.id}`}
          className="group flex min-h-16 items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors hover:bg-muted/45"
        >
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">{lead.nome}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {[lead.stato, lead.sede].filter(Boolean).join(" · ") || "Dati da completare"}
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      ))}
    </div>
  )
}

function TaskList({ tasks }: { tasks: DashboardTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/25 px-6 py-9 text-center text-sm text-muted-foreground">
        Nessun compito urgente.
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/compiti/${task.id}`}
          className="group flex items-center justify-between gap-4 rounded-md px-2 py-3 hover:bg-muted/45"
        >
          <div className="min-w-0">
            <p className="truncate font-bold">{task.title}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {[task.status, task.priority, task.dueDate ? new Date(task.dueDate).toLocaleDateString("it-IT") : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      ))}
    </div>
  )
}

function EconomicWidget({
  data,
  linked,
}: {
  data: EconomicWidgetData
  linked: boolean
}) {
  return (
    <PremiumCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[#20a47a]">
            <CircleDollarSign className="size-5" />
            Dati economici
          </p>
          <strong className="dashboard-hero-number text-[#167a5e]">
            {formatNumber(data.count)}
          </strong>
          <p className="mt-2 text-sm text-muted-foreground">{data.detail}</p>
        </div>
        {linked ? (
          <Link href="/documenti" className="dashboard-soft-link">
            Documenti
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </PremiumCard>
  )
}

function SystemSemaphore({ data }: { data: SystemSemaphoreData }) {
  return (
    <PremiumCard>
      <p className="flex items-center gap-2 text-sm font-bold text-[#315fc5]">
        <HeartPulse className="size-5" />
        Stato sistema
      </p>
      <div
        className={`mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-extrabold ${
          data.regular
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        <span className="size-2.5 rounded-full bg-current" />
        {data.regular ? "Tutto regolare" : "Verifiche in corso"}
      </div>
    </PremiumCard>
  )
}

function BusinessDashboard({
  data,
  role,
  author,
  economic,
  semaphore,
}: {
  data: DashboardData
  role: string
  author: string
  economic?: EconomicWidgetData
  semaphore?: SystemSemaphoreData
}) {
  const previousMonth = data.leadTrend.at(-2)?.count ?? 0
  const currentMonth = data.leadTrend.at(-1)?.count ?? 0
  const trend =
    previousMonth > 0 ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100) : 0

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <BigMetric
          icon={TrendingUp}
          value={data.counts.leads}
          label="Lead totali"
          helper={`${trend >= 0 ? "+" : ""}${trend}% questo mese`}
          tone="#315fc5"
        />
        <BigMetric icon={UserRoundCheck} value={data.counts.clienti} label="Clienti" tone="#20a47a" accent="base clienti" />
        <BigMetric icon={Flame} value={data.hotLeads.length} label="Priorità alte" tone="#ef6a47" accent="focus immediato" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(350px,1fr)]">
        <PremiumCard>
          <ExecutiveSummary
            total={currentMonth}
            primary="Nuovi lead nel mese corrente"
            secondary={`${formatNumber(data.counts.leads)} lead complessivi nel CRM`}
            tone="#315fc5"
          />
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-[#315fc5]">
                <BarChart3 className="size-5" />
                Lead intelligence
              </p>
              <h2 className="mt-2 text-2xl font-extrabold">Andamento commerciale</h2>
            </div>
            <span className="rounded-md bg-[#eef3ff] px-3 py-1.5 text-xs font-bold text-[#315fc5]">
              Dati reali
            </span>
          </div>
          <div className="mt-6 grid gap-7 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <h3 className="mb-3 text-base font-bold">Nuovi lead, ultimi 6 mesi</h3>
              <BarChart items={data.leadTrend} />
            </div>
            <div>
              <h3 className="mb-4 text-base font-bold">Distribuzione per stato</h3>
              <DistributionBars items={data.leadsByStatus} total={data.counts.leads} />
            </div>
          </div>
        </PremiumCard>

        <Noticeboard
          initialItems={data.noticeboard}
          canManage={ROLE_MANAGERS.has(role)}
          author={author}
          compact
        />
      </div>

      {economic || semaphore ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {economic ? <EconomicWidget data={economic} linked={role === "ADMIN"} /> : null}
          {semaphore ? <SystemSemaphore data={semaphore} /> : null}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <PremiumCard>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-[#b8273d]">
                <MapPinned className="size-5" />
                Distribuzione commerciale
              </p>
              <h2 className="mt-1 text-2xl font-bold">Lead sul territorio</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Intensità regionale e sedi operative configurate
              </p>
            </div>
            <div className="rounded-lg bg-[#fff1ed] px-4 py-2 text-right">
              <strong className="block text-5xl font-black leading-none text-[#b8273d]">
                {formatNumber(data.leadsByRegion.reduce((sum, item) => sum + item.count, 0))}
              </strong>
              <span className="mt-1 block text-xs font-bold text-muted-foreground">lead geolocalizzati</span>
            </div>
          </div>
          <div className="h-[520px]">
            <LazyItalyMap markers={data.mapMarkers} regionData={data.leadsByRegion} />
          </div>
        </PremiumCard>

        <div className="grid content-start gap-5">
          <PremiumCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#8b6bd6]">Operatività</p>
                <h2 className="mt-1 text-xl font-bold">Compiti</h2>
              </div>
              <Link href="/compiti" className="dashboard-soft-link">
                Apri
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="my-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#f3efff] p-4">
                <CheckSquare className="size-5 text-[#7656c8]" />
                <strong className="mt-3 block text-5xl font-black leading-none text-[#7656c8]">
                  {formatNumber(data.counts.compiti)}
                </strong>
                <span className="text-xs font-semibold text-muted-foreground">Totali</span>
              </div>
              <div className="rounded-lg bg-[#fff0ed] p-4">
                <Flame className="size-5 text-[#d84f42]" />
                <strong className="mt-3 block text-5xl font-black leading-none text-[#b83e35]">
                  {formatNumber(data.overdueTasks)}
                </strong>
                <span className="text-xs font-semibold text-muted-foreground">Scaduti</span>
              </div>
            </div>
            <DistributionBars items={data.tasksByStatus} total={data.counts.compiti} limit={4} />
          </PremiumCard>

          <PremiumCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#e1832f]">Agenda</p>
                <h2 className="mt-1 text-xl font-bold">Scadenze</h2>
              </div>
              <CalendarClock className="size-6 text-[#e1832f]" />
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-border">
              <div className="pr-3">
                <strong className="block text-5xl font-black leading-none text-[#c1433b]">
                  {formatNumber(data.deadlines.overdue)}
                </strong>
                <span className="text-xs text-muted-foreground">Scadute</span>
              </div>
              <div className="px-3">
                <strong className="block text-5xl font-black leading-none text-[#e1832f]">
                  {formatNumber(data.deadlines.next7Days)}
                </strong>
                <span className="text-xs text-muted-foreground">7 giorni</span>
              </div>
              <div className="pl-3">
                <strong className="block text-5xl font-black leading-none text-[#315fc5]">
                  {formatNumber(data.deadlines.later)}
                </strong>
                <span className="text-xs text-muted-foreground">Successive</span>
              </div>
            </div>
          </PremiumCard>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <PremiumCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Flame className="size-5 text-[#ef6a47]" />
              Lead da seguire
            </h2>
            <Link href="/leads" className="dashboard-soft-link">
              Vedi tutti
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <LeadQueue leads={data.hotLeads} />
        </PremiumCard>
        <PremiumCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <CheckCircle2 className="size-5 text-[#20a47a]" />
              Ultimi ingressi
            </h2>
            <Link href="/leads" className="dashboard-soft-link">
              Apri elenco
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <LeadQueue leads={data.recentLeads} />
        </PremiumCard>
      </div>
    </>
  )
}

function Monitoring({ data }: { data: SuperadminDashboardData }) {
  return (
    <PremiumCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[#315fc5]">
            <Gauge className="size-5" />
            Monitoring di sistema
          </p>
          <h2 className="mt-2 text-2xl font-extrabold">Provisioning e invii</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.health.map((service) => (
            <span
              key={service.id}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                service.status === "operational"
                  ? "bg-emerald-100 text-emerald-800"
                  : service.status === "unconfigured"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-amber-100 text-amber-800"
              }`}
              title={service.detail}
            >
              {service.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
            <DatabaseZap className="size-5 text-[#8b6bd6]" />
            Nextcloud
          </h3>
          <div className="grid gap-3">
            {data.nextcloudIssues.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/25 px-4 py-5 text-sm text-muted-foreground">
                Nessuna credenziale da ripristinare.
              </p>
            ) : (
              data.nextcloudIssues.map((issue) => (
                <div key={issue.userId} className="rounded-lg border border-border bg-white/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{issue.name}</p>
                      <p className="text-sm text-muted-foreground">{issue.status}</p>
                    </div>
                    <SystemRetryButton userId={issue.userId} kind="nextcloud" />
                  </div>
                  {issue.error ? <p className="mt-2 text-xs text-muted-foreground">{issue.error}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
            <MailWarning className="size-5 text-[#ef6a47]" />
            Welcome email
          </h3>
          <div className="grid gap-3">
            {data.welcomeEmailIssues.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/25 px-4 py-5 text-sm text-muted-foreground">
                Nessun invio fallito.
              </p>
            ) : (
              data.welcomeEmailIssues.map((issue) => (
                <div key={issue.userId} className="rounded-lg border border-border bg-white/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{issue.name}</p>
                      <p className="text-sm text-muted-foreground">{issue.status}</p>
                    </div>
                    <SystemRetryButton userId={issue.userId} kind="welcome-email" />
                  </div>
                  {issue.error ? <p className="mt-2 text-xs text-muted-foreground">{issue.error}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </PremiumCard>
  )
}

const SUPERADMIN_SHORTCUTS = [
  { title: "Account Management", href: "/crm-settings/account/utenti", icon: UserCog, tone: "#315fc5" },
  { title: "Permission Management", href: "/crm-settings/account/permessi", icon: ShieldCheck, tone: "#20a47a" },
  { title: "Manutenzione", href: "/crm-settings/maintenance/health", icon: HeartPulse, tone: "#ef6a47" },
  { title: "Automazioni", href: "/crm-settings/system/flussi", icon: Settings, tone: "#8b6bd6" },
  { title: "File Manager", href: "/crm-settings/file-manager/nextcloud", icon: FileCog, tone: "#2b9fb3" },
  { title: "Bacheca", href: "#bacheca", icon: Megaphone, tone: "#f2b84b" },
]

function SuperadminDashboard({ data, author }: { data: SuperadminDashboardData; author: string }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SUPERADMIN_SHORTCUTS.map((shortcut) => {
          const Icon = shortcut.icon
          return (
            <Link
              key={shortcut.title}
              href={shortcut.href}
              className="dashboard-shortcut"
              style={{ "--shortcut-tone": shortcut.tone } as React.CSSProperties}
            >
              <span>
                <Icon className="size-6" />
              </span>
              <strong>{shortcut.title}</strong>
              <ArrowRight className="ml-auto size-4" />
            </Link>
          )
        })}
      </div>
      <Monitoring data={data} />
      <div id="bacheca">
        <Noticeboard initialItems={data.noticeboard} canManage author={author} />
      </div>
    </>
  )
}

export default async function DashboardPage() {
  const permissions = await requirePage("dashboard")
  const subject = permissions.snapshot.subject
  const role = subject.ruoloCode.toUpperCase()

  if (role === "SUPERADMIN") {
    const data = await getSuperadminDashboardData()
    return (
      <div className="mx-auto flex max-w-[1540px] flex-col gap-6">
        <Greeting
          name={subject.nome}
          subtitle="Centro tecnico per account, permessi, automazioni e provisioning."
        />
        <SuperadminDashboard data={data} author={subject.nome} />
      </div>
    )
  }

  if (role === "AGENT") {
    const data = await getAgentDashboardData(permissions.snapshot)
    return (
      <div className="mx-auto flex max-w-[1540px] flex-col gap-6">
        <Greeting
          name={subject.nome}
          subtitle="Priorità personali, compiti e comunicazioni operative."
          action={
            <Link href="/leads" className="dashboard-primary-action">
              Apri i tuoi Lead
              <ArrowRight className="size-4" />
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-3">
          <BigMetric icon={TrendingUp} value={data.counts.activeLeads} label="I tuoi lead attivi" tone="#315fc5" accent="pipeline personale" />
          <BigMetric icon={UserRoundCheck} value={data.counts.clients} label="I tuoi clienti" tone="#20a47a" accent="portafoglio" />
          <BigMetric icon={BellRing} value={data.counts.overdueTasks} label="Compiti scaduti" tone="#ef6a47" accent="urgenze" />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(350px,0.8fr)]">
          <PremiumCard>
            <ExecutiveSummary
              total={data.upcomingTasks.length}
              primary="Prossime azioni operative"
              secondary={`${formatNumber(data.staleLeads.length)} lead da ricontattare`}
              tone="#8b6bd6"
            />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <CheckSquare className="size-5 text-[#8b6bd6]" />
                I tuoi prossimi compiti
              </h2>
              <Link href="/compiti" className="dashboard-soft-link">
                Apri
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <TaskList tasks={data.upcomingTasks} />
          </PremiumCard>
          <Noticeboard
            initialItems={data.noticeboard}
            canManage={false}
            author={subject.nome}
            compact
          />
        </div>
        <PremiumCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <KeyRound className="size-5 text-[#ef6a47]" />
              Lead da ricontattare
            </h2>
            <span className="rounded-md bg-[#fff0ed] px-3 py-1.5 text-xs font-bold text-[#b83e35]">
              {STALE_LEAD_DAYS}+ giorni
            </span>
          </div>
          <LeadQueue leads={data.staleLeads} empty="Nessun lead fermo da ricontattare." />
        </PremiumCard>
      </div>
    )
  }

  if (!BUSINESS_ROLES.has(role)) {
    return (
      <div className="mx-auto flex max-w-[1540px] flex-col gap-6">
        <Greeting name={subject.nome} subtitle="Dashboard non configurata per questo ruolo." />
      </div>
    )
  }

  const [data, economic, semaphore] = await Promise.all([
    getDashboardData(),
    role === "DIRECTOR" || role === "ADMIN"
      ? getEconomicWidgetData(permissions.snapshot)
      : Promise.resolve(undefined),
    role === "ADMIN" ? getSystemSemaphoreData() : Promise.resolve(undefined),
  ])

  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-6">
      <Greeting
        name={subject.nome}
        subtitle="Dati correnti, priorità e comunicazioni operative."
        action={
          <Link href="/leads" className="dashboard-primary-action">
            Apri area Lead
            <ArrowRight className="size-4" />
          </Link>
        }
      />
      <BusinessDashboard
        data={data}
        role={role}
        author={subject.nome}
        economic={economic}
        semaphore={semaphore}
      />
    </div>
  )
}
