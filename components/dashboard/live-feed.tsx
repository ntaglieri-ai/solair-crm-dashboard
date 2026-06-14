import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { FEED, type FeedItem, type FeedTipo } from "@/lib/mock-data"
import { FEED_ICONS } from "./icons"

const TIPO_STYLES: Record<FeedTipo, string> = {
  "email-open": "bg-info/10 text-info",
  "nuovo-lead": "bg-teal/10 text-teal",
  "compito-scaduto": "bg-destructive/10 text-destructive",
  "contratto-firmato": "bg-success/10 text-success",
  "lead-fermo": "bg-warning/10 text-warning",
  conversione: "bg-navy/10 text-navy",
}

function renderTesto(item: FeedItem) {
  let parts: (string | { bold: string })[] = [item.testo]
  for (const h of item.highlight) {
    const next: (string | { bold: string })[] = []
    for (const part of parts) {
      if (typeof part !== "string") {
        next.push(part)
        continue
      }
      const segments = part.split(h)
      segments.forEach((seg, i) => {
        if (seg) next.push(seg)
        if (i < segments.length - 1) next.push({ bold: h })
      })
    }
    parts = next
  }
  return parts.map((part, i) =>
    typeof part === "string" ? (
      <span key={i}>{part}</span>
    ) : (
      <span key={i} className="font-semibold text-foreground">
        {part.bold}
      </span>
    ),
  )
}

export function LiveFeed() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Feed live</span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            live
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {FEED.map((item) => {
          const Icon = FEED_ICONS[item.tipo]
          return (
            <div key={item.id} className="flex gap-3 rounded-lg px-1 py-2">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  TIPO_STYLES[item.tipo],
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm leading-snug text-muted-foreground text-pretty">
                  {renderTesto(item)}
                </p>
                <span className="text-xs text-muted-foreground/70">
                  {item.timestamp}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
