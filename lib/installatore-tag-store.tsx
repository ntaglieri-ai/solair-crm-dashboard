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

export interface InstallatoreTag {
  id: string
  name: string
  color: string
  createdAt?: string
}

export interface InstallatoreReferenceOption {
  id: string
  nome: string
}

export type InstallatoreReferencePayload = {
  tags: InstallatoreTag[]
  installatoreTagIds: Record<string, string[]>
  owners: InstallatoreReferenceOption[]
}

export const INSTALLATORE_TAG_PALETTE = [
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

export const MAX_INSTALLATORE_TAGS = 100

export function installatoreTagColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return INSTALLATORE_TAG_PALETTE[hash % INSTALLATORE_TAG_PALETTE.length]
}

export function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "")
  const r = Number.parseInt(c.slice(0, 2), 16)
  const g = Number.parseInt(c.slice(2, 4), 16)
  const b = Number.parseInt(c.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62
}

interface InstallatoreTagContextValue extends InstallatoreReferencePayload {
  loading: boolean
  getInstallatoreTags: (installatoreId: string) => InstallatoreTag[]
  hydrateInstallatoreTagIds: (assignments: Record<string, string[]>) => void
  usageCount: (tagId: string) => number
  toggleInstallatoreTag: (installatoreId: string, tagId: string) => void
  createTags: (names: string, color: string) => void
  createAndAssign: (installatoreId: string, name: string, color: string) => void
  renameTag: (tagId: string, name: string) => void
  recolorTag: (tagId: string, color: string) => void
  deleteTag: (tagId: string) => void
}

const EMPTY: InstallatoreReferencePayload = {
  tags: [],
  installatoreTagIds: {},
  owners: [],
}

const Ctx = createContext<InstallatoreTagContextValue | null>(null)

async function mutate(body: Record<string, unknown>) {
  const response = await fetch("/api/installatori/reference-data", {
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

/**
 * Sostituisce la versione precedente (interamente finta: catalogo di 12 tag
 * hardcoded in memoria, zero persistenza, e il campo di assegnazione era un
 * valore singolo di testo libero su installatori.tag, non un vero sistema
 * multi-tag). Ora persiste su Supabase (tabelle tag/installatore_tags),
 * stesso schema di lib/cliente-tag-store.tsx. Ricostruito 26/07.
 */
export function InstallatoreTagProvider({
  children,
  initialData,
}: {
  children: ReactNode
  initialData?: InstallatoreReferencePayload
}) {
  const pathname = usePathname()
  const [data, setData] = useState<InstallatoreReferencePayload>(initialData ?? EMPTY)
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return
    if (!pathname.startsWith("/installatori")) return
    let active = true
    fetch("/api/installatori/reference-data")
      .then(async (response) => {
        if (!response.ok) throw new Error("Caricamento riferimenti Installatore non riuscito")
        return response.json() as Promise<InstallatoreReferencePayload>
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

  const getInstallatoreTags = useCallback(
    (installatoreId: string) => {
      const ids = data.installatoreTagIds[installatoreId] ?? []
      return ids
        .map((id) => data.tags.find((tag) => tag.id === id))
        .filter((tag): tag is InstallatoreTag => Boolean(tag))
    },
    [data.installatoreTagIds, data.tags],
  )

  const hydrateInstallatoreTagIds = useCallback((assignments: Record<string, string[]>) => {
    setData((previous) => ({
      ...previous,
      installatoreTagIds: { ...previous.installatoreTagIds, ...assignments },
    }))
  }, [])

  const usageCount = useCallback(
    (tagId: string) =>
      Object.values(data.installatoreTagIds).filter((ids) => ids.includes(tagId)).length,
    [data.installatoreTagIds],
  )

  const toggleInstallatoreTag = useCallback(
    (installatoreId: string, tagId: string) => {
      const current = data.installatoreTagIds[installatoreId] ?? []
      const enabled = !current.includes(tagId)
      setData((previous) => ({
        ...previous,
        installatoreTagIds: {
          ...previous.installatoreTagIds,
          [installatoreId]: enabled ? [...current, tagId] : current.filter((id) => id !== tagId),
        },
      }))
      void mutate({ action: "toggle", installatoreId, tagId, enabled }).catch(() => {
        setData((previous) => ({
          ...previous,
          installatoreTagIds: { ...previous.installatoreTagIds, [installatoreId]: current },
        }))
      })
    },
    [data.installatoreTagIds],
  )

  const createTags = useCallback((names: string, color: string) => {
    const parts = names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
    if (!parts.length) return
    void mutate({ action: "create", names: parts, color }).then(
      ({ tags }: { tags: InstallatoreTag[] }) => {
        setData((previous) => ({
          ...previous,
          tags: [
            ...tags,
            ...previous.tags.filter((current) => !tags.some((tag) => tag.id === current.id)),
          ],
        }))
      },
    )
  }, [])

  const createAndAssign = useCallback((installatoreId: string, name: string, color: string) => {
    const normalized = name.trim()
    if (!normalized) return
    void mutate({ action: "create_assign", installatoreId, name: normalized, color }).then(
      ({ tag }: { tag: InstallatoreTag }) => {
        setData((previous) => ({
          ...previous,
          tags: previous.tags.some((item) => item.id === tag.id)
            ? previous.tags
            : [...previous.tags, tag],
          installatoreTagIds: {
            ...previous.installatoreTagIds,
            [installatoreId]: [
              ...new Set([...(previous.installatoreTagIds[installatoreId] ?? []), tag.id]),
            ],
          },
        }))
      },
    )
  }, [])

  const renameTag = useCallback((tagId: string, name: string) => {
    const normalized = name.trim()
    if (!normalized) return
    setData((previous) => ({
      ...previous,
      tags: previous.tags.map((tag) => (tag.id === tagId ? { ...tag, name: normalized } : tag)),
    }))
    void mutate({ action: "update", tagId, name: normalized })
  }, [])

  const recolorTag = useCallback((tagId: string, color: string) => {
    setData((previous) => ({
      ...previous,
      tags: previous.tags.map((tag) => (tag.id === tagId ? { ...tag, color } : tag)),
    }))
    void mutate({ action: "update", tagId, color })
  }, [])

  const deleteTag = useCallback((tagId: string) => {
    setData((previous) => ({
      ...previous,
      tags: previous.tags.filter((tag) => tag.id !== tagId),
      installatoreTagIds: Object.fromEntries(
        Object.entries(previous.installatoreTagIds).map(([installatoreId, ids]) => [
          installatoreId,
          ids.filter((id) => id !== tagId),
        ]),
      ),
    }))
    void mutate({ action: "delete", tagId })
  }, [])

  const value = useMemo<InstallatoreTagContextValue>(
    () => ({
      ...data,
      loading,
      getInstallatoreTags,
      hydrateInstallatoreTagIds,
      usageCount,
      toggleInstallatoreTag,
      createTags,
      createAndAssign,
      renameTag,
      recolorTag,
      deleteTag,
    }),
    [
      data,
      loading,
      getInstallatoreTags,
      hydrateInstallatoreTagIds,
      usageCount,
      toggleInstallatoreTag,
      createTags,
      createAndAssign,
      renameTag,
      recolorTag,
      deleteTag,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useInstallatoreTags() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useInstallatoreTags must be used within InstallatoreTagProvider")
  return ctx
}
