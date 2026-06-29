"use client"

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import type { ClienteRecord } from "@/lib/mock-data"
import {
  type ClientiListParams,
  type ClientiListResponse,
  type ClientiListItem,
  buildClientiSearchParams,
} from "@/lib/clienti/api-types"

export const clientiKeys = {
  all: ["clienti"] as const,
  lists: () => [...clientiKeys.all, "list"] as const,
  list: (sp: string) => [...clientiKeys.lists(), sp] as const,
}

// Lista paginata — keepPreviousData per transizioni fluide tra pagine/filtri.
export function useClientiQuery(
  params: ClientiListParams,
  initial?: { sp: string; data: ClientiListResponse },
) {
  const sp = buildClientiSearchParams(params).toString()
  const hasInitial = !!initial && initial.sp === sp
  return useQuery({
    queryKey: clientiKeys.list(sp),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/clienti?${sp}`, { signal })
      if (!res.ok) throw new Error("Errore nel caricamento dei clienti")
      return (await res.json()) as ClientiListResponse
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
type ListSnapshot = [readonly unknown[], ClientiListResponse | undefined][]

function mapListRows(
  qc: ReturnType<typeof useQueryClient>,
  updater: (rows: ClientiListItem[]) => ClientiListItem[],
): ListSnapshot {
  const snapshots = qc.getQueriesData<ClientiListResponse>({
    queryKey: clientiKeys.lists(),
  })
  qc.setQueriesData<ClientiListResponse>(
    { queryKey: clientiKeys.lists() },
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

// Aggiorna singolo cliente (optimistic).
export function useUpdateCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<ClienteRecord> }) => {
      const res = await fetch(`/api/clienti/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.patch),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      return (await res.json()) as ClientiListItem
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: clientiKeys.lists() })
      const snapshots = mapListRows(qc, (rows) =>
        rows.map((r) => (r.id === vars.id ? { ...r, ...vars.patch } : r)),
      )
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: clientiKeys.lists() }),
  })
}

// Elimina singolo cliente (optimistic).
export function useDeleteCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clienti/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Eliminazione non riuscita")
      return (await res.json()) as { removed: number }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: clientiKeys.lists() })
      const snapshots = mapListRows(qc, (rows) =>
        rows.filter((r) => r.id !== id),
      )
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: clientiKeys.lists() }),
  })
}

// Elimina N clienti in parallelo (ottimizzato per bulk delete).
export function useDeleteClienti() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => fetch(`/api/clienti/${id}`, { method: "DELETE" })),
      )
      return { removed: ids.length }
    },
    onMutate: async (ids) => {
      const idSet = new Set(ids)
      await qc.cancelQueries({ queryKey: clientiKeys.lists() })
      const snapshots = mapListRows(qc, (rows) =>
        rows.filter((r) => !idSet.has(r.id)),
      )
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => qc.invalidateQueries({ queryKey: clientiKeys.lists() }),
  })
}

// Crea nuovo cliente.
export function useCreateCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cliente: Partial<ClienteRecord>) => {
      const res = await fetch("/api/clienti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cliente),
      })
      if (!res.ok) throw new Error("Creazione non riuscita")
      return (await res.json()) as ClientiListItem
    },
    onSettled: () => qc.invalidateQueries({ queryKey: clientiKeys.lists() }),
  })
}

// Aggiorna lo stesso campo su N clienti in parallelo (bulk transfer/update).
export async function bulkUpdateClienti(
  ids: string[],
  patch: Partial<ClienteRecord>,
): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      fetch(`/api/clienti/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    ),
  )
}

// Export CSV: fetch la pagina corrente con tutti i filtri attivi.
export async function fetchClientiForExport(
  params: ClientiListParams,
): Promise<ClientiListItem[]> {
  const sp = buildClientiSearchParams({ ...params, page: 1, pageSize: 200 })
  const res = await fetch(`/api/clienti?${sp.toString()}`)
  if (!res.ok) throw new Error("Esportazione non riuscita")
  const data = (await res.json()) as ClientiListResponse
  return data.rows
}
