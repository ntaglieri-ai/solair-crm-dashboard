"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  Pencil,
  MoreHorizontal,
  Trash2,
  Copy,
  FileText,
  FileDown,
  Building2,
  UserCircle,
  Wrench,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { type ClienteRecord } from "@/lib/mock-data"
import { EditRecordDialog } from "@/components/shared/edit-record-dialog"
import { useDeleteCliente } from "@/lib/clienti/hooks"
import { ClienteAvatar, StatoClienteBadge } from "./cliente-utils"
import { ClienteTagBadges } from "./cliente-tag-controls"

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  return String(v)
}

export function ClienteDetailHeader({ cliente }: { cliente: ClienteRecord }) {
  const router = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteCliente = useDeleteCliente()
  const [editOpen, setEditOpen] = useState(false)
  const [showContract, setShowContract] = useState(false)
  const nome = cliente["Nome Clienti"]

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/clienti" className="hover:text-foreground">
          Clienti
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{nome}</span>
      </nav>

      {/* Titolo + azioni */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ClienteAvatar nome={nome} className="size-12 text-base" />
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">
              {nome}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatoClienteBadge stato={cliente.Stato} />
              <ClienteTagBadges clienteId={cliente.id} empty="" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setShowContract(true)}
          >
            <FileText data-icon="inline-start" />
            Genera contratto
          </Button>
          <Button variant="outline" className="bg-card" onClick={() => setEditOpen(true)}>
            <Pencil data-icon="inline-start" />
            Modifica
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-card"
                  aria-label="Altre azioni"
                >
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/clienti/${cliente.id}/duplica`, {
                        method: "POST",
                      })
                      const result = (await res.json().catch(() => null)) as
                        | { id?: string; error?: string }
                        | null
                      if (!res.ok || !result?.id) {
                        toast.error(result?.error ?? "Duplicazione non riuscita")
                        return
                      }
                      toast.success("Cliente duplicato")
                      router.push(`/clienti/${result.id}`)
                    } catch {
                      toast.error("Duplicazione non riuscita: errore di rete")
                    }
                  }}
                >
                  <Copy data-icon="inline-start" />
                  Duplica
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    // "Semplice": stampa la pagina cosi' com'e', con sidebar
                    // e pulsanti azione nascosti via CSS (.no-print, vedi
                    // globals.css) — nessun layout PDF dedicato per ora.
                    window.print()
                  }}
                >
                  <FileDown data-icon="inline-start" />
                  Esporta scheda PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Riga info rapida */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="size-3.5" />
          {val(cliente.Sede)}
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1.5">
          <UserCircle className="size-3.5" />
          {val(cliente["Clienti Proprietario"])}
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1.5">
          <Wrench className="size-3.5" />
          {val(cliente.Installatore)}
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          {val(cliente["Ora creazione"])}
        </span>
        <span className="ml-auto text-muted-foreground/70">
          Ultimo aggiornamento: {val(cliente["Ora modifica"])}
        </span>
      </div>

      {/* Dialog elimina */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina cliente</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">{nome}</span>?
              L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)} disabled={deleting}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                setDeleting(true)
                deleteCliente.mutate(cliente.id, {
                  onSuccess: () => {
                    toast.success("Cliente eliminato", { description: nome })
                    router.push("/clienti")
                  },
                  onError: () => {
                    toast.error("Errore nell'eliminazione del cliente")
                    setDeleting(false)
                  },
                })
              }}
            >
              {deleting ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog genera contratto */}
      <Dialog open={showContract} onOpenChange={setShowContract}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Genera contratto</DialogTitle>
            <DialogDescription>
              Vuoi generare il contratto digitale per{" "}
              <span className="font-semibold text-foreground">{nome}</span>? Il
              documento sarà compilato con i dati della scheda cliente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContract(false)}>
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => {
                setShowContract(false)
                toast.success("Contratto generato", { description: nome })
              }}
            >
              Genera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditRecordDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Modifica cliente"
        endpoint={`/api/clienti/${cliente.id}`}
        fields={[
          { key: "nome", label: "Nome", value: cliente.Nome ?? "" },
          { key: "cognome", label: "Cognome", value: cliente.Cognome ?? "" },
          { key: "cellulare", label: "Cellulare", value: cliente.Cellulare ?? "", type: "tel" },
          { key: "email", label: "E-mail", value: cliente["E-mail"] ?? "", type: "email" },
          {
            key: "codiceFiscale",
            label: "Codice fiscale",
            value: cliente["Codice fiscale"] ?? "",
          },
        ]}
        buildBody={(v) => ({
          Nome: v.nome,
          Cognome: v.cognome,
          Cellulare: v.cellulare,
          "E-mail": v.email,
          "Codice fiscale": v.codiceFiscale,
        })}
      />
    </div>
  )
}
