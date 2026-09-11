import { describe, expect, it } from "vitest"

import { scegliRecordPerDocumento } from "@/lib/solair-ai/record-match"

const records = [
  { id: "1", etichetta: "Nando Taglieri" },
  { id: "2", etichetta: "Mario Rossi" },
  { id: "3", etichetta: "Mario Esposito" },
]

describe("scegliRecordPerDocumento", () => {
  it("riconosce il record dal nome file", () => {
    expect(
      scegliRecordPerDocumento(records, {
        path: "Solair/Solair-Group/Clienti/contratto_Nando_Taglieri.pdf",
        nome: "contratto_Nando_Taglieri.pdf",
        testo: "",
      }),
    ).toMatchObject({ stato: "matched", record: { id: "1" } })
  })

  it("riconosce il record dal contenuto estratto", () => {
    expect(
      scegliRecordPerDocumento(records, {
        path: "Solair/Solair-Group/Clienti/documento.pdf",
        nome: "documento.pdf",
        testo: "Verbale di sopralluogo per il cliente Nando Taglieri.",
      }),
    ).toMatchObject({ stato: "matched", record: { id: "1" } })
  })

  it("non sceglie se il match e' ambiguo", () => {
    const match = scegliRecordPerDocumento(records, {
      path: "Solair/Solair-Group/Clienti/mario.pdf",
      nome: "mario.pdf",
      testo: "Mario",
    })
    expect(match.stato).toBe("none")
  })
})
