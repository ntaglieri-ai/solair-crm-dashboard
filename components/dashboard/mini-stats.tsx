import { Card, CardContent } from "@/components/ui/card"
import type { MiniStat } from "@/lib/mock-data"

export function MiniStats({ data }: { data: MiniStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {data.map((stat) => (
        <Card key={stat.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted-foreground text-pretty">{stat.label}</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
