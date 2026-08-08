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
import { toast } from "sonner"

export interface ClienteTag {
  id: string
  name: string
  color: string
  /** Data di creazione reale (colonna created_at) — non esiste una colonna "ultima modifica" nello schema reale. */
  createdAt?: string
}

export interface ClienteReferenceOption {
  id: string
  nome: string
}

export type ClienteReferencePayload = {
  tags: ClienteTag[]
  clienteTagIds: Record<string, string[]>
  owners: ClienteReferenceOption[]
}

/**
 * Palette colori per i tag clienti. Più ricca della palette lead per
 * riprodurre i colori reali dell'elenco Zoho. I colori possono ripetersi
 * tra tag diversi (nessun vincolo di unicità sul colore).
 */
export const CLIENTE_TAG_PALETTE = [
  "#DC2626",
  "#E2541F",
  "#E8902E",
  "#D9A441",
  "#F2D24A",
  "#A8B84A",
  "#9BD675",
  "#6FBF73",
  "#2F8F4E",
  "#2F6B3C",
  "#3DA89A",
  "#5EC8C0",
  "#8FE3D8",
  "#5B9BD5",
  "#2536C8",
  "#5B7891",
  "#8E96E6",
  "#6D28D9",
  "#9B59B6",
  "#C8A2E0",
  "#D633C4",
  "#E0269E",
  "#E68FB0",
  "#E0457B",
  "#B0244A",
  "#8B2E3F",
  "#E58A8A",
  "#B0B3B8",
  "#8A8D93",
  "#111111",
] as const

export const MAX_CLIENTE_TAGS = 100

export function clienteTagColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return CLIENTE_TAG_PALETTE[hash % CLIENTE_TAG_PALETTE.length]
}

/** Restituisce true se sul colore serve testo scuro (colore chiaro). */
export function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "")
  const r = Number.parseInt(c.slice(0, 2), 16)
  const g = Number.parseInt(c.slice(2, 4), 16)
  const b = Number.parseInt(c.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62
}

interface ClienteTagContextValue extends ClienteReferencePayload {
  loading: boolean
  getClienteTags: (clienteId: string) => ClienteTag[]
  hydrateClienteTagIds: (assignments: Record<string, string[]>) => void
  usageCount: (tagId: string) => number
  toggleClienteTag: (clienteId: string, tagId: string) => void
  createTags: (names: string, color: string) => void
  createAndAssign: (clienteId: string, name: string, color: string) => void
  renameTag: (tagId: string, name: string) => void
  recolorTag: (tagId: string, color: string) => void
  deleteTag: (tagId: string) => void
}

const EMPTY: ClienteReferencePayload = {
  tags: [],
  clienteTagIds: {},
  owners: [],
}

const Ctx = createContext<ClienteTagContextValue | null>(null)

/**
 * Esito dell'automazione handoff 4.4 che la route allega alla risposta quando
 * il tag applicato e' "Emettere fattura" (vedi app/api/clienti/reference-data).
 */
type EsitoAutomazione = { avviso?: string; info?: string } | null

async function mutate(body: Record<string, unknown>) {
  const response = await fetch("/api/clienti/reference-data", {
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
 * L'automazione non e' mai bloccante: il tag e' gia' applicato in ogni caso,
 * qui si riporta solo cosa e' successo al Compito collegato.
 */
function segnalaAutomazione(payload: { automazione?: EsitoAutomazione } | null | undefined) {
  const esito = payload?.automazione
  if (!esito) return
  if (esito.avviso) toast.warning("Automazione handoff", { description: esito.avviso })
  else if (esito.info) toast.success("Automazione handoff", { description: esito.info })
}

/**
 * Sostituisce la versione precedente (25/07), che era interamente finta:
 * 68 tag "seed" hardcoded in memoria, nessuna fetch, nessuna persistenza,
 * e nessuna funzione per assegnare un tag a un cliente specifico. Ora
 * persiste davvero su Supabase (tabelle tag/cliente_tags, già esistenti),
 * stesso schema di lib/tag-store.tsx (Lead).
 */
export function ClienteTagProvider({
  children,
  initialData,
}: {
  children: ReactNode
  initialData?: ClienteReferencePayload
}) {
  const pathname = usePathname()
  const [data, setData] = useState<ClienteReferencePayload>(initialData ?? EMPTY)
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return
    if (!pathname.startsWith("/clienti")) return
    let active = true
    fetch("/api/clienti/reference-data")
      .then(async (response) => {
        if (!response.ok) throw new Error("Caricamento riferimenti Cliente non riuscito")
        return response.json() as Promise<ClienteReferencePayload>
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

  const getClienteTags = useCallback(
    (clienteId: string) => {
      const ids = data.clienteTagIds[clienteId] ?? []
      return ids
        .map((id) => data.tags.find((tag) => tag.id === id))
        .filter((tag): tag is ClienteTag => Boolean(tag))
    },
    [data.clienteTagIds, data.tags],
  )

  const hydrateClienteTagIds = useCallback((assignments: Record<string, string[]>) => {
    setData((previous) => ({
      ...previous,
      clienteTagIds: { ...previous.clienteTagIds, ...assignments },
    }))
  }, [])

  const usageCount = useCallback(
    (tagId: string) =>
      Object.values(data.clienteTagIds).filter((ids) => ids.includes(tagId)).length,
    [data.clienteTagIds],
  )

  const toggleClienteTag = useCallback(
    (clienteId: string, tagId: string) => {
      const current = data.clienteTagIds[clienteId] ?? []
      const enabled = !current.includes(tagId)
      setData((previous) => ({
        ...previous,
        clienteTagIds: {
          ...previous.clienteTagIds,
          [clienteId]: enabled ? [...current, tagId] : current.filter((id) => id !== tagId),
        },
      }))
      void mutate({ action: "toggle", clienteId, tagId, enabled })
        .then(segnalaAutomazione)
        .catch(() => {
          setData((previous) => ({
            ...previous,
            clienteTagIds: { ...previous.clienteTagIds, [clienteId]: current },
          }))
        })
    },
    [data.clienteTagIds],
  )

  const createTags = useCallback((names: string, color: string) => {
    const parts = names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
    if (!parts.length) return
    void mutate({ action: "create", names: parts, color }).then(
      ({ tags }: { tags: ClienteTag[] }) => {
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

  const createAndAssign = useCallback((clienteId: string, name: string, color: string) => {
    const normalized = name.trim()
    if (!normalized) return
    void mutate({ action: "create_assign", clienteId, name: normalized, color }).then(
      (payload: { tag: ClienteTag; automazione?: EsitoAutomazione }) => {
        const { tag } = payload
        setData((previous) => ({
          ...previous,
          tags: previous.tags.some((item) => item.id === tag.id)
            ? previous.tags
            : [...previous.tags, tag],
          clienteTagIds: {
            ...previous.clienteTagIds,
            [clienteId]: [...new Set([...(previous.clienteTagIds[clienteId] ?? []), tag.id])],
          },
        }))
        segnalaAutomazione(payload)
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
      clienteTagIds: Object.fromEntries(
        Object.entries(previous.clienteTagIds).map(([clienteId, ids]) => [
          clienteId,
          ids.filter((id) => id !== tagId),
        ]),
      ),
    }))
    void mutate({ action: "delete", tagId })
  }, [])

  const value = useMemo<ClienteTagContextValue>(
    () => ({
      ...data,
      loading,
      getClienteTags,
      hydrateClienteTagIds,
      usageCount,
      toggleClienteTag,
      createTags,
      createAndAssign,
      renameTag,
      recolorTag,
      deleteTag,
    }),
    [
      data,
      loading,
      getClienteTags,
      hydrateClienteTagIds,
      usageCount,
      toggleClienteTag,
      createTags,
      createAndAssign,
      renameTag,
      recolorTag,
      deleteTag,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useClienteTags() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useClienteTags must be used within ClienteTagProvider")
  return ctx
}
