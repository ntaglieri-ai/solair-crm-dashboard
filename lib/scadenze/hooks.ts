"use client"

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import type { ScadenzaRecord } from "@/lib/scadenze/repository"
import {
  type ScadenzeListParams,
  type ScadenzeListResponse,
  buildScadenzeSearchParams,
} from "@/lib/scadenze/api-types"

export const scadenzeKeys = {
  all: ["scadenze"] as const,
  lists: () => [...scadenzeKeys.all, "list"] as const,
  list: (sp: string) => [...scadenzeKeys.lists(), sp] as const,
  referenceData: () => [...scadenzeKeys.all, "reference-data"] as const,
}

export interface ScadenzaProprietario {
  id: string
  nome: string
}

export interface ScadenzeReferenceData {
  proprietari: ScadenzaProprietario[]
  tags: string[]
}

// Dati di riferimento (proprietari reali da `utenti` + tag distinti già
// presenti in tabella, per l'autocomplete) — stesso pattern di
// lib/compiti/hooks.ts.
export function useScadenzeReferenceData() {
  return useQuery({
    queryKey: scadenzeKeys.referenceData(),
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/scadenze/reference-data", { signal })
      if (!res.ok) throw new Error("Errore nel caricamento dei riferimenti")
      return (await res.json()) as ScadenzeReferenceData
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

export class BulkOperationError extends Error {
  constructor(
    public failed: number,
    public total: number,
  ) {
    super(`${failed} di ${total} operazioni non riuscite`)
    this.name = "BulkOperationError"
  }
}

function countFailures(results: PromiseSettledResult<Response>[]): number {
  return results.filter((r) => r.status === "rejected" || !r.value.ok).length
}

// Lista paginata — keepPreviousData per transizioni fluide tra pagine/filtri.
export function useScadenzeQuery(
  params: ScadenzeListParams,
  initial?: { sp: string; data: ScadenzeListResponse },
) {
  const sp = buildScadenzeSearchParams(params).toString()
  const hasInitial = !!initial && initial.sp === sp
  return useQuery({
    queryKey: scadenzeKeys.list(sp),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/scadenze?${sp}`, { signal })
      if (!res.ok) throw new Error("Errore nel caricamento delle scadenze")
      return (await res.json()) as ScadenzeListResponse
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    initialData: hasInitial ? initial!.data : undefined,
    initialDataUpdatedAt: hasInitial ? Date.now() : undefined,
    refetchOnMount: hasInitial ? false : undefined,
  })
}

type ListSnapshot = [readonly unknown[], ScadenzeListResponse | undefined][]

function mapListRows(
  qc: ReturnType<typeof useQueryClient>,
  updater: (rows: ScadenzaRecord[]) => ScadenzaRecord[],
): ListSnapshot {
  const snapshots = qc.getQueriesData<ScadenzeListResponse>({
    queryKey: scadenzeKeys.lists(),
  })
  qc.setQueriesData<ScadenzeListResponse>(
    { queryKey: scadenzeKeys.lists() },
    (old) => (old ? { ...old, rows: updater(old.rows) } : old),
  )
  return snapshots
}

function restore(qc: ReturnType<typeof useQueryClient>, snapshots?: ListSnapshot) {
  snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
}

// Elimina singola scadenza (optimistic).
export function useDeleteScadenza() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/scadenze/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Eliminazione non riuscita")
      return (await res.json()) as { removed: boolean }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: scadenzeKeys.lists() })
      const snapshots = mapListRows(qc, (rows) => rows.filter((r) => r.id !== id))
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: scadenzeKeys.lists() }),
  })
}

// Elimina N scadenze in parallelo.
export function useDeleteScadenze() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/scadenze/${id}`, { method: "DELETE" })),
      )
      const failed = countFailures(results)
      if (failed > 0) throw new BulkOperationError(failed, ids.length)
      return { removed: ids.length }
    },
    onMutate: async (ids) => {
      const idSet = new Set(ids)
      await qc.cancelQueries({ queryKey: scadenzeKeys.lists() })
      const snapshots = mapListRows(qc, (rows) => rows.filter((r) => !idSet.has(r.id)))
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: scadenzeKeys.lists() }),
  })
}

// Aggiorna lo stesso campo su N scadenze in parallelo (bulk transfer proprietario).
export async function bulkUpdateScadenze(
  ids: string[],
  patch: { proprietario_id: string | null },
): Promise<void> {
  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(`/api/scadenze/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    ),
  )
  const failed = countFailures(results)
  if (failed > 0) throw new BulkOperationError(failed, ids.length)
}
