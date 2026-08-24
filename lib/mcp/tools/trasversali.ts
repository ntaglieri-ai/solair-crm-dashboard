import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import {
  deleteCollegamentoRow,
  insertCollegamento,
  listCollegamenti,
} from "@/lib/allegati/repository"
import type { AllegatoRecordTipo } from "@/lib/allegati/paths"
import { clientMcpObbligatorio } from "@/lib/mcp/context"
import { registraTool } from "@/lib/mcp/registra-tool"
import { utenteCorrenteId } from "@/lib/mcp/utente-corrente"

/**
 * Tool che non appartengono a un modulo solo: la timeline delle attivita', le
 * note, i tag e i link esterni valgono per lead, clienti, compiti e
 * installatori allo stesso modo.
 *
 * Sui tipi di record: la RLS di `attivita` e `collegamenti` ammette quattro
 * valori (lead, cliente, compito, installatore) e verifica che il record
 * esista davvero nella tabella corrispondente, quindi un record_id sbagliato
 * viene rifiutato dal database prima ancora che dal tool. Il tipo
 * AllegatoRecordTipo del repository ne dichiara solo tre — nasce dalle cartelle
 * allegati, dove i compiti non hanno una cartella — ed e' il motivo del cast
 * nei collegamenti.
 */

const RECORD_TIPI = ["lead", "cliente", "compito", "installatore"] as const

const MODULI_TAG = ["lead", "cliente", "compito", "installatore"] as const

export function registraToolTrasversali(server: McpServer): void {
  registraTool(server, {
    nome: "crm_timeline_list",
    titolo: "Timeline di un record",
    descrizione:
      "Elenca le attivita' registrate su un record — note scritte dagli utenti e cambi di stato — " +
      "dalla piu' recente. E' la stessa timeline che si vede aprendo il record nel CRM.",
    schema: {
      record_tipo: z.enum(RECORD_TIPI),
      record_id: z.string().uuid(),
      limite: z.number().int().min(1).max(200).optional().describe("Default 50."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ record_tipo, record_id, limite }) => {
      const supabase = clientMcpObbligatorio()
      const { data, error } = await supabase
        .from("attivita")
        .select("id,tipo,testo,campo,valore_precedente,valore_nuovo,utente_id,created_at")
        .eq("record_tipo", record_tipo)
        .eq("record_id", record_id)
        .order("created_at", { ascending: false })
        .limit(limite ?? 50)
      if (error) throw new Error(`Lettura timeline non riuscita: ${error.message}`)

      // Gli autori arrivano come id: si risolvono in nomi, altrimenti la
      // timeline e' una colonna di uuid illeggibili.
      const autori = [...new Set((data ?? []).map((r) => r.utente_id).filter(Boolean))] as string[]
      const nomi = new Map<string, string>()
      if (autori.length > 0) {
        const { data: utenti } = await supabase.from("utenti").select("id,nome").in("id", autori)
        for (const u of utenti ?? []) nomi.set((u as { id: string }).id, (u as { nome: string }).nome)
      }

      const voci = (data ?? []).map((r) => ({
        ...r,
        autore: r.utente_id ? (nomi.get(r.utente_id as string) ?? "Utente CRM") : "Sistema",
      }))
      return { dati: { record_tipo, record_id, voci }, righe: voci.length }
    },
  })

  registraTool(server, {
    nome: "crm_nota_add",
    titolo: "Aggiungi una nota",
    descrizione:
      "Scrive una nota sulla timeline di un record. La nota resta firmata con l'utente per conto del " +
      "quale gira questo server, come se fosse stata scritta dal CRM.",
    schema: {
      record_tipo: z.enum(RECORD_TIPI),
      record_id: z.string().uuid(),
      testo: z.string().trim().min(1).max(4000),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async ({ record_tipo, record_id, testo }) => {
      const supabase = clientMcpObbligatorio()
      const { data, error } = await supabase
        .from("attivita")
        .insert({
          tipo: "nota",
          testo,
          record_id,
          record_tipo,
          utente_id: await utenteCorrenteId(),
        })
        .select("id,tipo,testo,created_at")
        .single()
      if (error) throw new Error(`Nota non salvata: ${error.message}`)
      return { dati: data, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "crm_tags_list",
    titolo: "Tag disponibili",
    descrizione:
      "Elenca i tag definiti nel CRM con il loro id e colore, filtrabili per modulo. Gli id servono ai " +
      "tool che assegnano tag a lead, clienti e compiti.",
    schema: {
      modulo: z.enum(MODULI_TAG).optional().describe("Senza filtro restituisce i tag di tutti i moduli."),
      cerca: z.string().trim().optional(),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ modulo, cerca }) => {
      const supabase = clientMcpObbligatorio()
      let query = supabase.from("tag").select("id,nome,colore,modulo").order("modulo").order("nome")
      if (modulo) query = query.eq("modulo", modulo)
      if (cerca) query = query.ilike("nome", `%${cerca.replace(/[%,()\\]/g, " ").trim()}%`)
      const { data, error } = await query
      if (error) throw new Error(`Lettura tag non riuscita: ${error.message}`)
      return { dati: { tag: data ?? [] }, righe: data?.length ?? 0 }
    },
  })

  registraTool(server, {
    nome: "crm_tag_create",
    titolo: "Crea un tag",
    descrizione:
      "Crea un nuovo tag per un modulo. Nome e modulo insieme devono essere unici: se il tag esiste " +
      "gia' la creazione viene rifiutata, quindi conviene cercarlo prima con crm_tags_list e riusarne l'id.",
    schema: {
      nome: z.string().trim().min(1).max(60),
      modulo: z.enum(MODULI_TAG),
      colore: z.string().trim().optional().describe("Colore esadecimale, es. #2563eb. Default #64748b."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async ({ nome, modulo, colore }) => {
      const supabase = clientMcpObbligatorio()
      const { data, error } = await supabase
        .from("tag")
        .insert({ nome, modulo, colore: colore ?? "#64748b" })
        .select("id,nome,colore,modulo")
        .single()
      if (error) {
        // 23505 = tag_nome_modulo_key. Senza questa traduzione al modello
        // arriva "duplicate key value violates unique constraint", che non
        // suggerisce la cosa giusta da fare (cercarlo e riusarlo).
        if (error.code === "23505") {
          const { data: esistente } = await supabase
            .from("tag")
            .select("id,nome,colore,modulo")
            .eq("modulo", modulo)
            .ilike("nome", nome)
            .maybeSingle()
          throw new Error(
            `Il tag "${nome}" esiste gia' nel modulo ${modulo}${esistente ? ` (id ${(esistente as { id: string }).id})` : ""}: riusa quello invece di crearne un altro.`,
          )
        }
        throw new Error(`Tag non creato: ${error.message}`)
      }
      return { dati: data, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "crm_collegamenti_list",
    titolo: "Link esterni di un record",
    descrizione:
      "Elenca i link esterni collegati a un record (Google Maps, pratiche online, cartelle condivise). " +
      "I file allegati non stanno qui: quelli vivono nella cartella Nextcloud del record.",
    schema: { record_tipo: z.enum(RECORD_TIPI), record_id: z.string().uuid() },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ record_tipo, record_id }) => {
      const righe = await listCollegamenti(record_tipo as AllegatoRecordTipo, record_id)
      return { dati: { record_tipo, record_id, collegamenti: righe }, righe: righe.length }
    },
  })

  registraTool(server, {
    nome: "crm_collegamenti_add",
    titolo: "Aggiungi un link a un record",
    descrizione: "Collega un link esterno a un record. Sono ammessi solo indirizzi http o https.",
    schema: {
      record_tipo: z.enum(RECORD_TIPI),
      record_id: z.string().uuid(),
      titolo: z.string().trim().min(1).max(200),
      url: z.string().trim().url(),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async ({ record_tipo, record_id, titolo, url }) => {
      const protocollo = new URL(url).protocol
      if (protocollo !== "http:" && protocollo !== "https:") {
        throw new Error(`Protocollo non ammesso: ${protocollo}`)
      }
      const riga = await insertCollegamento({
        titolo,
        url,
        record_id,
        record_tipo: record_tipo as AllegatoRecordTipo,
        creato_da: await utenteCorrenteId(),
      })
      return { dati: riga, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "crm_collegamenti_delete",
    titolo: "Rimuovi un link da un record",
    descrizione:
      "Elimina un link esterno. L'id si ottiene da crm_collegamenti_list. La risorsa puntata dal link " +
      "non viene toccata: sparisce solo il riferimento nel CRM.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id }) => {
      await deleteCollegamentoRow(id)
      return { dati: { eliminato: true, id }, righe: 1 }
    },
  })
}
