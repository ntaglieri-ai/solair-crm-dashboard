import Link from "next/link"
import { HardHat } from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getInstallatori } from "@/lib/installatori/repository"
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
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
    new Date(value),
  )
}

export default async function InstallatoriPage() {
  await requirePage("installatori")
  const installatori = await getInstallatori()

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Installatori</h1>
        <p className="text-sm text-muted-foreground">
          {installatori.length}{" "}
          {installatori.length === 1 ? "installatore" : "installatori"}
        </p>
      </header>

      {installatori.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 border-y border-border text-center">
          <HardHat className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Nessun installatore</p>
            <p className="text-sm text-muted-foreground">
              Gli installatori registrati in Supabase appariranno qui.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Proprietario</TableHead>
                <TableHead>Aggiornato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installatori.map((installatore) => (
                <TableRow key={installatore.id}>
                  <TableCell>
                    <Link
                      href={`/installatori/${installatore.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {installatore.nome}
                    </Link>
                  </TableCell>
                  <TableCell>{installatore.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={installatore.attivo ? "secondary" : "outline"}>
                      {installatore.attivo ? "Attivo" : "Non attivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{installatore.proprietario_nome ?? "—"}</TableCell>
                  <TableCell>{formatDate(installatore.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
