import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { DEFAULT_COMPITI_PARAMS, type CompitiListParams } from "@/lib/compiti/api-types"
import {
  createCompitoRecord,
  deleteCompitoRecords,
  getCompitoById,
  queryCompiti,
  updateCompitoRecord,
} from "@/lib/compiti/repository"
import { DEFAULT_SCADENZE_PARAMS, type ScadenzeListParams } from "@/lib/scadenze/api-types"
import {
  createScadenzaRecord,
  deleteScadenzaRecord,
  getScadenzaById,
  getScadenzaCompiti,
  queryScadenze,
  updateScadenzaRecord,
} from "@/lib/scadenze/repository"
import type { Compito, StatoCompito } from "@/lib/mock-data"
import { clientMcpObbligatorio } from "@/lib/mcp/context"
import { registraTool } from "@/lib/mcp/registra-tool"

/**
 * Aree Compiti e Scadenze.
 *
 * Due traduzioni servono al confine con i repository, che parlano la lingua
 * della UI e non quella di un modello:
 *
 *  - le date. I repository dei compiti scambiano "Data di scadenza" in
 *    DD/MM/YYYY (dmyToISO/isoToDMY): qui i tool accettano ISO, che e' la forma
 *    naturale per chi non guarda un calendario italiano, e convertono al volo.
 *
 *  - il proprietario. Vedi la nota su assegnaProprietario: il CRM assegna i
 *    compiti per id Zoho, non per id CRM.
 */

const STATI_COMPITO: StatoCompito[] = [
  "Non iniziato",
  "In corso",
  "Rinviato",
  "Completato",
  "In attesa di input",
  "Da fare",
  "In attesa",
]

const PRIORITA = ["Alto", "Medio", "Basso"] as const

/** ISO (YYYY-MM-DD, con o senza orario) -> DD/MM/YYYY per i repository. */
function isoADmy(iso: string): string {
  const data = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(data.getTime())) throw new Error(`Data non valida: ${iso}`)
  const giorno = String(data.getUTCDate()).padStart(2, "0")
  const mese = String(data.getUTCMonth() + 1).padStart(2, "0")
  return `${giorno}/${mese}/${data.getUTCFullYear()}`
}

type UtenteAssegnabile = { id: string; nome: string; zoho_id: string | null }

async function risolviUtente(id: string): Promise<UtenteAssegnabile> {
  const supabase = clientMcpObbligatorio()
  const { data, error } = await supabase
    .from("utenti")
    .select("id,nome,zoho_id")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Lettura utente non riuscita: ${error.message}`)
  if (!data) throw new Error(`Nessun utente con id ${id}. Usa crm_utenti_lookup per trovarlo.`)
  return data as UtenteAssegnabile
}

/**
 * Scrive `compiti.proprietario_id` dopo aver creato o aggiornato il compito.
 *
 * Perche' non basta il repository: createCompitoRecord scrive solo il nome e
 * l'id Zoho del proprietario, mai lo uuid, e updateCompitoRecord lo ricava
 * dall'id Zoho con una lookup su utenti. Cosi' l'assegnazione fallirebbe per
 * chiunque non venga da Zoho — oggi un utente attivo su 30 e' in quella
 * condizione. Questa e' l'unica scrittura diretta su colonna dell'intera area:
 * il resto passa dai repository.
 *
 * Nota: `proprietario_id` conta anche per la RLS (compiti_select lascia
 * passare le righe con proprietario_id nullo), quindi assegnare un compito lo
 * rende visibile al proprietario e agli amministratori, non piu' a chiunque.
 * E' il comportamento dei 2337 compiti su 2346 che l'id ce l'hanno.
 */
async function assegnaProprietario(compitoId: string, utenteId: string): Promise<void> {
  const supabase = clientMcpObbligatorio()
  const { error } = await supabase
    .from("compiti")
    .update({ proprietario_id: utenteId })
    .eq("id", compitoId)
  if (error) throw new Error(`Assegnazione proprietario non riuscita: ${error.message}`)
}

const correlatoSchema = z
  .object({
    tipo: z.enum(["lead", "cliente", "scadenza"]),
    id: z.string().uuid(),
    nome: z.string().trim().optional().describe("Etichetta mostrata nel CRM; se assente resta l'id."),
  })
  .optional()
  .describe("Record a cui il compito e' collegato.")

type TipoCorrelato = NonNullable<Compito["Correlato a"]>["tipo"]

function versoCorrelato(correlato: { tipo: string; id: string; nome?: string } | undefined) {
  if (!correlato) return undefined
  // Lo schema accetta minuscolo (piu' naturale da scrivere), il tipo Compito
  // vuole la maiuscola, il repository rimette tutto in minuscolo per il DB.
  const tipo = (correlato.tipo.charAt(0).toUpperCase() + correlato.tipo.slice(1)) as TipoCorrelato
  return { tipo, id: correlato.id, nome: correlato.nome ?? correlato.id }
}

export function registraToolCompiti(server: McpServer): void {
  registraTool(server, {
    nome: "compiti_search",
    titolo: "Cerca compiti",
    descrizione:
      "Cerca compiti con i filtri della bacheca CRM: testo libero, stati, priorita', proprietario, " +
      "sede, intervallo di scadenza, solo scaduti. Restituisce anche i contatori (scaduti, aperti, alta priorita').",
    schema: {
      cerca: z.string().trim().optional().describe("Testo su oggetto, descrizione, proprietario, contatto, correlato, tag."),
      stati: z.array(z.enum(STATI_COMPITO as [StatoCompito, ...StatoCompito[]])).optional(),
      priorita: z.enum(PRIORITA).optional(),
      proprietario_id: z.string().uuid().optional().describe("id utente proprietario."),
      sede: z.string().trim().optional(),
      scadenza_da: z.string().trim().optional().describe("Data ISO di inizio intervallo."),
      scadenza_a: z.string().trim().optional().describe("Data ISO di fine intervallo."),
      solo_scaduti: z.boolean().optional(),
      ordina_per: z.string().trim().optional().describe("Default 'Data di scadenza'."),
      direzione: z.enum(["asc", "desc"]).optional(),
      pagina: z.number().int().min(1).optional(),
      per_pagina: z.number().int().min(1).max(200).optional().describe("Default 25."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async (args) => {
      const params: CompitiListParams = {
        ...DEFAULT_COMPITI_PARAMS,
        page: args.pagina ?? 1,
        pageSize: args.per_pagina ?? 25,
        sortBy: (args.ordina_per ?? DEFAULT_COMPITI_PARAMS.sortBy) as CompitiListParams["sortBy"],
        sortDir: args.direzione ?? "asc",
        search: args.cerca ?? "",
        stati: args.stati ?? [],
        priorita: args.priorita ?? "all",
        proprietario: args.proprietario_id ?? "all",
        sede: args.sede ?? "all",
        scadenzaDa: args.scadenza_da ?? "",
        scadenzaA: args.scadenza_a ?? "",
        overdue: args.solo_scaduti ?? false,
      }
      const esito = await queryCompiti(params)
      return { dati: esito, righe: esito.rows.length }
    },
  })

  registraTool(server, {
    nome: "compiti_get",
    titolo: "Dettaglio compito",
    descrizione: "Scheda completa di un compito, comprese note e record correlato.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id }) => {
      const compito = await getCompitoById(id)
      if (!compito) throw new Error(`Nessun compito con id ${id}`)
      return { dati: compito, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "compiti_create",
    titolo: "Crea compito",
    descrizione:
      "Crea un compito e, se indicato, lo assegna a un utente. Assegnare un compito lo rende visibile " +
      "al proprietario e agli amministratori: senza proprietario resta visibile a tutti.",
    schema: {
      oggetto: z.string().trim().min(1).describe("Titolo del compito."),
      scadenza: z.string().trim().optional().describe("Data ISO, es. 2026-09-15."),
      stato: z.enum(STATI_COMPITO as [StatoCompito, ...StatoCompito[]]).optional().describe("Default 'Non iniziato'."),
      priorita: z.enum(PRIORITA).optional().describe("Default 'Medio'."),
      proprietario_id: z.string().uuid().optional().describe("id utente assegnatario (da crm_utenti_lookup)."),
      descrizione: z.string().trim().optional(),
      sede: z.string().trim().optional(),
      correlato: correlatoSchema,
      nome_contatto: z.string().trim().optional(),
      ripeti: z.string().trim().optional(),
      promemoria: z.string().trim().optional(),
      tag: z.string().trim().optional().describe("Tag testuale del compito (colonna storica, distinta da compito_tags)."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async (args) => {
      const proprietario = args.proprietario_id ? await risolviUtente(args.proprietario_id) : null
      const creato = await createCompitoRecord({
        Oggetto: args.oggetto,
        Stato: args.stato ?? "Non iniziato",
        Priorità: args.priorita ?? "Medio",
        ...(args.scadenza ? { "Data di scadenza": isoADmy(args.scadenza) } : {}),
        ...(proprietario
          ? {
              "Proprietario del compito": proprietario.nome,
              "Proprietario del compito.id": proprietario.zoho_id ?? "",
            }
          : {}),
        Descrizione: args.descrizione,
        Sede: args.sede as Compito["Sede"],
        "Nome contatto": args.nome_contatto,
        "Correlato a": versoCorrelato(args.correlato),
        Ripeti: args.ripeti,
        Promemoria: args.promemoria,
        Tag: args.tag,
      } as Partial<Compito>)

      if (proprietario) await assegnaProprietario(creato.id, proprietario.id)
      return { dati: { ...creato, proprietario_id: proprietario?.id ?? null }, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "compiti_update",
    titolo: "Aggiorna compito",
    descrizione:
      "Aggiorna un compito esistente: stato, priorita', scadenza, descrizione, record correlato, " +
      "oppure riassegnalo a un altro utente. I campi non passati restano invariati.",
    schema: {
      id: z.string().uuid(),
      oggetto: z.string().trim().optional(),
      scadenza: z.string().trim().optional().describe("Data ISO, es. 2026-09-15."),
      stato: z.enum(STATI_COMPITO as [StatoCompito, ...StatoCompito[]]).optional(),
      priorita: z.enum(PRIORITA).optional(),
      proprietario_id: z.string().uuid().optional().describe("Nuovo assegnatario."),
      descrizione: z.string().trim().optional(),
      sede: z.string().trim().optional(),
      correlato: correlatoSchema,
      nome_contatto: z.string().trim().optional(),
      ripeti: z.string().trim().optional(),
      promemoria: z.string().trim().optional(),
      tag: z.string().trim().optional(),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id, ...campi }) => {
      const proprietario = campi.proprietario_id ? await risolviUtente(campi.proprietario_id) : null
      const patch: Partial<Compito> = {
        ...(campi.oggetto !== undefined ? { Oggetto: campi.oggetto } : {}),
        ...(campi.stato !== undefined ? { Stato: campi.stato } : {}),
        ...(campi.priorita !== undefined ? { Priorità: campi.priorita } : {}),
        ...(campi.scadenza !== undefined ? { "Data di scadenza": isoADmy(campi.scadenza) } : {}),
        ...(campi.descrizione !== undefined ? { Descrizione: campi.descrizione } : {}),
        ...(campi.sede !== undefined ? { Sede: campi.sede as Compito["Sede"] } : {}),
        ...(campi.nome_contatto !== undefined ? { "Nome contatto": campi.nome_contatto } : {}),
        ...(campi.ripeti !== undefined ? { Ripeti: campi.ripeti } : {}),
        ...(campi.promemoria !== undefined ? { Promemoria: campi.promemoria } : {}),
        ...(campi.tag !== undefined ? { Tag: campi.tag } : {}),
        ...(campi.correlato !== undefined ? { "Correlato a": versoCorrelato(campi.correlato) } : {}),
        ...(proprietario
          ? {
              "Proprietario del compito": proprietario.nome,
              "Proprietario del compito.id": proprietario.zoho_id ?? "",
            }
          : {}),
      }
      if (Object.keys(patch).length === 0) throw new Error("Nessun campo da aggiornare")

      const aggiornato = await updateCompitoRecord(id, patch)
      if (!aggiornato) throw new Error(`Aggiornamento non riuscito: nessun compito con id ${id}`)
      if (proprietario) await assegnaProprietario(id, proprietario.id)
      return { dati: aggiornato, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "compiti_delete",
    titolo: "Elimina compiti",
    descrizione: "Elimina definitivamente uno o piu' compiti, con le note e i tag associati.",
    schema: { ids: z.array(z.string().uuid()).min(1).max(100) },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    esegui: async ({ ids }) => {
      const eliminati = await deleteCompitoRecords(ids)
      return { dati: { eliminati, richiesti: ids.length }, righe: eliminati }
    },
  })

  registraTool(server, {
    nome: "compiti_tag_add",
    titolo: "Assegna tag a un compito",
    descrizione: "Assegna uno o piu' tag a un compito. Gli id si ottengono da crm_tags_list.",
    schema: { compito_id: z.string().uuid(), tag_ids: z.array(z.string().uuid()).min(1) },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ compito_id, tag_ids }) => {
      const supabase = clientMcpObbligatorio()
      const righe = tag_ids.map((tag_id) => ({ compito_id, tag_id }))
      const { error } = await supabase
        .from("compito_tags")
        .upsert(righe, { onConflict: "compito_id,tag_id", ignoreDuplicates: true })
      if (error) throw new Error(`Assegnazione tag non riuscita: ${error.message}`)
      return { dati: { assegnati: righe.length }, righe: righe.length }
    },
  })

  registraTool(server, {
    nome: "compiti_tag_remove",
    titolo: "Rimuovi tag da un compito",
    descrizione: "Toglie uno o piu' tag da un compito. Il tag resta nel CRM: si rimuove solo l'assegnazione.",
    schema: { compito_id: z.string().uuid(), tag_ids: z.array(z.string().uuid()).min(1) },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ compito_id, tag_ids }) => {
      const supabase = clientMcpObbligatorio()
      const { error, count } = await supabase
        .from("compito_tags")
        .delete({ count: "exact" })
        .eq("compito_id", compito_id)
        .in("tag_id", tag_ids)
      if (error) throw new Error(`Rimozione tag non riuscita: ${error.message}`)
      return { dati: { rimossi: count ?? 0 }, righe: count ?? 0 }
    },
  })
}

export function registraToolScadenze(server: McpServer): void {
  registraTool(server, {
    nome: "scadenze_search",
    titolo: "Cerca scadenze",
    descrizione:
      "Cerca scadenze per nome, proprietario, tag, intervallo di date o presenza di un collegamento " +
      "a lead/cliente. Restituisce anche i contatori di scadute e in scadenza entro 7 giorni.",
    schema: {
      cerca: z.string().trim().optional(),
      proprietario_id: z.string().uuid().optional(),
      tag: z.string().trim().optional(),
      da: z.string().trim().optional().describe("Data ISO di inizio intervallo."),
      a: z.string().trim().optional().describe("Data ISO di fine intervallo."),
      collegamento: z.enum(["all", "si", "no"]).optional().describe("Filtra per presenza di un record collegato."),
      ordina_per: z.enum(["nome", "data_scadenza", "proprietario_nome", "updated_at"]).optional(),
      direzione: z.enum(["asc", "desc"]).optional(),
      pagina: z.number().int().min(1).optional(),
      per_pagina: z.number().int().min(1).max(200).optional().describe("Default 25."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async (args) => {
      const params: ScadenzeListParams = {
        ...DEFAULT_SCADENZE_PARAMS,
        page: args.pagina ?? 1,
        pageSize: args.per_pagina ?? 25,
        sortBy: args.ordina_per ?? DEFAULT_SCADENZE_PARAMS.sortBy,
        sortDir: args.direzione ?? "asc",
        search: args.cerca ?? "",
        proprietario: args.proprietario_id ?? "all",
        tag: args.tag ?? "all",
        scadenzaDa: args.da ?? "",
        scadenzaA: args.a ?? "",
        collegamento: args.collegamento ?? "all",
      }
      const esito = await queryScadenze(params)
      return { dati: esito, righe: esito.rows.length }
    },
  })

  registraTool(server, {
    nome: "scadenze_get",
    titolo: "Dettaglio scadenza",
    descrizione: "Scheda di una scadenza con i compiti collegati.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id }) => {
      const [scadenza, compiti] = await Promise.all([getScadenzaById(id), getScadenzaCompiti(id)])
      if (!scadenza) throw new Error(`Nessuna scadenza con id ${id}`)
      return { dati: { ...scadenza, compiti }, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "scadenze_create",
    titolo: "Crea scadenza",
    descrizione:
      "Crea una scadenza, opzionalmente assegnata a un utente e collegata a un lead o a un cliente.",
    schema: {
      nome: z.string().trim().min(1),
      data_scadenza: z.string().trim().describe("Data ISO, es. 2026-09-30."),
      proprietario_id: z.string().uuid().optional(),
      descrizione: z.string().trim().optional(),
      collegato_a_id: z.string().uuid().optional(),
      collegato_a_tipo: z.enum(["lead", "cliente"]).optional(),
      tag: z.string().trim().optional(),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async (args) => {
      if (Boolean(args.collegato_a_id) !== Boolean(args.collegato_a_tipo)) {
        throw new Error("collegato_a_id e collegato_a_tipo vanno passati insieme")
      }
      const creata = await createScadenzaRecord({
        nome: args.nome,
        data_scadenza: args.data_scadenza,
        proprietario_id: args.proprietario_id ?? null,
        descrizione: args.descrizione ?? null,
        connesso_a_id: args.collegato_a_id ?? null,
        connesso_a_tipo: args.collegato_a_tipo ?? null,
        tag: args.tag ?? null,
      })
      return { dati: creata, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "scadenze_update",
    titolo: "Aggiorna scadenza",
    descrizione: "Aggiorna i campi indicati di una scadenza, riassegnazione compresa.",
    schema: {
      id: z.string().uuid(),
      nome: z.string().trim().optional(),
      data_scadenza: z.string().trim().optional().describe("Data ISO."),
      proprietario_id: z.string().uuid().nullable().optional(),
      descrizione: z.string().trim().nullable().optional(),
      collegato_a_id: z.string().uuid().nullable().optional(),
      collegato_a_tipo: z.enum(["lead", "cliente"]).nullable().optional(),
      tag: z.string().trim().nullable().optional(),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id, ...campi }) => {
      const patch = {
        ...(campi.nome !== undefined ? { nome: campi.nome } : {}),
        ...(campi.data_scadenza !== undefined ? { data_scadenza: campi.data_scadenza } : {}),
        ...(campi.proprietario_id !== undefined ? { proprietario_id: campi.proprietario_id } : {}),
        ...(campi.descrizione !== undefined ? { descrizione: campi.descrizione } : {}),
        ...(campi.collegato_a_id !== undefined ? { connesso_a_id: campi.collegato_a_id } : {}),
        ...(campi.collegato_a_tipo !== undefined ? { connesso_a_tipo: campi.collegato_a_tipo } : {}),
        ...(campi.tag !== undefined ? { tag: campi.tag } : {}),
      }
      if (Object.keys(patch).length === 0) throw new Error("Nessun campo da aggiornare")
      const aggiornata = await updateScadenzaRecord(id, patch)
      if (!aggiornata) throw new Error(`Aggiornamento non riuscito: nessuna scadenza con id ${id}`)
      return { dati: aggiornata, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "scadenze_delete",
    titolo: "Elimina scadenza",
    descrizione:
      "Elimina definitivamente una scadenza. I compiti collegati non vengono cancellati: restano " +
      "senza collegamento.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    esegui: async ({ id }) => {
      const eliminata = await deleteScadenzaRecord(id)
      if (!eliminata) throw new Error(`Nessuna scadenza con id ${id}`)
      return { dati: { eliminata: true, id }, righe: 1 }
    },
  })
}
