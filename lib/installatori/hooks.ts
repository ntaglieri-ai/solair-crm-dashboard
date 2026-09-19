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

export interface InstallatoreTagOption {
  id: string
  name: string
  color: string
}

export interface InstallatoriReferenceData {
  owners: InstallatoreProprietario[]
  tags: InstallatoreTagOption[]
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

// --- Export ----------------------------------------------------------------
// Gemelli di fetchClientiForExport / fetchClientiByIdsForExport. Passano dal
// server e non dalle righe gia' in pagina: e' quello che fa finire l'export
// nell'audit log e che alza il tetto oltre la pagina corrente.

export interface InstallatoriExportResult {
  rows: InstallatoreRecord[]
  total: number
  truncated: boolean
  limit: number
}

export async function fetchInstallatoriForExport(
  params: InstallatoriListParams,
): Promise<InstallatoriExportResult> {
  const sp = buildInstallatoriSearchParams({ ...params, page: 1 })
  const res = await fetch(`/api/installatori/export?${sp.toString()}`)
  if (!res.ok) throw new Error(await messaggioErroreExportInstallatori(res))
  return (await res.json()) as InstallatoriExportResult
}

/** Export di una selezione: gli id vanno al server (e finiscono nell'audit). */
export async function fetchInstallatoriByIdsForExport(
  ids: string[],
): Promise<InstallatoriExportResult> {
  const sp = new URLSearchParams({ ids: ids.join(",") })
  const res = await fetch(`/api/installatori/export?${sp.toString()}`)
  if (!res.ok) throw new Error(await messaggioErroreExportInstallatori(res))
  return (await res.json()) as InstallatoriExportResult
}

/**
 * Il messaggio del server ha la precedenza: un 403 per permesso di export
 * mancante spiega cosa chiedere all'amministratore, un generico "non riuscita"
 * lascerebbe a indovinare.
 */
async function messaggioErroreExportInstallatori(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error || "Esportazione non riuscita"
}
