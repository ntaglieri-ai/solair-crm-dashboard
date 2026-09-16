import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { spostaCampo } from "../sposta-campo"

const chiamate: { url: string; body: unknown }[] = []
let risposte: { ok: boolean; corpo: unknown }[] = []

beforeEach(() => {
  chiamate.length = 0
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    chiamate.push({ url, body: JSON.parse(String(init.body)) })
    const r = risposte.shift() ?? { ok: true, corpo: { ok: true } }
    return { ok: r.ok, json: async () => r.corpo } as Response
  })
})
afterEach(() => vi.unstubAllGlobals())

describe("spostaCampo", () => {
  it("sposta in un blocco esistente con una sola chiamata", async () => {
    risposte = [{ ok: true, corpo: { ok: true } }]
    expect(await spostaCampo("clienti", "c1", { tipo: "blocco", bloccoId: "b2" })).toEqual({ ok: true })
    expect(chiamate).toHaveLength(1)
    expect(chiamate[0].body).toEqual({ modulo: "clienti", tipo: "campo", id: "c1", bloccoId: "b2" })
  })

  it("crea il blocco prima di spostare, su una pagina che non ne ha", async () => {
    // Documenti non ha blocchi: senza questo ramo resterebbe irraggiungibile.
    risposte = [
      { ok: true, corpo: { id: "b-nuovo" } },
      { ok: true, corpo: { ok: true } },
    ]
    expect(
      await spostaCampo("clienti", "c1", {
        tipo: "pagina-vuota", paginaId: "p-doc", etichettaBlocco: "Documenti",
      }),
    ).toEqual({ ok: true })
    expect(chiamate).toHaveLength(2)
    expect(chiamate[0].body).toEqual({ modulo: "clienti", tipo: "blocco", paginaId: "p-doc", label: "Documenti" })
    expect(chiamate[1].body).toEqual({ modulo: "clienti", tipo: "campo", id: "c1", bloccoId: "b-nuovo" })
  })

  it("non prova a spostare se la creazione del blocco fallisce", async () => {
    risposte = [{ ok: false, corpo: { error: "Pagina inesistente" } }]
    expect(
      await spostaCampo("clienti", "c1", {
        tipo: "pagina-vuota", paginaId: "boh", etichettaBlocco: "X",
      }),
    ).toEqual({ ok: false, errore: "Pagina inesistente" })
    expect(chiamate).toHaveLength(1)
  })

  it("riporta l'errore del server invece di dichiarare successo", async () => {
    risposte = [{ ok: false, corpo: { error: "Blocco di destinazione inesistente o di un altro modulo" } }]
    expect(await spostaCampo("clienti", "c1", { tipo: "blocco", bloccoId: "altro-modulo" }))
      .toEqual({ ok: false, errore: "Blocco di destinazione inesistente o di un altro modulo" })
  })
})
