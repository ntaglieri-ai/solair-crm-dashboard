import Link from "next/link"
import { Sparkles } from "lucide-react"

import { requirePage } from "@/lib/permissions/server"
import { SOLAIR_AI_APPS } from "./apps"

export const dynamic = "force-dynamic"

export default async function SolairAiHubPage() {
  await requirePage("solair_ai")

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SolairAI</h1>
        <p className="text-sm text-muted-foreground">
          Le app basate su AI attive nel CRM.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SOLAIR_AI_APPS.map((app) => (
          <Link
            key={app.slug}
            href={`/solair-ai/${app.slug}`}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-teal hover:bg-muted/40"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-navy/10 text-navy">
              <Sparkles className="size-5" />
            </span>
            <span className="font-semibold text-foreground">{app.nome}</span>
            <span className="text-sm text-muted-foreground">{app.descrizione}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
