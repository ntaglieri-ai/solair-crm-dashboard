import Link from "next/link"
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  HardHat,
  Users,
} from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getDashboardData } from "@/lib/dashboard/repository"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const KPI_CONFIG = [
  { key: "leads", label: "Lead", href: "/leads", icon: Users },
  { key: "clienti", label: "Clienti", href: "/clienti", icon: BriefcaseBusiness },
  { key: "compiti", label: "Compiti", href: "/compiti", icon: CheckSquare },
  { key: "scadenze", label: "Scadenze", href: "/scadenze", icon: CalendarClock },
  { key: "installatori", label: "Installatori", href: "/installatori", icon: HardHat },
] as const

export default async function DashboardPage() {
  await requirePage("dashboard")
  const data = await getDashboardData()
  const clientiTotal = data.counts.clienti

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Panoramica</h1>
        <p className="text-sm text-muted-foreground">
          Dati correnti del CRM
        </p>
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

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="border-y border-border py-5">
          <div className="mb-4">
            <h2 className="font-semibold text-foreground">Lead con valutazione alta</h2>
            <p className="text-sm text-muted-foreground">Valutazione superiore a 80</p>
          </div>
          {data.hotLeads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessun lead con valutazione superiore a 80.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.hotLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-4 py-3 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {lead.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[lead.stato, lead.sede].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Badge variant="secondary">{lead.valutazione}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="border-y border-border py-5">
          <div className="mb-4">
            <h2 className="font-semibold text-foreground">Clienti per stato</h2>
            <p className="text-sm text-muted-foreground">Distribuzione corrente</p>
          </div>
          {data.clientiByStatus.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessun cliente registrato.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.clientiByStatus.map((item) => {
                const percentage =
                  clientiTotal > 0 ? Math.round((item.count / clientiTotal) * 100) : 0
                return (
                  <div key={item.stato}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="text-foreground">{item.stato}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
