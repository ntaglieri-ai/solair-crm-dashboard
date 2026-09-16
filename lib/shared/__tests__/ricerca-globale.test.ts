import { describe, expect, it } from "vitest"
import { patternRicercaGlobale } from "@/lib/shared/ricerca-globale"

describe("patternRicercaGlobale", () => {
  it("avvolge il testo fra wildcard", () => {
    expect(patternRicercaGlobale("rossi")).toBe("%rossi%")
  })

  it("toglie gli spazi ai bordi", () => {
    expect(patternRicercaGlobale("  rossi  ")).toBe("%rossi%")
  })

  it("neutralizza i caratteri che PostgREST leggerebbe come sintassi di .or()", () => {
    // Senza la sostituzione questi spezzerebbero l'espressione del filtro e
    // la query tornerebbe 400 invece di cercare.
    expect(patternRicercaGlobale("Rossi, Mario")).toBe("%Rossi  Mario%")
    expect(patternRicercaGlobale("Solair (Nord)")).toBe("%Solair  Nord%")
  })

  it("neutralizza wildcard ed escape scritti dall'utente", () => {
    expect(patternRicercaGlobale("100%")).toBe("%100%")
    expect(patternRicercaGlobale("a\\b")).toBe("%a b%")
  })

  it("restituisce stringa vuota quando non resta niente da cercare", () => {
    // Un pattern "%%" interrogherebbe il database chiedendo tutto: chi
    // chiama deve potersi fermare prima.
    expect(patternRicercaGlobale("")).toBe("")
    expect(patternRicercaGlobale("   ")).toBe("")
    expect(patternRicercaGlobale(",,()")).toBe("")
  })
})
