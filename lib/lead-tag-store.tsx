"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export interface LeadTag {
  id: string
  name: string
  color: string
  /** Data ultima modifica, già formattata (es. "Giugno 04 , 2024"). */
  modificato: string
  /** Conteggio lead a cui il tag è associato. */
  uso: number
}

/**
 * Palette colori per i tag lead. I colori possono ripetersi tra tag diversi
 * (nessun vincolo di unicità sul colore).
 */
export const LEAD_TAG_PALETTE = [
  "#DC2626", // rosso
  "#C0392B", // rosso scuro
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

export const MAX_LEAD_TAGS = 100

/**
 * Tag reali presenti nell'elenco Lead (estratti dal CRM).
 * Sono 61 → corrisponde al contatore "Tag utilizzati: 61 / 100".
 */
const SEED_TAGS: { name: string; color: string; modificato: string; uso: number }[] = [
  { name: "Trattativa", color: "#5B9BD5", modificato: "Giugno 04 , 2024", uso: 84 },
  { name: "In attesa", color: "#F2D24A", modificato: "Giugno 04 , 2024", uso: 67 },
  { name: "Richiamare", color: "#6FBF73", modificato: "Giugno 05 , 2024", uso: 92 },
  { name: "Non risponde piu`", color: "#8A8D93", modificato: "Settembre 26 , 2024", uso: 45 },
  { name: "NON RISPONDE - SEGRETERIA", color: "#E8902E", modificato: "Maggio 27 , 2025", uso: 31 },
  { name: "installatore", color: "#C8A2E0", modificato: "Giugno 18 , 2024", uso: 26 },
  { name: "Sopralluogo fatto", color: "#E8902E", modificato: "Luglio 10 , 2025", uso: 38 },
  { name: "Fake", color: "#D9A441", modificato: "Settembre 18 , 2024", uso: 22 },
  { name: "Impianto industriale", color: "#A8B84A", modificato: "Settembre 19 , 2024", uso: 14 },
  { name: "Fuori target", color: "#8E96E6", modificato: "Novembre 08 , 2024", uso: 41 },
  { name: "Ricliccato", color: "#5B7891", modificato: "Novembre 28 , 2024", uso: 19 },
  { name: "Fissare sopralluogo", color: "#E58A8A", modificato: "Novembre 29 , 2024", uso: 36 },
  { name: "Capannone per CER", color: "#D9A441", modificato: "Novembre 29 , 2024", uso: 8 },
  { name: "Inviare preventivo", color: "#8E96E6", modificato: "Novembre 29 , 2024", uso: 53 },
  { name: "Non risponde", color: "#6FBF73", modificato: "Febbraio 04 , 2025", uso: 78 },
  { name: "Inviato Preventivo", color: "#A8B84A", modificato: "Luglio 04 , 2025", uso: 49 },
  { name: "NUMERO ERRATO", color: "#E0457B", modificato: "Giugno 05 , 2025", uso: 27 },
  { name: "solo per informazione", color: "#E8902E", modificato: "Gennaio 28 , 2025", uso: 17 },
  { name: "Posticipato", color: "#F2D24A", modificato: "Febbraio 05 , 2025", uso: 33 },
  { name: "Fissato incontro", color: "#C8A2E0", modificato: "Febbraio 10 , 2025", uso: 29 },
  { name: "PRATICHE ENEL", color: "#8A8D93", modificato: "Febbraio 20 , 2025", uso: 21 },
  { name: "NEGATIVO", color: "#C0392B", modificato: "Maggio 27 , 2025", uso: 44 },
  { name: "NUOVO CONTRATTO", color: "#F2D24A", modificato: "Marzo 18 , 2025", uso: 58 },
  { name: "non interessato", color: "#E8902E", modificato: "Marzo 31 , 2025", uso: 62 },
  { name: "Fissato sopralluogo", color: "#5B9BD5", modificato: "Luglio 10 , 2025", uso: 47 },
  { name: "CONSULENTE", color: "#C8A2E0", modificato: "Maggio 08 , 2025", uso: 13 },
  { name: "In ristrutturazione", color: "#D9A441", modificato: "Maggio 13 , 2025", uso: 9 },
  { name: "RIGENERATO", color: "#3DA89A", modificato: "Maggio 27 , 2025", uso: 18 },
  { name: "RICHIAMARE IN FUTURO", color: "#D9A441", modificato: "Maggio 27 , 2025", uso: 51 },
  { name: "richiamare tra mesi", color: "#3DA89A", modificato: "Maggio 27 , 2025", uso: 24 },
  { name: "Inviata offerta PNNR", color: "#5B7891", modificato: "Maggio 27 , 2025", uso: 16 },
  { name: "PERDITA DI TEMPO", color: "#6FBF73", modificato: "Giugno 06 , 2025", uso: 35 },
  { name: "ATTENZIONARE", color: "#8E96E6", modificato: "Giugno 08 , 2025", uso: 20 },
  { name: "Senza numero", color: "#3DA89A", modificato: "Giugno 09 , 2025", uso: 11 },
  { name: "Sicilia Ovest", color: "#E58A8A", modificato: "Giugno 12 , 2025", uso: 7 },
  { name: "non contattato", color: "#E58A8A", modificato: "Giugno 12 , 2025", uso: 39 },
  { name: "attendo essere ricontatta", color: "#A8B84A", modificato: "Giugno 12 , 2025", uso: 15 },
  { name: "in attesa bollette", color: "#D9A441", modificato: "Giugno 13 , 2025", uso: 23 },
  { name: "Sopralluogo Installatore", color: "#D9A441", modificato: "Giugno 17 , 2025", uso: 28 },
  { name: "collaborazione", color: "#D9A441", modificato: "Giugno 19 , 2025", uso: 6 },
  { name: "perso", color: "#9BD675", modificato: "Luglio 16 , 2025", uso: 42 },
  { name: "in attesa doc", color: "#5B9BD5", modificato: "Agosto 29 , 2025", uso: 19 },
  { name: "doppione", color: "#E58A8A", modificato: "Settembre 01 , 2025", uso: 25 },
  { name: "Fissata Call", color: "#E68FB0", modificato: "Settembre 04 , 2025", uso: 30 },
  { name: "Fuori Raggio Agente", color: "#E58A8A", modificato: "Settembre 22 , 2025", uso: 12 },
  { name: "in corso", color: "#F2D24A", modificato: "Settembre 25 , 2025", uso: 48 },
  { name: "Call Online", color: "#6FBF73", modificato: "Febbraio 13 , 2026", uso: 22 },
  { name: "MASE", color: "#8A8D93", modificato: "Febbraio 13 , 2026", uso: 10 },
  { name: "tempo perso", color: "#E8902E", modificato: "Febbraio 17 , 2026", uso: 34 },
  { name: "conto termico", color: "#C8A2E0", modificato: "Febbraio 19 , 2026", uso: 17 },
  { name: "rifiutato", color: "#5B7891", modificato: "Marzo 25 , 2026", uso: 26 },
  { name: "Vincenzo Sasso", color: "#A8B84A", modificato: "Maggio 22 , 2026", uso: 5 },
  { name: "DE Paola", color: "#C8A2E0", modificato: "Aprile 16 , 2026", uso: 4 },
  { name: "Cantalupo", color: "#8A8D93", modificato: "Aprile 16 , 2026", uso: 3 },
  { name: "Inviato Prospetto", color: "#5B9BD5", modificato: "Aprile 23 , 2026", uso: 31 },
  { name: "vedi note", color: "#A8B84A", modificato: "Aprile 29 , 2026", uso: 55 },
  { name: "OLD", color: "#5B7891", modificato: "Maggio 07 , 2026", uso: 14 },
  { name: "Tasso zero IRFIS", color: "#8B2E3F", modificato: "Maggio 04 , 2026", uso: 8 },
  { name: "ContrattoWEB", color: "#5B9BD5", modificato: "Maggio 12 , 2026", uso: 21 },
  { name: "nuccio", color: "#8A8D93", modificato: "Maggio 20 , 2026", uso: 2 },
  { name: "non più interessata", color: "#E58A8A", modificato: "Giugno 09 , 2026", uso: 37 },
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
const nextId = () => `ltag-${++seq}`

function buildInitial(): LeadTag[] {
  return SEED_TAGS.map((t) => ({ id: nextId(), ...t }))
}

interface LeadTagContextValue {
  tags: LeadTag[]
  /** Crea uno o più tag (nomi separati da virgola) con lo stesso colore. */
  createTags: (names: string, color: string) => LeadTag[]
  renameTag: (id: string, name: string) => void
  recolorTag: (id: string, color: string) => void
  deleteTag: (id: string) => void
}

const Ctx = createContext<LeadTagContextValue | null>(null)

export function LeadTagProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<LeadTag[]>(buildInitial)

  const createTags = useCallback((names: string, color: string) => {
    const parts = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
    if (parts.length === 0) return []

    const created: LeadTag[] = []
    setTags((prev) => {
      const existingLower = new Set(prev.map((t) => t.name.toLowerCase()))
      const next = [...prev]
      for (const name of parts) {
        if (existingLower.has(name.toLowerCase())) continue
        const tag: LeadTag = {
          id: nextId(),
          name,
          color,
          modificato: oggiFormattato(),
          uso: 0,
        }
        existingLower.add(name.toLowerCase())
        created.push(tag)
        // I nuovi tag compaiono in cima
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

  const value = useMemo<LeadTagContextValue>(
    () => ({ tags, createTags, renameTag, recolorTag, deleteTag }),
    [tags, createTags, renameTag, recolorTag, deleteTag],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLeadTags() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useLeadTags must be used within LeadTagProvider")
  return ctx
}

/** Restituisce true se sul colore serve testo scuro (colore chiaro). */
export function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "")
  const r = Number.parseInt(c.slice(0, 2), 16)
  const g = Number.parseInt(c.slice(2, 4), 16)
  const b = Number.parseInt(c.slice(4, 6), 16)
  // Luminanza percepita
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62
}
