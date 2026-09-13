import Link from "next/link"
import { Sparkles } from "lucide-react"

import { requirePage } from "@/lib/permissions/server"
import { SOLAIR_AI_APPS } from "./apps"

export const dynamic = "force-dynamic"

/**
 * Icona colorata quadrata con angoli arrotondati, sul modello dell'App
 * Launcher Salesforce: un colore per app, cosi' restano riconoscibili a
 * colpo d'occhio quando saranno piu' di una.
 */
const COLORI_TILE = ["bg-navy", "bg-teal", "bg-[#8a5cf6]", "bg-[#c2410c]"]

export default async function SolairAiHubPage() {
  await requirePage("solair_ai")

  return (
    <div className="min-h-full bg-[#f3f2f2] p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#032d60]">SolairAI</h1>
          <p className="text-sm text-muted-foreground">Le app AI del CRM.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SOLAIR_AI_APPS.map((app, i) => (
            <Link
              key={app.slug}
              href={`/solair-ai/${app.slug}`}
              title={app.descrizione}
              className="group flex flex-col items-center gap-2 rounded-md border border-[#dddbda] bg-white px-3 py-5 text-center transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
            >
              <span
                className={`flex size-11 items-center justify-center rounded-lg text-white ${COLORI_TILE[i % COLORI_TILE.length]}`}
              >
                <Sparkles className="size-5" />
              </span>
              <span className="text-[13px] font-medium leading-tight text-[#032d60] group-hover:underline">
                {app.nome}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
