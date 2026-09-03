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
import { EditRecordDialog, buildClienteEditFields } from "@/components/shared/edit-record-dialog"
import { useDeleteCliente } from "@/lib/clienti/hooks"
import { usePermissions } from "@/lib/permissions/provider"
import { ClienteAvatar, StatoClienteBadge } from "./cliente-utils"
import { ClienteTagBadges } from "./cliente-tag-controls"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { displayClienteOwner } from "@/lib/clienti/owner-display"

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  return String(v)
}

export function ClienteDetailHeader({ cliente }: { cliente: ClienteRecord }) {
  const router = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteCliente = useDeleteCliente()
  const permissions = usePermissions()
  const [editOpen, setEditOpen] = useState(false)
  const nome = cliente["Nome Clienti"]
  const { ownerNames, installerNames } = useClienteTags()
  const ownerName = displayClienteOwner(cliente, ownerNames, "Non assegnato")

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-[0_18px_45px_-32px_rgb(15_23_42/0.55)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--navy),var(--teal),var(--info),var(--warning))]" />
      <div className="flex flex-col gap-5 pt-1">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Link href="/clienti" className="transition-colors hover:text-navy">
          Clienti
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-semibold text-foreground">{nome}</span>
      </nav>

      {/* Titolo + azioni */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ClienteAvatar nome={nome} className="size-14 text-lg shadow-lg ring-4 ring-secondary" />
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">
              {nome}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatoClienteBadge stato={cliente.Stato} />
              <ClienteTagBadges clienteId={cliente.id} empty="" animate />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <Button
            variant="outline"
            className="h-10 bg-card px-4 text-sm font-semibold shadow-sm"
            onClick={() => setEditOpen(true)}
          >
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
                {permissions.canRecord("clienti", "delete") ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setShowDelete(true)}
                    >
                      <Trash2 data-icon="inline-start" />
                      Elimina
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Riga info rapida */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-navy/10 px-2.5 font-semibold text-navy">
          <Building2 className="size-3.5" />
          {val(cliente.Sede)}
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-info/10 px-2.5 font-semibold text-info">
          <UserCircle className="size-3.5" />
          {ownerName}
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-warning/15 px-2.5 font-semibold text-warning">
          <Wrench className="size-3.5" />
          {val(cliente.Installatore)}
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-teal/10 px-2.5 font-semibold text-teal">
          <CalendarDays className="size-3.5" />
          {val(cliente["Ora creazione"])}
        </span>
        <span className="ml-auto inline-flex min-h-8 items-center rounded-lg bg-muted px-2.5 text-sm font-semibold text-muted-foreground">
          Ultimo aggiornamento: {val(cliente["Ora modifica"])}
        </span>
      </div>
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

      <EditRecordDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Modifica cliente"
        endpoint={`/api/clienti/${cliente.id}`}
        fields={buildClienteEditFields(cliente, permissions, installerNames)}
      />
    </div>
  )
}
