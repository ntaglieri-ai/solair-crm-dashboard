"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export interface ClienteTag {
  id: string
  name: string
  color: string
  /** Data ultima modifica, già formattata (es. "Gennaio 29 , 2025"). */
  modificato: string
  /** Conteggio clienti a cui il tag è associato. */
  uso: number
}

/**
 * Palette colori per i tag clienti. Più ricca della palette lead per
 * riprodurre i colori reali dell'elenco Zoho. I colori possono ripetersi
 * tra tag diversi (nessun vincolo di unicità sul colore).
 */
export const CLIENTE_TAG_PALETTE = [
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

export const MAX_CLIENTE_TAGS = 100

/**
 * Tag reali presenti nell'elenco Clienti (estratti dal CRM).
 * Sono 68 → corrisponde al contatore "Tag utilizzati: 68 / 100".
 */
const SEED_TAGS: { name: string; color: string; modificato: string; uso: number }[] = [
  { name: "Saldo finale ok", color: "#2F8F4E", modificato: "Gennaio 24 , 2025", uso: 34 },
  { name: "Fine iter", color: "#8B2E3F", modificato: "Gennaio 24 , 2025", uso: 41 },
  { name: "Iter Enel Avviato", color: "#E68FB0", modificato: "Gennaio 24 , 2025", uso: 28 },
  { name: "ATTESA CLIENTE", color: "#E8902E", modificato: "Ottobre 15 , 2024", uso: 52 },
  { name: "Concluso", color: "#5B7891", modificato: "Gennaio 06 , 2025", uso: 73 },
  { name: "PNRR 40%", color: "#C8A2E0", modificato: "Gennaio 06 , 2025", uso: 19 },
  { name: "Ok Fin", color: "#3DA89A", modificato: "Novembre 28 , 2024", uso: 22 },
  { name: "Pagato 80%", color: "#5B9BD5", modificato: "Gennaio 06 , 2025", uso: 16 },
  { name: "Pagato 50%", color: "#6FBF73", modificato: "Gennaio 24 , 2025", uso: 24 },
  { name: "Pagato 30%", color: "#9BD675", modificato: "Gennaio 24 , 2025", uso: 31 },
  { name: "Merce Spedita", color: "#F0D28A", modificato: "Gennaio 06 , 2025", uso: 12 },
  { name: "Emettere fattura", color: "#A8B84A", modificato: "Gennaio 07 , 2025", uso: 27 },
  { name: "Merce ordinata", color: "#C8A2E0", modificato: "Maggio 29 , 2025", uso: 38 },
  { name: "ATTESA INTEGRAZIONE", color: "#D9A441", modificato: "Gennaio 07 , 2025", uso: 15 },
  { name: "Fare progetto", color: "#8A8D93", modificato: "Gennaio 08 , 2025", uso: 44 },
  { name: "Emessa fattura", color: "#E05C5C", modificato: "Novembre 05 , 2025", uso: 29 },
  { name: "Merce consegnata", color: "#6FBF73", modificato: "Gennaio 14 , 2025", uso: 33 },
  { name: "COSTI EXTRA", color: "#E58A8A", modificato: "Gennaio 21 , 2025", uso: 9 },
  { name: "ASSISTENZA", color: "#5B9BD5", modificato: "Gennaio 21 , 2025", uso: 18 },
  { name: "NUOVO CONTRATTO", color: "#F2D24A", modificato: "Gennaio 21 , 2025", uso: 47 },
  { name: "Liquidare fin", color: "#8E96E6", modificato: "Luglio 04 , 2025", uso: 21 },
  { name: "Attesa esito fin", color: "#E8902E", modificato: "Gennaio 23 , 2025", uso: 26 },
  { name: "Avviare iter enel", color: "#B0244A", modificato: "Gennaio 24 , 2025", uso: 30 },
  { name: "Sbloccare inverter", color: "#5B9BD5", modificato: "Gennaio 24 , 2025", uso: 7 },
  { name: "Progetto ok", color: "#8A8D93", modificato: "Gennaio 24 , 2025", uso: 39 },
  { name: "Attesa GSE", color: "#8A8D93", modificato: "Gennaio 29 , 2025", uso: 25 },
  { name: "Avviare Fin", color: "#8E96E6", modificato: "Gennaio 27 , 2025", uso: 14 },
  { name: "Finanziaria esito negativo", color: "#E2541F", modificato: "Gennaio 29 , 2025", uso: 11 },
  { name: "Vedi note", color: "#F2E33A", modificato: "Gennaio 29 , 2025", uso: 56 },
  { name: "GSE Cer DF", color: "#D633C4", modificato: "Luglio 04 , 2025", uso: 13 },
  { name: "Fine lavori da fare", color: "#B0244A", modificato: "Febbraio 10 , 2025", uso: 20 },
  { name: "ITER ORDINARIO", color: "#6FBF73", modificato: "Febbraio 12 , 2025", uso: 48 },
  { name: "Cantiere multiplo", color: "#5B7891", modificato: "Febbraio 25 , 2025", uso: 6 },
  { name: "Ordinare merce", color: "#5B9BD5", modificato: "Marzo 21 , 2025", uso: 35 },
  { name: "Liquidata fin", color: "#3DA89A", modificato: "Marzo 26 , 2025", uso: 17 },
  { name: "Fin da firmare", color: "#8FE3D8", modificato: "Settembre 03 , 2025", uso: 23 },
  { name: "Scaldacqua", color: "#8E96E6", modificato: "Aprile 29 , 2025", uso: 8 },
  { name: "Wallbox", color: "#5B9BD5", modificato: "Maggio 28 , 2025", uso: 10 },
  { name: "Climatizzatore", color: "#3DA89A", modificato: "Maggio 28 , 2025", uso: 5 },
  { name: "Merce confermata", color: "#9B59B6", modificato: "Giugno 17 , 2025", uso: 32 },
  { name: "Pagato 10%", color: "#86C28A", modificato: "Ottobre 31 , 2025", uso: 40 },
  { name: "ITALIA", color: "#8B2E3F", modificato: "Febbraio 11 , 2026", uso: 4 },
  { name: "WARNING", color: "#DC2626", modificato: "Giugno 30 , 2025", uso: 3 },
  { name: "Quadro Interfaccia", color: "#5EC8C0", modificato: "Luglio 16 , 2025", uso: 7 },
  { name: "Disdetto", color: "#111111", modificato: "Agosto 28 , 2025", uso: 9 },
  { name: "fare ENEA", color: "#86C28A", modificato: "Settembre 08 , 2025", uso: 15 },
  { name: "Sopralluogo", color: "#6D28D9", modificato: "Marzo 25 , 2026", uso: 36 },
  { name: "GiroBonifici", color: "#E58A8A", modificato: "Novembre 13 , 2025", uso: 12 },
  { name: "Verificare Layout", color: "#B0B3B8", modificato: "Ottobre 02 , 2025", uso: 19 },
  { name: "Attesa TICA", color: "#7C7F86", modificato: "Ottobre 08 , 2025", uso: 28 },
  { name: "Prev. Pagato", color: "#5EC8C0", modificato: "Ottobre 31 , 2025", uso: 22 },
  { name: "CTR AMM", color: "#2F6B3C", modificato: "Novembre 04 , 2025", uso: 16 },
  { name: "Azione_Legale", color: "#D98080", modificato: "Novembre 25 , 2025", uso: 2 },
  { name: "NDC", color: "#7A2E3F", modificato: "Gennaio 16 , 2026", uso: 5 },
  { name: "AMMISSIBILE", color: "#86C28A", modificato: "Gennaio 22 , 2026", uso: 43 },
  { name: "TERNA", color: "#2536C8", modificato: "Gennaio 28 , 2026", uso: 18 },
  { name: "NUOVO CONTRATTO DIGITALE", color: "#E0269E", modificato: "Febbraio 19 , 2026", uso: 51 },
  { name: "Doc e valid.", color: "#C8A2E0", modificato: "Marzo 25 , 2026", uso: 24 },
  { name: "Solare Termico", color: "#8E96E6", modificato: "Maggio 07 , 2026", uso: 11 },
  { name: "PDC", color: "#7FCFC4", modificato: "Maggio 22 , 2026", uso: 14 },
  { name: "CT3", color: "#5B9BD5", modificato: "Giugno 11 , 2026", uso: 37 },
  { name: "Emessa fattura CT3", color: "#C0392B", modificato: "Giugno 12 , 2026", uso: 20 },
  { name: "Emettere fattura CT3", color: "#2F6B3C", modificato: "Giugno 12 , 2026", uso: 17 },
  { name: "Pagato CT3", color: "#5B9BD5", modificato: "Giugno 12 , 2026", uso: 13 },
  { name: "Richiamare", color: "#6FBF73", modificato: "Giugno 11 , 2026", uso: 29 },
  { name: "Avviare pratica CT3", color: "#E0457B", modificato: "Giugno 18 , 2026", uso: 8 },
  { name: "Pratica CT3 avviata", color: "#9B59B6", modificato: "Giugno 18 , 2026", uso: 21 },
  { name: "Off Grid", color: "#6FBF73", modificato: "Giugno 18 , 2026", uso: 6 },
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
const nextId = () => `ctag-${++seq}`

function buildInitial(): ClienteTag[] {
  return SEED_TAGS.map((t) => ({ id: nextId(), ...t }))
}

interface ClienteTagContextValue {
  tags: ClienteTag[]
  /** Crea uno o più tag (nomi separati da virgola) con lo stesso colore. */
  createTags: (names: string, color: string) => ClienteTag[]
  renameTag: (id: string, name: string) => void
  recolorTag: (id: string, color: string) => void
  deleteTag: (id: string) => void
}

const Ctx = createContext<ClienteTagContextValue | null>(null)

export function ClienteTagProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<ClienteTag[]>(buildInitial)

  const createTags = useCallback(
    (names: string, color: string) => {
      const parts = names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
      if (parts.length === 0) return []

      const created: ClienteTag[] = []
      setTags((prev) => {
        const existingLower = new Set(prev.map((t) => t.name.toLowerCase()))
        const next = [...prev]
        for (const name of parts) {
          if (existingLower.has(name.toLowerCase())) continue
          const tag: ClienteTag = {
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
    },
    [],
  )

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

  const value = useMemo<ClienteTagContextValue>(
    () => ({ tags, createTags, renameTag, recolorTag, deleteTag }),
    [tags, createTags, renameTag, recolorTag, deleteTag],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useClienteTags() {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error("useClienteTags must be used within ClienteTagProvider")
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
