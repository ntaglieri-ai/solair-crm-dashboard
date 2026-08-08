// Regola pura del tag "Italia" (spec FASE 2, punto 2.3): quali province
// contano come siciliane e quando un cliente va taggato. Nessuna scrittura,
// nessun accesso al DB — l'applicazione vera sta in lib/clienti/tag-italia.ts.
//
// Perche' un modulo separato: qui dentro NON si importa "@/lib/supabase/server"
// (che tira dentro next/headers e vive solo in una request Next). Cosi' anche
// scripts/backfill-tag-italia.mjs, che gira in Node puro fuori da Next, puo'
// riusare la stessa identica regola invece di riscriversi la lista delle
// sigle — che e' l'unico modo di garantire che backfill e runtime taggino
// esattamente gli stessi clienti.
import { regionFromProvince } from "@/lib/dashboard/italy-regions"

/** Le nove sigle siciliane: le uniche province considerate "in area". */
export const PROVINCE_SICILIANE = [
  "AG",
  "CL",
  "CT",
  "EN",
  "ME",
  "PA",
  "RG",
  "SR",
  "TP",
] as const

export const TAG_ITALIA_NOME = "Italia"

// Verde della palette tag dell'app (stesso set di 20260726_installatore_tags),
// non un colore inventato qui: il tag deve sembrare uno dei tag esistenti.
export const TAG_ITALIA_COLORE = "#22C55E"

const SIGLE_SICILIANE = new Set<string>(PROVINCE_SICILIANE)

function normalizza(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : ""
}

export function isProvinciaSiciliana(value: unknown): boolean {
  const provincia = normalizza(value)
  if (!provincia) return false
  if (SIGLE_SICILIANE.has(provincia)) return true

  // I dati ereditati da Zoho usano le sigle ("CT", "TV"), ma la colonna e'
  // testo libero: se qualcuno scrive "Palermo" per esteso deve valere lo
  // stesso. regionFromProvince conosce sigle e nomi completi di tutte le
  // province (la usa la mappa della dashboard), quindi la riusiamo invece di
  // duplicare qui l'elenco lungo.
  return regionFromProvince(provincia) === "Sicilia"
}

/**
 * True quando il cliente va taggato "Italia".
 *
 * Provincia vuota = non sappiamo dove sta il cliente, quindi non si tagga:
 * meglio nessun tag che un tag sbagliato da smontare a mano.
 *
 * Qualsiasi altro valore non siciliano fa scattare il tag, anche se non e' una
 * sigla italiana riconosciuta. E' la lettura letterale della spec ("NON tra
 * quelle siciliane") ed e' la scelta piu' sicura: pretendere una provincia
 * italiana valida farebbe saltare silenziosamente i valori scritti male, che
 * sono proprio quelli su cui serve l'automazione.
 */
export function richiedeTagItalia(value: unknown): boolean {
  return normalizza(value) !== "" && !isProvinciaSiciliana(value)
}
