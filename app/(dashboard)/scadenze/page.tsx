import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getScadenze } from "@/lib/scadenze/repository"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export default async function ScadenzePage() {
  await requirePage("scadenze")
  const scadenze = await getScadenze()

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Scadenze</h1>
        <p className="text-sm text-muted-foreground">
          {scadenze.length} {scadenze.length === 1 ? "scadenza" : "scadenze"}
        </p>
      </header>

      {scadenze.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 border-y border-border text-center">
          <CalendarClock className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Nessuna scadenza</p>
            <p className="text-sm text-muted-foreground">
              Le scadenze registrate in Supabase appariranno qui.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Data scadenza</TableHead>
                <TableHead>Proprietario</TableHead>
                <TableHead>Collegamento</TableHead>
                <TableHead>Aggiornata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scadenze.map((scadenza) => (
                <TableRow key={scadenza.id}>
                  <TableCell>
                    <Link
                      href={`/scadenze/${scadenza.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {scadenza.nome}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(scadenza.data_scadenza)}</TableCell>
                  <TableCell>{scadenza.proprietario_nome ?? "—"}</TableCell>
                  <TableCell>
                    {scadenza.connesso_a_tipo ? (
                      <Badge variant="outline">
                        {scadenza.connesso_a_tipo === "lead" ? "Lead" : "Cliente"}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(scadenza.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
