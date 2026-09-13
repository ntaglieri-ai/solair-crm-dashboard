/**
 * Catalogo delle app AI dentro SolairAI.
 *
 * Aggiungere una app nuova = aggiungere una voce qui + la sua route in
 * app/(dashboard)/solair-ai/<slug>/. Il drawer si aggiorna da solo.
 *
 * tone/glow seguono lo stesso registro colore di CRM_SETTINGS_GROUPS
 * (lib/crm-settings/catalog.ts), cosi' le card restano coerenti tra i due
 * pannelli anche se sono file separati.
 */
export type SolairAiAppDef = {
  slug: string
  nome: string
  descrizione: string
  /** Riga in maiuscoletto sotto la card. */
  meta: string
  /** Gradiente del badge icona. */
  tone: string
  /** Ombra del badge icona. */
  glow: string
  /** "popup": si apre come finestra flottante senza cambiare pagina.
   *  "page": naviga sulla sua route in app/(dashboard)/solair-ai/<slug>/. */
  kind: "popup" | "page"
  /** Chiave permessi da requirePage/canAction, se diversa da "solair_ai". */
  pageKey?: string
}

export const SOLAIR_AI_APPS: SolairAiAppDef[] = [
  {
    slug: "assistente",
    nome: "Assistente Documenti",
    descrizione:
      "Legge i documenti su Nextcloud, li abbina a Lead/Cliente/Installatore e propone i campi da compilare o aggiornare.",
    meta: "Assistente AI",
    tone: "from-[#6f42c1] to-[#9f7aea]",
    glow: "shadow-[0_8px_18px_rgb(111_66_193/22%)]",
    kind: "popup",
  },
]
