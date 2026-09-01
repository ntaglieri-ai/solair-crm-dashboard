import { describe, expect, it } from "vitest"
import { CLIENTE_COLUMNS } from "@/lib/mock-data"
import { parseClienteViewPreferences } from "@/lib/clienti/view-preferences"

const validColumnIds = new Set(CLIENTE_COLUMNS.map((column) => column.id))

describe("parseClienteViewPreferences", () => {
  it("ignora cookie di un altro utente", () => {
    const prefs = parseClienteViewPreferences(
      encodeURIComponent(
        JSON.stringify({
          version: 1,
          owner: "user-1",
          visibleCols: ["Nome Clienti", "Tag"],
          columnWidths: {},
          density: "normale",
        }),
      ),
      "user-2",
      validColumnIds,
    )

    expect(prefs).toBeNull()
  })

  it("normalizza colonne e larghezze salvate", () => {
    const prefs = parseClienteViewPreferences(
      encodeURIComponent(
        JSON.stringify({
          version: 1,
          owner: "user-1",
          visibleCols: ["Nome Clienti", "campo inesistente", "Tag"],
          columnWidths: {
            "Nome Clienti": 40,
            Tag: 999,
          },
          density: "densa",
        }),
      ),
      "user-1",
      validColumnIds,
    )

    expect(prefs?.visibleCols).toEqual(["Nome Clienti", "Tag"])
    expect(prefs?.columnWidths["Nome Clienti"]).toBe(72)
    expect(prefs?.columnWidths.Tag).toBe(480)
    expect(prefs?.density).toBe("densa")
  })
})
