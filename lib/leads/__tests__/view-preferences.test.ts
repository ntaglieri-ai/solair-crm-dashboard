import { describe, expect, it } from "vitest"
import { LEAD_COLUMNS } from "@/lib/mock-data"
import { minimumLeadColumnWidth } from "@/lib/leads/column-widths"
import { parseLeadViewPreferences } from "@/lib/leads/view-preferences"

const validColumnIds = new Set(LEAD_COLUMNS.map((column) => column.id))

describe("parseLeadViewPreferences", () => {
  it("rialza le larghezze salvate sotto il minimo della colonna", () => {
    const prefs = parseLeadViewPreferences(
      encodeURIComponent(
        JSON.stringify({
          version: 3,
          owner: "user-1",
          visibleCols: ["E-mail", "Creato da"],
          columnWidths: {
            "E-mail": 90,
            "Creato da": 40,
          },
          density: "normale",
        }),
      ),
      "user-1",
      validColumnIds,
    )

    expect(prefs?.columnWidths["E-mail"]).toBe(minimumLeadColumnWidth("E-mail"))
    expect(prefs?.columnWidths["Creato da"]).toBe(
      minimumLeadColumnWidth("Creato da"),
    )
  })
})
