// Ponte fra i nomi applicativi dei campi e le chiavi di permessi_campo.
//
// La UI ragiona per etichette ("IBAN", "Codice fiscale", "Importo
// Contrattuale"), permessi_campo e il catalogo ragionano per colonna
// ("iban", "codice_fiscale", "importo_contrattuale"). Senza un ponte
// bisognerebbe tenere allineate due liste di nomi, e la seconda finirebbe
// per divergere in silenzio.
//
// La mappa si costruisce da CLIENTI_RECORD_FIELDS, che quella corrispondenza
// ce l'ha gia' (`appField` <-> `column`) ed e' la stessa usata dal repository
// per leggere e scrivere: se un campo cambia nome, cambia in un posto solo.

import { CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"

/**
 * Etichette che non passano da CLIENTI_RECORD_FIELDS perche' la colonna Zoho
 * si chiama in un modo e la UI le mostra in un altro. Sono poche e vanno
 * elencate: indovinarle con una normalizzazione automatica produrrebbe
 * corrispondenze sbagliate proprio sui campi sensibili.
 */
const ECCEZIONI_CLIENTI: Record<string, string> = {
  IBAN: "iban",
  "1° Tranche": "n_1_tranche",
  "2°Tranche": "n_2tranche",
  Bonifico1: "bonifico1",
  Bonifico2: "bonifico2",
  BonificoPDC: "bonificopdc",
  FatturaPDC: "fatturapdc",
  Saldo: "saldo",
  IVA: "iva",
  "di cui CT3": "di_cui_ct3",
  "di cui FTV": "di_cui_ftv",
  "Tot Contratto": "tot_contratto",
  "Sconto COMBO": "sconto_combo",
  "Note pagamenti": "note_pagamenti",
  "Note Provvigioni": "note_provvigioni",
  "Codice fiscale": "codice_fiscale",
}

const MAPPA_CLIENTI: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const field of CLIENTI_RECORD_FIELDS) out[field.appField] = field.column
  return { ...out, ...ECCEZIONI_CLIENTI }
})()

/**
 * Chiave di permessi_campo per un'etichetta di colonna Cliente, oppure null
 * se quel campo non ha una colonna corrispondente.
 *
 * `null` significa "nessuna regola applicabile", quindi il campo resta
 * visibile: qui non si inventano restrizioni per campi che nessuno ha
 * configurato.
 */
export function chiaveCampoCliente(appField: string): string | null {
  return MAPPA_CLIENTI[appField] ?? null
}
