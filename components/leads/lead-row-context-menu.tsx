"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconTag,
  IconUserEdit,
  IconArrowRight,
  IconExternalLink,
  IconCopy,
  IconDownload,
  IconTrash,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  type Lead,
  type StatoLead,
  mockCommerciali,
} from "@/lib/mock-data"
import { TagPicker } from "./tag-controls"

const STATI: StatoLead[] = [
  "Non contattato",
  "Contattato",
  "Tentato di contattare",
  "Inviato Preventivo",
  "Convertito",
  "Perso",
]

export function LeadRowContextMenu({
  lead,
  children,
  onDelete,
}: {
  lead: Lead
  children: ReactNode
  onDelete: (lead: Lead) => void
}) {
  const router = useRouter()
  const [tagOpen, setTagOpen] = useState(false)
  const [owner, setOwner] = useState(lead["Lead Proprietario"] ?? "")
  const [stato, setStato] = useState<StatoLead>(lead["Stato Lead"])
  const [confirmDup, setConfirmDup] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const exportRow = () => {
    toast.success("Esportazione avviata", {
      description: `Lead "${lead["Nome Lead"]}" esportato in CSV.`,
    })
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger render={children as never} />
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuGroupLabel>Azioni rapide</ContextMenuGroupLabel>

            {/* Gestisci tag -> apre popover inline sulla riga */}
            <Popover open={tagOpen} onOpenChange={setTagOpen}>
              <PopoverTrigger
                nativeButton={false}
                render={
                  <ContextMenuItem
                    closeOnClick={false}
                    onClick={(e) => {
                      e.preventDefault()
                      setTagOpen(true)
                    }}
                  >
                    <IconTag size={15} stroke={1.8} />
                    Gestisci tag
                  </ContextMenuItem>
                }
              />
              <PopoverContent align="start" className="w-72 gap-0 p-2">
                <TagPicker leadId={lead.id} onDone={() => setTagOpen(false)} />
              </PopoverContent>
            </Popover>

            {/* Cambia proprietario */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <IconUserEdit size={15} stroke={1.8} />
                Cambia proprietario
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {mockCommerciali.map((c) => (
                  <ContextMenuItem
                    key={c}
                    onClick={() => {
                      setOwner(c)
                      toast.success("Proprietario aggiornato", {
                        description: `${lead["Nome Lead"]} → ${c}`,
                      })
                    }}
                  >
                    {owner === c ? (
                      <IconCheck size={15} stroke={2} className="text-teal" />
                    ) : (
                      <span className="size-[15px]" />
                    )}
                    {c}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>

            {/* Cambia stato */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <IconArrowRight size={15} stroke={1.8} />
                Cambia stato
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {STATI.map((s) => (
                  <ContextMenuItem
                    key={s}
                    onClick={() => {
                      setStato(s)
                      toast.success("Stato aggiornato", {
                        description: `${lead["Nome Lead"]} → ${s}`,
                      })
                    }}
                  >
                    {stato === s ? (
                      <IconCheck size={15} stroke={2} className="text-teal" />
                    ) : (
                      <span className="size-[15px]" />
                    )}
                    {s}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuGroup>

          <ContextMenuSeparator />

          <ContextMenuGroup>
            <ContextMenuGroupLabel>Navigazione</ContextMenuGroupLabel>
            <ContextMenuItem onClick={() => router.push(`/leads/${lead.id}`)}>
              <IconExternalLink size={15} stroke={1.8} />
              Apri scheda
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setConfirmDup(true)}>
              <IconCopy size={15} stroke={1.8} />
              Duplica lead
            </ContextMenuItem>
          </ContextMenuGroup>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={exportRow}>
            <IconDownload size={15} stroke={1.8} />
            Esporta questo lead
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => setConfirmDel(true)}>
            <IconTrash size={15} stroke={1.8} />
            Elimina
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Dialog duplica */}
      <Dialog open={confirmDup} onOpenChange={setConfirmDup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplica lead</DialogTitle>
            <DialogDescription>
              Creare una copia di{" "}
              <span className="font-medium text-foreground">
                {lead["Nome Lead"]}
              </span>
              ? La copia conserverà tag e dati principali.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDup(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                setConfirmDup(false)
                toast.success("Lead duplicato", {
                  description: `Copia di "${lead["Nome Lead"]}" creata.`,
                })
              }}
            >
              Duplica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog elimina */}
      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lead</DialogTitle>
            <DialogDescription>
              Vuoi eliminare{" "}
              <span className="font-medium text-foreground">
                {lead["Nome Lead"]}
              </span>
              ? L&apos;azione non è reversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDel(false)
                onDelete(lead)
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
