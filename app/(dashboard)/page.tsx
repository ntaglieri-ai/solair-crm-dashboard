import Link from "next/link"
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Flame,
  MapPinned,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getDashboardData, type DashboardLead } from "@/lib/dashboard/repository"
import { ItalyMap } from "@/components/dashboard/italy-map"
import { Noticeboard } from "@/components/dashboard/noticeboard"

const ROLE_MANAGERS = new Set(["SUPERADMIN", "ADMIN", "DIRECTOR"])

function BarChart({
  items,
  color = "#4f7cff",
}: {
  items: Array<{ label: string; count: number }>
  color?: string
}) {
  const max = Math.max(...items.map((item) => item.count), 1)
  return (
    <div className="flex h-36 items-end gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="text-xs font-bold tabular-nums text-foreground">
            {item.count.toLocaleString("it-IT")}
          </span>
          <div className="flex h-24 w-full items-end overflow-hidden rounded-md bg-muted/60">
            <div
              className="w-full rounded-md transition-[height] duration-500"
              style={{
                height: `${Math.max(item.count > 0 ? 8 : 2, (item.count / max) * 100)}%`,
                background: color,
              }}
            />
          </div>
          <span className="text-xs capitalize text-muted-foreground">{item.label}</span>
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
        const colors = ["#4f7cff", "#20a47a", "#f2b84b", "#ef6a47", "#8b6bd6"]
        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-foreground">{item.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {item.count.toLocaleString("it-IT")} · {percentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${percentage}%`, background: colors[index % colors.length] }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LeadQueue({ leads }: { leads: DashboardLead[] }) {
  if (leads.length === 0) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-6 text-center text-sm text-muted-foreground">
        Nessun lead da mostrare.
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {leads.slice(0, 5).map((lead) => (
        <Link
          key={lead.id}
          href={`/leads/${lead.id}`}
          className="group flex min-h-16 items-center justify-between gap-4 px-2 py-3 transition-colors hover:bg-muted/45"
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

function Metric({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Users
  value: number
  label: string
  tone: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-lg text-white" style={{ background: tone }}>
        <Icon className="size-5" />
      </span>
      <span>
        <strong className="block text-2xl font-extrabold tabular-nums">
          {value.toLocaleString("it-IT")}
        </strong>
        <small className="block text-xs font-semibold text-muted-foreground">{label}</small>
      </span>
    </div>
  )
}

export default async function DashboardPage() {
  const permissions = await requirePage("dashboard")
  const data = await getDashboardData()
  const subject = permissions.snapshot.subject
  const previousMonth = data.leadTrend.at(-2)?.count ?? 0
  const currentMonth = data.leadTrend.at(-1)?.count ?? 0
  const trend =
    previousMonth > 0 ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100) : 0

  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
            <Sparkles className="size-4" />
            Il tuo spazio di lavoro
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Buongiorno, {subject.nome.split(" ")[0]}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Dati correnti, priorità e comunicazioni operative.
          </p>
        </div>
        <Link href="/leads" className="dashboard-primary-action">
          Apri area Lead
          <ArrowRight className="size-4" />
        </Link>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(350px,1fr)]">
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-[#4f7cff]">
                <TrendingUp className="size-5" />
                Lead intelligence
              </p>
              <div className="mt-3 flex items-end gap-3">
                <strong className="text-5xl font-extrabold tracking-tight tabular-nums">
                  {data.counts.leads.toLocaleString("it-IT")}
                </strong>
                <span className="mb-1 rounded-md bg-[#eef3ff] px-2.5 py-1 text-xs font-bold text-[#315fc5]">
                  {trend >= 0 ? "+" : ""}{trend}% questo mese
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Lead totali nel CRM</p>
            </div>
            <div className="flex gap-8">
              <Metric icon={UserRoundCheck} value={data.counts.clienti} label="Clienti" tone="#20a47a" />
              <Metric icon={Flame} value={data.hotLeads.length} label="Priorità alte" tone="#ef6a47" />
            </div>
          </div>

          <div className="mt-6 grid gap-7 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-bold">Nuovi lead, ultimi 6 mesi</h2>
                <span className="text-xs text-muted-foreground">Dati reali</span>
              </div>
              <BarChart items={data.leadTrend} />
            </div>
            <div>
              <h2 className="mb-4 text-base font-bold">Distribuzione per stato</h2>
              <DistributionBars items={data.leadsByStatus} total={data.counts.leads} />
            </div>
          </div>
        </section>

        <Noticeboard
          initialItems={data.noticeboard}
          canManage={ROLE_MANAGERS.has(subject.ruoloCode)}
          author={subject.nome}
          compact
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
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
              <strong className="block text-xl font-extrabold text-[#b8273d]">
                {data.leadsByRegion.reduce((sum, item) => sum + item.count, 0).toLocaleString("it-IT")}
              </strong>
              <span className="text-xs font-semibold text-muted-foreground">lead geolocalizzati</span>
            </div>
          </div>
          <div className="h-[520px]">
            <ItalyMap markers={data.mapMarkers} regionData={data.leadsByRegion} />
          </div>
        </section>

        <div className="grid content-start gap-5">
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#8b6bd6]">Operatività</p>
                <h2 className="mt-1 text-xl font-bold">Compiti</h2>
              </div>
              <Link href="/compiti" className="text-sm font-bold text-primary hover:underline">
                Apri
              </Link>
            </div>
            <div className="my-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#f3efff] p-4">
                <CheckSquare className="size-5 text-[#7656c8]" />
                <strong className="mt-3 block text-3xl font-extrabold">
                  {data.counts.compiti.toLocaleString("it-IT")}
                </strong>
                <span className="text-xs font-semibold text-muted-foreground">Totali</span>
              </div>
              <div className="rounded-lg bg-[#fff0ed] p-4">
                <Flame className="size-5 text-[#d84f42]" />
                <strong className="mt-3 block text-3xl font-extrabold text-[#b83e35]">
                  {data.overdueTasks.toLocaleString("it-IT")}
                </strong>
                <span className="text-xs font-semibold text-muted-foreground">Scaduti</span>
              </div>
            </div>
            <DistributionBars items={data.tasksByStatus} total={data.counts.compiti} limit={4} />
          </section>

          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#e1832f]">Agenda</p>
                <h2 className="mt-1 text-xl font-bold">Scadenze</h2>
              </div>
              <CalendarClock className="size-6 text-[#e1832f]" />
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-border">
              <div className="pr-3">
                <strong className="block text-3xl font-extrabold text-[#c1433b]">{data.deadlines.overdue}</strong>
                <span className="text-xs text-muted-foreground">Scadute</span>
              </div>
              <div className="px-3">
                <strong className="block text-3xl font-extrabold text-[#e1832f]">{data.deadlines.next7Days}</strong>
                <span className="text-xs text-muted-foreground">7 giorni</span>
              </div>
              <div className="pl-3">
                <strong className="block text-3xl font-extrabold text-[#315fc5]">{data.deadlines.later}</strong>
                <span className="text-xs text-muted-foreground">Successive</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Flame className="size-5 text-[#ef6a47]" />
              Lead da seguire
            </h2>
            <Link href="/leads" className="text-sm font-bold text-primary hover:underline">Vedi tutti</Link>
          </div>
          <LeadQueue leads={data.hotLeads} />
        </section>
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <CheckCircle2 className="size-5 text-[#20a47a]" />
              Ultimi ingressi
            </h2>
            <Link href="/leads" className="text-sm font-bold text-primary hover:underline">Apri elenco</Link>
          </div>
          <LeadQueue leads={data.recentLeads} />
        </section>
      </div>
    </div>
  )
}
