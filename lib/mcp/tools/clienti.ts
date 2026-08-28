import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { DEFAULT_CLIENTI_PARAMS, type ClientiListParams } from "@/lib/clienti/api-types"
import {
  createClienteRecord,
  deleteClienteRecords,
  getClienteById,
  queryClienti,
  updateClienteRecord,
} from "@/lib/clienti/repository"
import { CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"
import { CLIENTE_COLUMNS, type ClienteRecord } from "@/lib/mock-data"
import { clientMcpObbligatorio } from "@/lib/mcp/context"
import { registraTool } from "@/lib/mcp/registra-tool"

/**
 * Area Clienti.
 *
 * Dove stanno davvero i dati delle sei sezioni (impianto, pagamenti, iter,
 * logistica, documenti, comunicazioni): in COLONNE della tabella `clienti`,
 * non nelle tabelle `cliente_*`. Quelle esistono ma sono vuote (0 righe tutte
 * e sei), non sono referenziate da nessuna riga di codice dell'app, e 79 delle
 * loro 103 colonne sono duplicate su `clienti` — dove i dati veri ci sono
 * (5 IBAN, 7 POD, 7 COD-MODULI sui 16 clienti). La UI le tratta come gruppi di
 * colonne (CLIENTE_COLUMNS.group), con gli stessi nomi delle tabelle vuote.
 *
 * Questi tool scrivono quindi su `clienti`, che e' cio' che il CRM legge.
 * Scrivere sulle `cliente_*` avrebbe prodotto record invisibili all'app e una
 * seconda verita' divergente sugli stessi campi.
 *
 * La scrittura passa da updateClienteRecord, che gia' accetta genericamente
 * ogni campo di CLIENTI_RECORD_FIELDS: nessuna mappatura nuova da mantenere.
 */

/** Gruppo di colonne della UI che corrisponde a ciascuna sezione. */
const GRUPPO_IMPIANTO = "Configurazione impianto"
const GRUPPO_PAGAMENTI = "Pagamenti e finanziario"
const GRUPPO_ITER = "Iter burocratico"
const GRUPPO_LOGISTICA = "Logistica e cantiere"
const GRUPPO_DOCUMENTI = "Documenti e pratiche"
const GRUPPO_COMUNICAZIONI = "Comunicazioni automatiche"

/** Campi realmente scrivibili: nella UI ma anche nella mappa del repository. */
const SCRIVIBILI = new Set(CLIENTI_RECORD_FIELDS.map((campo) => campo.appField))

const campiClienteLiberi = new Map<string, string>()
for (const field of CLIENTI_RECORD_FIELDS) {
  campiClienteLiberi.set(field.appField, field.appField)
  campiClienteLiberi.set(field.column, field.appField)
}

function campiDelGruppo(gruppo: string): string[] {
  return CLIENTE_COLUMNS.filter((colonna) => colonna.group === gruppo)
    .map((colonna) => colonna.id as string)
    .filter((id) => SCRIVIBILI.has(id))
}

function versoClienteDaCampiLiberi(campi: Record<string, unknown>, ammessi?: Set<string>): Partial<ClienteRecord> {
  const patch: Record<string, unknown> = {}
  const sconosciuti: string[] = []
  const fuoriSezione: string[] = []

  for (const [chiave, valore] of Object.entries(campi)) {
    if (valore === undefined) continue
    const destinazione = campiClienteLiberi.get(chiave)
    if (!destinazione) {
      sconosciuti.push(chiave)
      continue
    }
    if (ammessi && !ammessi.has(destinazione)) {
      fuoriSezione.push(chiave)
      continue
    }
    patch[destinazione] = valore
  }

  if (sconosciuti.length > 0) {
    throw new Error(
      `Campi cliente non riconosciuti: ${sconosciuti.join(", ")}. ` +
        "Usa clienti_campi_disponibili per i nomi CRM o le colonne database esatte.",
    )
  }
  if (fuoriSezione.length > 0) {
    throw new Error(`Campi non validi per questa sezione: ${fuoriSezione.join(", ")}`)
  }
  return patch as Partial<ClienteRecord>
}

/**
 * Aggiorna una sezione. Il controllo sui nomi campo e' esplicito e non
 * permissivo di proposito: updateClienteRecord ignora in silenzio le chiavi
 * che non riconosce, quindi senza questo un campo scritto male tornerebbe
 * "aggiornato" senza aver toccato niente.
 */
async function aggiornaSezione(gruppo: string, clienteId: string, campi: Record<string, unknown>) {
  const ammessi = new Set(campiDelGruppo(gruppo))
  const patch = versoClienteDaCampiLiberi(campi, ammessi)
  const passati = Object.keys(patch)
  if (passati.length === 0) throw new Error("Nessun campo da aggiornare")

  const aggiornato = await updateClienteRecord(clienteId, patch)
  if (!aggiornato) throw new Error(`Aggiornamento non riuscito: nessun cliente con id ${clienteId}`)
  return { dati: { id: clienteId, sezione: gruppo, aggiornati: passati }, righe: 1 }
}

const schemaSezione = {
  cliente_id: z.string().uuid(),
  campi: z
    .record(z.string(), z.unknown())
    .describe("Coppie nome campo -> valore. I nomi ammessi si ottengono da clienti_campi_disponibili."),
}

export function registraToolClienti(server: McpServer): void {
  registraTool(server, {
    nome: "clienti_search",
    titolo: "Cerca clienti",
    descrizione:
      "Cerca clienti con i filtri della lista CRM (testo su nome, email, cellulare e codice fiscale; " +
      "stato, sede, proprietario, installatore) e restituisce una pagina di risultati con il totale.",
    schema: {
      cerca: z.string().trim().optional(),
      stato: z.string().trim().optional(),
      sede: z.string().trim().optional(),
      proprietario: z.string().trim().optional().describe("id utente del proprietario."),
      installatore: z.string().trim().optional().describe("id installatore."),
      ordina_per: z.string().trim().optional().describe("Es. 'Ora modifica' (default), 'Nome Clienti', 'Stato'."),
      direzione: z.enum(["asc", "desc"]).optional(),
      pagina: z.number().int().min(1).optional(),
      per_pagina: z.number().int().min(1).max(200).optional().describe("Default 25."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async (args) => {
      const params: ClientiListParams = {
        ...DEFAULT_CLIENTI_PARAMS,
        page: args.pagina ?? 1,
        pageSize: args.per_pagina ?? 25,
        sortBy: (args.ordina_per ?? DEFAULT_CLIENTI_PARAMS.sortBy) as ClientiListParams["sortBy"],
        sortDir: args.direzione ?? "desc",
        search: args.cerca ?? "",
        stato: args.stato ?? "all",
        sede: args.sede ?? "all",
        proprietario: args.proprietario ?? "all",
        installatore: args.installatore ?? "all",
      }
      const esito = await queryClienti(params)
      return { dati: esito, righe: esito.rows.length }
    },
  })

  registraTool(server, {
    nome: "clienti_get",
    titolo: "Scheda cliente",
    descrizione:
      "Scheda completa di un cliente: anagrafica e tutte le sezioni (impianto, pagamenti con IBAN, " +
      "iter burocratico, logistica, stato documenti, comunicazioni), piu' i compiti collegati.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id }) => {
      const cliente = await getClienteById(id)
      if (!cliente) throw new Error(`Nessun cliente con id ${id}`)
      return { dati: cliente, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "clienti_campi_disponibili",
    titolo: "Campi della scheda cliente",
    descrizione:
      "Elenca i campi scrivibili del cliente, raggruppati per sezione. Da consultare prima " +
      "di clienti_update o dei tool di sezione: sono accettati sia il nome CRM sia la colonna database.",
    schema: {
      sezione: z
        .string()
        .trim()
        .optional()
        .describe("Filtra su un gruppo, es. 'Pagamenti e finanziario'. Senza filtro restituisce tutti i gruppi."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ sezione }) => {
      const gruppi = new Map<string, string[]>()
      for (const colonna of CLIENTE_COLUMNS) {
        const id = colonna.id as string
        if (!SCRIVIBILI.has(id)) continue
        if (sezione && colonna.group !== sezione) continue
        const elenco = gruppi.get(colonna.group) ?? []
        const field = CLIENTI_RECORD_FIELDS.find((item) => item.appField === id)
        elenco.push(field ? `${id} (${field.column}, ${field.type})` : id)
        gruppi.set(colonna.group, elenco)
      }
      const dati = Object.fromEntries(gruppi)
      return { dati, righe: Object.values(dati).reduce((n, campi) => n + campi.length, 0) }
    },
  })

  registraTool(server, {
    nome: "clienti_create",
    titolo: "Crea cliente",
    descrizione:
      "Crea un cliente con l'anagrafica di base. Le sezioni di dettaglio si compilano poi con i tool " +
      "dedicati. Se si passa la provincia postale scatta la regola del tag 'Italia'.",
    schema: {
      nome_clienti: z.string().trim().optional().describe("Nome completo mostrato in lista."),
      nome: z.string().trim().optional(),
      cognome: z.string().trim().optional(),
      email: z.string().trim().optional(),
      cellulare: z.string().trim().optional(),
      codice_fiscale: z.string().trim().optional(),
      stato: z.string().trim().optional(),
      sede: z.string().trim().optional(),
      proprietario_id: z.string().uuid().optional().describe("id utente (da crm_utenti_lookup)."),
      installatore: z.string().trim().optional().describe("Nome dell'installatore (colonna testuale storica)."),
      installatore_id: z.string().uuid().optional().describe("id installatore, se assegnato."),
      provincia: z.string().trim().optional().describe("Provincia dell'indirizzo postale."),
      lead_id: z.string().uuid().optional().describe("Lead di origine, se il cliente nasce da una conversione."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async (args) => {
      const body: Partial<ClienteRecord> = {
        "Nome Clienti": args.nome_clienti ?? [args.nome, args.cognome].filter(Boolean).join(" ").trim(),
        Nome: args.nome,
        Cognome: args.cognome,
        "E-mail": args.email,
        Cellulare: args.cellulare,
        "Codice fiscale": args.codice_fiscale,
        Stato: args.stato as ClienteRecord["Stato"],
        Sede: args.sede as ClienteRecord["Sede"],
        "Clienti Proprietario": args.proprietario_id,
        Installatore: args.installatore,
        InstallatoreId: args.installatore_id,
        "Provincia indirizzo postale": args.provincia,
      }
      if (!body["Nome Clienti"] && !body["E-mail"] && !body.Cellulare) {
        throw new Error("Serve almeno uno fra nome_clienti, nome, email o cellulare")
      }
      const creato = await createClienteRecord(body, args.lead_id)
      return { dati: creato, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "clienti_update",
    titolo: "Aggiorna cliente",
    descrizione:
      "Aggiorna qualsiasi campo della scheda cliente, di qualunque sezione. I nomi dei campi si " +
      "ottengono da clienti_campi_disponibili. Per modificare una sola sezione conviene il tool dedicato.",
    schema: {
      id: z.string().uuid(),
      campi: z
        .record(z.string(), z.unknown())
        .describe("Coppie nome campo -> valore, con i nomi esatti di clienti_campi_disponibili."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id, campi }) => {
      const patch = versoClienteDaCampiLiberi(campi)
      const passati = Object.keys(patch)
      if (passati.length === 0) throw new Error("Nessun campo da aggiornare")
      const aggiornato = await updateClienteRecord(id, patch)
      if (!aggiornato) throw new Error(`Aggiornamento non riuscito: nessun cliente con id ${id}`)
      return { dati: { id, aggiornati: passati }, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "clienti_delete",
    titolo: "Elimina clienti",
    descrizione:
      "Elimina definitivamente uno o piu' clienti, con tutte le sezioni di dettaglio e i tag " +
      "associati. Non e' reversibile. Le note della timeline e i link esterni restano nel database " +
      "senza piu' un record a cui appartenere, come quando si elimina un cliente dal CRM.",
    schema: { ids: z.array(z.string().uuid()).min(1).max(50) },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    esegui: async ({ ids }) => {
      const eliminati = await deleteClienteRecords(ids)
      return { dati: { eliminati, richiesti: ids.length }, righe: eliminati }
    },
  })

  registraTool(server, {
    nome: "clienti_duplica",
    titolo: "Duplica cliente",
    descrizione:
      "Crea una copia del cliente con l'anagrafica di base e il suffisso '(copia)' nel nome. " +
      "Non copia le sezioni di dettaglio (impianto, pagamenti, iter): restano da compilare, " +
      "cosi' non si duplicano per sbaglio dati finanziari.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async ({ id }) => {
      const sorgente = await getClienteById(id)
      if (!sorgente) throw new Error(`Nessun cliente con id ${id}`)
      // Stessa superficie della route /api/clienti/[id]/duplica, provincia
      // esclusa compresa: il duplicato non deve ereditare un tag "Italia"
      // dedotto da un indirizzo mai confermato su quel record.
      const copia = await createClienteRecord({
        ...sorgente,
        "Nome Clienti": `${sorgente["Nome Clienti"]} (copia)`,
        "Provincia indirizzo postale": undefined,
      })
      return { dati: copia, righe: 1 }
    },
  })

  const sezioni: { nome: string; gruppo: string; titolo: string; descrizione: string; distruttivo: boolean }[] = [
    {
      nome: "cliente_impianto_upsert",
      gruppo: GRUPPO_IMPIANTO,
      titolo: "Configurazione impianto",
      descrizione:
        "Aggiorna la configurazione tecnica dell'impianto del cliente: moduli, inverter, storage, " +
        "potenze, accessori, EPS, retrofit, disponibilita' di magazzino.",
      distruttivo: false,
    },
    {
      nome: "cliente_pagamenti_upsert",
      gruppo: GRUPPO_PAGAMENTI,
      titolo: "Pagamenti e finanziario",
      descrizione:
        "Aggiorna i dati economici del cliente: importo contrattuale, tranche e bonifici, saldo, " +
        "IBAN, finanziamento, IVA, sconto combo. Tocca dati bancari e contabili: verifica i valori " +
        "prima di scrivere, perche' sovrascrivono quelli presenti.",
      distruttivo: true,
    },
    {
      nome: "cliente_iter_upsert",
      gruppo: GRUPPO_ITER,
      titolo: "Iter burocratico",
      descrizione:
        "Aggiorna l'iter burocratico: POD, zona, TICA e relativo stato, date di sopralluogo, " +
        "ammissibilita', pratiche GSE ed e-distribuzione, solleciti.",
      distruttivo: false,
    },
    {
      nome: "cliente_logistica_upsert",
      gruppo: GRUPPO_LOGISTICA,
      titolo: "Logistica e cantiere",
      descrizione:
        "Aggiorna logistica e cantiere: stratigrafia, magazzino installatore, ritiro merce, " +
        "interventi, date di installazione e appuntamento di allaccio.",
      distruttivo: false,
    },
    {
      nome: "cliente_documenti_stato_upsert",
      gruppo: GRUPPO_DOCUMENTI,
      titolo: "Stato documenti e pratiche",
      descrizione:
        "Aggiorna lo stato dei documenti del cliente: mappa catastale, regolamento di esercizio, " +
        "attestato Terna, scheda ENEA, fatture, verifica documentale, layout verificato.",
      distruttivo: false,
    },
    {
      nome: "cliente_comunicazioni_upsert",
      gruppo: GRUPPO_COMUNICAZIONI,
      titolo: "Comunicazioni automatiche",
      descrizione:
        "Aggiorna il registro delle comunicazioni al cliente: messaggio di benvenuto, progetto " +
        "preliminare, ordine merce, esecuzione, telefonata post installazione, fattura, assistenza.",
      distruttivo: false,
    },
  ]

  for (const sezione of sezioni) {
    registraTool(server, {
      nome: sezione.nome,
      titolo: sezione.titolo,
      descrizione: `${sezione.descrizione} I nomi dei campi si ottengono da clienti_campi_disponibili con sezione "${sezione.gruppo}".`,
      schema: schemaSezione,
      annotazioni: {
        readOnlyHint: false,
        destructiveHint: sezione.distruttivo,
        idempotentHint: true,
        openWorldHint: false,
      },
      esegui: ({ cliente_id, campi }) => aggiornaSezione(sezione.gruppo, cliente_id, campi),
    })
  }

  registraTool(server, {
    nome: "cliente_tags_add",
    titolo: "Assegna tag a un cliente",
    descrizione:
      "Assegna uno o piu' tag a un cliente. Gli id si ottengono da crm_tags_list. I tag gia' " +
      "presenti non vengono duplicati e non perdono la traccia di chi li aveva assegnati.",
    schema: { cliente_id: z.string().uuid(), tag_ids: z.array(z.string().uuid()).min(1) },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ cliente_id, tag_ids }) => {
      const supabase = clientMcpObbligatorio()
      const righe = tag_ids.map((tag_id) => ({ cliente_id, tag_id }))
      const { error } = await supabase
        .from("cliente_tags")
        .upsert(righe, { onConflict: "cliente_id,tag_id", ignoreDuplicates: true })
      if (error) throw new Error(`Assegnazione tag non riuscita: ${error.message}`)
      return { dati: { assegnati: righe.length }, righe: righe.length }
    },
  })

  registraTool(server, {
    nome: "cliente_tags_remove",
    titolo: "Rimuovi tag da un cliente",
    descrizione:
      "Toglie uno o piu' tag da un cliente. Il tag resta nel CRM: si rimuove solo l'assegnazione. " +
      "Attenzione al tag 'Italia', che il CRM riassegna da solo quando cambia la provincia.",
    schema: { cliente_id: z.string().uuid(), tag_ids: z.array(z.string().uuid()).min(1) },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ cliente_id, tag_ids }) => {
      const supabase = clientMcpObbligatorio()
      const { error, count } = await supabase
        .from("cliente_tags")
        .delete({ count: "exact" })
        .eq("cliente_id", cliente_id)
        .in("tag_id", tag_ids)
      if (error) throw new Error(`Rimozione tag non riuscita: ${error.message}`)
      return { dati: { rimossi: count ?? 0 }, righe: count ?? 0 }
    },
  })
}
