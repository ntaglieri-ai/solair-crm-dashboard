import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getInstallatoreById } from "@/lib/installatori/repository"
import { Badge } from "@/components/ui/badge"

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

export default async function InstallatoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePage("installatori")
  const { id } = await params
  const installatore = await getInstallatoreById(id)
  if (!installatore) notFound()

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/installatori" className="hover:text-foreground">
          Installatori
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{installatore.nome}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          {installatore.nome}
        </h1>
        <Badge variant={installatore.attivo ? "secondary" : "outline"}>
          {installatore.attivo ? "Attivo" : "Non attivo"}
        </Badge>
      </header>

      <section className="border-y border-border py-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Email</dt>
            <dd className="mt-1 text-sm text-foreground">
              {value(installatore.email)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Email secondaria
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {value(installatore.email_secondaria)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Proprietario
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {value(installatore.proprietario_nome)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Creato</dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatDate(installatore.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Aggiornato</dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatDate(installatore.updated_at)}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-medium text-muted-foreground">Note</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {value(installatore.note)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
