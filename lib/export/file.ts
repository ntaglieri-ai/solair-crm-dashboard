"use client"

/**
 * Costruzione del file di export, condivisa da Clienti, Lead e Installatori.
 *
 * Prima ogni pagina aveva la sua `downloadXCsv()`: due copie quasi identiche
 * (clienti-client.tsx e leads-client.tsx) che scrivevano sempre TUTTE le
 * colonne del modulo, ignorando quelle scelte a schermo, e sempre e solo in
 * CSV. Le differenze fra le due erano accidentali, non volute — il tipo di
 * cosa che diverge ancora di piu' al terzo modulo.
 *
 * Qui il file si costruisce dalle colonne che gli vengono passate: la scelta
 * di QUALI colonne e' una decisione dell'interfaccia (vedi
 * components/shared/export-dialog.tsx), non di questo modulo.
 */

export type FormatoExport = "csv" | "xlsx"

export type ColonnaExport = {
  /** Chiave con cui leggere il valore dalla riga. */
  id: string
  /** Intestazione scritta nel file. */
  label: string
}

/**
 * Da valore del record a cella. Gli array (i Tag, tipicamente) diventano una
 * lista separata da virgola invece di "[object Object]", che e' quello che
 * usciva prima su ogni riga con piu' di un tag.
 */
function cella(valore: unknown): string {
  if (valore === null || valore === undefined) return ""
  if (Array.isArray(valore)) return valore.join(", ")
  if (typeof valore === "boolean") return valore ? "Sì" : "No"
  return String(valore)
}

/**
 * CSV con separatore `;` (Excel in locale italiano lo usa come separatore di
 * colonna: con la virgola aprirebbe tutto in una cella sola) e virgolette
 * raddoppiate secondo RFC 4180.
 *
 * Il BOM iniziale non e' decorativo: senza, Excel legge il file come ANSI e
 * ogni accento diventa un carattere sbagliato — "Città" -> "CittÃ ". Il CSV
 * esportato finora ne era privo.
 */
export function costruisciCsv(
  righe: Record<string, unknown>[],
  colonne: ColonnaExport[],
): Blob {
  const intestazione = colonne.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(";")
  const corpo = righe
    .map((riga) =>
      colonne
        .map((c) => `"${cella(riga[c.id]).replace(/"/g, '""')}"`)
        .join(";"),
    )
    .join("\r\n")

  return new Blob([`\uFEFF${intestazione}\r\n${corpo}`], {
    type: "text/csv;charset=utf-8;",
  })
}

/**
 * Excel vero (.xlsx). La libreria si carica solo quando serve davvero: un
 * export CSV non deve pagare il peso di un generatore di fogli di calcolo.
 *
 * Se l'import fallisce — dipendenza non installata dopo un deploy parziale —
 * si rilancia un errore leggibile invece di lasciare il pulsante muto.
 */
export async function costruisciXlsx(
  righe: Record<string, unknown>[],
  colonne: ColonnaExport[],
): Promise<Blob> {
  let writeXlsxFile: typeof import("write-excel-file").default
  try {
    writeXlsxFile = (await import("write-excel-file")).default
  } catch {
    throw new Error(
      "Formato Excel non disponibile su questa installazione. Esporta in CSV.",
    )
  }

  // Tutto testo di proposito: il CRM tiene importi e date come stringhe gia'
  // formattate per l'italiano ("11.800", "16/09/2026"). Dichiararle numero o
  // data farebbe reinterpretare a Excel il separatore migliaia e il formato
  // giorno/mese, cambiando i valori sotto gli occhi di chi legge.
  const dati = [
    colonne.map((c) => ({ value: c.label, fontWeight: "bold" as const })),
    ...righe.map((riga) => colonne.map((c) => ({ value: cella(riga[c.id]) }))),
  ]

  // Senza `fileName` la libreria restituisce direttamente un Blob: e'
  // l'overload pensato per il browser. Non esiste nessuna opzione `buffer`
  // — passarla faceva scartare tutti gli overload e il tipo di ritorno
  // collassava a void.
  return writeXlsxFile(dati, {
    columns: colonne.map((c) => ({
      width: Math.min(Math.max(c.label.length + 4, 12), 40),
    })),
  })
}

/** Estensione corretta per il formato, usata per comporre il nome del file. */
export function estensione(formato: FormatoExport): string {
  return formato === "xlsx" ? "xlsx" : "csv"
}

/** Costruisce e scarica. Unico punto in cui si tocca il DOM. */
export async function scaricaExport(
  righe: Record<string, unknown>[],
  colonne: ColonnaExport[],
  formato: FormatoExport,
  nomeFile: string,
): Promise<void> {
  const blob =
    formato === "xlsx"
      ? await costruisciXlsx(righe, colonne)
      : costruisciCsv(righe, colonne)

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nomeFile
  a.click()
  // Rilasciare subito l'URL su Safari annulla il download appena avviato: si
  // aspetta un giro di event loop.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
