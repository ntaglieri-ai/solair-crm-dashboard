/**
 * Tipi condivisi della Bacheca aziendale, in un modulo senza dipendenze server
 * cosi' che il widget client e le route API possano importarli entrambi.
 */

export const BACHECA_LIVELLI = ["info", "attenzione", "urgente"] as const

export type BachecaLivello = (typeof BACHECA_LIVELLI)[number]

export type BachecaMessaggio = {
  id: string
  titolo: string
  testo: string
  livello: BachecaLivello
  pin: boolean
  autore: string | null
  createdAt: string
}

export function isBachecaLivello(value: unknown): value is BachecaLivello {
  return (
    typeof value === "string" &&
    (BACHECA_LIVELLI as readonly string[]).includes(value)
  )
}

/** Chiave permessi_ui che abilita "+ Nuovo annuncio" ed "Elimina". */
export const BACHECA_MANAGE_ACTION = "widget.bacheca.gestisci"
