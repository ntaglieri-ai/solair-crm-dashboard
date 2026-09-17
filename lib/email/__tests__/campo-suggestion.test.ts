import { describe, expect, it } from "vitest"
import { Schema } from "@tiptap/pm/model"
import { findSuggestionMatch } from "@tiptap/suggestion"

/**
 * Verifica diretta della logica di trigger di CampoSuggestion
 * (components/shared/campo-suggestion.tsx), senza passare da un editor React:
 * qui basta un documento ProseMirror minimo, nessun DOM richiesto.
 *
 * Serve perche' @tiptap/suggestion dichiara @tiptap/core e @tiptap/pm come
 * PEER dependencies (non dependencies dirette): senza @tiptap/pm esplicito
 * nel package.json del progetto, pnpm arrivava a risolvere due istanze
 * diverse dello stesso pacchetto (una per @tiptap/suggestion, una per il
 * resto dell'editor) — il plugin si registrava senza errori ma non si
 * attivava mai, silenziosamente. Questo test blocca una regressione futura
 * sulla stessa causa, anche se la manifestazione (nessun errore in console)
 * non lascerebbe altro indizio.
 */

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*", toDOM: () => ["p", 0] },
    text: { group: "inline" },
  },
})

function match(testo: string) {
  const paragrafo = testo
    ? schema.node("paragraph", null, schema.text(testo))
    : schema.node("paragraph")
  const doc = schema.node("doc", null, [paragrafo])
  const posizioneFinale = doc.content.size - 1
  const $position = doc.resolve(posizioneFinale)

  return findSuggestionMatch({
    char: "{",
    allowSpaces: true,
    allowToIncludeChar: false,
    allowedPrefixes: [" "],
    startOfLine: false,
    $position,
  })
}

describe("trigger '{' di CampoSuggestion", () => {
  it("riconosce il campo a inizio testo", () => {
    expect(match("{test")).toMatchObject({ query: "test", text: "{test" })
  })

  it("riconosce il campo dopo una parola e uno spazio", () => {
    expect(match("ciao {in")).toMatchObject({ query: "in", text: "{in" })
  })

  it("riconosce anche la sola graffa appena digitata", () => {
    expect(match("{")).toMatchObject({ query: "", text: "{" })
  })

  it("il nome campo puo' contenere spazi (es. 'Nr. Moduli')", () => {
    expect(match("{Nr. Mod")).toMatchObject({ query: "Nr. Mod", text: "{Nr. Mod" })
  })

  it("non scatta senza la graffa", () => {
    expect(match("ciao installatori")).toBeNull()
  })
})
