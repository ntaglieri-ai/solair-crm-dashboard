import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { DEFAULT_LIST_PARAMS, type LeadListParams } from "@/lib/leads/api-types"
import {
  bulkUpdateRecords,
  computeStats,
  createLeadRecord,
  deleteLeadRecords,
  getFullLeadById,
  queryLeads,
  updateLeadRecord,
} from "@/lib/leads/repository"
import type { Lead } from "@/lib/mock-data"
import { clientMcpObbligatorio } from "@/lib/mcp/context"
import { registraTool } from "@/lib/mcp/registra-tool"

/**
 * Area Lead. Tutto passa dai repository gia' in uso dalle route dell'app
 * (queryLeads, patchLead & co.), quindi filtri, proiezioni e mappature
 * colonna <-> campo restano una cosa sola: se domani cambia la lista nella
 * UI, cambia anche qui senza doverci pensare.
 *
 * Sugli stati: il tipo StatoLead in mock-data ne dichiara sei, ma la tabella
 * ne contiene anche altri realmente in uso (Rifiutato 871 righe, Non
 * qualificato 342, Contattare in futuro 292, Prequalificato 2), eredita' del
 * travaso da Zoho. Uno z.enum sui sei del tipo impedirebbe di mettere un lead
 * in "Rifiutato": lo schema resta quindi una stringa libera, con i valori noti
 * elencati nella descrizione.
 */

const STATI_NOTI = [
  "Non contattato",
  "Tentato di contattare",
  "Contattato",
  "Inviato Preventivo",
  "Convertito",
  "Perso",
  "Rifiutato",
  "Non qualificato",
  "Contattare in futuro",
  "Prequalificato",
]

const campiLead = {
  nome: z.string().trim().optional().describe("Nome di battesimo."),
  cognome: z.string().trim().optional().describe("Cognome."),
  nome_lead: z.string().trim().optional().describe("Nome completo mostrato in lista; se assente si compone da nome e cognome."),
  email: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  mobile_fisso: z.string().trim().optional(),
  stato_lead: z.string().trim().optional().describe(`Stato del lead. Valori in uso: ${STATI_NOTI.join(", ")}.`),
  valutazione: z.number().min(0).max(100).optional().describe("Punteggio 0-100; sopra 80 il lead e' considerato caldo."),
  lead_proprietario_id: z.string().uuid().optional().describe("id utente (da crm_utenti_lookup) del commerciale assegnatario."),
  origine_lead: z.string().trim().optional().describe("Es. Facebook, Pubblicita', Sito web, Chat, Configuratore WebSite, Manuale."),
  sede: z.string().trim().optional().describe("Es. Catania, Palermo, Milano."),
  campaign_name: z.string().trim().optional(),
  citta: z.string().trim().optional(),
  provincia: z.string().trim().optional(),
  codice_postale: z.string().trim().optional(),
  paese: z.string().trim().optional(),
  descrizione: z.string().trim().optional().describe("Note libere sul lead."),
  residente_in_sicilia: z.boolean().optional(),
  wallbox_richiesto: z.boolean().optional(),
  kwp: z.number().optional().describe("Potenza dell'impianto di interesse, in kWp."),
  kwh: z.number().optional().describe("Capacita' di accumulo di interesse, in kWh."),
  modello_pannello: z.string().trim().optional(),
  consenso_email: z.boolean().optional().describe("Consenso al contatto via email: senza questo, l'invio massivo salta il contatto."),
  consenso_telefono: z.boolean().optional(),
  consenso_whatsapp: z.boolean().optional(),
}

/** Traduce i campi del tool nelle chiavi (italiane, con spazi) del tipo Lead. */
function versoLead(campi: Record<string, unknown>): Partial<Lead> {
  const patch: Record<string, unknown> = {}
  const mappa: Record<string, string> = {
    nome: "Nome",
    cognome: "Cognome",
    nome_lead: "Nome Lead",
    email: "E-mail",
    telefono: "Telefono",
    mobile_fisso: "Mobile/Fisso",
    stato_lead: "Stato Lead",
    valutazione: "Valutazione",
    lead_proprietario_id: "Lead Proprietario",
    origine_lead: "Origine Lead",
    sede: "Sede",
    campaign_name: "campaign name",
    citta: "Città",
    provincia: "Provincia",
    codice_postale: "Codice postale",
    paese: "Paese",
    descrizione: "Descrizione",
    residente_in_sicilia: "Residente in Sicilia",
    wallbox_richiesto: "Wallbox richiesto",
    kwp: "kWp",
    kwh: "kWh",
    modello_pannello: "Modello pannello",
    consenso_email: "Consenso e-mail",
    consenso_telefono: "Consenso telefono",
    consenso_whatsapp: "Consenso WhatsApp",
  }
  for (const [chiave, valore] of Object.entries(campi)) {
    if (valore === undefined) continue
    const destinazione = mappa[chiave]
    if (destinazione) patch[destinazione] = valore
  }
  return patch as Partial<Lead>
}

export function registraToolLeads(server: McpServer): void {
  registraTool(server, {
    nome: "leads_search",
    titolo: "Cerca lead",
    descrizione:
      "Cerca lead con i filtri della lista CRM (testo libero su nome/email/telefono, stato, sede, " +
      "commerciale, origine, fascia di punteggio) e restituisce una pagina di risultati con il totale.",
    schema: {
      cerca: z.string().trim().optional().describe("Testo cercato in nome, email e telefono."),
      stato: z.string().trim().optional().describe(`Stato esatto. Valori in uso: ${STATI_NOTI.join(", ")}.`),
      sede: z.string().trim().optional(),
      commerciale: z
        .string()
        .trim()
        .optional()
        .describe("id utente del proprietario, oppure __unassigned__ per i lead senza commerciale."),
      origine: z.string().trim().optional(),
      punteggio: z.enum(["all", "caldo", "medio", "freddo"]).optional().describe("caldo > 80, medio 50-80, freddo < 50."),
      ordina_per: z.string().trim().optional().describe("Nome colonna, es. 'Ora creazione' (default) o 'Nome Lead'."),
      direzione: z.enum(["asc", "desc"]).optional(),
      pagina: z.number().int().min(1).optional(),
      per_pagina: z.number().int().min(1).max(200).optional().describe("Default 25."),
      tutti_i_campi: z
        .boolean()
        .optional()
        .describe("true restituisce l'anagrafica completa di ogni lead invece dei soli campi di lista."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async (args) => {
      const params: LeadListParams = {
        ...DEFAULT_LIST_PARAMS,
        page: args.pagina ?? 1,
        pageSize: args.per_pagina ?? 25,
        sortBy: (args.ordina_per ?? DEFAULT_LIST_PARAMS.sortBy) as LeadListParams["sortBy"],
        sortDir: args.direzione ?? "desc",
        search: args.cerca ?? "",
        stato: args.stato ?? "all",
        sede: args.sede ?? "all",
        commerciale: args.commerciale ?? "all",
        origine: args.origine ?? "all",
        score: args.punteggio ?? "all",
        fields: args.tutti_i_campi ? ["*"] : [],
      }
      const esito = await queryLeads(params)
      return { dati: esito, righe: esito.rows.length }
    },
  })

  registraTool(server, {
    nome: "leads_get",
    titolo: "Dettaglio lead",
    descrizione:
      "Scheda completa di un lead: anagrafica, consensi, note della timeline e compiti collegati.",
    schema: { id: z.string().uuid().describe("id del lead.") },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id }) => {
      const lead = await getFullLeadById(id)
      if (!lead) throw new Error(`Nessun lead con id ${id}`)
      return { dati: lead, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "leads_stats",
    titolo: "Statistiche lead",
    descrizione:
      "Contatori del modulo Lead: totale, distribuzione per stato, lead caldi, non assegnati e creati oggi.",
    schema: {},
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async () => ({ dati: await computeStats(), righe: null }),
  })

  registraTool(server, {
    nome: "leads_create",
    titolo: "Crea lead",
    descrizione:
      "Crea un nuovo lead. Serve almeno un recapito o un nome. Lo stato predefinito e' 'Non contattato'. " +
      "I consensi al contatto sono false se non specificati: senza consenso email il lead non riceve invii massivi.",
    schema: campiLead,
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async (args) => {
      const patch = versoLead(args)
      if (!patch["Nome Lead"] && !patch.Nome && !patch["E-mail"] && !patch.Telefono) {
        throw new Error("Serve almeno uno fra nome_lead, nome, email o telefono")
      }
      const nomeCompleto =
        patch["Nome Lead"] ??
        [patch.Nome, patch.Cognome].filter(Boolean).join(" ").trim() ??
        ""
      const bozza = {
        ...patch,
        "Nome Lead": nomeCompleto,
        "Stato Lead": patch["Stato Lead"] ?? "Non contattato",
      } as Lead
      const creato = await createLeadRecord(bozza)

      // insertLead non scrive i consensi (li gestisce solo patchLead): se sono
      // stati richiesti si completano subito, cosi' il tool mantiene la
      // promessa fatta nello schema invece di ignorarli in silenzio.
      const consensi = versoLead({
        consenso_email: args.consenso_email,
        consenso_telefono: args.consenso_telefono,
        consenso_whatsapp: args.consenso_whatsapp,
      })
      if (Object.keys(consensi).length > 0 && creato.id) {
        const aggiornato = await updateLeadRecord(creato.id, consensi)
        return { dati: aggiornato ?? creato, righe: 1 }
      }
      return { dati: creato, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "leads_update",
    titolo: "Aggiorna lead",
    descrizione:
      "Aggiorna i campi indicati di un lead esistente. I campi non passati restano invariati.",
    schema: { id: z.string().uuid().describe("id del lead da aggiornare."), ...campiLead },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id, ...campi }) => {
      const patch = versoLead(campi)
      if (Object.keys(patch).length === 0) throw new Error("Nessun campo da aggiornare")
      const aggiornato = await updateLeadRecord(id, patch)
      if (!aggiornato) throw new Error(`Aggiornamento non riuscito: nessun lead con id ${id}`)
      return { dati: aggiornato, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "leads_bulk_update",
    titolo: "Aggiorna più lead",
    descrizione:
      "Applica lo stesso valore a molti lead in una volta: stato, sede, commerciale assegnatario o " +
      "aggiunta di un tag. Per il tag il valore si somma a quelli gia' presenti, non li sostituisce.",
    schema: {
      ids: z.array(z.string().uuid()).min(1).max(500).describe("id dei lead da aggiornare."),
      campo: z.enum(["Stato Lead", "Sede", "Lead Proprietario", "Tag"]),
      valore: z.string().describe("Nuovo valore; per 'Lead Proprietario' e' l'id utente."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ ids, campo, valore }) => {
      const aggiornati = await bulkUpdateRecords(ids, campo, valore)
      return { dati: { aggiornati, richiesti: ids.length }, righe: aggiornati }
    },
  })

  registraTool(server, {
    nome: "leads_delete",
    titolo: "Elimina lead",
    descrizione:
      "Elimina definitivamente uno o piu' lead. L'operazione non e' reversibile e porta con se' " +
      "note, attivita' e collegamenti del lead.",
    schema: { ids: z.array(z.string().uuid()).min(1).max(100).describe("id dei lead da eliminare.") },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    esegui: async ({ ids }) => {
      const eliminati = await deleteLeadRecords(ids)
      return { dati: { eliminati, richiesti: ids.length }, righe: eliminati }
    },
  })

  registraTool(server, {
    nome: "leads_tag_add",
    titolo: "Assegna tag a un lead",
    descrizione:
      "Assegna uno o piu' tag a un lead. Gli id dei tag si ottengono da crm_tags_list. " +
      "I tag gia' presenti non vengono duplicati.",
    schema: {
      lead_id: z.string().uuid(),
      tag_ids: z.array(z.string().uuid()).min(1),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ lead_id, tag_ids }) => {
      const supabase = clientMcpObbligatorio()
      const righe = tag_ids.map((tag_id) => ({ lead_id, tag_id }))
      const { error, count } = await supabase
        .from("lead_tags")
        .upsert(righe, { onConflict: "lead_id,tag_id", count: "exact" })
      if (error) throw new Error(`Assegnazione tag non riuscita: ${error.message}`)
      return { dati: { assegnati: count ?? righe.length }, righe: count ?? righe.length }
    },
  })

  // Separato da leads_tag_add e non un parametro "modo": le annotazioni MCP
  // valgono per tool, non per argomento. Un unico tool con due modalita'
  // dovrebbe dichiararsi distruttivo anche quando aggiunge, oppure mentire
  // quando toglie.
  registraTool(server, {
    nome: "leads_tag_remove",
    titolo: "Rimuovi tag da un lead",
    descrizione: "Toglie uno o piu' tag da un lead. Il tag resta nel CRM: si rimuove solo l'assegnazione.",
    schema: {
      lead_id: z.string().uuid(),
      tag_ids: z.array(z.string().uuid()).min(1),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ lead_id, tag_ids }) => {
      const supabase = clientMcpObbligatorio()
      const { error, count } = await supabase
        .from("lead_tags")
        .delete({ count: "exact" })
        .eq("lead_id", lead_id)
        .in("tag_id", tag_ids)
      if (error) throw new Error(`Rimozione tag non riuscita: ${error.message}`)
      return { dati: { rimossi: count ?? 0 }, righe: count ?? 0 }
    },
  })
}
