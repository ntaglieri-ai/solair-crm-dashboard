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
import { type Lead, nomeCompleto } from "@/lib/mock-data"
import { LeadAvatar, StatusBadge, ScoreBar } from "./lead-utils"

export function LeadDetailHeader({ lead }: { lead: Lead }) {
  const router = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const [showLost, setShowLost] = useState(false)
  const [showConvert, setShowConvert] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/leads" className="hover:text-foreground">
          Lead
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{nomeCompleto(lead)}</span>
      </nav>

      {/* Titolo + azioni */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <LeadAvatar lead={lead} className="size-14 text-base" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {nomeCompleto(lead)}
            </h1>
            <div className="flex items-center gap-3">
              <StatusBadge status={lead.status} />
              <ScoreBar score={lead.score} />
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

      {/* Dialog elimina */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lead</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">{nomeCompleto(lead)}</span>?
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
              <span className="font-semibold text-foreground">{nomeCompleto(lead)}</span>{" "}
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
              <span className="font-semibold text-foreground">{nomeCompleto(lead)}</span>{" "}
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
