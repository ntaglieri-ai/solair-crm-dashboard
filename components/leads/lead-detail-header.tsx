"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  UserCheck,
  Pencil,
  MoreHorizontal,
  Trash2,
  XCircle,
  Mail,
  Building2,
  UserCircle,
  Megaphone,
  CalendarDays,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconPlus } from "@tabler/icons-react"
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
import { type Lead } from "@/lib/mock-data"
import { LeadAvatar, StatoLeadBadge, ScoreBar } from "./lead-utils"
import { LeadTagBadges, TagAssignPopover } from "./tag-controls"
import { useTags } from "@/lib/tag-store"

export function LeadDetailHeader({ lead }: { lead: Lead }) {
  const { owners } = useTags()
  const router = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const [showLost, setShowLost] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const nome = lead["Nome Lead"]
  const ownerName =
    owners.find((owner) => owner.id === lead["Lead Proprietario"])?.nome ||
    lead["Lead Proprietario"] ||
    "Non assegnato"

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/leads" className="hover:text-foreground">
          Lead
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{nome}</span>
      </nav>

      {/* Titolo + azioni */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <LeadAvatar nome={nome} className="size-12 text-base" />
          <div className="flex flex-col gap-2">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">
              {nome}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <StatoLeadBadge stato={lead["Stato Lead"]} />
              <ScoreBar score={lead.Valutazione} />
              <div className="flex flex-wrap items-center gap-1.5">
                <LeadTagBadges leadId={lead.id} />
                <TagAssignPopover
                  leadId={lead.id}
                  trigger={
                    <button
                      type="button"
                      aria-label="Aggiungi tag"
                      className="flex size-5 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                    >
                      <IconPlus size={14} stroke={2} />
                    </button>
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setShowConvert(true)}
          >
            <UserCheck data-icon="inline-start" />
            Converti a cliente
          </Button>
          <Button variant="outline" className="bg-card">
            <Pencil data-icon="inline-start" />
            Modifica
          </Button>
          <Button variant="outline" className="bg-card">
            <Mail data-icon="inline-start" />
            Invia e-mail
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" className="bg-card" aria-label="Altre azioni">
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Copy data-icon="inline-start" />
                  Duplica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowLost(true)}>
                  <XCircle data-icon="inline-start" />
                  Segna come perso
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setShowDelete(true)}>
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
          {lead.Sede}
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1.5">
          <UserCircle className="size-3.5" />
          {ownerName}
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1.5">
          <Megaphone className="size-3.5" />
          {lead["Origine Lead"]}
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          {lead["Ora creazione"]}
        </span>
        <span className="ml-auto text-muted-foreground/70">
          Ultimo aggiornamento: {lead["Ora ultima attività"]}
        </span>
      </div>

      {/* Dialog elimina */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lead</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">{nome}</span>?
              L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDelete(false)
                router.push("/leads")
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog segna come perso */}
      <Dialog open={showLost} onOpenChange={setShowLost}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Segna come perso</DialogTitle>
            <DialogDescription>
              Confermi di voler contrassegnare{" "}
              <span className="font-semibold text-foreground">{nome}</span>{" "}
              come lead perso?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLost(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={() => setShowLost(false)}>
              Segna come perso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog converti */}
      <Dialog open={showConvert} onOpenChange={setShowConvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converti a cliente</DialogTitle>
            <DialogDescription>
              Vuoi convertire{" "}
              <span className="font-semibold text-foreground">{nome}</span>{" "}
              in cliente? Verrà creata una nuova scheda cliente con i dati del lead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvert(false)}>
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => setShowConvert(false)}
            >
              Converti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
