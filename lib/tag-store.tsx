"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"

export interface Tag {
  id: string
  name: string
  color: string
}

export interface ReferenceOption {
  id: string
  nome: string
}

export interface TagEvent {
  id: string
  testo: string
  autore: string
  ora: string
}

export type ReferencePayload = {
  tags: Tag[]
  leadTagIds: Record<string, string[]>
  owners: ReferenceOption[]
  installers: ReferenceOption[]
}

export const TAG_PALETTE = [
  "#3B82F6",
  "#22C55E",
  "#F97316",
  "#9CA3AF",
  "#EF4444",
  "#EAB308",
  "#14B8A6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#64748B",
] as const

interface TagContextValue extends ReferencePayload {
  loading: boolean
  tagEvents: Record<string, TagEvent[]>
  getLeadTags: (leadId: string) => Tag[]
  hydrateLeadTagIds: (assignments: Record<string, string[]>) => void
  usageCount: (tagId: string) => number
  toggleLeadTag: (leadId: string, tagId: string) => void
  createTags: (names: string, color: string) => void
  createAndAssign: (leadId: string, name: string, color: string) => void
  renameTag: (tagId: string, name: string) => void
  recolorTag: (tagId: string, color: string) => void
  deleteTag: (tagId: string) => void
}

const EMPTY: ReferencePayload = {
  tags: [],
  leadTagIds: {},
  owners: [],
  installers: [],
}

const TagContext = createContext<TagContextValue | null>(null)

async function mutate(body: Record<string, unknown>) {
  const response = await fetch("/api/leads/reference-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? "Aggiornamento tag non riuscito")
  }
  return response.json()
}

export function TagProvider({
  children,
  initialData,
}: {
  children: ReactNode
  initialData?: ReferencePayload
}) {
  const pathname = usePathname()
  const [data, setData] = useState<ReferencePayload>(initialData ?? EMPTY)
  const [loading, setLoading] = useState(!initialData)
  const [tagEvents, setTagEvents] = useState<Record<string, TagEvent[]>>({})

  useEffect(() => {
    if (initialData) return
    if (!pathname.startsWith("/leads")) {
      return
    }
    let active = true
    fetch("/api/leads/reference-data")
      .then(async (response) => {
        if (!response.ok) throw new Error("Caricamento riferimenti Lead non riuscito")
        return response.json() as Promise<ReferencePayload>
      })
      .then((payload) => {
        if (active) setData(payload)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [initialData, pathname])

  const pushEvent = useCallback((leadId: string, testo: string) => {
    setTagEvents((previous) => ({
      ...previous,
      [leadId]: [
        {
          id: `tag-event-${Date.now()}`,
          testo,
          autore: "Utente CRM",
          ora: "adesso",
        },
        ...(previous[leadId] ?? []),
      ],
    }))
  }, [])

  const getLeadTags = useCallback(
    (leadId: string) => {
      const ids = data.leadTagIds[leadId] ?? []
      return ids
        .map((id) => data.tags.find((tag) => tag.id === id))
        .filter((tag): tag is Tag => Boolean(tag))
    },
    [data.leadTagIds, data.tags],
  )

  const hydrateLeadTagIds = useCallback(
    (assignments: Record<string, string[]>) => {
      setData((previous) => ({
        ...previous,
        leadTagIds: { ...previous.leadTagIds, ...assignments },
      }))
    },
    [],
  )

  const usageCount = useCallback(
    (tagId: string) =>
      Object.values(data.leadTagIds).filter((ids) => ids.includes(tagId)).length,
    [data.leadTagIds],
  )

  const toggleLeadTag = useCallback(
    (leadId: string, tagId: string) => {
      const current = data.leadTagIds[leadId] ?? []
      const enabled = !current.includes(tagId)
      const tag = data.tags.find((item) => item.id === tagId)
      setData((previous) => ({
        ...previous,
        leadTagIds: {
          ...previous.leadTagIds,
          [leadId]: enabled
            ? [...current, tagId]
            : current.filter((id) => id !== tagId),
        },
      }))
      if (tag) pushEvent(leadId, `Tag ${enabled ? "aggiunto" : "rimosso"} — ${tag.name}`)
      void mutate({ action: "toggle", leadId, tagId, enabled }).catch(() => {
        setData((previous) => ({
          ...previous,
          leadTagIds: { ...previous.leadTagIds, [leadId]: current },
        }))
      })
    },
    [data.leadTagIds, data.tags, pushEvent],
  )

  const createTags = useCallback((names: string, color: string) => {
    const parts = names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
    if (!parts.length) return
    void mutate({ action: "create", names: parts, color }).then(
      ({ tags }: { tags: Tag[] }) => {
        setData((previous) => ({
          ...previous,
          tags: [
            ...tags,
            ...previous.tags.filter(
              (current) => !tags.some((tag) => tag.id === current.id),
            ),
          ],
        }))
      },
    )
  }, [])

  const createAndAssign = useCallback(
    (leadId: string, name: string, color: string) => {
      const normalized = name.trim()
      if (!normalized) return
      void mutate({
        action: "create_assign",
        leadId,
        name: normalized,
        color,
      }).then(({ tag }: { tag: Tag }) => {
        setData((previous) => ({
          ...previous,
          tags: previous.tags.some((item) => item.id === tag.id)
            ? previous.tags
            : [...previous.tags, tag],
          leadTagIds: {
            ...previous.leadTagIds,
            [leadId]: [
              ...new Set([...(previous.leadTagIds[leadId] ?? []), tag.id]),
            ],
          },
        }))
        pushEvent(leadId, `Tag aggiunto — ${tag.name}`)
      })
    },
    [pushEvent],
  )

  const renameTag = useCallback((tagId: string, name: string) => {
    const normalized = name.trim()
    if (!normalized) return
    setData((previous) => ({
      ...previous,
      tags: previous.tags.map((tag) =>
        tag.id === tagId ? { ...tag, name: normalized } : tag,
      ),
    }))
    void mutate({ action: "update", tagId, name: normalized })
  }, [])

  const recolorTag = useCallback((tagId: string, color: string) => {
    setData((previous) => ({
      ...previous,
      tags: previous.tags.map((tag) =>
        tag.id === tagId ? { ...tag, color } : tag,
      ),
    }))
    void mutate({ action: "update", tagId, color })
  }, [])

  const deleteTag = useCallback((tagId: string) => {
    setData((previous) => ({
      ...previous,
      tags: previous.tags.filter((tag) => tag.id !== tagId),
      leadTagIds: Object.fromEntries(
        Object.entries(previous.leadTagIds).map(([leadId, ids]) => [
          leadId,
          ids.filter((id) => id !== tagId),
        ]),
      ),
    }))
    void mutate({ action: "delete", tagId })
  }, [])

  const value = useMemo<TagContextValue>(
    () => ({
      ...data,
      loading,
      tagEvents,
      getLeadTags,
      hydrateLeadTagIds,
      usageCount,
      toggleLeadTag,
      createTags,
      createAndAssign,
      renameTag,
      recolorTag,
      deleteTag,
    }),
    [
      data,
      loading,
      tagEvents,
      getLeadTags,
      hydrateLeadTagIds,
      usageCount,
      toggleLeadTag,
      createTags,
      createAndAssign,
      renameTag,
      recolorTag,
      deleteTag,
    ],
  )

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>
}

export function useTags() {
  const context = useContext(TagContext)
  if (!context) throw new Error("useTags must be used within TagProvider")
  return context
}
