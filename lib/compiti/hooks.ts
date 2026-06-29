"use client"

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import type { Compito, StatoCompito } from "@/lib/mock-data"
import {
  type CompitiListParams,
  type CompitiListResponse,
  type CompitiListItem,
  buildCompitiSearchParams,
} from "@/lib/compiti/api-types"

export const compitiKeys = {
  all: ["compiti"] as const,
  lists: () => [...compitiKeys.all, "list"] as const,
  list: (sp: string) => [...compitiKeys.lists(), sp] as const,
}

// Lista paginata — keepPreviousData per transizioni fluide tra pagine/filtri.
export function useCompitiQuery(
  params: CompitiListParams,
  initial?: { sp: string; data: CompitiListResponse },
) {
  const sp = buildCompitiSearchParams(params).toString()
  const hasInitial = !!initial && initial.sp === sp
  return useQuery({
    queryKey: compitiKeys.list(sp),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/compiti?${sp}`, { signal })
      if (!res.ok) throw new Error("Errore nel caricamento dei compiti")
      return (await res.json()) as CompitiListResponse
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    initialData: hasInitial ? initial!.data : undefined,
    initialDataUpdatedAt: hasInitial ? Date.now() : undefined,
    refetchOnMount: hasInitial ? false : undefined,
  })
}

// --- Helper ottimistici ---
type ListSnapshot = [readonly unknown[], CompitiListResponse | undefined][]

function mapListRows(
  qc: ReturnType<typeof useQueryClient>,
  updater: (rows: CompitiListItem[]) => CompitiListItem[],
): ListSnapshot {
  const snapshots = qc.getQueriesData<CompitiListResponse>({
    queryKey: compitiKeys.lists(),
  })
  qc.setQueriesData<CompitiListResponse>(
    { queryKey: compitiKeys.lists() },
    (old) => (old ? { ...old, rows: updater(old.rows) } : old),
  )
  return snapshots
}

function restore(
  qc: ReturnType<typeof useQueryClient>,
  snapshots?: ListSnapshot,
) {
  snapshots?.forEach(([key, data]) => qc.setQueryData(key, data))
}

// Aggiorna singolo compito (optimistic).
export function useUpdateCompito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<Compito> }) => {
      const res = await fetch(`/api/compiti/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.patch),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      return (await res.json()) as CompitiListItem
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: compitiKeys.lists() })
      const snapshots = mapListRows(qc, (rows) =>
        rows.map((r) => (r.id === vars.id ? { ...r, ...vars.patch } : r)),
      )
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: compitiKeys.lists() }),
  })
}

// Completa un singolo compito (Stato → "Completato", ottimistico).
export function useCompleteCompito() {
  const updateCompito = useUpdateCompito()
  return {
    mutate: (id: string) =>
      updateCompito.mutate({
        id,
        patch: { Stato: "Completato" as StatoCompito },
      }),
    isPending: updateCompito.isPending,
  }
}

// Elimina singolo compito (optimistic).
export function useDeleteCompito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/compiti/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Eliminazione non riuscita")
      return (await res.json()) as { removed: number }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: compitiKeys.lists() })
      const snapshots = mapListRows(qc, (rows) =>
        rows.filter((r) => r.id !== id),
      )
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: compitiKeys.lists() }),
  })
}

// Elimina N compiti in parallelo.
export function useDeleteCompiti() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => fetch(`/api/compiti/${id}`, { method: "DELETE" })),
      )
      return { removed: ids.length }
    },
    onMutate: async (ids) => {
      const idSet = new Set(ids)
      await qc.cancelQueries({ queryKey: compitiKeys.lists() })
      const snapshots = mapListRows(qc, (rows) =>
        rows.filter((r) => !idSet.has(r.id)),
      )
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: compitiKeys.lists() }),
  })
}

// Crea nuovo compito.
export function useCreateCompito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (compito: Partial<Compito>) => {
      const res = await fetch("/api/compiti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compito),
      })
      if (!res.ok) throw new Error("Creazione non riuscita")
      return (await res.json()) as CompitiListItem
    },
    onSettled: () => qc.invalidateQueries({ queryKey: compitiKeys.lists() }),
  })
}

// Aggiorna lo stesso campo su N compiti in parallelo (bulk transfer/stato).
export async function bulkUpdateCompiti(
  ids: string[],
  patch: Partial<Compito>,
): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      fetch(`/api/compiti/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    ),
  )
}
