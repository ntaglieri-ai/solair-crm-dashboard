/**
 * Il criterio con cui SolairAI decide che un file su Nextcloud riguarda una
 * certa persona.
 *
 * Vive in un modulo suo, senza `server-only`, perche' e' logica pura e va
 * testata: un errore qui non da' nessun errore a schermo — da' i documenti
 * di un'altra persona letti e riversati sulla scheda sbagliata.
 */

function normalizza(valore: string): string {
  return valore
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Le parole del nome che contano. Le iniziali puntate ("M. Rossi") sparirebbero
 * comunque nella normalizzazione: si scartano i frammenti di una lettera
 * perche' matcherebbero quasi qualunque percorso.
 */
export function paroleDelNome(nome: string): string[] {
  return normalizza(nome)
    .split(" ")
    .filter((parola) => parola.length > 1)
}

/**
 * Il file riguarda `nome`?
 *
 * Due disposizioni sono entrambe comuni e sono entrambe supportate senza
 * doverlo dichiarare da nessuna parte:
 *
 *   Lead/Mario Rossi/preventivo.pdf     una sottocartella per persona
 *   Lead/mario-rossi-preventivo.pdf     il nome dentro il nome del file
 *
 * Il confronto e' sulle PAROLE del nome normalizzato (niente accenti, niente
 * punteggiatura) e devono esserci TUTTE: bastasse una parola, "Mario Rossi"
 * pescherebbe anche i documenti di "Mario Esposito".
 *
 * La parte di percorso corrispondente alla cartella configurata viene tolta
 * prima del confronto: una radice che contenga per caso una parola del nome
 * (es. "Solair/Rossi/Lead") farebbe passare tutto quello che c'e' dentro.
 */
export function fileRiguardaNome(path: string, cartella: string, parole: string[]): boolean {
  if (parole.length === 0) return false

  const completo = normalizza(path)
  const radice = normalizza(cartella)
  const relativo =
    radice !== "" && completo.startsWith(radice) ? completo.slice(radice.length) : completo

  return parole.every((parola) => relativo.includes(parola))
}
