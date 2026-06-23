"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export interface InstallatoreTag {
  id: string
  name: string
  color: string
  /** Data ultima modifica, già formattata (es. "Gennaio 29 , 2025"). */
  modificato: string
  /** Conteggio installatori a cui il tag è associato. */
  uso: number
}

/**
 * Palette colori per i tag installatori. Riusa la stessa scala cromatica del
 * modulo Clienti per coerenza visiva: i colori possono ripetersi tra tag.
 */
export const INSTALLATORE_TAG_PALETTE = [
  "#DC2626", // rosso
  "#E2541F", // arancio-rosso
  "#E8902E", // arancio
  "#D9A441", // oro
  "#F2D24A", // giallo
  "#A8B84A", // oliva
  "#9BD675", // verde chiaro
  "#6FBF73", // verde
  "#2F8F4E", // verde scuro
  "#2F6B3C", // verde bottiglia
  "#3DA89A", // verde acqua
  "#5EC8C0", // teal chiaro
  "#8FE3D8", // acqua
  "#5B9BD5", // blu
  "#2536C8", // blu intenso
  "#5B7891", // ardesia
  "#8E96E6", // pervinca
  "#6D28D9", // viola
  "#9B59B6", // porpora
  "#C8A2E0", // lilla
  "#D633C4", // magenta
  "#E0269E", // fucsia
  "#E68FB0", // rosa
  "#E0457B", // rosa intenso
  "#B0244A", // cremisi
  "#8B2E3F", // bordeaux
  "#E58A8A", // salmone
  "#B0B3B8", // grigio chiaro
  "#8A8D93", // grigio
  "#111111", // nero
] as const

export const MAX_INSTALLATORE_TAGS = 100

/** Tag iniziali del modulo Installatori. */
const SEED_TAGS: {
  name: string
  color: string
  modificato: string
  uso: number
}[] = [
  { name: "Partner", color: "#2536C8", modificato: "Gennaio 24 , 2025", uso: 3 },
  { name: "Certificato", color: "#2F8F4E", modificato: "Gennaio 24 , 2025", uso: 2 },
  { name: "Preferito", color: "#E8902E", modificato: "Febbraio 11 , 2025", uso: 2 },
  { name: "Convenzionato", color: "#3DA89A", modificato: "Marzo 21 , 2025", uso: 1 },
  { name: "Manutenzione", color: "#5B9BD5", modificato: "Aprile 29 , 2025", uso: 1 },
  { name: "Sospeso", color: "#DC2626", modificato: "Novembre 27 , 2025", uso: 2 },
  { name: "Zona Sicilia", color: "#D9A441", modificato: "Giugno 12 , 2025", uso: 1 },
  { name: "Zona Nord", color: "#8E96E6", modificato: "Giugno 12 , 2025", uso: 0 },
  { name: "Elettrico", color: "#F2D24A", modificato: "Luglio 04 , 2025", uso: 0 },
  { name: "Fotovoltaico", color: "#6FBF73", modificato: "Luglio 04 , 2025", uso: 0 },
  { name: "Termico", color: "#E0457B", modificato: "Luglio 16 , 2025", uso: 0 },
  { name: "Da verificare", color: "#8A8D93", modificato: "Ottobre 02 , 2025", uso: 0 },
]

const MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
]

function oggiFormattato(): string {
  const d = new Date()
  return `${MESI[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")} , ${d.getFullYear()}`
}

let seq = 0
const nextId = () => `itag-${++seq}`

function buildInitial(): InstallatoreTag[] {
  return SEED_TAGS.map((t) => ({ id: nextId(), ...t }))
}

interface InstallatoreTagContextValue {
  tags: InstallatoreTag[]
  /** Crea uno o più tag (nomi separati da virgola) con lo stesso colore. */
  createTags: (names: string, color: string) => InstallatoreTag[]
  renameTag: (id: string, name: string) => void
  recolorTag: (id: string, color: string) => void
  deleteTag: (id: string) => void
}

const Ctx = createContext<InstallatoreTagContextValue | null>(null)

export function InstallatoreTagProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<InstallatoreTag[]>(buildInitial)

  const createTags = useCallback((names: string, color: string) => {
    const parts = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
    if (parts.length === 0) return []

    const created: InstallatoreTag[] = []
    setTags((prev) => {
      const existingLower = new Set(prev.map((t) => t.name.toLowerCase()))
      const next = [...prev]
      for (const name of parts) {
        if (existingLower.has(name.toLowerCase())) continue
        const tag: InstallatoreTag = {
          id: nextId(),
          name,
          color,
          modificato: oggiFormattato(),
          uso: 0,
        }
        existingLower.add(name.toLowerCase())
        created.push(tag)
        next.unshift(tag)
      }
      return next
    })
    return created
  }, [])

  const renameTag = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setTags((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, name: trimmed, modificato: oggiFormattato() } : t,
      ),
    )
  }, [])

  const recolorTag = useCallback((id: string, color: string) => {
    setTags((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, color, modificato: oggiFormattato() } : t,
      ),
    )
  }, [])

  const deleteTag = useCallback((id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo<InstallatoreTagContextValue>(
    () => ({ tags, createTags, renameTag, recolorTag, deleteTag }),
    [tags, createTags, renameTag, recolorTag, deleteTag],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useInstallatoreTags() {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error(
      "useInstallatoreTags must be used within InstallatoreTagProvider",
    )
  return ctx
}

/**
 * Mappa statica nome tag → colore, derivata dai tag iniziali. Permette di
 * colorare i pill nelle celle della tabella senza dipendere dal provider.
 */
const SEED_COLOR_BY_NAME: Record<string, string> = SEED_TAGS.reduce<
  Record<string, string>
>((acc, t) => {
  acc[t.name.toLowerCase()] = t.color
  return acc
}, {})

/** Colore per un tag dato il nome (fallback deterministico sulla palette). */
export function installatoreTagColor(name: string): string {
  const known = SEED_COLOR_BY_NAME[name.toLowerCase()]
  if (known) return known
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return INSTALLATORE_TAG_PALETTE[sum % INSTALLATORE_TAG_PALETTE.length]
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
