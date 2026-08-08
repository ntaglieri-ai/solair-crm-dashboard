"use client"

import { useQuery } from "@tanstack/react-query"

// Stato del gate dei tre documenti obbligatori (spec FASE 1.3) letto da
// GET /api/leads/[id]/documenti-obbligatori. Serve solo a guidare la UI: il
// controllo che conta davvero e' quello server-side in POST .../converti.

export type StatoDocumentiObbligatori = {
  count: number
  richiesti: number
  completo: boolean
  folderPath: string
}

export const documentiObbligatoriKeys = {
  lead: (leadId: string) => ["documenti-obbligatori", leadId] as const,
}

/**
 * Evento con cui la sezione allegati avvisa l'intestazione del Lead che il
 * conteggio e' cambiato: i due componenti sono su rami diversi della pagina e
 * non condividono props (stessa soluzione gia' usata per
 * "solair:open-task-dialog" in lead-detail-content.tsx).
 */
export const DOCUMENTI_OBBLIGATORI_CHANGED = "solair:documenti-obbligatori-changed"

export function notificaDocumentiObbligatoriCambiati() {
  window.dispatchEvent(new Event(DOCUMENTI_OBBLIGATORI_CHANGED))
}

export function useDocumentiObbligatori(leadId: string) {
  return useQuery({
    queryKey: documentiObbligatoriKeys.lead(leadId),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/leads/${leadId}/documenti-obbligatori`, {
        signal,
        cache: "no-store",
      })
      const payload = (await res.json().catch(() => null)) as
        | (Partial<StatoDocumentiObbligatori> & { error?: string })
        | null
      if (!res.ok) {
        throw new Error(payload?.error ?? "Verifica documenti obbligatori non riuscita")
      }
      return payload as StatoDocumentiObbligatori
    },
    // Il conteggio arriva da Nextcloud (PROPFIND): non lo si rilegge a ogni
    // focus, ma solo su richiesta esplicita dopo un upload/eliminazione.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
