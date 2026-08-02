// Estrazione del testo dai PDF di listino.
//
// Si usa unpdf (wrapper di pdf.js pensato per ambienti serverless) invece di
// pdf-parse: quest'ultimo non si importa in ESM senza workaround sul path
// interno, mentre unpdf gira senza build step ne' binari nativi.
//
// L'estrazione NON e' quella "piatta" di default. I listini Solair sono quasi
// tutti tabelle prezzi: concatenando i frammenti nell'ordine in cui pdf.js li
// emette si ottiene roba come "kWp678910,615,921,29.80010.80011.800", da cui
// non si capisce quale prezzo appartenga a quale taglia. Qui i frammenti
// vengono raggruppati per coordinata Y (= riga visiva) e ordinati per X, con
// le colonne separate da " | ": la stessa tabella diventa
//   kWp | 10,6 | 15,9 | 21,2
//   6 | 9.800 | 10.800 | 11.800
// che il modello puo' leggere correttamente.

import { getDocumentProxy } from "unpdf"

// Tolleranza verticale entro cui due frammenti sono considerati sulla stessa
// riga: i PDF hanno micro-scostamenti di baseline fra le celle.
const TOLLERANZA_RIGA_PT = 3

type Frammento = { x: number; testo: string }

/**
 * Alcuni listini hanno il font con il simbolo euro mappato sul generico "¤"
 * (currency sign). Lasciarlo passare significa far scrivere "7.590 ¤" al
 * chatbot: si normalizza qui, dove si conosce il contesto (sono tutti prezzi).
 */
function normalizza(testo: string): string {
  return testo.replace(/¤/g, "€")
}

function testoDellaPagina(items: { str?: string; transform?: number[] }[]): string {
  const righe = new Map<number, Frammento[]>()

  for (const item of items) {
    const testo = typeof item.str === "string" ? item.str.trim() : ""
    if (!testo || !item.transform) continue

    const y = Math.round(item.transform[5])
    // Si riusa la riga esistente piu' vicina entro la tolleranza, cosi' celle
    // con baseline leggermente diverse non generano righe separate.
    const chiave = [...righe.keys()].find((k) => Math.abs(k - y) <= TOLLERANZA_RIGA_PT) ?? y

    const frammenti = righe.get(chiave)
    if (frammenti) frammenti.push({ x: item.transform[4], testo })
    else righe.set(chiave, [{ x: item.transform[4], testo }])
  }

  return [...righe.entries()]
    .sort((a, b) => b[0] - a[0]) // Y cresce verso l'alto: dall'alto al basso.
    .map(([, frammenti]) =>
      frammenti
        .sort((a, b) => a.x - b.x)
        .map((f) => f.testo)
        .join(" | "),
    )
    .filter((riga) => riga.length > 0)
    .join("\n")
}

/**
 * Testo di un PDF, con le righe delle tabelle preservate.
 *
 * Restituisce null se il PDF non contiene testo estraibile (tipicamente una
 * scansione immagine): il chiamante lo tratta come documento senza testo, non
 * come errore.
 *
 * Lancia solo se il PDF e' illeggibile: la gestione sta nel chiamante, che
 * salta il singolo file senza far fallire l'intera risposta.
 */
export async function estraiTestoDaPdf(contenuto: Uint8Array): Promise<string | null> {
  // pdf.js prende possesso del buffer che riceve e lo lascia "detached": dopo
  // questa chiamata l'originale risulterebbe vuoto al chiamante. Gli si passa
  // una copia, cosi' chi ha scaricato il PDF puo' ancora riusarne i byte (per
  // le scansioni immagine servono per il base64).
  const pdf = await getDocumentProxy(new Uint8Array(contenuto))
  const pagine: string[] = []

  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n)
    const content = await pagina.getTextContent()
    const testo = testoDellaPagina(content.items as { str?: string; transform?: number[] }[])
    if (testo.length > 0) pagine.push(testo)
  }

  const completo = normalizza(pagine.join("\n\n")).trim()
  return completo.length > 0 ? completo : null
}
