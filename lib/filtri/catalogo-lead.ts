import type { CampoFiltrabile, TipoCampo } from "./albero"

/**
 * I campi filtrabili del Lead, raggruppati per sezione.
 *
 * In colonna, trenta campi in fila sono illeggibili: si scorre a lungo senza
 * sapere dove ci si trova. I gruppi ricalcano le sezioni della scheda, cosi'
 * chi cerca "Citta'" la trova sotto Indirizzo, dov'e' abituato a vederla.
 *
 * L'ordine dentro ogni gruppo e' quello della scheda, non alfabetico: si
 * cerca per posizione ricordata, non per iniziale.
 */

export type GruppoCampi = {
  chiave: string
  etichetta: string
  campi: CampoFiltrabile[]
}

function campo(
  chiave: string,
  etichetta: string,
  tipo: TipoCampo,
  opzioni?: readonly string[],
): CampoFiltrabile {
  return { chiave, etichetta, tipo, opzioni }
}

/**
 * I collegati: non sono colonne del record ma domande su altre tabelle
 * ("questo lead ha attivita' aperte?"). L'unica cosa sensata da chiedere e'
 * se ce ne sono o no, quindi si presentano come Si'/No.
 */
export const COLLEGATI_LEAD: CampoFiltrabile[] = [
  campo("Attività aperte", "Attività aperte", "collegato"),
  campo("Attività chiuse", "Attività chiuse", "collegato"),
  campo("Note", "Note", "collegato"),
  campo("Allegati", "Allegati", "collegato"),
  campo("E-mail inviate", "E-mail inviate", "collegato"),
  campo("Eventi in calendario", "Eventi in calendario", "collegato"),
]

/**
 * Costruisce i gruppi per il modulo Lead.
 *
 * Le opzioni dei campi a elenco (stati, proprietari, origini) arrivano dai
 * dati veri e non da un elenco scritto qui: un valore aggiunto in
 * configurazione deve comparire nel filtro senza toccare il codice.
 */
export function gruppiCampiLead(opzioni: {
  stati: readonly string[]
  origini: readonly string[]
  sedi: readonly string[]
  proprietari: readonly string[]
  creatori?: readonly string[]
  statoEmail?: readonly string[]
  saluti?: readonly string[]
  rating?: readonly string[]
  campagne?: readonly string[]
  modalitaIscrizioneAnnullata?: readonly string[]
  modelliPannello?: readonly string[]
  installatori?: readonly string[]
  tag: readonly string[]
}): GruppoCampi[] {
  return [
    {
      chiave: "principali",
      etichetta: "Informazioni principali",
      campi: [
        campo("Nome Lead", "Nome lead", "testo"),
        campo("Nome", "Nome", "testo"),
        campo("Cognome", "Cognome", "testo"),
        campo("E-mail", "E-mail", "testo"),
        campo("Telefono", "Telefono", "testo"),
        campo("Mobile/Fisso", "Mobile/Fisso", "testo"),
        campo("Stato Lead", "Stato lead", "elenco", opzioni.stati),
        campo("Origine Lead", "Origine lead", "elenco", opzioni.origini),
        campo("Lead Proprietario", "Proprietario", "elenco", opzioni.proprietari),
        campo("Sede", "Sede", "elenco", opzioni.sedi),
        campo("Tag", "Tag", "elenco", opzioni.tag),
        campo("Valutazione", "Valutazione", "elenco", opzioni.rating ?? []),
        campo("Punteggio", "Punteggio", "numero"),
        campo("Residente in Sicilia", "Residente in Sicilia", "booleano"),
        campo("Wallbox richiesto", "Wallbox richiesto", "booleano"),
        campo("Creato da", "Creato da", "elenco", opzioni.creatori ?? []),
        campo("Saluti", "Saluti", "elenco", opzioni.saluti ?? []),
        campo("campaign name", "Campagna", "elenco", opzioni.campagne ?? []),
        campo("Social Lead ID", "Social Lead ID", "testo"),
      ],
    },
    {
      chiave: "consensi",
      etichetta: "Consensi",
      campi: [
        campo("Consenso telefono", "Consenso telefono", "booleano"),
        campo("Consenso e-mail", "Consenso e-mail", "booleano"),
        campo("Consenso WhatsApp", "Consenso WhatsApp", "booleano"),
      ],
    },
    {
      chiave: "indirizzo",
      etichetta: "Indirizzo",
      campi: [
        campo("Città", "Città", "testo"),
        campo("Provincia", "Provincia", "testo"),
        campo("Paese", "Paese", "testo"),
        campo("Codice postale", "Codice postale", "testo"),
      ],
    },
    {
      chiave: "date",
      etichetta: "Date",
      campi: [
        campo("Ora creazione", "Ora creazione", "data"),
        campo("Ora ultima attività", "Ora ultima attività", "data"),
        campo("Data Click", "Data click", "data"),
        campo("Data/Ora", "Data/Ora", "data"),
      ],
    },
    {
      chiave: "sopralluogo",
      etichetta: "Sopralluogo",
      campi: [
        campo(
          "Installatore - Incaricato sopralluogo",
          "Installatore incaricato",
          "elenco",
          opzioni.installatori ?? [],
        ),
        campo("Data sopralluogo", "Data sopralluogo", "data"),
        campo("Descrizione", "Descrizione", "testo"),
      ],
    },
    {
      chiave: "conversione",
      etichetta: "Conversione",
      campi: [
        campo("Account convertito", "Account convertito", "testo"),
        campo("Contatto convertito", "Contatto convertito", "testo"),
        campo(
          "Modalità iscrizione annullata",
          "Modalità iscrizione annullata",
          "elenco",
          opzioni.modalitaIscrizioneAnnullata ?? [],
        ),
        campo("Modello pannello", "Modello pannello", "elenco", opzioni.modelliPannello ?? []),
        campo("Stato", "Stato", "elenco", opzioni.statoEmail ?? []),
        campo("Tempo di conversione Lead", "Tempo di conversione", "numero"),
      ],
    },
    {
      chiave: "collegati",
      etichetta: "Contenuti collegati",
      campi: COLLEGATI_LEAD,
    },
  ]
}

/** Il catalogo piatto, per la validazione lato server. */
export function catalogoDaGruppi(gruppi: GruppoCampi[]): CampoFiltrabile[] {
  return gruppi.flatMap((gruppo) => gruppo.campi)
}
