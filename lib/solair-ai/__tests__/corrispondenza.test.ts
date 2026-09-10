import { describe, expect, it } from "vitest"

import { fileRiguardaNome, paroleDelNome } from "@/lib/solair-ai/corrispondenza"

/**
 * Un errore qui non si vede: SolairAI legge i documenti sbagliati e li
 * riversa su una scheda che non c'entra, senza mai segnalare niente.
 */

const CARTELLA = "Solair/SolairAI/Lead"

function riguarda(path: string, nome: string, cartella = CARTELLA) {
  return fileRiguardaNome(path, cartella, paroleDelNome(nome))
}

describe("fileRiguardaNome", () => {
  it("prende i file nella sottocartella intestata alla persona", () => {
    expect(riguarda(`${CARTELLA}/Mario Rossi/preventivo.pdf`, "Mario Rossi")).toBe(true)
  })

  it("prende i file col nome nel titolo, anche col trattino", () => {
    expect(riguarda(`${CARTELLA}/mario-rossi-preventivo.pdf`, "Mario Rossi")).toBe(true)
  })

  it("non guarda l'ordine di nome e cognome", () => {
    expect(riguarda(`${CARTELLA}/ROSSI Mario.pdf`, "Mario Rossi")).toBe(true)
  })

  it("ignora accenti e maiuscole", () => {
    expect(riguarda(`${CARTELLA}/niccolo-di-bartolo/contratto.pdf`, "Niccolò Di Bàrtolo")).toBe(
      true,
    )
  })

  it("non prende un omonimo parziale", () => {
    // Il caso che conta: due Mario nella stessa cartella.
    expect(riguarda(`${CARTELLA}/Mario Esposito/contratto.pdf`, "Mario Rossi")).toBe(false)
    expect(riguarda(`${CARTELLA}/Mario Rossi/contratto.pdf`, "Mario Esposito")).toBe(false)
  })

  it("non prende un file di un'altra persona solo perche' il cognome torna", () => {
    expect(riguarda(`${CARTELLA}/Rossi Giulia/scheda.pdf`, "Mario Rossi")).toBe(false)
  })

  it("non conta le parole della cartella configurata", () => {
    // Con una radice che contiene per caso una parola del nome, confrontare
    // il percorso intero farebbe passare tutto quello che c'e' dentro.
    const radice = "Solair/Rossi/Lead"
    expect(riguarda(`${radice}/Giulia Bianchi/scheda.pdf`, "Mario Rossi", radice)).toBe(false)
    expect(riguarda(`${radice}/Mario Rossi/scheda.pdf`, "Mario Rossi", radice)).toBe(true)
  })

  it("non prende niente quando il nome non ha parole utilizzabili", () => {
    expect(riguarda(`${CARTELLA}/qualcosa.pdf`, "  ")).toBe(false)
    expect(riguarda(`${CARTELLA}/qualcosa.pdf`, "M. R.")).toBe(false)
  })
})

describe("paroleDelNome", () => {
  it("scompone il nome in parole normalizzate, scartando le iniziali", () => {
    expect(paroleDelNome("Mario Rossi")).toEqual(["mario", "rossi"])
    expect(paroleDelNome("Niccolò Di Bàrtolo")).toEqual(["niccolo", "di", "bartolo"])
    expect(paroleDelNome("M. Rossi")).toEqual(["rossi"])
    // "S.r.l." si sbriciola in tre lettere singole, che cadono tutte: di una
    // ragione sociale resta la parte che identifica davvero l'azienda.
    expect(paroleDelNome("Solar S.r.l.")).toEqual(["solar"])
  })
})
