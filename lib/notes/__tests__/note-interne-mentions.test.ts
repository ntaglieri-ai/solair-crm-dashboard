import { describe, expect, it } from "vitest"
import { destinatariMenzioni } from "../note-interne-mentions-server"
import type { NoteMention } from "../mentions"

function menzione(userId: string, start = 0): NoteMention {
  return { userId, name: userId, start, end: start + 5 }
}

describe("destinatariMenzioni", () => {
  it("avvisa chi e' menzionato", () => {
    const destinatari = destinatariMenzioni([menzione("anna"), menzione("bruno", 10)])
    expect([...destinatari]).toEqual(["anna", "bruno"])
  })

  it("non avvisa nessuno quando la nota non menziona nessuno", () => {
    // Scrivere una nota non deve mandare email a nessuno: e' la differenza
    // fra un avviso e il rumore.
    expect(destinatariMenzioni([]).size).toBe(0)
  })

  it("avvisa anche l'autore che menziona se stesso", () => {
    // Menzionarsi e' un modo di lasciarsi un promemoria: l'avviso arriva
    // come per gli altri.
    expect(destinatariMenzioni([menzione("anna")]).has("anna")).toBe(true)
  })

  it("non riavvisa chi era gia' menzionato prima della modifica", () => {
    // Correggere un refuso in una nota non deve far ripartire l'email a chi
    // l'aveva gia' ricevuta.
    const destinatari = destinatariMenzioni(
      [menzione("anna"), menzione("bruno", 10)],
      [menzione("anna")],
    )
    expect([...destinatari]).toEqual(["bruno"])
  })

  it("non ripete lo stesso destinatario menzionato due volte", () => {
    const destinatari = destinatariMenzioni([menzione("anna"), menzione("anna", 20)])
    expect([...destinatari]).toEqual(["anna"])
  })
})
