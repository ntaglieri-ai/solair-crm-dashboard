import { describe, expect, it } from "vitest"
import { estimateColumnWidth } from "@/lib/shared/table-column-widths"

describe("estimateColumnWidth", () => {
  it("usa label e valori reali entro minimo e massimo", () => {
    expect(
      estimateColumnWidth({
        label: "Nome",
        values: ["Mario", "Francesco Giovanni Merlino - Giuseppe Lo Medico"],
        min: 120,
        max: 420,
      }),
    ).toBeGreaterThan(300)
  })

  it("non supera il massimo configurato", () => {
    expect(
      estimateColumnWidth({
        label: "Note",
        values: ["x".repeat(500)],
        min: 120,
        max: 280,
      }),
    ).toBe(280)
  })

  it("gestisce array e oggetti linkati", () => {
    const width = estimateColumnWidth({
      label: "Collegamento",
      values: [["NUOVO CONTRATTO DIGITALE", "Sopralluogo"], { nome: "Cliente molto lungo" }],
      min: 120,
      max: 360,
    })

    expect(width).toBeGreaterThan(220)
  })
})

