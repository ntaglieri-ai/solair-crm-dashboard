import "server-only"

import { createClient } from "@/lib/supabase/server"
import { CAMPI_AI, RECORD_TIPO_ATTIVITA, TABELLA_AI, formattaValore, valorePieno } from "./campi"
import type { CampoProposto, EntitaAI, FileCandidato, PropostaAI } from "./tipi"

export type RecordTrovato = {
  id: string
  etichetta: string
  valori: Record<string, unknown>
}

/** Le colonne su cui si cerca un record per nome, in ordine di preferenza. */
const COLONNE_NOME: Record<EntitaAI, string[]> = {
  lead: ["nome_lead", "nome", "cognome", "email"],
  cliente: ["nome_clienti", "nome", "cognome", "email"],
  installatore: ["nome", "email"],
}

/** La colonna che da' l'etichetta leggibile del record. */
const COLONNA_ETICHETTA: Record<EntitaAI, string[]> = {
  lead: ["nome_lead", "nome", "email"],
  cliente: ["nome_clienti", "nome", "email"],
  installatore: ["nome", "email"],
}

function escapeOr(valore: string): string {
  // PostgREST usa la virgola come separatore dei rami di `or` e le parentesi
  // per raggrupparli: lasciarle passare spezzerebbe il filtro.
  return valore.replace(/[,()\\*]/g, " ").trim()
}

function etichettaDi(entita: EntitaAI, riga: Record<string, unknown>): string {
  for (const colonna of COLONNA_ETICHETTA[entita]) {
    const valore = riga[colonna]
    if (typeof valore === "string" && valore.trim() !== "") return valore.trim()
  }
  return "(senza nome)"
}

function colonneDaLeggere(entita: EntitaAI): string {
  const campi = CAMPI_AI[entita].map((campo) => campo.column)
  return ["id", ...new Set([...campi, ...COLONNA_ETICHETTA[entita]])].join(",")
}

/**
 * Cerca il record per nome. Restituisce `null` quando non esiste — che per
 * SolairAI non e' un errore, e' il ramo "Creo il lead/cliente/installatore?".
 *
 * Con piu' omonimi vince il piu' recente: e' l'unico criterio che non
 * richiede all'utente di conoscere gli id, e la scheda proposta viene
 * comunque mostrata prima di scrivere qualunque cosa.
 */
export async function trovaRecord(
  entita: EntitaAI,
  nome: string,
): Promise<RecordTrovato | null> {
  const cercato = escapeOr(nome)
  if (cercato === "") return null

  const supabase = await createClient()
  const filtro = COLONNE_NOME[entita]
    .map((colonna) => `${colonna}.ilike.%${cercato}%`)
    .join(",")

  const { data, error } = await supabase
    .from(TABELLA_AI[entita])
    .select(colonneDaLeggere(entita))
    .or(filtro)
    .limit(5)

  if (error) throw new Error(`Ricerca ${entita} non riuscita: ${error.message}`)
  const righe = (data ?? []) as unknown as Record<string, unknown>[]
  if (righe.length === 0) return null

  // Una corrispondenza esatta sull'etichetta batte una parziale: cercando
  // "Rossi" con a DB "Rossi" e "Rossini", il primo e' quello giusto.
  const esatto = righe.find(
    (riga) => etichettaDi(entita, riga).toLowerCase() === nome.trim().toLowerCase(),
  )
  const scelta = esatto ?? righe[0]

  return {
    id: String(scelta.id),
    etichetta: etichettaDi(entita, scelta),
    valori: scelta,
  }
}

export async function leggiRecord(
  entita: EntitaAI,
  id: string,
): Promise<RecordTrovato | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(TABELLA_AI[entita])
    .select(colonneDaLeggere(entita))
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(`Lettura ${entita} non riuscita: ${error.message}`)
  if (!data) return null
  const riga = data as unknown as Record<string, unknown>
  return { id: String(riga.id), etichetta: etichettaDi(entita, riga), valori: riga }
}

export async function aggiornaRecord(
  entita: EntitaAI,
  id: string,
  valori: { campo: CampoProposto; valore: unknown }[],
): Promise<void> {
  if (valori.length === 0) return
  const supabase = await createClient()
  const patch: Record<string, unknown> = Object.fromEntries(
    valori.map((voce) => [voce.campo.campo, voce.valore]),
  )
  patch.updated_at = new Date().toISOString()
  // `leads` e `clienti` hanno anche il timestamp di ultima attivita', che la
  // lista usa per ordinare: senza, un record aggiornato da SolairAI resta in
  // fondo come se non fosse successo niente.
  if (entita !== "installatore") patch.ora_ultima_attivita = patch.updated_at

  const { error } = await supabase.from(TABELLA_AI[entita]).update(patch).eq("id", id)
  if (error) throw new Error(`Aggiornamento ${entita} non riuscito: ${error.message}`)
}

/**
 * Crea il record con i campi proposti. Il nome e' obbligatorio: e' la sola
 * colonna che serve a ritrovarlo, e senza finirebbe in lista come vuoto.
 */
export async function creaRecord(
  entita: EntitaAI,
  nome: string,
  valori: { campo: CampoProposto; valore: unknown }[],
): Promise<RecordTrovato> {
  const supabase = await createClient()
  const riga: Record<string, unknown> = Object.fromEntries(
    valori.map((voce) => [voce.campo.campo, voce.valore]),
  )

  const colonnaNome = COLONNA_ETICHETTA[entita][0]
  if (!valorePieno(riga[colonnaNome])) riga[colonnaNome] = nome.trim()

  if (entita === "lead") {
    // stato_lead e' obbligatorio per la lista: senza, il lead nasce fuori da
    // ogni colonna della pipeline.
    riga.stato_lead ??= "Nuovo"
    riga.paese ??= "Italia"
  }

  const { data, error } = await supabase
    .from(TABELLA_AI[entita])
    .insert(riga)
    .select(colonneDaLeggere(entita))
    .single()

  if (error) throw new Error(`Creazione ${entita} non riuscita: ${error.message}`)
  const creato = data as unknown as Record<string, unknown>
  return { id: String(creato.id), etichetta: etichettaDi(entita, creato), valori: creato }
}

export async function inserisciRevisioni(
  entita: EntitaAI,
  recordId: string,
  utenteId: string,
  righe: { campo: CampoProposto; valoreAttuale: string }[],
): Promise<void> {
  if (righe.length === 0) return
  const supabase = await createClient()
  const { error } = await supabase.from("crm_revisioni_pending").upsert(
    righe.map((riga) => ({
      record_tipo: entita,
      record_id: recordId,
      campo: riga.campo.campo,
      campo_etichetta: riga.campo.etichetta,
      valore_attuale: riga.valoreAttuale,
      valore_proposto: riga.campo.valore,
      fonte_documento: riga.campo.fonte,
      stato: "pending" as const,
      creato_da: utenteId,
    })),
    // L'indice unico parziale copre le sole righe pendenti: una seconda
    // lettura dello stesso documento aggiorna la proposta invece di
    // accodarne una gemella.
    { onConflict: "record_tipo,record_id,campo" },
  )
  if (error) throw new Error(`Revisioni non registrate: ${error.message}`)
}

/**
 * La nota automatica del punto 4. Stessa scrittura di crm_nota_add: riga
 * `attivita` di tipo "nota" firmata dall'utente, cosi' compare nella
 * timeline del record come qualunque altra nota del CRM.
 */
export async function scriviNotaRiepilogo(
  entita: EntitaAI,
  recordId: string,
  utenteId: string,
  testo: string,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from("attivita").insert({
    tipo: "nota",
    testo,
    record_id: recordId,
    record_tipo: RECORD_TIPO_ATTIVITA[entita],
    utente_id: utenteId,
  })
  if (error) throw new Error(`Nota di riepilogo non salvata: ${error.message}`)
}

/** Il testo della nota: file letti, campi aggiornati, campi in revisione. */
export function testoNota(params: {
  creato: boolean
  file: FileCandidato[]
  aggiornati: CampoProposto[]
  inRevisione: CampoProposto[]
}): string {
  const righe: string[] = [
    params.creato ? "SolairAI ha creato questo record." : "SolairAI ha letto nuovi documenti.",
  ]

  if (params.file.length > 0) {
    righe.push("", `File letti (${params.file.length}):`)
    for (const file of params.file) righe.push(`- ${file.path}`)
  }

  if (params.aggiornati.length > 0) {
    righe.push("", `Campi aggiornati (${params.aggiornati.length}):`)
    for (const campo of params.aggiornati) righe.push(`- ${campo.etichetta}: ${campo.valore}`)
  }

  if (params.inRevisione.length > 0) {
    righe.push("", `In revisione, non sovrascritti (${params.inRevisione.length}):`)
    for (const campo of params.inRevisione) righe.push(`- ${campo.etichetta}: ${campo.valore}`)
  }

  if (params.aggiornati.length === 0 && params.inRevisione.length === 0) {
    righe.push("", "Nessun campo modificato: i documenti non aggiungevano niente di nuovo.")
  }

  return righe.join("\n")
}

/** I valori attuali dei campi che la proposta tocca, per mostrarli in chat. */
export function anteprimaConfronto(
  proposta: PropostaAI,
  valori: Record<string, unknown>,
): { etichetta: string; attuale: string; proposto: string }[] {
  return proposta.campi.map((campo) => ({
    etichetta: campo.etichetta,
    attuale: formattaValore(valori[campo.campo]),
    proposto: campo.valore,
  }))
}
