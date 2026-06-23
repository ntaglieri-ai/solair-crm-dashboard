// Logica PURA dei filtri avanzati Lead (no React, no "use client").
// Condivisa tra il pannello UI (client) e il repository server-side (API).
import type { Lead } from "@/lib/mock-data"

export type FieldType = "text" | "enum" | "date" | "number" | "boolean"

export type FieldValue =
  | { type: "text"; contains: string }
  | { type: "enum"; selected: string[] }
  | { type: "date"; from: string; to: string }
  | { type: "number"; min: string; max: string }
  | { type: "boolean"; value: "all" | "yes" | "no" }

export interface AdvancedFilterState {
  quick: {
    badgeAttivita: boolean
    badgeNota: boolean
    nonToccati: boolean
    toccati: boolean
  }
  fields: Record<string, FieldValue>
}

export const EMPTY_ADVANCED: AdvancedFilterState = {
  quick: {
    badgeAttivita: false,
    badgeNota: false,
    nonToccati: false,
    toccati: false,
  },
  fields: {},
}

// Parsing date "12 Giu 2026 07:08" → timestamp
const MONTHS: Record<string, number> = {
  Gen: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  Mag: 4,
  Giu: 5,
  Lug: 6,
  Ago: 7,
  Set: 8,
  Ott: 9,
  Nov: 10,
  Dic: 11,
}

export function parseLeadDate(value: unknown): number | null {
  if (typeof value !== "string") return null
  const m = value.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/)
  if (!m) return null
  const day = Number(m[1])
  const mon = MONTHS[m[2] as keyof typeof MONTHS]
  const yr = Number(m[3])
  if (mon === undefined) return null
  return new Date(yr, mon, day).getTime()
}

export function isFieldActive(v: FieldValue): boolean {
  switch (v.type) {
    case "text":
      return v.contains.trim() !== ""
    case "enum":
      return v.selected.length > 0
    case "date":
      return v.from !== "" || v.to !== ""
    case "number":
      return v.min !== "" || v.max !== ""
    case "boolean":
      return v.value !== "all"
  }
}

export function countActiveAdvanced(state: AdvancedFilterState): number {
  const quick = Object.values(state.quick).filter(Boolean).length
  const fields = Object.values(state.fields).filter(isFieldActive).length
  return quick + fields
}

export function matchesAdvanced(lead: Lead, state: AdvancedFilterState): boolean {
  const { quick, fields } = state

  // Filtri rapidi
  if (quick.badgeAttivita && !lead["Badge dell'attività"]) return false
  if (quick.badgeNota && !lead["Badge di nota"]) return false
  const toccato = lead.attivita.length > 1
  if (quick.nonToccati && toccato) return false
  if (quick.toccati && !toccato) return false

  // Filtri per campo (AND)
  for (const [id, v] of Object.entries(fields)) {
    if (!isFieldActive(v)) continue
    const raw = lead[id as keyof Lead]

    if (v.type === "text") {
      const hay = String(raw ?? "").toLowerCase()
      if (!hay.includes(v.contains.trim().toLowerCase())) return false
    } else if (v.type === "enum") {
      if (id === "Tag") {
        const leadTags = lead.Tag
        if (!v.selected.some((s) => leadTags.includes(s))) return false
      } else {
        if (!v.selected.includes(String(raw ?? ""))) return false
      }
    } else if (v.type === "number") {
      const num = typeof raw === "number" ? raw : Number(raw)
      if (Number.isNaN(num)) return false
      if (v.min !== "" && num < Number(v.min)) return false
      if (v.max !== "" && num > Number(v.max)) return false
    } else if (v.type === "date") {
      const ts = parseLeadDate(raw)
      if (ts === null) return false
      if (v.from !== "" && ts < new Date(v.from).getTime()) return false
      if (v.to !== "" && ts > new Date(v.to).getTime()) return false
    } else if (v.type === "boolean") {
      const wanted = v.value === "yes"
      if (Boolean(raw) !== wanted) return false
    }
  }

  return true
}
