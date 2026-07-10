"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  IconExternalLink,
  IconPencil,
  IconTrash,
  IconUserEdit,
  IconTag,
  IconCheck,
  IconToggleLeft,
} from "@tabler/icons-react"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu"
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import { installatoriKeys, useInstallatoriReferenceData } from "@/lib/installatori/hooks"
import { InstallatoreTagMenuDialog } from "./installatore-tag-picker"

export function InstallatoreRowContextMenu({
  installatore,
  children,
  onEdit,
  onDelete,
}: {
  installatore: InstallatoreRecord
  children: ReactNode
  onEdit: (i: InstallatoreRecord) => void
  onDelete: (i: InstallatoreRecord) => void
}) {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: referenceData } = useInstallatoriReferenceData()
  const proprietari = referenceData?.proprietari ?? []
  const tags = referenceData?.tags ?? []
  const [tagOpen, setTagOpen] = useState(false)

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/installatori/${installatore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error("Aggiornamento non riuscito")
    qc.invalidateQueries({ queryKey: installatoriKeys.lists() })
    qc.invalidateQueries({ queryKey: installatoriKeys.referenceData() })
  }

  const changeOwner = async (ownerId: string, ownerNome: string) => {
    try {
      await patch({ proprietario_id: ownerId })
      toast.success("Proprietario aggiornato", {
        description: `${installatore.nome} → ${ownerNome}`,
      })
    } catch {
      toast.error("Errore nell'aggiornamento del proprietario")
    }
  }

  const changeTag = async (tag: string) => {
    try {
      await patch({ tag: tag || null })
      toast.success(tag ? "Tag aggiornato" : "Tag rimosso", {
        description: installatore.nome,
      })
    } catch {
      toast.error("Errore nell'aggiornamento del tag")
    }
  }

  const toggleAttivo = async () => {
    try {
      await patch({ attivo: !installatore.attivo })
      toast.success(installatore.attivo ? "Impostato non attivo" : "Impostato attivo", {
        description: installatore.nome,
      })
    } catch {
      toast.error("Errore nell'aggiornamento dello stato")
    }
  }

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger render={children as never} />
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuGroupLabel>Azioni rapide</ContextMenuGroupLabel>

          <ContextMenuItem onClick={() => router.push(`/installatori/${installatore.id}`)}>
            <IconExternalLink size={15} stroke={1.8} />
            Apri installatore
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onEdit(installatore)}>
            <IconPencil size={15} stroke={1.8} />
            Modifica
          </ContextMenuItem>
          <ContextMenuItem onClick={toggleAttivo}>
            <IconToggleLeft size={15} stroke={1.8} />
            {installatore.attivo ? "Imposta non attivo" : "Imposta attivo"}
          </ContextMenuItem>

          <ContextMenuItem onClick={() => setTagOpen(true)}>
            <IconTag size={15} stroke={1.8} />
            Cambia tag
          </ContextMenuItem>

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <IconUserEdit size={15} stroke={1.8} />
              Cambia proprietario
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {proprietari.length === 0 ? (
                <ContextMenuItem disabled>Nessun utente attivo</ContextMenuItem>
              ) : (
                proprietari.map((p) => (
                  <ContextMenuItem key={p.id} onClick={() => changeOwner(p.id, p.nome)}>
                    {installatore.proprietario_id === p.id ? (
                      <IconCheck size={15} stroke={2} className="text-teal" />
                    ) : (
                      <span className="size-[15px]" />
                    )}
                    {p.nome}
                  </ContextMenuItem>
                ))
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>

        <ContextMenuSeparator />

        <ContextMenuItem variant="destructive" onClick={() => onDelete(installatore)}>
          <IconTrash size={15} stroke={1.8} />
          Elimina
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <InstallatoreTagMenuDialog
      value={installatore.tag}
      suggestions={tags}
      onSelect={changeTag}
      open={tagOpen}
      onOpenChange={setTagOpen}
    />
    </>
  )
}
