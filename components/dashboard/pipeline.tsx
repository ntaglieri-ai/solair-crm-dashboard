import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { PIPELINE, type PipelineStage } from "@/lib/mock-data"

const TONE_COLOR: Record<PipelineStage["tone"], string> = {
  navy: "var(--navy)",
  teal: "var(--teal)",
  info: "var(--info)",
  warning: "var(--warning)",
  success: "var(--success)",
}

export function Pipeline() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline clienti</CardTitle>
        <CardDescription>Avanzamento per fase contrattuale</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {PIPELINE.map((stage) => (
          <div key={stage.fase} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{stage.label}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">
                  {stage.count}
                </span>
                <span className="tabular-nums">{stage.percent}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${stage.percent}%`,
                  backgroundColor: TONE_COLOR[stage.tone],
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
