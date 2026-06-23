"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  IconEye,
  IconEyeOff,
  IconCopy,
  IconRefresh,
  IconCircleCheck,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  mockWebhookEvents,
  MAKE_TOKEN_MASKED,
  MAKE_TOKEN_FULL,
} from "@/lib/mock-data"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

export function MakeSection() {
  const [revealed, setRevealed] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const events = mockWebhookEvents
  const last = events[0]

  const copyToken = () => {
    navigator.clipboard?.writeText(MAKE_TOKEN_FULL).catch(() => {})
    toast.success("Token copiato negli appunti")
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Integrazione Make"
        description="Collega Make (Integromat) per automatizzare la creazione e l'aggiornamento dei record."
      />

      {/* Stato + token */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Stato connessione
          </span>
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-success/10 px-2 text-xs font-medium text-success">
            <IconCircleCheck size={13} stroke={2} />
            Attivo
          </span>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">Token API CRM</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex h-9 flex-1 items-center rounded-lg border border-border bg-muted/50 px-3 font-mono text-sm text-foreground">
              {revealed ? MAKE_TOKEN_FULL : MAKE_TOKEN_MASKED}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? (
                <IconEyeOff size={15} stroke={1.8} data-icon="inline-start" />
              ) : (
                <IconEye size={15} stroke={1.8} data-icon="inline-start" />
              )}
              {revealed ? "Nascondi" : "Mostra"}
            </Button>
            <Button variant="outline" size="sm" onClick={copyToken}>
              <IconCopy size={15} stroke={1.8} data-icon="inline-start" />
              Copia
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegenOpen(true)}
            >
              <IconRefresh size={15} stroke={1.8} data-icon="inline-start" />
              Rigenera token
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">
            Ultimo webhook ricevuto
          </span>
          <span className="text-sm text-foreground">
            <span className="font-medium">{last.tipo}</span> — {last.data}
          </span>
        </div>
      </Card>

      {/* Ultimi eventi webhook */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Ultimi eventi webhook
        </h3>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold text-muted-foreground">
                    Tipo
                  </TableHead>
                  <TableHead className="font-semibold text-muted-foreground">
                    Data
                  </TableHead>
                  <TableHead className="font-semibold text-muted-foreground">
                    Stato
                  </TableHead>
                  <TableHead className="font-semibold text-muted-foreground">
                    Payload
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium text-foreground">
                      {e.tipo}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                      {e.data}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-medium",
                          e.esito === "Successo"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {e.esito === "Successo" ? (
                          <IconCircleCheck size={13} stroke={2} />
                        ) : (
                          <IconAlertTriangle size={13} stroke={2} />
                        )}
                        {e.esito}
                      </span>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs text-muted-foreground">
                        {e.payload}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Dialog conferma rigenerazione token */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rigenerare il token API?</DialogTitle>
            <DialogDescription>
              Il token attuale smetterà immediatamente di funzionare. Tutti gli
              scenari Make collegati dovranno essere aggiornati con il nuovo
              token.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setRegenOpen(false)
                setRevealed(false)
                toast.success("Token rigenerato", {
                  description: "Aggiorna i tuoi scenari Make.",
                })
              }}
            >
              Rigenera token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
