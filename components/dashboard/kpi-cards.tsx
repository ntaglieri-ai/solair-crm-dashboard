import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { KpiData } from "@/lib/mock-data"
import { KPI_ICONS } from "./icons"

const ACCENT_STYLES: Record<KpiData["accent"], string> = {
  navy: "bg-navy/10 text-navy",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  destructive: "bg-destructive/10 text-destructive",
}

const VALUE_STYLES: Record<KpiData["accent"], string> = {
  navy: "text-foreground",
  success: "text-success",
  info: "text-foreground",
  destructive: "text-destructive",
}

const BADGE_STYLES: Record<KpiData["badgeTone"], string> = {
  navy: "bg-secondary text-secondary-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
}

function KpiCard({ kpi }: { kpi: KpiData }) {
  const Icon = KPI_ICONS[kpi.icon]
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-lg",
              ACCENT_STYLES[kpi.accent],
            )}
          >
            <Icon className="size-5" />
          </div>
          <Badge
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              BADGE_STYLES[kpi.badgeTone],
            )}
          >
            {kpi.badge === "live" ? (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-success" />
                live
              </span>
            ) : (
              kpi.badge
            )}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {kpi.label}
          </p>
          <p className={cn("text-3xl font-bold tabular-nums", VALUE_STYLES[kpi.accent])}>
            {kpi.value}
          </p>
          <p className="text-sm text-muted-foreground">{kpi.sottotesto}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function KpiCards({ data }: { data: KpiData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {data.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  )
}
