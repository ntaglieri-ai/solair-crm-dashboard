import { describe, expect, it } from "vitest"
import { proprietarioSpuntato } from "../proprietario-menu"

const ANNA = "00000000-0000-4000-8000-00000000000a"
const BRUNO = "00000000-0000-4000-8000-00000000000b"

describe("spunta del proprietario nel menu contestuale", () => {
  it("segue il valore attuale della riga, anche dopo un cambio", () => {
    let riga = { "Clienti Proprietario": ANNA }
    expect(proprietarioSpuntato(riga, ANNA)).toBe(true)
    expect(proprietarioSpuntato(riga, BRUNO)).toBe(false)

    // La riga cambia (aggiornamento ottimistico o dato riletto dal server):
    // la spunta si sposta, senza copie locali rimaste indietro.
    riga = { "Clienti Proprietario": BRUNO }
    expect(proprietarioSpuntato(riga, ANNA)).toBe(false)
    expect(proprietarioSpuntato(riga, BRUNO)).toBe(true)
  })

  it("non spunta nessuno quando il cliente non ha proprietario", () => {
    expect(proprietarioSpuntato({ "Clienti Proprietario": undefined }, ANNA)).toBe(false)
    expect(proprietarioSpuntato({ "Clienti Proprietario": "" }, "")).toBe(false)
  })
})
