import Link from "next/link"
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  Flame,
  HardHat,
  Users,
} from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getDashboardData, type DashboardLead } from "@/lib/dashboard/repository"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ItalyMap } from "@/components/dashboard/italy-map"

const KPI_CONFIG = [
  { key: "leads", label: "Lead", href: "/leads", icon: Users },
  { key: "clienti", label: "Clienti", href: "/clienti", icon: BriefcaseBusiness },
  { key: "compiti", label: "Compiti", href: "/compiti", icon: CheckSquare },
  { key: "scadenze", label: "Scadenze", href: "/scadenze", icon: CalendarClock },
  { key: "installatori", label: "Installatori", href: "/installatori", icon: HardHat },
] as const

function LeadList({
  leads,
  empty,
  showScore = false,
}: {
  leads: DashboardLead[]
  empty: string
  showScore?: boolean
}) {
  if (leads.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <div className="divide-y divide-border">
      {leads.map((lead) => (
        <Link
          key={lead.id}
          href={`/leads/${lead.id}`}
          className="flex items-center justify-between gap-4 px-1 py-3 transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{lead.nome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[lead.stato, lead.sede].filter(Boolean).join(" · ") || "Dati da completare"}
            </p>
          </div>
          {showScore ? <Badge variant="secondary">{lead.valutazione}</Badge> : null}
        </Link>
      ))}
    </div>
  )
}

function Distribution({
  items,
  total,
  empty,
}: {
  items: Array<{ label: string; count: number }>
  total: number
  empty: string
}) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {items.slice(0, 6).map((item) => {
        const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0
        return (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="truncate text-foreground">{item.label}</span>
              <span className="tabular-nums text-muted-foreground">{item.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-teal" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function DashboardPage() {
  await requirePage("dashboard")
  const data = await getDashboardData()

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Panoramica</h1>
        <p className="text-sm text-muted-foreground">Stato operativo del CRM in tempo reale</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {KPI_CONFIG.map(({ key, label, href, icon: Icon }) => (
          <Link key={key} href={href}>
            <Card className="h-full transition-colors hover:border-foreground/25">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                    {data.counts[key]}
                  </p>
                </div>
                <Icon className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="size-[18px] text-destructive" />
              Lead con valutazione alta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeadList
              leads={data.hotLeads}
              empty="Nessun lead con valutazione superiore a 80."
              showScore
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Distribuzione territoriale</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ItalyMap markers={data.mapMarkers} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Lead per stato</CardTitle></CardHeader>
          <CardContent>
            <Distribution
              items={data.leadsByStatus}
              total={data.counts.leads}
              empty="Nessun lead registrato."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lead recenti</CardTitle></CardHeader>
          <CardContent>
            <LeadList leads={data.recentLeads} empty="Nessun lead recente." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pipeline clienti</CardTitle></CardHeader>
          <CardContent>
            <Distribution
              items={data.clientiByStatus}
              total={data.counts.clienti}
              empty="La pipeline apparirà con il primo cliente."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
