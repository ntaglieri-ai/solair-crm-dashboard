import { describe, expect, it } from "vitest"

import { classificaDocumentoCrm } from "@/lib/solair-ai/document-filter"

describe("classificaDocumentoCrm", () => {
  it("tratta le planimetrie come allegati senza chiamata LLM", () => {
    const esito = classificaDocumentoCrm({
      nome: "Nando Taglieri - piantina casa.pdf",
      path: "Solair/Solair-Group/Clienti/Nando Taglieri - piantina casa.pdf",
      testo: "Scala 1:100 piano terra",
    })

    expect(esito).toMatchObject({ usaLlm: false, soloAllegato: true })
  })

  it("manda all'LLM i documenti CRM con segnali locali forti", () => {
    const esito = classificaDocumentoCrm({
      nome: "Nando Taglieri - verbale sopralluogo.pdf",
      path: "Solair/Solair-Group/Clienti/Nando Taglieri - verbale sopralluogo.pdf",
      testo: "Cliente Nando Taglieri, telefono 333 1234567, POD IT001E12345678, indirizzo via Roma 1.",
    })

    expect(esito.usaLlm).toBe(true)
    expect(esito.soloAllegato).toBe(false)
  })

  it("non spende AI su archivi e backup anche se appartengono al record", () => {
    const esito = classificaDocumentoCrm({
      nome: "Nando Taglieri - backup documenti.zip",
      path: "Solair/Solair-Group/Clienti/Nando Taglieri - backup documenti.zip",
      testo: "contratto preventivo telefono 333 1234567",
    })

    expect(esito).toMatchObject({ usaLlm: false, soloAllegato: true })
  })

  it("non chiama l'LLM su documenti generici senza segnali CRM", () => {
    const esito = classificaDocumentoCrm({
      nome: "documento.pdf",
      path: "Solair/Solair-Group/Clienti/Nando Taglieri/documento.pdf",
      testo: "Note varie senza dati anagrafici o tecnici utili alla scheda.",
    })

    expect(esito).toMatchObject({ usaLlm: false, soloAllegato: true })
  })
})
