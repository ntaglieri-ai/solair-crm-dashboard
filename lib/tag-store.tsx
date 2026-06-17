"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { mockLeads } from "@/lib/mock-data"

export interface Tag {
  id: string
  name: string
  color: string
}

export interface TagEvent {
  id: string
  testo: string
  autore: string
  ora: string
}

// Palette 12 colori predefiniti per i tag
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

const CURRENT_USER = "Nando Taglieri"

// Colori noti dei tag predefiniti (gli altri ereditano grigio)
const PREDEFINED_COLORS: Record<string, string> = {
  "Inviato Preventivo": "#3B82F6",
  Richiamare: "#22C55E",
  "NON RISPONDE": "#F97316",
  Cantalupo: "#9CA3AF",
  nuccio: "#9CA3AF",
}

let tagSeq = 0
const nextTagId = () => `tag-${++tagSeq}`

function buildInitialState() {
  const byName = new Map<string, Tag>()
  // Prima i predefiniti, in ordine
  for (const [name, color] of Object.entries(PREDEFINED_COLORS)) {
    byName.set(name, { id: nextTagId(), name, color })
  }
  // Poi eventuali tag presenti nei lead non ancora mappati (grigio default)
  for (const lead of mockLeads) {
    for (const name of lead.Tag) {
      if (!byName.has(name)) {
        byName.set(name, { id: nextTagId(), name, color: "#9CA3AF" })
      }
    }
  }

  const tags = Array.from(byName.values())
  const nameToId = new Map(tags.map((t) => [t.name, t.id]))

  const leadTagIds: Record<string, string[]> = {}
  for (const lead of mockLeads) {
    leadTagIds[lead.id] = lead.Tag.map((n) => nameToId.get(n)!).filter(Boolean)
  }

  return { tags, leadTagIds }
}

interface TagContextValue {
  tags: Tag[]
  leadTagIds: Record<string, string[]>
  tagEvents: Record<string, TagEvent[]>
  getLeadTags: (leadId: string) => Tag[]
  usageCount: (tagId: string) => number
  toggleLeadTag: (leadId: string, tagId: string) => void
  createTag: (name: string, color: string) => Tag | null
  createAndAssign: (leadId: string, name: string, color: string) => void
  renameTag: (tagId: string, name: string) => void
  recolorTag: (tagId: string, color: string) => void
  deleteTag: (tagId: string) => void
}

const TagContext = createContext<TagContextValue | null>(null)

export function TagProvider({ children }: { children: ReactNode }) {
  const [{ tags: initialTags, leadTagIds: initialAssign }] = useState(
    buildInitialState,
  )
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [leadTagIds, setLeadTagIds] =
    useState<Record<string, string[]>>(initialAssign)
  const [tagEvents, setTagEvents] = useState<Record<string, TagEvent[]>>({})

  const pushEvent = useCallback((leadId: string, testo: string) => {
    setTagEvents((prev) => {
      const ev: TagEvent = {
        id: `tev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        testo,
        autore: CURRENT_USER,
        ora: "adesso",
      }
      return { ...prev, [leadId]: [ev, ...(prev[leadId] ?? [])] }
    })
  }, [])

  const getLeadTags = useCallback(
    (leadId: string) => {
      const ids = leadTagIds[leadId] ?? []
      return ids
        .map((id) => tags.find((t) => t.id === id))
        .filter((t): t is Tag => Boolean(t))
    },
    [leadTagIds, tags],
  )

  const usageCount = useCallback(
    (tagId: string) =>
      Object.values(leadTagIds).reduce(
        (acc, ids) => acc + (ids.includes(tagId) ? 1 : 0),
        0,
      ),
    [leadTagIds],
  )

  const toggleLeadTag = useCallback(
    (leadId: string, tagId: string) => {
      const tag = tags.find((t) => t.id === tagId)
      setLeadTagIds((prev) => {
        const current = prev[leadId] ?? []
        const has = current.includes(tagId)
        if (tag) {
          pushEvent(
            leadId,
            `${has ? "Tag rimosso" : "Tag aggiunto"} — ${tag.name}`,
          )
        }
        return {
          ...prev,
          [leadId]: has
            ? current.filter((id) => id !== tagId)
            : [...current, tagId],
        }
      })
    },
    [tags, pushEvent],
  )

  const createTag = useCallback(
    (name: string, color: string) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      const existing = tags.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
      )
      if (existing) return existing
      const tag: Tag = { id: nextTagId(), name: trimmed, color }
      setTags((prev) => [...prev, tag])
      return tag
    },
    [tags],
  )

  const createAndAssign = useCallback(
    (leadId: string, name: string, color: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const existing = tags.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
      )
      const tag: Tag = existing ?? {
        id: nextTagId(),
        name: trimmed,
        color,
      }
      if (!existing) setTags((prev) => [...prev, tag])
      setLeadTagIds((prev) => {
        const current = prev[leadId] ?? []
        if (current.includes(tag.id)) return prev
        return { ...prev, [leadId]: [...current, tag.id] }
      })
      pushEvent(leadId, `Tag aggiunto — ${tag.name}`)
    },
    [tags, pushEvent],
  )

  const renameTag = useCallback((tagId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, name: trimmed } : t)),
    )
  }, [])

  const recolorTag = useCallback((tagId: string, color: string) => {
    setTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, color } : t)),
    )
  }, [])

  const deleteTag = useCallback((tagId: string) => {
    setTags((prev) => prev.filter((t) => t.id !== tagId))
    setLeadTagIds((prev) => {
      const next: Record<string, string[]> = {}
      for (const [leadId, ids] of Object.entries(prev)) {
        next[leadId] = ids.filter((id) => id !== tagId)
      }
      return next
    })
  }, [])

  const value = useMemo<TagContextValue>(
    () => ({
      tags,
      leadTagIds,
      tagEvents,
      getLeadTags,
      usageCount,
      toggleLeadTag,
      createTag,
      createAndAssign,
      renameTag,
      recolorTag,
      deleteTag,
    }),
    [
      tags,
      leadTagIds,
      tagEvents,
      getLeadTags,
      usageCount,
      toggleLeadTag,
      createTag,
      createAndAssign,
      renameTag,
      recolorTag,
      deleteTag,
    ],
  )

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>
}

export function useTags() {
  const ctx = useContext(TagContext)
  if (!ctx) throw new Error("useTags must be used within TagProvider")
  return ctx
}
