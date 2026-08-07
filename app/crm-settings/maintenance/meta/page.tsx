"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, Megaphone, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

// Endpoint gia' sottoscritto su Meta per i Lead Ads: valore fisso, non serve
// interrogare Graph per mostrarlo.
const WEBHOOK_URL = "https://crm.solairgroup.it/api/meta/webhook"

type MetaPage = {
  id: string
  name: string
  category: string | null
  picture_url: string | null
}

export default function MetaAdsPage() {
  const [pages, setPages] = useState<MetaPage[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/meta/pages", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Lettura delle Pagine Meta non riuscita")
      }
      setPages(Array.isArray(payload?.pages) ? payload.pages : [])
      setActivePageId(payload?.activePageId ?? null)
    } catch (reason) {
      setPages([])
      setError(
        reason instanceof Error
          ? reason.message
          : "Lettura delle Pagine Meta non riuscita",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Meta Ads"
        description="Pagine Facebook collegate e stato del webhook Lead Ads."
        action={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Aggiorna
          </Button>
        }
      />

      <section className="flex max-w-3xl items-start gap-3 rounded-lg border border-border bg-card p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Webhook Lead Ads</h2>
            <span className="inline-flex h-5 items-center rounded-full bg-success/10 px-2 text-xs font-medium text-success">
              Connesso
            </span>
          </div>
          <div className="mt-2 rounded-md bg-muted px-3 py-2">
            <code className="block truncate text-xs text-muted-foreground">
              {WEBHOOK_URL}
            </code>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Pagine Facebook collegate
        </h2>

        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Lettura delle Pagine da Meta in corso...
          </div>
        ) : null}

        {!loading && !error && pages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <Megaphone className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="font-medium">Nessuna Pagina collegata</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Il token non ha accesso a nessuna Pagina del Business Manager.
            </p>
          </div>
        ) : null}

        {!loading && pages.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {pages.map((page) => (
              <article
                key={page.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
              >
                {page.picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.picture_url}
                    alt=""
                    className="size-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
                    <Megaphone className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{page.name}</h3>
                    {activePageId && page.id === activePageId ? (
                      <span className="inline-flex h-5 items-center rounded-full bg-success/10 px-2 text-xs font-medium text-success">
                        Attiva
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {page.category ?? "Categoria non disponibile"}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    ID {page.id}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
