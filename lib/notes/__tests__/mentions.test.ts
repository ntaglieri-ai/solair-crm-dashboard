import { describe, expect, it } from "vitest"
import { sanitizeNoteMentions } from "../mentions"

const users = [
  { id: "user-1", nome: "Mario Rossi" },
  { id: "user-2", nome: "Maria Verdi" },
]

describe("sanitizeNoteMentions", () => {
  it("keeps valid mentions and resolves the canonical CRM name", () => {
    const text = "Sentire @Mario Rossi domani"
    expect(sanitizeNoteMentions(text, [{ userId: "user-1", start: 8, end: 20 }], users)).toEqual([
      { userId: "user-1", name: "Mario Rossi", start: 8, end: 20 },
    ])
  })

  it("rejects forged, stale and unknown mention ranges", () => {
    const text = "Sentire @Mario Rossi"
    expect(sanitizeNoteMentions(text, [
      { userId: "user-1", start: 0, end: 12 },
      { userId: "missing", start: 8, end: 20 },
    ], users)).toEqual([])
  })
})
