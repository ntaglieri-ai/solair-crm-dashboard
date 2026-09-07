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
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuickContactIcons } from "@/components/shared/quick-contact-icons"
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
import { SEDE_LABELS, type ClienteRecord } from "@/lib/mock-data"
import { EditRecordDialog, buildClienteEditFields } from "@/components/shared/edit-record-dialog"
import { useDeleteCliente } from "@/lib/clienti/hooks"
import { usePermissions } from "@/lib/permissions/provider"
import { ClienteAvatar, StatoClienteBadge } from "./cliente-utils"
import { ClienteTagBadges, ClienteTagAssignPopover } from "./cliente-tag-controls"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { useStatoClienteQuery } from "@/lib/clienti/stato-cliente-store"
import { option } from "@/lib/crm-settings/column-values"
import { useColumnValueOptions } from "@/lib/crm-settings/use-column-values"

export function ClienteDetailHeader({ cliente }: { cliente: ClienteRecord }) {
  const router = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteCliente = useDeleteCliente()
  const permissions = usePermissions()
  const [editOpen, setEditOpen] = useState(false)
  const nome = cliente["Nome Clienti"]
  const { installers } = useClienteTags()
  const { data: statoOptions } = useStatoClienteQuery()
  const sedeOptions = useColumnValueOptions(
    "Clienti",
    "sede",
    SEDE_LABELS.map((value) => option(value)),
    { includeFallback: true },
  ).options

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-[0_18px_45px_-32px_rgb(15_23_42/0.55)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--navy),var(--teal),var(--info),var(--warning))]" />
      <div className="flex flex-col gap-2 pt-1">
      {/* Breadcrumb */}
      <nav className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground">
        <Link href="/clienti" className="transition-colors hover:text-navy">
          Clienti
        </Link>
        <ChevronRight className="size-3 shrink-0" />
        <span className="truncate font-semibold text-foreground">{nome}</span>
      </nav>

      {/* Titolo + azioni: nome, stato e pulsanti sulla stessa riga. E' la
          riga che resta ancorata in alto durante lo scroll (vedi
          StickyDetailHeader), quindi va tenuta bassa — niente altro qui. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ClienteAvatar nome={nome} className="size-10 shrink-0 text-sm shadow-sm ring-2 ring-secondary" />
          <h1 className="min-w-0 truncate text-xl font-black leading-tight text-foreground sm:text-2xl">
            {nome}
          </h1>
          {/* Su schermi molto stretti il badge stato cede il posto al nome:
              torna visibile da 'sm' in su. */}
          <span className="hidden sm:inline-flex">
            <StatoClienteBadge stato={cliente.Stato} />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <Button
            variant="outline"
            className="h-9 bg-card px-3 text-sm font-semibold shadow-sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil data-icon="inline-start" />
            Modifica
          </Button>
          <QuickContactIcons
            kind="cliente"
            recordId={cliente.id}
            nome={cliente["Nome Clienti"]}
            telefono={cliente.Cellulare}
            email={cliente["E-mail"]}
            show={["email"]}
            emailAsButton
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 bg-card"
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

      {/* Tag: riga propria sotto al nome, come su Zoho. Nascosta sotto 'sm'
          insieme al badge stato — su mobile restano solo nome + azione
          primaria + menu, il resto e' a un tap di distanza. */}
      <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
        <ClienteTagBadges clienteId={cliente.id} empty="" animate />
        <ClienteTagAssignPopover
          clienteId={cliente.id}
          trigger={
            <button
              type="button"
              aria-label="Aggiungi tag"
              className="flex size-5 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          }
        />
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
        fields={buildClienteEditFields(
          cliente,
          permissions,
          installers,
          (statoOptions ?? []).map((s) => s.valore),
          { sedi: sedeOptions.map((s) => s.value) },
        )}
      />
    </div>
  )
}
