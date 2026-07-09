"use client"

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import {
  type InstallatoriListParams,
  type InstallatoriListResponse,
  buildInstallatoriSearchParams,
} from "@/lib/installatori/api-types"

export const installatoriKeys = {
  all: ["installatori"] as const,
  lists: () => [...installatoriKeys.all, "list"] as const,
  list: (sp: string) => [...installatoriKeys.lists(), sp] as const,
  referenceData: () => [...installatoriKeys.all, "reference-data"] as const,
}

export interface InstallatoreProprietario {
  id: string
  nome: string
}

export interface InstallatoriReferenceData {
  proprietari: InstallatoreProprietario[]
  tags: string[]
}

// Dati di riferimento (proprietari reali da `utenti` + tag distinti già
// presenti in tabella, per l'autocomplete) — stesso pattern di
// lib/compiti/hooks.ts.
export function useInstallatoriReferenceData() {
  return useQuery({
    queryKey: installatoriKeys.referenceData(),
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/installatori/reference-data", { signal })
      if (!res.ok) throw new Error("Errore nel caricamento dei riferimenti")
      return (await res.json()) as InstallatoriReferenceData
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
export function useInstallatoriQuery(
  params: InstallatoriListParams,
  initial?: { sp: string; data: InstallatoriListResponse },
) {
  const sp = buildInstallatoriSearchParams(params).toString()
  const hasInitial = !!initial && initial.sp === sp
  return useQuery({
    queryKey: installatoriKeys.list(sp),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/installatori?${sp}`, { signal })
      if (!res.ok) throw new Error("Errore nel caricamento degli installatori")
      return (await res.json()) as InstallatoriListResponse
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    initialData: hasInitial ? initial!.data : undefined,
    initialDataUpdatedAt: hasInitial ? Date.now() : undefined,
    refetchOnMount: hasInitial ? false : undefined,
  })
}

type ListSnapshot = [readonly unknown[], InstallatoriListResponse | undefined][]

function mapListRows(
  qc: ReturnType<typeof useQueryClient>,
  updater: (rows: InstallatoreRecord[]) => InstallatoreRecord[],
): ListSnapshot {
  const snapshots = qc.getQueriesData<InstallatoriListResponse>({
    queryKey: installatoriKeys.lists(),
  })
  qc.setQueriesData<InstallatoriListResponse>(
    { queryKey: installatoriKeys.lists() },
    (old) => (old ? { ...old, rows: updater(old.rows) } : old),
  )
  return snapshots
}

function restore(qc: ReturnType<typeof useQueryClient>, snapshots?: ListSnapshot) {
  snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
}

// Elimina singolo installatore (optimistic).
export function useDeleteInstallatore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/installatori/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Eliminazione non riuscita")
      return (await res.json()) as { removed: boolean }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: installatoriKeys.lists() })
      const snapshots = mapListRows(qc, (rows) => rows.filter((r) => r.id !== id))
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: installatoriKeys.lists() }),
  })
}

// Elimina N installatori in parallelo.
export function useDeleteInstallatori() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/installatori/${id}`, { method: "DELETE" })),
      )
      const failed = countFailures(results)
      if (failed > 0) throw new BulkOperationError(failed, ids.length)
      return { removed: ids.length }
    },
    onMutate: async (ids) => {
      const idSet = new Set(ids)
      await qc.cancelQueries({ queryKey: installatoriKeys.lists() })
      const snapshots = mapListRows(qc, (rows) => rows.filter((r) => !idSet.has(r.id)))
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: installatoriKeys.lists() }),
  })
}

// Aggiorna lo stesso campo su N installatori in parallelo (bulk transfer proprietario).
export async function bulkUpdateInstallatori(
  ids: string[],
  patch: { proprietario_id: string | null },
): Promise<void> {
  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(`/api/installatori/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    ),
  )
  const failed = countFailures(results)
  if (failed > 0) throw new BulkOperationError(failed, ids.length)
}
