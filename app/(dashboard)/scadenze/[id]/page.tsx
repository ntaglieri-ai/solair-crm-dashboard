import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getScadenzaById } from "@/lib/scadenze/repository"

function value(text: string | null) {
  return text?.trim() || "—"
}

function formatDate(text: string | null) {
  if (!text) return "—"
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(text))
}

export default async function ScadenzaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("scadenze")
  const { id } = await params
  const scadenza = await getScadenzaById(id)
  if (!scadenza) notFound()

  const connectedHref =
    scadenza.connesso_a_id && scadenza.connesso_a_tipo
      ? `/${scadenza.connesso_a_tipo === "lead" ? "leads" : "clienti"}/${scadenza.connesso_a_id}`
      : null

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/scadenze" className="hover:text-foreground">
          Scadenze
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{scadenza.nome}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-foreground">{scadenza.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scadenza: {formatDate(scadenza.data_scadenza)}
        </p>
      </header>

      <section className="border-y border-border py-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Proprietario</dt>
            <dd className="mt-1 text-sm text-foreground">
              {value(scadenza.proprietario_nome)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Connesso a</dt>
            <dd className="mt-1 text-sm text-foreground">
              {connectedHref ? (
                <Link href={connectedHref} className="hover:underline">
                  {scadenza.connesso_a_tipo === "lead" ? "Lead" : "Cliente"}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Creata</dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatDate(scadenza.created_at)}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-medium text-muted-foreground">Descrizione</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {value(scadenza.descrizione)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
