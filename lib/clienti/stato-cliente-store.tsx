"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export type StatoClienteOption = {
  id: string
  valore: string
  tono: "muted" | "success" | "warning" | "info" | "teal" | "destructive"
  ordinamento: number
}

export const statoClienteKeys = {
  all: ["stato-cliente"] as const,
}

/**
 * Lista configurabile di Stato Cliente (report Vito cap. 5 + richiesta
 * Nando 04/09: "solo quelli Zoho e la possibilita' di crearne"). Sostituisce
 * STATO_CLIENTE_VALUES/STATO_CLIENTE_TONE, che restavano un elenco fisso
 * risolvibile solo con un deploy.
 */
export function useStatoClienteQuery() {
  return useQuery({
    queryKey: statoClienteKeys.all,
    queryFn: async () => {
      const res = await fetch("/api/crm-settings/stato-cliente")
      if (!res.ok) throw new Error("Errore nel caricamento degli stati cliente")
      const body = (await res.json()) as { stati: StatoClienteOption[] }
      return body.stati
    },
    // Lista di configurazione, cambia raramente: nessun bisogno di
    // rifetchare a ogni focus finestra come per i dati clienti.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useCreateStatoCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (valore: string) => {
      const res = await fetch("/api/crm-settings/stato-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valore }),
      })
      const body = (await res.json().catch(() => null)) as { stato?: StatoClienteOption; error?: string } | null
      if (!res.ok) throw new Error(body?.error ?? "Creazione stato non riuscita")
      return body!.stato!
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: statoClienteKeys.all })
    },
  })
}
