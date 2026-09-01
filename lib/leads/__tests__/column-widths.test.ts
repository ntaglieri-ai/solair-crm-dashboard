import { describe, expect, it } from "vitest"
import {
  fitLeadColumnWidthsToViewport,
  minimumLeadColumnWidth,
} from "@/lib/leads/column-widths"
import type { LeadColumnId } from "@/lib/mock-data"

describe("fitLeadColumnWidthsToViewport", () => {
  it("distribuisce lo spazio libero tra le colonne visibili", () => {
    const columns: LeadColumnId[] = ["Città", "E-mail", "Valutazione"]
    const preferredWidths = {
      Città: minimumLeadColumnWidth("Città"),
      "E-mail": minimumLeadColumnWidth("E-mail"),
      Valutazione: minimumLeadColumnWidth("Valutazione"),
    } as Record<LeadColumnId, number>

    const widths = fitLeadColumnWidthsToViewport({
      columns,
      preferredWidths,
      viewportWidth: 900,
      fixedWidth: 124,
    })

    const total = columns.reduce((sum, column) => sum + widths[column], 0)
    expect(total).toBe(776)
    expect(widths["E-mail"]).toBeGreaterThan(preferredWidths["E-mail"])
    expect(widths.Città).toBeGreaterThan(preferredWidths.Città)
    expect(widths.Valutazione).toBeGreaterThan(preferredWidths.Valutazione)
  })

  it("non comprime le colonne quando serve lo scroll orizzontale", () => {
    const columns: LeadColumnId[] = ["Città", "E-mail", "Valutazione"]
    const preferredWidths = {
      Città: 160,
      "E-mail": 260,
      Valutazione: 150,
    } as Record<LeadColumnId, number>

    const widths = fitLeadColumnWidthsToViewport({
      columns,
      preferredWidths,
      viewportWidth: 420,
      fixedWidth: 124,
    })

    expect(widths).toEqual(preferredWidths)
  })
})
