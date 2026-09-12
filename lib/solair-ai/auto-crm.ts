import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  folderPathForRecord,
  isPathInsideRecordFolder,
  nomeSenzaCollisioni,
  sanitizeName,
} from "@/lib/allegati/paths"
import { copyFile, listFolder } from "@/lib/nextcloud/admin-webdav"
import { leggiDocumenti } from "./claude"
import {
  CAMPI_AI,
  RECORD_TIPO_ATTIVITA,
  TABELLA_AI,
  risolviCampoAI,
  smistaCampi,
} from "./campi"
import { classificaDocumentoCrm } from "./document-filter"
import { scegliRecordPerDocumento } from "./record-match"
import type { CampoProposto, EntitaAI, FileCandidato } from "./tipi"

type RecordRow = {
  id: string
  etichetta: string
  valori: Record<string, unknown>
}

export type EsitoAutoCrmDocumento = {
  stato: "matched" | "skipped" | "error"
  recordId: string | null
  recordEtichetta: string | null
  allegatoPath: string | null
  aggiornati: number
  revisioni: number
  errore: string | null
}

const COLONNE_ETICHETTA: Record<EntitaAI, string[]> = {
  lead: ["nome_lead", "nome", "email"],
  cliente: ["nome_clienti", "nome", "email"],
  installatore: ["nome", "email"],
}

const RECORD_CACHE_TTL_MS = 60_000
const recordCache = new Map<EntitaAI, { expiresAt: number; records: RecordRow[] }>()

function colonneRecord(entita: EntitaAI): string {
  const campi = CAMPI_AI[entita].map((campo) => campo.column)
  return ["id", ...new Set([...COLONNE_ETICHETTA[entita], ...campi])].join(",")
}

function etichettaDi(entita: EntitaAI, riga: Record<string, unknown>): string {
  for (const colonna of COLONNE_ETICHETTA[entita]) {
    const valore = riga[colonna]
    if (typeof valore === "string" && valore.trim() !== "") return valore.trim()
  }
  return "(senza nome)"
}

async function leggiRecordCandidati(
  supabase: SupabaseClient,
  entita: EntitaAI,
): Promise<RecordRow[]> {
  const cached = recordCache.get(entita)
  if (cached && cached.expiresAt > Date.now()) return cached.records

  const righe: RecordRow[] = []
  const pageSize = 1000

  for (let from = 0; from < 20_000; from += pageSize) {
    const { data, error } = await supabase
      .from(TABELLA_AI[entita])
      .select(colonneRecord(entita))
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`Lettura ${entita} per match documento fallita: ${error.message}`)

    const page = ((data ?? []) as unknown as Record<string, unknown>[]).map((riga) => ({
      id: String(riga.id),
      etichetta: etichettaDi(entita, riga),
      valori: riga,
    }))
    righe.push(...page)

    if (page.length < pageSize) break
  }

  const records = righe.filter((record) => record.id && record.etichetta !== "(senza nome)")
  recordCache.set(entita, { expiresAt: Date.now() + RECORD_CACHE_TTL_MS, records })
  return records
}

async function giaProcessatoPerRecord(
  supabase: SupabaseClient,
  entita: EntitaAI,
  recordId: string,
  fingerprint: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("crm_ai_file_log")
    .select("id")
    .eq("entita", entita)
    .eq("record_id", recordId)
    .eq("fingerprint", fingerprint)
    .limit(1)

  if (error) throw new Error(`Registro letture non leggibile: ${error.message}`)
  return (data?.length ?? 0) > 0
}

async function registraLetturaAdmin(
  supabase: SupabaseClient,
  params: { entita: EntitaAI; recordId: string; utenteId: string | null; file: FileCandidato },
) {
  const { error } = await supabase.from("crm_ai_file_log").upsert(
    {
      entita: params.entita,
      record_id: params.recordId,
      path: params.file.path,
      fingerprint: params.file.fingerprint,
      dimensione: params.file.dimensione,
      modificato_il: params.file.modificatoIl,
      letto_da: params.utenteId,
      letto_il: new Date().toISOString(),
      esito: "letto",
    },
    { onConflict: "entita,record_id,path,fingerprint" },
  )
  if (error) throw new Error(`Registro lettura non aggiornato: ${error.message}`)
}

async function copiaComeAllegato(
  entita: EntitaAI,
  record: RecordRow,
  file: FileCandidato,
): Promise<string> {
  if (isPathInsideRecordFolder(entita, record.id, record.etichetta, file.path)) return file.path

  const cartella = folderPathForRecord(entita, record.id, record.etichetta)
  const listing = await listFolder(cartella)
  if (listing.ok) {
    const stessaImpronta = listing.items.find(
      (item) => !item.isFolder && item.etag && file.fingerprint === `etag:${item.etag}`,
    )
    if (stessaImpronta) return stessaImpronta.path
  }

  // Il nome libero si sceglie dall'elenco letto un attimo prima: con piu'
  // file in lavorazione insieme due worker possono scegliere lo stesso e il
  // secondo si prende "Destinazione gia' esistente". Chi perde la corsa
  // riprova aggiungendo i nomi gia' tentati a quelli occupati.
  const occupati = listing.ok ? listing.items.map((item) => item.nome) : []
  const base = sanitizeName(file.nome) || "documento"

  let ultimoErrore: string | null = null
  for (let tentativo = 0; tentativo < 4; tentativo++) {
    const nome = nomeSenzaCollisioni(base, occupati)
    const destinazione = `${cartella}/${nome}`
    const esito = await copyFile(file.path, destinazione)
    if (esito.ok) return destinazione
    ultimoErrore = esito.error ?? `Copia allegato fallita (${esito.status})`
    occupati.push(nome)
  }
  throw new Error(ultimoErrore ?? "Copia allegato fallita")
}

async function aggiornaCrmDaDocumento(params: {
  supabase: SupabaseClient
  entita: EntitaAI
  record: RecordRow
  utenteId: string | null
  file: FileCandidato
  testo: string
}): Promise<{ aggiornati: CampoProposto[]; revisioni: CampoProposto[] }> {
  if (params.testo.trim() === "") return { aggiornati: [], revisioni: [] }

  const classificazione = classificaDocumentoCrm({
    nome: params.file.nome,
    path: params.file.path,
    testo: params.testo,
  })
  if (!classificazione.usaLlm) return { aggiornati: [], revisioni: [] }

  const estrazione = await leggiDocumenti({
    entita: params.entita,
    nome: params.record.etichetta,
    contenuti: [
      {
        file: params.file,
        base64: Buffer.from(params.testo).toString("base64"),
        mediaType: "text/plain",
      },
    ],
    valoriAttuali: params.record.valori,
  })

  const proposti = estrazione.campi
    .map((proposto) => {
      const campo = risolviCampoAI(params.entita, proposto.campo)
      if (!campo) return null
      return {
        campo: campo.column,
        etichetta: campo.etichetta,
        valore: proposto.valore,
        fonte: proposto.fonte === params.file.path ? proposto.fonte : params.file.path,
      }
    })
    .filter((campo): campo is CampoProposto => campo !== null)

  const smistamento = smistaCampi(params.entita, proposti, params.record.valori)

  if (smistamento.daScrivere.length > 0) {
    const patch: Record<string, unknown> = Object.fromEntries(
      smistamento.daScrivere.map((voce) => [voce.campo.campo, voce.valore]),
    )
    patch.updated_at = new Date().toISOString()
    if (params.entita !== "installatore") patch.ora_ultima_attivita = patch.updated_at

    const { error } = await params.supabase
      .from(TABELLA_AI[params.entita])
      .update(patch)
      .eq("id", params.record.id)
    if (error) throw new Error(`Aggiornamento CRM automatico fallito: ${error.message}`)
    Object.assign(params.record.valori, patch)
  }

  if (smistamento.inRevisione.length > 0) {
    // L'unico indice unico su (record_tipo, record_id, campo) e' PARZIALE —
    // vale solo per `stato = 'pending'`. Un upsert non puo' puntarlo, perche'
    // PostgREST non sa esprimere il predicato dell'indice: usciva
    // "there is no unique or exclusion constraint matching the ON CONFLICT
    // specification", e ogni file che proponeva una revisione finiva in
    // errore. La riga pendente si sostituisce a mano: prima si toglie quella
    // vecchia sullo stesso campo, poi si inserisce la nuova.
    //
    // Delete e insert non sono atomiche insieme: due documenti dello stesso
    // record lavorati in parallelo possono cancellare entrambi e poi
    // scontrarsi sull'indice. Non e' un caso da evitare, e' un caso da
    // ripetere — vince l'ultimo che scrive, che e' la semantica giusta per
    // "il valore proposto piu' recente".
    const campi = smistamento.inRevisione.map((riga) => riga.campo.campo)
    const righe = smistamento.inRevisione.map((riga) => ({
      record_tipo: params.entita,
      record_id: params.record.id,
      campo: riga.campo.campo,
      campo_etichetta: riga.campo.etichetta,
      valore_attuale: riga.valoreAttuale,
      valore_proposto: riga.campo.valore,
      fonte_documento: riga.campo.fonte,
      stato: "pending",
      creato_da: params.utenteId,
    }))

    let ultimoErrore: string | null = null
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      const { error: erroreRimozione } = await params.supabase
        .from("crm_revisioni_pending")
        .delete()
        .eq("record_tipo", params.entita)
        .eq("record_id", params.record.id)
        .eq("stato", "pending")
        .in("campo", campi)
      if (erroreRimozione) {
        throw new Error(`Revisione automatica non registrata: ${erroreRimozione.message}`)
      }

      const { error } = await params.supabase.from("crm_revisioni_pending").insert(righe)
      if (!error) {
        ultimoErrore = null
        break
      }
      // 23505 = violazione di unicita': un altro worker ha inserito la sua
      // riga fra la nostra delete e la nostra insert.
      if (error.code !== "23505") {
        throw new Error(`Revisione automatica non registrata: ${error.message}`)
      }
      ultimoErrore = error.message
      await new Promise((resolve) => setTimeout(resolve, 120 * (tentativo + 1)))
    }
    if (ultimoErrore) {
      throw new Error(`Revisione automatica non registrata: ${ultimoErrore}`)
    }
  }

  const aggiornati = smistamento.daScrivere.map((voce) => voce.campo)
  const revisioni = smistamento.inRevisione.map((voce) => voce.campo)
  if (aggiornati.length > 0 || revisioni.length > 0) {
    const righe = [
      "SolairAI ha processato automaticamente un documento Nextcloud.",
      "",
      `File: ${params.file.path}`,
      aggiornati.length > 0
        ? `Campi aggiornati: ${aggiornati.map((campo) => campo.etichetta).join(", ")}`
        : null,
      revisioni.length > 0
        ? `Campi in revisione: ${revisioni.map((campo) => campo.etichetta).join(", ")}`
        : null,
    ].filter(Boolean)

    const { error } = await params.supabase.from("attivita").insert({
      tipo: "nota",
      testo: righe.join("\n"),
      record_id: params.record.id,
      record_tipo: RECORD_TIPO_ATTIVITA[params.entita],
      utente_id: params.utenteId,
    })
    if (error) throw new Error(`Nota automatica non salvata: ${error.message}`)
  }

  return { aggiornati, revisioni }
}

export async function processaDocumentoSuCrmAutomatico(params: {
  supabase: SupabaseClient
  entita: EntitaAI
  file: FileCandidato
  testo: string
  utenteId: string | null
}): Promise<EsitoAutoCrmDocumento> {
  try {
    const records = await leggiRecordCandidati(params.supabase, params.entita)
    const match = scegliRecordPerDocumento(records, {
      path: params.file.path,
      nome: params.file.nome,
      testo: params.testo,
    })

    if (match.stato !== "matched") {
      return {
        stato: "skipped",
        recordId: null,
        recordEtichetta: null,
        allegatoPath: null,
        aggiornati: 0,
        revisioni: 0,
        errore:
          match.stato === "ambiguous"
            ? `match ambiguo: ${match.candidati.map((record) => record.etichetta).join(", ")}`
            : match.motivo,
      }
    }

    const record = records.find((voce) => voce.id === match.record.id)
    if (!record) throw new Error("Record riconosciuto non riletto")

    const giaProcessato = await giaProcessatoPerRecord(
      params.supabase,
      params.entita,
      record.id,
      params.file.fingerprint,
    )
    if (giaProcessato) {
      return {
        stato: "skipped",
        recordId: record.id,
        recordEtichetta: record.etichetta,
        allegatoPath: null,
        aggiornati: 0,
        revisioni: 0,
        errore: "file gia' processato per questo record",
      }
    }

    const allegatoPath = await copiaComeAllegato(params.entita, record, params.file)
    const { aggiornati, revisioni } = await aggiornaCrmDaDocumento({
      supabase: params.supabase,
      entita: params.entita,
      record,
      utenteId: params.utenteId,
      file: params.file,
      testo: params.testo,
    })

    await registraLetturaAdmin(params.supabase, {
      entita: params.entita,
      recordId: record.id,
      utenteId: params.utenteId,
      file: params.file,
    })
    if (allegatoPath !== params.file.path) {
      await registraLetturaAdmin(params.supabase, {
        entita: params.entita,
        recordId: record.id,
        utenteId: params.utenteId,
        file: {
          ...params.file,
          path: allegatoPath,
          nome: allegatoPath.split("/").pop() ?? params.file.nome,
        },
      })
    }

    return {
      stato: "matched",
      recordId: record.id,
      recordEtichetta: record.etichetta,
      allegatoPath,
      aggiornati: aggiornati.length,
      revisioni: revisioni.length,
      errore: null,
    }
  } catch (errore) {
    return {
      stato: "error",
      recordId: null,
      recordEtichetta: null,
      allegatoPath: null,
      aggiornati: 0,
      revisioni: 0,
      errore: errore instanceof Error ? errore.message : "Automazione CRM fallita",
    }
  }
}
