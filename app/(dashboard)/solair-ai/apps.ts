/**
 * Catalogo delle app AI dentro SolairAI.
 *
 * Aggiungere una app nuova = aggiungere una voce qui + la sua route in
 * app/(dashboard)/solair-ai/<slug>/. La hub page si aggiorna da sola.
 */
export type SolairAiAppDef = {
  slug: string
  nome: string
  descrizione: string
  /** Chiave permessi da requirePage/canAction, se diversa da "solair_ai". */
  pageKey?: string
}

export const SOLAIR_AI_APPS: SolairAiAppDef[] = [
  {
    slug: "assistente",
    nome: "Assistente Documenti",
    descrizione:
      "Legge i documenti su Nextcloud, li abbina a Lead/Cliente/Installatore e propone i campi da compilare o aggiornare.",
  },
]
