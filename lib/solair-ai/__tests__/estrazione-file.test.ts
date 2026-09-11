import JSZip from "jszip"
import { describe, expect, it } from "vitest"

import { estraiContenutoDaBuffer } from "@/lib/solair-ai/estrazione-file"

async function zipBuffer(files: Record<string, string>) {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content)
  }
  return zip.generateAsync({ type: "uint8array" })
}

describe("estraiContenutoDaBuffer", () => {
  it("legge il testo dei file Word docx", async () => {
    const buffer = await zipBuffer({
      "word/document.xml": `
        <w:document>
          <w:body>
            <w:p><w:r><w:t>Cliente Mario Rossi</w:t></w:r></w:p>
            <w:p><w:r><w:t>Impianto 6,5 kWp a Palermo</w:t></w:r></w:p>
          </w:body>
        </w:document>
      `,
    })

    const estratto = await estraiContenutoDaBuffer({
      nome: "scheda-cliente.docx",
      path: "Clienti/Mario Rossi/scheda-cliente.docx",
      buffer,
      contentType: null,
    })

    expect(estratto.stato).toBe("ready")
    expect(estratto.testo).toContain("Cliente Mario Rossi")
    expect(estratto.testo).toContain("Impianto 6,5 kWp")
  })

  it("legge celle e stringhe condivise dei file Excel xlsx", async () => {
    const buffer = await zipBuffer({
      "xl/sharedStrings.xml": `
        <sst>
          <si><t>Lead</t></si>
          <si><t>Giulia Bianchi</t></si>
        </sst>
      `,
      "xl/worksheets/sheet1.xml": `
        <worksheet>
          <sheetData>
            <row>
              <c t="s"><v>0</v></c>
              <c t="s"><v>1</v></c>
              <c><v>7200</v></c>
            </row>
          </sheetData>
        </worksheet>
      `,
    })

    const estratto = await estraiContenutoDaBuffer({
      nome: "lead.xlsx",
      path: "Lead/lead.xlsx",
      buffer,
      contentType: null,
    })

    expect(estratto.stato).toBe("ready")
    expect(estratto.testo).toContain("Lead | Giulia Bianchi | 7200")
  })

  it("legge il testo delle slide PowerPoint pptx", async () => {
    const buffer = await zipBuffer({
      "ppt/slides/slide1.xml": `
        <p:sld>
          <p:cSld>
            <a:p><a:r><a:t>Offerta installatore Sicilia</a:t></a:r></a:p>
          </p:cSld>
        </p:sld>
      `,
    })

    const estratto = await estraiContenutoDaBuffer({
      nome: "presentazione.pptx",
      path: "Installatori/presentazione.pptx",
      buffer,
      contentType: null,
    })

    expect(estratto.stato).toBe("ready")
    expect(estratto.testo).toContain("Offerta installatore Sicilia")
  })

  it("apre gli archivi zip e indicizza i file leggibili interni", async () => {
    const docx = await zipBuffer({
      "word/document.xml": "<w:document><w:body><w:p><w:t>Contratto interno archiviato</w:t></w:p></w:body></w:document>",
    })
    const zip = new JSZip()
    zip.file("note.txt", "Promemoria appuntamento sopralluogo")
    zip.file("documenti/contratto.docx", docx)
    const buffer = await zip.generateAsync({ type: "uint8array" })

    const estratto = await estraiContenutoDaBuffer({
      nome: "pratica.zip",
      path: "Clienti/Mario Rossi/pratica.zip",
      buffer,
      contentType: null,
    })

    expect(estratto.stato).toBe("ready")
    expect(estratto.testo).toContain("Promemoria appuntamento sopralluogo")
    expect(estratto.testo).toContain("Contratto interno archiviato")
  })
})
