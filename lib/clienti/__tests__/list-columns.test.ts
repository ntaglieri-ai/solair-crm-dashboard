import { describe, expect, it } from "vitest"
import { listColumnsForFields, serveBadgeAttivita, serveTag } from "../repository"

function colonne(select: string): Set<string> {
  return new Set(select.split(",").map((valore) => valore.trim()))
}

describe("listColumnsForFields", () => {
  it("legge sempre e-mail e cellulare, anche se le colonne non sono visibili", () => {
    // Le icone di contatto rapido stanno nella cella del nome e si disegnano
    // sempre: senza queste due colonne restavano spente su tutta la lista, e
    // non si poteva scrivere a nessun cliente pur avendo l'indirizzo a
    // database.
    const select = colonne(listColumnsForFields(["Nome Clienti"], ""))

    expect(select.has("email")).toBe(true)
    expect(select.has("cellulare")).toBe(true)
  })

  it("legge i campi richiesti e non quelli esclusi", () => {
    const select = colonne(listColumnsForFields(["Nome Clienti"], ""))

    expect(select.has("nome_clienti")).toBe(true)
    expect(select.has("importo_contrattuale")).toBe(false)
  })

  it("con '*' legge tutti i campi del record", () => {
    const select = colonne(listColumnsForFields(["*"], ""))

    expect(select.has("nome_clienti")).toBe(true)
    expect(select.has("importo_contrattuale")).toBe(true)
  })

  it("include la colonna di ordinamento anche se non richiesta", () => {
    const select = colonne(listColumnsForFields(["Nome Clienti"], "importo_contrattuale"))

    expect(select.has("importo_contrattuale")).toBe(true)
  })
})

describe("letture accessorie", () => {
  it("non legge i compiti aperti se il badge non è fra le colonne", () => {
    // Costa un'interrogazione a parte sulla tabella dei compiti: chiederla
    // per un dato che nessuno guarda rallenta ogni caricamento della lista.
    expect(serveBadgeAttivita(["Nome Clienti"])).toBe(false)
    expect(serveBadgeAttivita(["Nome Clienti", "Badge dell'attività"])).toBe(true)
  })

  it("non legge i tag se la colonna Tag non è richiesta", () => {
    expect(serveTag(["Nome Clienti"])).toBe(false)
    expect(serveTag(["Nome Clienti", "Tag"])).toBe(true)
  })

  it("con '*' legge tutto", () => {
    expect(serveBadgeAttivita(["*"])).toBe(true)
    expect(serveTag(["*"])).toBe(true)
  })

  it("con l'elenco vuoto vale quello che mostrano le colonne di default", () => {
    // [] non significa "niente": significa "quelle di default".
    expect(serveBadgeAttivita([])).toBe(true)
    expect(serveTag([])).toBe(true)
  })
})
