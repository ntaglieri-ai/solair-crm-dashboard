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
import type { ScadenzaRecord } from "@/lib/scadenze/repository"
import { scadenzeKeys, useScadenzeReferenceData } from "@/lib/scadenze/hooks"
import { ScadenzaTagMenuDialog } from "./scadenza-tag-picker"

export function ScadenzaRowContextMenu({
  scadenza,
  children,
  onEdit,
  onDelete,
}: {
  scadenza: ScadenzaRecord
  children: ReactNode
  onEdit: (s: ScadenzaRecord) => void
  onDelete: (s: ScadenzaRecord) => void
}) {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: referenceData } = useScadenzeReferenceData()
  const proprietari = referenceData?.proprietari ?? []
  const tags = referenceData?.tags ?? []
  const [tagOpen, setTagOpen] = useState(false)

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/scadenze/${scadenza.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error("Aggiornamento non riuscito")
    qc.invalidateQueries({ queryKey: scadenzeKeys.lists() })
    qc.invalidateQueries({ queryKey: scadenzeKeys.referenceData() })
  }

  const changeOwner = async (ownerId: string, ownerNome: string) => {
    try {
      await patch({ proprietario_id: ownerId })
      toast.success("Proprietario aggiornato", {
        description: `${scadenza.nome} → ${ownerNome}`,
      })
    } catch {
      toast.error("Errore nell'aggiornamento del proprietario")
    }
  }

  const changeTag = async (tag: string) => {
    try {
      await patch({ tag: tag || null })
      toast.success(tag ? "Tag aggiornato" : "Tag rimosso", {
        description: scadenza.nome,
      })
    } catch {
      toast.error("Errore nell'aggiornamento del tag")
    }
  }

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger render={children as never} />
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuGroupLabel>Azioni rapide</ContextMenuGroupLabel>

          <ContextMenuItem onClick={() => router.push(`/scadenze/${scadenza.id}`)}>
            <IconExternalLink size={15} stroke={1.8} />
            Apri scadenza
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onEdit(scadenza)}>
            <IconPencil size={15} stroke={1.8} />
            Modifica
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
                    {scadenza.proprietario_id === p.id ? (
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

        <ContextMenuItem variant="destructive" onClick={() => onDelete(scadenza)}>
          <IconTrash size={15} stroke={1.8} />
          Elimina
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <ScadenzaTagMenuDialog
      value={scadenza.tag}
      suggestions={tags}
      onSelect={changeTag}
      open={tagOpen}
      onOpenChange={setTagOpen}
    />
    </>
  )
}
