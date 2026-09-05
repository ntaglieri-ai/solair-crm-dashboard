import { describe, expect, it } from "vitest"
import {
  applyRobertaSyncChecks,
  type RobertaSyncResult,
} from "@/lib/roberta/knowledge"

function result(overrides: Partial<RobertaSyncResult> = {}): RobertaSyncResult {
  return {
    activeSources: 1,
    sources: 0,
    updated: 0,
    reused: 0,
    chunks: 0,
    catalogItems: 0,
    scansPending: 0,
    staleSources: 0,
    staleSourceKeys: [],
    warnings: [],
    errors: [],
    ...overrides,
  }
}

describe("applyRobertaSyncChecks", () => {
  it("segnala errore quando ci sono fonti attive ma zero PDF", () => {
    const checked = applyRobertaSyncChecks(result(), {
      activeSources: 1,
      staleSourceKeys: [],
      staleSourcesDeleted: true,
    })

    expect(checked.errors).toContain(
      "1 fonte/i RobertaBot attiva/e ma nessun PDF trovato nelle cartelle selezionate",
    )
    expect(checked.errors).toContain("Ultima sincronizzazione senza nessun documento processato")
  })

  it("segnala errore quando l'indice vecchio resta presente", () => {
    const checked = applyRobertaSyncChecks(result(), {
      activeSources: 1,
      staleSourceKeys: ["Solair/vecchio.pdf"],
      staleSourcesDeleted: false,
    })

    expect(checked.staleSources).toBe(1)
    expect(checked.errors).toContain(
      "1 documento/i RobertaBot non più presenti nelle fonti configurate: indice vecchio ancora presente",
    )
  })

  it("segnala warning quando rimuove fonti obsolete dall'indice", () => {
    const checked = applyRobertaSyncChecks(result({ sources: 2, updated: 1, reused: 1 }), {
      activeSources: 1,
      staleSourceKeys: ["Solair/vecchio.pdf"],
      staleSourcesDeleted: true,
    })

    expect(checked.errors).toEqual([])
    expect(checked.warnings).toContain(
      "1 documento/i RobertaBot non più presenti nelle fonti configurate: rimossi dall'indice",
    )
  })
})
