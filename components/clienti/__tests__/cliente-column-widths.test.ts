import { describe, expect, it } from "vitest"
import { measuredCellText } from "../cliente-table"
import { estimateColumnWidth } from "@/lib/shared/table-column-widths"
import type { ClienteRecord } from "@/lib/mock-data"

const ownerNames = { "6114bac9-696e-48e0-97e1-3220ec676aa8": "Ivan Lo Faro" }

const cliente = {
  id: "c1",
  "Nome Clienti": "Antonino Molino",
  "Ora modifica": "2026-09-15T09:56:15.693+00:00",
  "Clienti Proprietario": "6114bac9-696e-48e0-97e1-3220ec676aa8",
  ClientiProprietarioNome: "Ivan Lo Faro",
  "Badge di nota": true,
  "Badge dell'attività": false,
} as unknown as ClienteRecord

describe("larghezza colonne clienti: si misura il testo mostrato", () => {
  it("riduce una data alla forma resa, non alla stringa ISO", () => {
    const shown = measuredCellText("Ora modifica", cliente, ownerNames)
    expect(shown).not.toContain("T09:56:15")
    expect(String(shown)).toMatch(/2026/)
    // La colonna deve restare piu' stretta di quanto la rendeva l'ISO grezzo.
    const iso = estimateColumnWidth({ label: "Ora modifica", values: [cliente["Ora modifica"]], min: 140, max: 520 })
    const reso = estimateColumnWidth({ label: "Ora modifica", values: [shown], min: 140, max: 520 })
    expect(reso).toBeLessThan(iso)
  })

  it("misura il proprietario sul nome, non sull'uuid", () => {
    expect(measuredCellText("Clienti Proprietario", cliente, ownerNames)).toBe("Ivan Lo Faro")
  })

  it("non fa pesare nulla alle colonne a sola icona", () => {
    expect(measuredCellText("Badge di nota", cliente, ownerNames)).toBe("")
    expect(measuredCellText("Badge dell'attività", cliente, ownerNames)).toBe("")
  })

  it("lascia passare invariati i valori gia' testuali", () => {
    expect(measuredCellText("Nome Clienti", cliente, ownerNames)).toBe("Antonino Molino")
  })
})
