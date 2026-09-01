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
  buildLeadsSearchParams,
  getInitialLeadsParams,
  type LeadListResponse,
  type LeadStats,
} from "@/lib/leads/api-types"
import { leadsKeys } from "@/lib/leads/hooks"
import {
  DEFAULT_VISIBLE_COLUMNS,
  LEAD_COLUMNS,
} from "@/lib/mock-data"
import { usePermissions } from "@/lib/permissions/provider"
import { warmLeadReferenceData } from "@/lib/tag-store"
import {
  LEADS_VIEW_COOKIE,
  type LeadViewPreferences,
  parseLeadViewPreferences,
} from "@/lib/leads/view-preferences"

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
  const subject = permissions.snapshot.subject
  const preferenceOwner = subject.userId ?? subject.authUserId ?? "anonymous"

  useEffect(() => {
    let cancelled = false

    const handle = scheduleIdle(() => {
      if (cancelled) return

      if (canReadLeads && !pathname.startsWith("/leads")) {
        router.prefetch("/leads")
        void warmLeadReferenceData()
        const leadParams = {
          ...getInitialLeadsParams(),
          fields: readLeadPreferenceColumns(preferenceOwner) as unknown as string[],
        }
        const leadSp = buildLeadsSearchParams(leadParams).toString()
        void queryClient.prefetchQuery({
          queryKey: leadsKeys.list(leadSp),
          queryFn: ({ signal }) =>
            readJson<LeadListResponse>(`/api/leads?${leadSp}`, signal),
          staleTime: 60_000,
        })
        void queryClient.prefetchQuery({
          queryKey: leadsKeys.stats(),
          queryFn: ({ signal }) => readJson<LeadStats>("/api/leads/stats", signal),
          staleTime: 60_000,
        })
      }

      if (canReadClienti && !pathname.startsWith("/clienti")) {
        router.prefetch("/clienti")
        const clientiSp = buildClientiSearchParams(DEFAULT_CLIENTI_PARAMS).toString()
        void queryClient.prefetchQuery({
          queryKey: clientiKeys.list(clientiSp),
          queryFn: ({ signal }) =>
            readJson<ClientiListResponse>(`/api/clienti?${clientiSp}`, signal),
          staleTime: 60_000,
        })
      }
    })

    return () => {
      cancelled = true
      cancelIdle(handle)
    }
  }, [canReadClienti, canReadLeads, pathname, preferenceOwner, queryClient, router])

  return null
}
