"use client"

// Punti d'ingresso condivisi dell'invio email di massa: la voce nel menu "…"
// in alto e il bottone nella barra fissa in basso. Vivono qui perche' Lead,
// Clienti e Installatori devono comportarsi in modo identico — in particolare
// sul tetto di MAX_BULK_RECIPIENTS, che va sempre spiegato e mai applicato
// troncando la selezione di nascosto.

import { IconMail } from "@tabler/icons-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { MAX_BULK_RECIPIENTS } from "@/lib/email/bulk-template"

export function overBulkEmailCap(selectedCount: number) {
  return selectedCount > MAX_BULK_RECIPIENTS
}

function capMessage(selectedCount: number) {
  return `Massimo ${MAX_BULK_RECIPIENTS} destinatari per invio: deseleziona ${
    selectedCount - MAX_BULK_RECIPIENTS
  } righe.`
}

/** Voce "Invia email" del dropdown bulk actions. */
export function BulkEmailMenuItem({
  selectedCount,
  onSelect,
}: {
  selectedCount: number
  onSelect: () => void
}) {
  const over = overBulkEmailCap(selectedCount)

  return (
    <>
      <DropdownMenuItem disabled={over} onClick={over ? undefined : onSelect}>
        <IconMail size={16} stroke={1.8} data-icon="inline-start" />
        Invia email
      </DropdownMenuItem>
      {/* Un tooltip su una voce disabilitata non si aprirebbe (nessun evento
          puntatore): la spiegazione va resa inline, sotto la voce. */}
      {over ? (
        <p className="px-2 pb-1 text-xs leading-snug text-muted-foreground">
          {capMessage(selectedCount)}
        </p>
      ) : null}
    </>
  )
}

/** Bottone "Invia email" della barra fissa in basso. */
export function BulkEmailBarButton({
  selectedCount,
  onSelect,
  className,
}: {
  selectedCount: number
  onSelect: () => void
  className?: string
}) {
  const over = overBulkEmailCap(selectedCount)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Invia email"
            // aria-disabled e non `disabled`: un bottone nativamente
            // disabilitato non emette eventi puntatore, quindi il tooltip che
            // spiega il perche' non si aprirebbe mai.
            aria-disabled={over}
            onClick={() => {
              if (!over) onSelect()
            }}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg text-navy transition-transform duration-150 hover:scale-110 hover:bg-secondary",
              over && "cursor-not-allowed opacity-50 hover:scale-100 hover:bg-transparent",
              className,
            )}
          >
            <IconMail size={18} stroke={1.8} />
          </button>
        }
      />
      <TooltipContent>{over ? capMessage(selectedCount) : "Invia email"}</TooltipContent>
    </Tooltip>
  )
}
