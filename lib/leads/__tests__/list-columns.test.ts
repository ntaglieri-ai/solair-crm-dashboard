import { describe, expect, it } from "vitest"
import { LEAD_COLUMNS } from "@/lib/mock-data"
import {
  LEAD_RELATION_FIELDS,
  leadFieldColumns,
  leadListColumnsForFields,
  leadListNeedsTags,
} from "@/lib/leads/list-columns"

function columns(select: string) {
  return new Set(select.split(",").filter(Boolean))
}

describe("lead list columns", () => {
  it("maps every visible data column to explicit database columns", () => {
    for (const column of LEAD_COLUMNS) {
      if (LEAD_RELATION_FIELDS.has(column.id)) continue
      expect(leadFieldColumns(column.id), column.id).not.toEqual([])
    }
  })

  it("selects visible fields and omits hidden data fields", () => {
    const select = columns(leadListColumnsForFields(["Nome Lead", "Creato da"]))

    expect(select.has("id")).toBe(true)
    expect(select.has("nome_lead")).toBe(true)
    expect(select.has("creato_da")).toBe(true)
    expect(select.has("social_lead_id")).toBe(false)
    expect(leadListNeedsTags(["Nome Lead", "Creato da"])).toBe(false)
    expect(leadListNeedsTags(["Tag"])).toBe(true)
  })

  it("selects all known lead data fields for full export paths", () => {
    const select = columns(leadListColumnsForFields(["*"]))

    expect(select.has("nome_lead")).toBe(true)
    expect(select.has("creato_da")).toBe(true)
    expect(select.has("social_lead_id")).toBe(true)
    expect(select.has("zoho_installatore_sopralluogo_nome")).toBe(true)
  })
})
