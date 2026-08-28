"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Contratto di stile condiviso dalle tabelle Lead / Clienti /
 * Installatori, ispirato a Salesforce Lightning.
 *
 * Vive in un modulo unico e non in tre file perche' il requisito e' la
 * coerenza fra le tre tabelle: finche' le classi sono copiate, la terza
 * tabella resta indietro a ogni ritocco. Le tre differiscono ancora in
 * tutto il resto (virtualizzazione, resize, drag delle colonne): qui
 * sta solo il vestito.
 *
 * Le scelte che contano, rispetto a com'erano prima:
 *
 *  - Righe piu' basse. Lightning punta sulla densita': piu' record a
 *    schermo senza scroll.
 *  - Griglia leggera. I separatori erano `foreground/30`, cioe' grigio
 *    scuro su ogni colonna: a schermo pieno vinceva la griglia sul dato.
 *    Ora la linea forte e' solo quella sotto l'header, le verticali sono
 *    appena accennate.
 *  - Intestazioni in maiuscoletto spaziato, piu' piccole del contenuto:
 *    l'occhio le legge come etichette e non come dati.
 *  - Barra di accento a sinistra sulla riga sotto il cursore, che
 *    sostituisce il solo cambio di fondo nel dire "sei qui".
 */
export const LIGHTNING = {
  /** <thead> sticky. `stuck` aggiunge l'ombra quando il corpo scorre. */
  header:
    "sticky top-0 z-20 bg-card/95 backdrop-blur-md transition-shadow duration-150",
  headerStuck: "shadow-[0_12px_22px_-18px_rgb(15_23_42/0.42)]",

  /** <th>. La linea forte sotto l'header e' l'unico bordo marcato. */
  headCell:
    "h-10 border-b-2 border-b-navy/25 border-r border-r-border/60 bg-secondary/55 text-muted-foreground last:border-r-0",

  /** Etichetta dentro il <th>. */
  headLabel:
    "text-xs font-bold uppercase tracking-[0.055em] transition-colors hover:text-foreground",
  headLabelActive: "text-navy drop-shadow-sm",
  headLabelIdle: "text-muted-foreground",

  /**
   * <tr> del corpo. `group/row` serve alle azioni inline: sono figlie
   * di una cella diversa da quella su cui si passa il mouse, quindi il
   * solo `group-hover` di Tailwind non basterebbe senza un gruppo
   * nominato sulla riga.
   */
  row: "group/row cursor-pointer border-b border-border/55 transition-colors hover:bg-teal/10 data-[state=selected]:bg-info/10",

  /** <td> generica. */
  cell: "border-r border-border/45 last:border-r-0",

  /**
   * Fondo delle celle bloccate ai bordi.
   *
   * Devono essere opache, altrimenti le colonne che scorrono sotto si
   * vedono in trasparenza — ma un `bg-card` fisso le lascia bianche
   * mentre il resto della riga si colora al passaggio del mouse o in
   * selezione, e la riga sembra spezzata in tre. Qui ripetono gli stessi
   * fondi di `row`, agganciati al gruppo della riga.
   */
  cellSticky:
    "bg-card group-hover/row:bg-teal/10 group-data-[state=selected]/row:bg-info/10",

  /**
   * Prima cella (sticky a sinistra): porta anche la barra di accento che
   * si accende con la riga. E' un inset shadow e non un bordo, cosi' non
   * sposta di un pixel il contenuto quando compare.
   */
  cellLeader:
    "sticky left-0 z-10 transition-shadow group-hover/row:shadow-[inset_4px_0_0_0_var(--teal)] group-data-[state=selected]/row:shadow-[inset_4px_0_0_0_var(--info)]",

  /** Cella delle azioni (sticky a destra). */
  headActions:
    "sticky right-0 z-40 border-l border-l-border/80 bg-secondary text-center shadow-[-12px_0_20px_-16px_rgb(15_23_42/0.5)]",
  cellActions:
    "sticky right-0 z-20 border-l border-l-border/80 bg-card text-right shadow-[-12px_0_18px_-16px_rgb(15_23_42/0.55)] group-hover/row:bg-teal/10 group-data-[state=selected]/row:bg-info/10",
} as const

export type Density = "comoda" | "normale" | "densa"

/**
 * Padding verticale e corpo del testo per densita'. Rispetto ai valori
 * precedenti (py-4 / py-2.5 / py-1) ogni livello scende di un gradino:
 * "normale" e' la densita' di default e quella che cambia di piu'.
 */
export const LIGHTNING_DENSITY: Record<Density, string> = {
  comoda: "py-3.5 text-[14px]",
  normale: "py-2 text-sm",
  densa: "py-1 text-[13px]",
}

/**
 * Altezza stimata della riga per densita'. Serve al virtualizzatore
 * della tabella Lead: se diverge troppo dal reale, la scrollbar "salta"
 * mentre si scorre. Va tenuta allineata a LIGHTNING_DENSITY.
 */
export const LIGHTNING_ROW_HEIGHT: Record<Density, number> = {
  // padding + il contenuto piu' alto della cella (l'avatar a 36px in
  // "comoda", le icone di contatto rapido a 24px nelle altre due) + 1px
  // di bordo.
  comoda: 66,
  normale: 44,
  densa: 34,
}

export type Tone =
  | "success"
  | "info"
  | "warning"
  | "muted"
  | "teal"
  | "destructive"

const TONE_PILL: Record<Tone, string> = {
  success: "bg-success/12 text-success",
  info: "bg-info/12 text-info",
  warning: "bg-warning/15 text-warning",
  muted: "bg-muted text-muted-foreground",
  teal: "bg-teal/12 text-teal",
  destructive: "bg-destructive/12 text-destructive",
}

const TONE_DOT: Record<Tone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  muted: "bg-muted-foreground/50",
  teal: "bg-teal",
  destructive: "bg-destructive",
}

/**
 * Pastiglia di stato condivisa da tutte e tre le tabelle.
 *
 * Il pallino pieno non e' decorazione: sui toni chiari il solo fondo al
 * 12% e' poco distinguibile fra `info` e `teal` a colpo d'occhio, e per
 * chi non distingue i colori resta comunque l'etichetta. Il fondo tenue
 * con testo del colore pieno tiene il contrasto del testo sopra 4.5:1,
 * cosa che un fondo pieno con testo bianco non garantirebbe sui toni
 * chiari come `warning`.
 */
export function StatoPill({
  tone,
  children,
  className,
}: {
  tone: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold shadow-sm ring-1 ring-inset ring-current/10",
        TONE_PILL[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />
      <span className="truncate">{children}</span>
    </span>
  )
}

/**
 * Azioni inline della riga: icone che compaiono al passaggio del mouse,
 * seguite dal menu di overflow.
 *
 * Restano montate e cambiano solo opacita': smontarle al mouse-out
 * chiuderebbe il menu di overflow nell'istante in cui il cursore lo
 * raggiunge. Per la stessa ragione la visibilita' e' forzata anche con
 * il focus da tastiera e con il popup aperto — senza, l'azione
 * scomparirebbe proprio mentre la si usa.
 *
 * Dove non esiste un cursore che passa sopra (touch), le azioni restano
 * sempre visibili: legare l'unico accesso al menu di riga a un hover le
 * renderebbe irraggiungibili da tablet.
 */
export function RowInlineActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150",
        "group-hover/row:opacity-100 focus-within:opacity-100 has-data-[popup-open]:opacity-100",
        "[@media(hover:none)]:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  )
}
