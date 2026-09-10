/**
 * I campi che SolairAI puo' proporre, per tipo di entita'.
 *
 * E' una lista curata, non l'intero schema: `clienti` ha oltre 130 colonne
 * e passarle tutte al modello significherebbe un prompt enorme e proposte su
 * campi di sistema (id Zoho, contatori di visite, flag di messaggistica) che
 * un documento non puo' sapere. Qui stanno l'anagrafica e i dati tecnici e
 * contrattuali che in un documento ci finiscono davvero.
 *
 * La lista e' anche la whitelist di scrittura: /applica rifiuta qualunque
 * campo che non compaia qui, quindi il modello non puo' scrivere su una
 * colonna solo perche' l'ha nominata.
 *
 * Consensi, proprietario, sede e stati di workflow restano fuori di
 * proposito: sono decisioni del CRM, non informazioni che si leggono da un
 * PDF. Il consenso e-mail in particolare e' un blocco legale (vedi
 * consenso_email), e non deve poter cambiare per via di un documento.
 */

import type { CampoProposto, EntitaAI } from "./tipi"

export type TipoCampoAI = "testo" | "numero" | "booleano" | "data"

export type CampoAI = {
  /** Colonna reale della tabella. */
  column: string
  /** Etichetta mostrata all'utente e passata al modello. */
  etichetta: string
  tipo: TipoCampoAI
  /** Nota per il modello quando l'etichetta da sola non basta. */
  nota?: string
}

const CAMPI_LEAD: CampoAI[] = [
  { column: "nome", etichetta: "Nome", tipo: "testo" },
  { column: "cognome", etichetta: "Cognome", tipo: "testo" },
  { column: "nome_lead", etichetta: "Nome Lead", tipo: "testo", nota: "Nome completo o ragione sociale." },
  { column: "email", etichetta: "E-mail", tipo: "testo" },
  { column: "telefono", etichetta: "Telefono", tipo: "testo" },
  { column: "mobile_fisso", etichetta: "Mobile/Fisso", tipo: "testo" },
  { column: "citta", etichetta: "Citta", tipo: "testo" },
  { column: "provincia", etichetta: "Provincia", tipo: "testo", nota: "Sigla di due lettere, es. PA." },
  { column: "codice_postale", etichetta: "Codice postale", tipo: "testo" },
  { column: "paese", etichetta: "Paese", tipo: "testo" },
  { column: "saluti", etichetta: "Saluti", tipo: "testo" },
  { column: "origine_lead", etichetta: "Origine Lead", tipo: "testo" },
  { column: "campaign_name", etichetta: "Campagna", tipo: "testo" },
  { column: "kwp", etichetta: "kWp", tipo: "numero", nota: "Potenza dell'impianto in kWp." },
  { column: "kwh", etichetta: "kWh", tipo: "numero", nota: "Capacita' di accumulo in kWh." },
  { column: "modello_pannello", etichetta: "Modello pannello", tipo: "testo" },
  { column: "wallbox_richiesto", etichetta: "Wallbox richiesto", tipo: "booleano" },
  { column: "residente_in_sicilia", etichetta: "Residente in Sicilia", tipo: "booleano" },
  { column: "data_sopralluogo", etichetta: "Data sopralluogo", tipo: "data" },
  { column: "tipo_documento", etichetta: "Tipo documento", tipo: "testo" },
  { column: "descrizione", etichetta: "Descrizione", tipo: "testo" },
]

const CAMPI_CLIENTE: CampoAI[] = [
  { column: "nome", etichetta: "Nome", tipo: "testo" },
  { column: "cognome", etichetta: "Cognome", tipo: "testo" },
  { column: "nome_clienti", etichetta: "Nome Cliente", tipo: "testo", nota: "Nome completo o ragione sociale." },
  { column: "codice_fiscale", etichetta: "Codice fiscale", tipo: "testo" },
  { column: "email", etichetta: "E-mail", tipo: "testo" },
  { column: "email_secondaria", etichetta: "E-mail secondaria", tipo: "testo" },
  { column: "cellulare", etichetta: "Cellulare", tipo: "testo" },
  { column: "altro_telefono", etichetta: "Altro telefono", tipo: "testo" },
  { column: "via_indirizzo_postale", etichetta: "Via", tipo: "testo" },
  { column: "citta_indirizzo_postale", etichetta: "Citta", tipo: "testo" },
  { column: "provincia_indirizzo_postale", etichetta: "Provincia", tipo: "testo", nota: "Sigla di due lettere." },
  { column: "codice_postale_indirizzo", etichetta: "Codice postale", tipo: "testo" },
  { column: "saluti", etichetta: "Saluti", tipo: "testo" },
  { column: "iban", etichetta: "IBAN", tipo: "testo" },
  { column: "pod", etichetta: "POD", tipo: "testo", nota: "Codice POD del punto di prelievo." },
  { column: "zona", etichetta: "Zona", tipo: "testo" },
  { column: "cod_inverter", etichetta: "COD. INVERTER", tipo: "testo" },
  { column: "cod_moduli", etichetta: "COD. MODULI", tipo: "testo" },
  { column: "cod_storage", etichetta: "COD. STORAGE", tipo: "testo" },
  { column: "nr_inverter", etichetta: "Nr. Inverter", tipo: "numero" },
  { column: "nr_moduli", etichetta: "Nr. Moduli", tipo: "numero" },
  { column: "nr_batterie", etichetta: "Nr. Batterie", tipo: "numero" },
  { column: "potenza_moduli_wp", etichetta: "Potenza moduli (Wp)", tipo: "numero" },
  { column: "potenza_inverter", etichetta: "Potenza inverter", tipo: "numero" },
  { column: "capacita_batterie", etichetta: "Capacita batterie", tipo: "testo" },
  { column: "tot_potenza_dc", etichetta: "Totale potenza DC", tipo: "numero" },
  { column: "tot_potenza_ac_kw", etichetta: "Totale potenza AC (kW)", tipo: "numero" },
  { column: "tipologia", etichetta: "Tipologia impianto", tipo: "testo" },
  { column: "importo_contrattuale", etichetta: "Importo contrattuale", tipo: "numero" },
  { column: "importo_finanziamento", etichetta: "Importo finanziamento", tipo: "numero" },
  { column: "modalita_di_pagamento", etichetta: "Modalita di pagamento", tipo: "testo" },
  { column: "iva", etichetta: "IVA", tipo: "numero" },
  { column: "data_sopralluogo", etichetta: "Data sopralluogo", tipo: "data" },
  { column: "data_installazione_ultimata", etichetta: "Data installazione ultimata", tipo: "data" },
  { column: "wallbox", etichetta: "Wallbox", tipo: "booleano" },
  { column: "descrizione", etichetta: "Descrizione", tipo: "testo" },
]

const CAMPI_INSTALLATORE: CampoAI[] = [
  { column: "nome", etichetta: "Nome Installatore", tipo: "testo" },
  { column: "email", etichetta: "E-mail", tipo: "testo" },
  { column: "email_secondaria", etichetta: "E-mail secondaria", tipo: "testo" },
  { column: "telefono", etichetta: "Telefono", tipo: "testo" },
  { column: "note", etichetta: "Note", tipo: "testo" },
]

export const CAMPI_AI: Record<EntitaAI, CampoAI[]> = {
  lead: CAMPI_LEAD,
  cliente: CAMPI_CLIENTE,
  installatore: CAMPI_INSTALLATORE,
}

/** Tabella su cui vive ogni entita'. */
export const TABELLA_AI: Record<EntitaAI, string> = {
  lead: "leads",
  cliente: "clienti",
  installatore: "installatori",
}

/** record_tipo usato da `attivita` per la nota di riepilogo. */
export const RECORD_TIPO_ATTIVITA: Record<EntitaAI, string> = {
  lead: "lead",
  cliente: "cliente",
  installatore: "installatore",
}

export function campoAI(entita: EntitaAI, column: string): CampoAI | undefined {
  return CAMPI_AI[entita].find((campo) => campo.column === column)
}

/**
 * Riconosce anche l'etichetta, non solo la colonna: il modello tende a
 * rispondere con l'etichetta che gli abbiamo mostrato, e rifiutare la
 * proposta per quello sarebbe un no su un campo valido.
 */
export function risolviCampoAI(entita: EntitaAI, chiave: string): CampoAI | undefined {
  const pulita = chiave.trim().toLowerCase()
  return CAMPI_AI[entita].find(
    (campo) =>
      campo.column.toLowerCase() === pulita || campo.etichetta.toLowerCase() === pulita,
  )
}

/** Un valore letto dal record conta come "gia' pieno"? */
export function valorePieno(valore: unknown): boolean {
  if (valore == null) return false
  if (typeof valore === "string") return valore.trim() !== ""
  // false su un booleano NON e' un campo pieno: e' il default della colonna,
  // e trattarlo come pieno manderebbe in revisione ogni "Wallbox: si'" letto
  // da un documento su un record mai toccato.
  if (typeof valore === "boolean") return valore
  if (Array.isArray(valore)) return valore.length > 0
  return true
}

/**
 * Porta il valore proposto dal modello (sempre stringa) al tipo della
 * colonna. Restituisce `undefined` quando il valore non e' interpretabile:
 * il campo viene scartato invece di scrivere spazzatura.
 */
export function normalizzaValore(campo: CampoAI, grezzo: string): unknown | undefined {
  const valore = grezzo.trim()
  if (valore === "") return undefined

  if (campo.tipo === "numero") {
    // Senza almeno una cifra non c'e' niente da leggere. Il controllo va
    // fatto PRIMA della ripulitura: "da definire" perde tutti i caratteri e
    // diventa la stringa vuota, che Number() legge come 0 — cioe' un
    // documento che dice "da definire" scriverebbe 0 kWp sul record.
    if (!/\d/.test(valore)) return undefined

    // I documenti italiani scrivono "6,5" e "1.234,50": la virgola e'
    // decimale e il punto e' separatore di migliaia.
    const normalizzato = valore
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".")
    const numero = Number(normalizzato)
    return Number.isFinite(numero) ? numero : undefined
  }

  if (campo.tipo === "booleano") {
    const positivi = ["si", "sì", "true", "vero", "1", "x", "presente", "richiesto"]
    const negativi = ["no", "false", "falso", "0", "assente"]
    const chiave = valore.toLowerCase()
    if (positivi.includes(chiave)) return true
    if (negativi.includes(chiave)) return false
    return undefined
  }

  if (campo.tipo === "data") {
    // gg/mm/aaaa prima di Date.parse: "05/03/2026" per il parser nativo e'
    // il 3 maggio, non il 5 marzo.
    const italiana = valore.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
    if (italiana) {
      const [, giorno, mese, anno] = italiana
      const data = new Date(Date.UTC(Number(anno), Number(mese) - 1, Number(giorno)))
      return Number.isNaN(data.getTime()) ? undefined : data.toISOString()
    }
    const parsed = new Date(valore)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
  }

  return valore
}

/** Come mostrare all'utente un valore letto dal record. */
export function formattaValore(valore: unknown): string {
  if (valore == null) return ""
  if (typeof valore === "boolean") return valore ? "Si" : "No"
  if (valore instanceof Date) return valore.toISOString()
  return String(valore)
}

export type Smistamento = {
  /** Campi vuoti sul record: si scrivono direttamente. */
  daScrivere: { campo: CampoProposto; valore: unknown }[]
  /** Campi gia' pieni con un valore diverso: vanno in revisione. */
  inRevisione: { campo: CampoProposto; valoreAttuale: string }[]
  /** Gia' uguali, o non interpretabili: nessuna azione. */
  invariati: CampoProposto[]
}

/**
 * La regola del punto 4, in un posto solo: campo vuoto -> UPDATE diretto,
 * campo pieno -> riga di revisione, mai una sovrascrittura.
 *
 * Gira su valori RILETTI dal database al momento dell'applicazione, non su
 * quelli che il client rimanda indietro: fra la proposta e la conferma il
 * record puo' essere cambiato, e in quel caso il campo non e' piu' vuoto.
 */
export function smistaCampi(
  entita: EntitaAI,
  proposti: CampoProposto[],
  valoriAttuali: Record<string, unknown>,
): Smistamento {
  const smistamento: Smistamento = { daScrivere: [], inRevisione: [], invariati: [] }

  for (const proposto of proposti) {
    const campo = risolviCampoAI(entita, proposto.campo)
    // Campo fuori catalogo: scartato senza rumore. E' la whitelist di
    // scrittura, e la proposta arriva dal client.
    if (!campo) continue

    const valore = normalizzaValore(campo, proposto.valore)
    if (valore === undefined) {
      smistamento.invariati.push(proposto)
      continue
    }

    const attuale = valoriAttuali[campo.column]
    if (!valorePieno(attuale)) {
      smistamento.daScrivere.push({ campo: { ...proposto, campo: campo.column }, valore })
      continue
    }

    const attualeTesto = formattaValore(attuale)
    if (attualeTesto.trim().toLowerCase() === formattaValore(valore).trim().toLowerCase()) {
      smistamento.invariati.push(proposto)
      continue
    }

    smistamento.inRevisione.push({
      campo: { ...proposto, campo: campo.column },
      valoreAttuale: attualeTesto,
    })
  }

  return smistamento
}
