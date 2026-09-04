"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronRight,
  UserCheck,
  Pencil,
  MoreHorizontal,
  Trash2,
  XCircle,
  Building2,
  UserCircle,
  Megaphone,
  CalendarDays,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuickContactIcons } from "@/components/shared/quick-contact-icons"
import { EditRecordDialog, buildLeadEditFields } from "@/components/shared/edit-record-dialog"
import { useDeleteLead, useCreateLead } from "@/lib/leads/hooks"
import { usePermissions } from "@/lib/permissions/provider"
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
import {
  DOCUMENTI_OBBLIGATORI_CHANGED,
  useDocumentiObbligatori,
} from "@/lib/allegati/hooks"

/**
 * Stato del gate accanto al pulsante "Converti a cliente": dice sempre a che
 * punto si e', cosi' un pulsante disabilitato non resta senza spiegazione.
 */
function GateDocumentiLabel({
  stato,
}: {
  stato: ReturnType<typeof useDocumentiObbligatori>
}) {
  if (stato.isPending) {
    return <span className="text-xs text-muted-foreground">Verifica documenti…</span>
  }

  // Nextcloud irraggiungibile: il conteggio non e' noto. Non blocca piu' la
  // conversione (gate rimosso, report Vito punto 17) — resta solo un avviso
  // informativo.
  if (stato.isError || !stato.data) {
    return (
      <span className="text-xs text-destructive">
        Conteggio documenti non disponibile — conversione consentita
      </span>
    )
  }

  const { count, richiesti, completo } = stato.data
  if (completo) {
    return (
      <span className="text-xs text-success">
        {richiesti} documenti caricati
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      Documenti caricati: {count}/{richiesti} — conversione consentita
    </span>
  )
}

export function LeadDetailHeader({ lead }: { lead: Lead }) {
  const { ownerNames } = useTags()
  const router = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteLead = useDeleteLead()
  const createLead = useCreateLead()
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const permissions = usePermissions()
  const [showLost, setShowLost] = useState(false)
  const [markingLost, setMarkingLost] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [converting, setConverting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const nome = lead["Nome Lead"]

  // Gate dei tre documenti obbligatori (spec FASE 1.3): il conteggio arriva
  // dalla sottocartella Nextcloud del lead. Qui serve solo a guidare l'utente
  // — se il pulsante viene attivato lo stesso (tastiera, automazione), la
  // route di conversione risponde 400 e il messaggio finisce nel toast.
  const documenti = useDocumentiObbligatori(lead.id)
  // Bug 6.1 (report Vito): senza questo, riaprire il dialog dopo una
  // conversione gia' riuscita e ricliccare "Converti" creava un secondo
  // cliente sullo stesso lead — la route ora rifiuta (409), ma il pulsante
  // va disabilitato anche qui, non solo lato server.
  const giaConvertito = lead["Stato Lead"] === "Convertito" || Boolean(lead["Account convertito"])

  // La sezione allegati sta su un altro ramo della pagina: avvisa via evento
  // quando si carica o elimina un documento, cosi' il conteggio qui si
  // aggiorna senza ricaricare.
  useEffect(() => {
    const refetch = () => {
      documenti.refetch()
    }
    window.addEventListener(DOCUMENTI_OBBLIGATORI_CHANGED, refetch)
    return () => window.removeEventListener(DOCUMENTI_OBBLIGATORI_CHANGED, refetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  const ownerName = lead["Lead Proprietario"]
    ? ownerNames[lead["Lead Proprietario"]] ?? "Utente non disponibile"
    : "Non assegnato"

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-[0_18px_45px_-32px_rgb(15_23_42/0.55)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--navy),var(--teal),var(--info),var(--warning))]" />
      <div className="flex flex-col gap-5 pt-1">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Link href="/leads" className="transition-colors hover:text-navy">
          Lead
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-semibold text-foreground">{nome}</span>
      </nav>

      {/* Titolo + azioni */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <LeadAvatar nome={nome} className="size-14 text-lg shadow-lg ring-4 ring-secondary" />
          <div className="flex min-w-0 flex-col gap-2.5">
            <h1 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">
              {nome}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <StatoLeadBadge stato={lead["Stato Lead"]} />
              <ScoreBar score={lead.Valutazione} />
              <div className="flex flex-wrap items-center gap-1.5">
                <LeadTagBadges leadId={lead.id} animate />
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

        <div className="flex flex-wrap items-center gap-2 no-print">
          {/* Il conteggio sta a sinistra del pulsante: spiega perche' e'
              disabilitato senza spostare la riga delle azioni. */}
          <GateDocumentiLabel stato={documenti} />
          <Button
            className="h-10 bg-teal px-4 text-sm font-bold text-teal-foreground shadow-sm hover:bg-teal/90"
            disabled={giaConvertito}
            onClick={() => setShowConvert(true)}
          >
            <UserCheck data-icon="inline-start" />
            {giaConvertito ? "Già convertito" : "Converti a cliente"}
          </Button>
          <Button
            variant="outline"
            className="h-10 bg-card px-4 text-sm font-semibold shadow-sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil data-icon="inline-start" />
            Modifica
          </Button>
          <QuickContactIcons
            kind="lead"
            recordId={lead.id}
            nome={lead["Nome Lead"]}
            telefono={lead.Telefono}
            email={lead["E-mail"]}
            show={["email"]}
            emailAsButton
          />
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
                <DropdownMenuItem onClick={() => setShowDuplicate(true)}>
                  <Copy data-icon="inline-start" />
                  Duplica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowLost(true)}>
                  <XCircle data-icon="inline-start" />
                  Segna come perso
                </DropdownMenuItem>
                {permissions.canRecord("lead", "delete") ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setShowDelete(true)}>
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
          {lead.Sede}
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-info/10 px-2.5 font-semibold text-info">
          <UserCircle className="size-3.5" />
          {ownerName}
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-warning/15 px-2.5 font-semibold text-warning">
          <Megaphone className="size-3.5" />
          {lead["Origine Lead"]}
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-teal/10 px-2.5 font-semibold text-teal">
          <CalendarDays className="size-3.5" />
          {lead["Ora creazione"]}
        </span>
        <span className="ml-auto inline-flex min-h-8 items-center rounded-lg bg-muted px-2.5 text-sm font-semibold text-muted-foreground">
          Ultimo aggiornamento: {lead["Ora ultima attività"]}
        </span>
      </div>
      </div>

      {/* Dialog duplica */}
      <Dialog open={showDuplicate} onOpenChange={setShowDuplicate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplica lead</DialogTitle>
            <DialogDescription>
              Creare una copia di{" "}
              <span className="font-medium text-foreground">{nome}</span>? La
              copia conserverà tag e dati principali.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDuplicate(false)}
              disabled={duplicating}
            >
              Annulla
            </Button>
            <Button
              disabled={duplicating}
              onClick={() => {
                setDuplicating(true)
                const copy = {
                  ...lead,
                  id: crypto.randomUUID(),
                  "Nome Lead": `Copia di ${lead["Nome Lead"]}`,
                  "Badge dell'attività": false,
                  "Badge di nota": false,
                  attivita: [],
                  documenti: [],
                }
                createLead.mutate(copy, {
                  onSuccess: () => {
                    toast.success("Lead duplicato")
                    setShowDuplicate(false)
                    setDuplicating(false)
                    router.push(`/leads/${copy.id}`)
                  },
                  onError: () => {
                    toast.error("Duplicazione non riuscita")
                    setDuplicating(false)
                  },
                })
              }}
            >
              {duplicating ? "Duplicazione..." : "Duplica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="outline" onClick={() => setShowDelete(false)} disabled={deleting}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                setDeleting(true)
                deleteLead.mutate(lead.id, {
                  onSuccess: () => {
                    toast.success("Lead eliminato", { description: nome })
                    router.push("/leads")
                  },
                  onError: () => {
                    toast.error("Errore nell'eliminazione del lead")
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
            <Button variant="outline" onClick={() => setShowLost(false)} disabled={markingLost}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={markingLost}
              onClick={async () => {
                setMarkingLost(true)
                try {
                  const res = await fetch(`/api/leads/${lead.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ "Stato Lead": "Perso" }),
                  })
                  if (!res.ok) throw new Error("Aggiornamento non riuscito")
                  toast.success("Lead segnato come perso")
                  setShowLost(false)
                  router.refresh()
                } catch {
                  toast.error("Errore nel segnare il lead come perso")
                } finally {
                  setMarkingLost(false)
                }
              }}
            >
              {markingLost ? "Salvataggio..." : "Segna come perso"}
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
            <Button variant="outline" onClick={() => setShowConvert(false)} disabled={converting}>
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              disabled={converting}
              onClick={async () => {
                setConverting(true)
                try {
                  const res = await fetch(`/api/leads/${lead.id}/converti`, {
                    method: "POST",
                  })
                  const result = (await res.json().catch(() => null)) as
                    | { clienteId?: string; error?: string }
                    | null
                  if (!res.ok || !result?.clienteId) {
                    // Include il 400 del gate ("Servono esattamente 3
                    // documenti obbligatori..."): il messaggio del server
                    // arriva all'utente invece di sparire in silenzio.
                    toast.error(result?.error ?? "Conversione non riuscita")
                    // Il conteggio mostrato era evidentemente vecchio: si
                    // rilegge, cosi' la label torna coerente col server.
                    documenti.refetch()
                    return
                  }
                  toast.success("Lead convertito in cliente")
                  setShowConvert(false)
                  router.push(`/clienti/${result.clienteId}`)
                } catch {
                  toast.error("Conversione non riuscita: errore di rete")
                } finally {
                  setConverting(false)
                }
              }}
            >
              {converting ? "Conversione..." : "Converti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditRecordDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Modifica lead"
        endpoint={`/api/leads/${lead.id}`}
        fields={buildLeadEditFields(lead, permissions)}
      />
    </div>
  )
}
