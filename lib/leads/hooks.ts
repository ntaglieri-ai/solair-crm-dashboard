"use client"

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import type { Lead } from "@/lib/mock-data"
import {
  type LeadListParams,
  type LeadListResponse,
  type LeadStats,
  type LeadListItem,
  buildLeadsSearchParams,
} from "@/lib/leads/api-types"
import type { BulkField } from "@/lib/leads/repository"

// ----------------------------------------------------------------------------
// Query keys
// ----------------------------------------------------------------------------
export const leadsKeys = {
  all: ["leads"] as const,
  lists: () => [...leadsKeys.all, "list"] as const,
  list: (sp: string) => [...leadsKeys.lists(), sp] as const,
  stats: () => [...leadsKeys.all, "stats"] as const,
}

// ----------------------------------------------------------------------------
// Lista paginata (server-side) — keepPreviousData per transizioni fluide
// ----------------------------------------------------------------------------
export function useLeadsQuery(
  params: LeadListParams,
  initial?: { sp: string; data: LeadListResponse },
) {
  const sp = buildLeadsSearchParams(params).toString()
  // initialData solo quando la chiave coincide con il prefetch server-side,
  // così non "perde" sulle altre pagine/filtri.
  const hasInitial = !!initial && initial.sp === sp
  return useQuery({
    queryKey: leadsKeys.list(sp),
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/leads?${sp}`, { signal })
      if (!res.ok) throw new Error("Errore nel caricamento dei lead")
      return (await res.json()) as LeadListResponse
    },
    // Mantiene la pagina precedente visibile durante filtri/paginazione
    // (nessuno svuotamento della tabella tra una query e l'altra).
    placeholderData: keepPreviousData,
    // I dati restano "freschi" 60s: niente refetch ridondanti col viavai
    // di decine di operatori sulla stessa lista.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    initialData: hasInitial ? initial!.data : undefined,
    // Quando usiamo il prefetch server-side, lo marchiamo come appena
    // aggiornato così React Query NON rilancia un fetch subito dopo il mount.
    initialDataUpdatedAt: hasInitial ? Date.now() : undefined,
    refetchOnMount: hasInitial ? false : undefined,
  })
}

// ----------------------------------------------------------------------------
// Statistiche header/dashboard — polling leggero (sostituto del realtime DB
// per conteggi critici). 20s di intervallo, solo conteggi aggregati.
// ----------------------------------------------------------------------------
export function useLeadStats(initialData?: LeadStats) {
  return useQuery({
    queryKey: leadsKeys.stats(),
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/leads/stats", { signal })
      if (!res.ok) throw new Error("Errore nel caricamento delle statistiche")
      return (await res.json()) as LeadStats
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    initialData,
  })
}

// ----------------------------------------------------------------------------
// Helper ottimistici condivisi
// ----------------------------------------------------------------------------
type ListSnapshot = [readonly unknown[], LeadListResponse | undefined][]

function mapListRows(
  qc: ReturnType<typeof useQueryClient>,
  updater: (rows: LeadListItem[]) => LeadListItem[],
): ListSnapshot {
  const snapshots = qc.getQueriesData<LeadListResponse>({
    queryKey: leadsKeys.lists(),
  })
  qc.setQueriesData<LeadListResponse>(
    { queryKey: leadsKeys.lists() },
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

// ----------------------------------------------------------------------------
// Mutazione: aggiorna un lead (optimistic)
// ----------------------------------------------------------------------------
export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<Lead> }) => {
      const res = await fetch(`/api/leads/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.patch),
      })
      if (!res.ok) throw new Error("Aggiornamento non riuscito")
      return (await res.json()) as LeadListItem
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: leadsKeys.lists() })
      const snapshots = mapListRows(qc, (rows) =>
        rows.map((r) => (r.id === vars.id ? { ...r, ...vars.patch } : r)),
      )
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: leadsKeys.lists() })
      qc.invalidateQueries({ queryKey: leadsKeys.stats() })
    },
  })
}

// ----------------------------------------------------------------------------
// Mutazione: elimina un lead (optimistic)
// ----------------------------------------------------------------------------
export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Eliminazione non riuscita")
      return (await res.json()) as { removed: number }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: leadsKeys.lists() })
      const snapshots = mapListRows(qc, (rows) =>
        rows.filter((r) => r.id !== id),
      )
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: leadsKeys.lists() })
      qc.invalidateQueries({ queryKey: leadsKeys.stats() })
    },
  })
}

// ----------------------------------------------------------------------------
// Mutazione: crea un lead
// ----------------------------------------------------------------------------
export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lead: Lead) => {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      })
      if (!res.ok) throw new Error("Creazione non riuscita")
      return (await res.json()) as LeadListItem
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: leadsKeys.lists() })
      qc.invalidateQueries({ queryKey: leadsKeys.stats() })
    },
  })
}

// ----------------------------------------------------------------------------
// Mutazione: azioni di massa (delete/convert/transfer/update)
// ----------------------------------------------------------------------------
export type BulkAction =
  | { action: "delete"; ids: string[] }
  | { action: "convert"; ids: string[] }
  | { action: "transfer"; ids: string[]; value: string }
  | { action: "update"; ids: string[]; field: BulkField; value: string }

export function useBulkLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BulkAction) => {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Operazione di massa non riuscita")
      return (await res.json()) as { affected: number }
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: leadsKeys.lists() })
      const ids = new Set(payload.ids)
      const snapshots = mapListRows(qc, (rows) => {
        if (payload.action === "delete") return rows.filter((r) => !ids.has(r.id))
        return rows.map((r) => {
          if (!ids.has(r.id)) return r
          if (payload.action === "convert")
            return { ...r, "Stato Lead": "Convertito" as Lead["Stato Lead"] }
          if (payload.action === "transfer")
            return { ...r, "Lead Proprietario": payload.value }
          if (payload.action === "update" && payload.field === "Tag") {
            const tags = r.Tag ?? []
            return {
              ...r,
              Tag: tags.includes(payload.value) ? tags : [...tags, payload.value],
            }
          }
          if (payload.action === "update")
            return { ...r, [payload.field]: payload.value }
          return r
        })
      })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => restore(qc, ctx?.snapshots),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: leadsKeys.lists() })
      qc.invalidateQueries({ queryKey: leadsKeys.stats() })
    },
  })
}

// ----------------------------------------------------------------------------
// Export CSV: scarica TUTTE le righe corrispondenti ai filtri (fields="*").
// ----------------------------------------------------------------------------
export async function fetchLeadsForExport(
  params: LeadListParams,
): Promise<LeadListItem[]> {
  const sp = buildLeadsSearchParams({
    ...params,
    page: 1,
    pageSize: 200,
    fields: ["*"],
  })
  const res = await fetch(`/api/leads?${sp.toString()}`)
  if (!res.ok) throw new Error("Esportazione non riuscita")
  const data = (await res.json()) as LeadListResponse
  return data.rows
}
