import { describe, expect, it } from "vitest"

import {
  confermaSemplice,
  entitaDaSelezioneSemplice,
  nomeDaRispostaSemplice,
  richiestaLetturaDocumenti,
  rifiutoSemplice,
  salutoSemplice,
} from "@/lib/solair-ai/dialogo"

describe("entitaDaSelezioneSemplice", () => {
  it("riconosce quando l'utente sta solo scegliendo il tipo record", () => {
    expect(entitaDaSelezioneSemplice("cliente")).toBe("cliente")
    expect(entitaDaSelezioneSemplice("Clienti")).toBe("cliente")
    expect(entitaDaSelezioneSemplice("un cliente")).toBe("cliente")
    expect(entitaDaSelezioneSemplice("lead")).toBe("lead")
    expect(entitaDaSelezioneSemplice("installatori")).toBe("installatore")
    expect(entitaDaSelezioneSemplice("l'installatore")).toBe("installatore")
  })

  it("non blocca domande reali o messaggi che contengono anche un nome", () => {
    expect(entitaDaSelezioneSemplice("quali clienti hanno il CER?")).toBeNull()
    expect(entitaDaSelezioneSemplice("cliente Mario Rossi")).toBeNull()
    expect(entitaDaSelezioneSemplice("dimmi i lead nuovi")).toBeNull()
  })
})

describe("confermaSemplice e rifiutoSemplice", () => {
  it("riconosce risposte brevi senza passare dal modello", () => {
    expect(confermaSemplice("sì")).toBe(true)
    expect(confermaSemplice("procedi")).toBe(true)
    expect(rifiutoSemplice("no")).toBe(true)
    expect(rifiutoSemplice("lascia stare")).toBe(true)
  })
})

describe("salutoSemplice", () => {
  it("riconosce saluti che non sono richieste operative", () => {
    expect(salutoSemplice("ciao")).toBe(true)
    expect(salutoSemplice("Buongiorno SolairAI")).toBe(true)
    expect(salutoSemplice("ciao, mi riassumi Mario Rossi?")).toBe(false)
  })
})

describe("nomeDaRispostaSemplice", () => {
  it("accetta un nome o una ragione sociale breve", () => {
    expect(nomeDaRispostaSemplice("Andrea Mazzotti")).toBe("Andrea Mazzotti")
    expect(nomeDaRispostaSemplice("Solair Group Srl")).toBe("Solair Group Srl")
  })

  it("scarta domande, comandi e selezioni di modulo", () => {
    expect(nomeDaRispostaSemplice("quanto manca?")).toBeNull()
    expect(nomeDaRispostaSemplice("leggi documenti")).toBeNull()
    expect(nomeDaRispostaSemplice("cliente")).toBeNull()
  })
})

describe("richiestaLetturaDocumenti", () => {
  it("riconosce quando l'utente chiede esplicitamente il giro lento su Nextcloud", () => {
    expect(richiestaLetturaDocumenti("leggi documenti")).toBe(true)
    expect(richiestaLetturaDocumenti("controlla la cartella Nextcloud")).toBe(true)
    expect(richiestaLetturaDocumenti("aggiorna i campi CRM")).toBe(true)
  })

  it("lascia le normali domande documentali al percorso indice", () => {
    expect(richiestaLetturaDocumenti("quale contratto ha firmato?")).toBe(false)
  })
})
