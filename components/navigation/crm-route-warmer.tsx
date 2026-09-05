"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  buildClientiSearchParams,
  DEFAULT_CLIENTI_PARAMS,
  type ClientiListResponse,
} from "@/lib/clienti/api-types"
import { clientiKeys } from "@/lib/clienti/hooks"
import {
  buildCompitiSearchParams,
  buildKanbanDoneParams,
  buildKanbanOpenParams,
  DEFAULT_COMPITI_PARAMS,
  DEFAULT_KANBAN_FILTERS,
  type CompitiListResponse,
} from "@/lib/compiti/api-types"
import { compitiKeys } from "@/lib/compiti/hooks"
import {
  buildLeadsSearchParams,
  getInitialLeadsParams,
  type LeadListResponse,
  type LeadStats,
} from "@/lib/leads/api-types"
import { leadsKeys } from "@/lib/leads/hooks"
import {
  DEFAULT_CLIENTE_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  CLIENTE_COLUMNS,
  LEAD_COLUMNS,
  OPEN_TASK_STATI,
} from "@/lib/mock-data"
import { usePermissions } from "@/lib/permissions/provider"
import { warmLeadReferenceData } from "@/lib/tag-store"
import {
  LEADS_VIEW_COOKIE,
  type LeadViewPreferences,
  parseLeadViewPreferences,
} from "@/lib/leads/view-preferences"
import {
  CLIENTI_VIEW_COOKIE,
  type ClienteViewPreferences,
  parseClienteViewPreferences,
} from "@/lib/clienti/view-preferences"

type IdleHandle = { id: number; idle: boolean }
type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number
  cancelIdleCallback?: (id: number) => void
}

function readCookie(name: string) {
  const prefix = `${name}=`
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
}

function readLeadPreferenceColumns(owner: string) {
  const validColumnIds = new Set(LEAD_COLUMNS.map((column) => column.id))
  const fromLocalStorage = window.localStorage.getItem(
    `solair:leads:view:${owner}:v3`,
  )
  if (fromLocalStorage) {
    try {
      const parsed = JSON.parse(fromLocalStorage) as Partial<LeadViewPreferences>
      if (parsed.version === 3 && parsed.owner === owner) {
        const visibleCols = (parsed.visibleCols ?? []).filter((id) =>
          validColumnIds.has(id),
        )
        if (visibleCols.length) return visibleCols
      }
    } catch {
      window.localStorage.removeItem(`solair:leads:view:${owner}:v3`)
    }
  }

  return (
    parseLeadViewPreferences(
      readCookie(LEADS_VIEW_COOKIE),
      owner,
      validColumnIds,
    )?.visibleCols ?? DEFAULT_VISIBLE_COLUMNS
  )
}

function readClientePreferenceColumns(owner: string) {
  const validColumnIds = new Set(CLIENTE_COLUMNS.map((column) => column.id))
  const fromLocalStorage = window.localStorage.getItem(
    `solair:clienti:view:${owner}:v2`,
  )
  if (fromLocalStorage) {
    try {
      const parsed = JSON.parse(fromLocalStorage) as Partial<ClienteViewPreferences>
      if (parsed.version === 2 && parsed.owner === owner) {
        const visibleCols = (parsed.visibleCols ?? []).filter((id) =>
          validColumnIds.has(id),
        )
        if (visibleCols.length) return visibleCols
      }
    } catch {
      window.localStorage.removeItem(`solair:clienti:view:${owner}:v2`)
    }
  }

  return (
    parseClienteViewPreferences(
      readCookie(CLIENTI_VIEW_COOKIE),
      owner,
      validColumnIds,
    )?.visibleCols ?? DEFAULT_CLIENTE_COLUMNS
  )
}

function scheduleIdle(callback: () => void): IdleHandle {
  const idleWindow = window as IdleWindow
  if (idleWindow.requestIdleCallback) {
    return {
      id: idleWindow.requestIdleCallback(callback, { timeout: 2_500 }),
      idle: true,
    }
  }
  return { id: window.setTimeout(callback, 1_200), idle: false }
}

function cancelIdle(handle: IdleHandle) {
  const idleWindow = window as IdleWindow
  if (handle.idle && idleWindow.cancelIdleCallback) {
    idleWindow.cancelIdleCallback(handle.id)
    return
  }
  window.clearTimeout(handle.id)
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Warm-up non riuscito: ${url}`)
  return (await res.json()) as T
}

export function CrmRouteWarmer() {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const permissions = usePermissions()
  const canReadLeads = permissions.canPage("lead")
  const canReadClienti = permissions.canPage("clienti")
  const canReadCompiti = permissions.canPage("compiti")
  const subject = permissions.snapshot.subject
  const preferenceOwner = subject.userId ?? subject.authUserId ?? "anonymous"

  useEffect(() => {
    let cancelled = false

    const handle = scheduleIdle(() => {
      void (async () => {
        if (cancelled) return

        if (canReadLeads && !pathname.startsWith("/leads")) {
          router.prefetch("/leads")
          void warmLeadReferenceData()
          const leadParams = {
            ...getInitialLeadsParams(),
            fields: readLeadPreferenceColumns(preferenceOwner) as unknown as string[],
          }
          const leadSp = buildLeadsSearchParams(leadParams).toString()
          await queryClient.prefetchQuery({
            queryKey: leadsKeys.list(leadSp),
            queryFn: ({ signal }) =>
              readJson<LeadListResponse>(`/api/leads?${leadSp}`, signal),
            staleTime: 60_000,
          }).catch(() => undefined)
          if (cancelled) return
          await delay(350)
          await queryClient.prefetchQuery({
            queryKey: leadsKeys.stats(),
            queryFn: ({ signal }) => readJson<LeadStats>("/api/leads/stats", signal),
            staleTime: 60_000,
          }).catch(() => undefined)
        }

        if (cancelled) return
        await delay(350)

        if (canReadClienti && !pathname.startsWith("/clienti")) {
          router.prefetch("/clienti")
          const clientiParams = {
            ...DEFAULT_CLIENTI_PARAMS,
            fields: readClientePreferenceColumns(preferenceOwner) as unknown as string[],
          }
          const clientiSp = buildClientiSearchParams(clientiParams).toString()
          await queryClient.prefetchQuery({
            queryKey: clientiKeys.list(clientiSp),
            queryFn: ({ signal }) =>
              readJson<ClientiListResponse>(`/api/clienti?${clientiSp}`, signal),
            staleTime: 60_000,
          }).catch(() => undefined)
        }

        if (cancelled) return
        await delay(700)

        if (canReadCompiti && !pathname.startsWith("/compiti")) {
          router.prefetch("/compiti")
          const compitiParams = DEFAULT_COMPITI_PARAMS
          const kanbanOpenParams = buildKanbanOpenParams(DEFAULT_KANBAN_FILTERS, [
            ...OPEN_TASK_STATI,
          ])
          const kanbanDoneParams = buildKanbanDoneParams(DEFAULT_KANBAN_FILTERS)
          for (const params of [compitiParams, kanbanOpenParams, kanbanDoneParams]) {
            if (cancelled) return
            const sp = buildCompitiSearchParams(params).toString()
            await queryClient.prefetchQuery({
              queryKey: compitiKeys.list(sp),
              queryFn: ({ signal }) =>
                readJson<CompitiListResponse>(`/api/compiti?${sp}`, signal),
              staleTime: 60_000,
            }).catch(() => undefined)
            await delay(250)
          }
        }
      })()
    })

    return () => {
      cancelled = true
      cancelIdle(handle)
    }
  }, [
    canReadClienti,
    canReadCompiti,
    canReadLeads,
    pathname,
    preferenceOwner,
    queryClient,
    router,
  ])

  return null
}
