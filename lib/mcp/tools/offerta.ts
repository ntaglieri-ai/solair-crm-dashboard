import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { deleteFile } from "@/lib/nextcloud/admin-webdav"
import {
  calcolaPreventivo,
  ErrorePreventivo,
  type CatalogoPerCalcolo,
} from "@/lib/offerta-commerciale/calcola-preventivo"
import {
  normalizeAccessori,
  normalizeAccumuli,
  normalizeCodiciSconto,
  normalizeFotovoltaico,
  normalizePannelli,
  normalizeSconti,
  normalizeSpecificheProdotto,
  OFFERTA_COMMERCIALE_ROOT,
} from "@/lib/offerta-commerciale/store"
import type { CatalogoCommerciale, PannelloSpec } from "@/lib/offerta-commerciale/types"
import { clientMcpObbligatorio } from "@/lib/mcp/context"
import { registraTool } from "@/lib/mcp/registra-tool"

/**
 * Aree Offerta Commerciale e Catalogo prodotti.
 *
 * Il listino non e' una tabella di righe ma una riga con dentro sei blocchi
 * JSONB (fotovoltaico, accumuli, accessori, sconti, codici_sconto,
 * specifiche_prodotto.pannelli). I tool scrivono un blocco alla volta passando
 * dai normalize* gia' usati dalla route dell'app: stessa validazione, stesse
 * conversioni, e le chiavi che il chiamante non conosce non si perdono.
 *
 * Il `catalogo_id` e' sempre obbligatorio e non ha un default sul pubblicato,
 * di proposito: modificare il listino pubblicato cambia i prezzi che il
 * configuratore del sito mostra ai visitatori nello stesso istante. Chi scrive
 * deve prima guardare listino_versioni_list e sapere su quale versione sta
 * mettendo le mani.
 *
 * Il catalogo prodotti e' lo stesso record: `catalogo_prodotti` (la tabella)
 * e' vuota e non referenziata da nessuna riga di codice — la fonte viva e'
 * offerta_commerciale_cataloghi.
 */

type RigaCatalogo = CatalogoCommerciale & Record<string, unknown>

async function caricaCatalogo(id?: string): Promise<RigaCatalogo> {
  const supabase = clientMcpObbligatorio()
  const query = supabase.from("offerta_commerciale_cataloghi").select("*")
  const { data, error } = id
    ? await query.eq("id", id).maybeSingle()
    : await query.eq("stato", "pubblicato").order("aggiornato_at", { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`Lettura listino non riuscita: ${error.message}`)
  if (!data) {
    throw new Error(id ? `Nessun listino con id ${id}` : "Nessun listino pubblicato al momento")
  }
  return data as RigaCatalogo
}

async function salvaCatalogo(id: string, patch: Record<string, unknown>) {
  const supabase = clientMcpObbligatorio()
  const aggiornatoAt = new Date().toISOString()
  const { error } = await supabase
    .from("offerta_commerciale_cataloghi")
    .update({ ...patch, aggiornato_at: aggiornatoAt })
    .eq("id", id)
  if (error) throw new Error(`Salvataggio listino non riuscito: ${error.message}`)
  return aggiornatoAt
}

/** Avviso da allegare alla risposta quando si e' scritto sul listino vivo. */
function avvisoSePubblicato(catalogo: RigaCatalogo): string | undefined {
  return catalogo.stato === "pubblicato"
    ? "Attenzione: questo listino e' quello PUBBLICATO, le modifiche sono gia' visibili al configuratore del sito."
    : undefined
}

const pannelloSchema = z.object({
  brand: z.string().trim().optional(),
  modello: z.string().trim().min(1),
  nome_display: z.string().trim().optional().describe("Se assente si usa il modello."),
  codice: z.string().trim().nullable().optional(),
  potenza_wp: z.number().nullable().optional(),
  larghezza_mm: z.number().nullable().optional(),
  altezza_mm: z.number().nullable().optional(),
  peso_kg: z.number().nullable().optional(),
  efficienza_pct: z.number().nullable().optional(),
  degrado: z.union([z.number(), z.string()]).nullable().optional().describe("Percentuale annua o testo libero."),
  garanzia_prodotto_anni: z.number().nullable().optional(),
  garanzia_lineare_anni: z.number().nullable().optional(),
  tags: z.array(z.string().trim()).optional(),
  tier: z.string().trim().nullable().optional(),
  attivo: z.boolean().optional().describe("Default true. I pannelli non attivi non escono nel catalogo pubblico."),
  immagine_nc_path: z.string().trim().nullable().optional().describe("Percorso Nextcloud dell'immagine."),
  scheda_pdf_nc_path: z.string().trim().nullable().optional().describe("Percorso Nextcloud della scheda tecnica."),
})

export function registraToolOfferta(server: McpServer): void {
  // --- Preventivo -----------------------------------------------------------

  registraTool(server, {
    nome: "offerta_calcola_preventivo",
    titolo: "Calcola preventivo",
    descrizione:
      "Calcola il prezzo di una configurazione sul listino PUBBLICATO: prezzo base per kWp, " +
      "sovrapprezzo batteria, sconto di zona, codice sconto ed EPS. E' lo stesso calcolo che usa il " +
      "configuratore del sito. Se la configurazione e' fuori listino, restituisce i valori ammessi.",
    schema: {
      kwp: z.number().positive(),
      batteria_marca: z.string().trim().min(1),
      batteria_kwh: z.number().positive(),
      zona: z.string().trim().min(1).describe("Zona commerciale che determina lo sconto, es. 'Sicilia'."),
      eps: z.boolean().optional().describe("Include il dispositivo EPS."),
      eps_gift: z.boolean().optional().describe("EPS in omaggio, se la regola di zona lo permette."),
      codice_sconto: z.string().trim().optional(),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async (args) => {
      const riga = await caricaCatalogo()
      const catalogo: CatalogoPerCalcolo = {
        fotovoltaico: normalizeFotovoltaico(riga.fotovoltaico),
        accumuli: normalizeAccumuli(riga.accumuli),
        sconti: normalizeSconti(riga.sconti),
        codici_sconto: normalizeCodiciSconto(riga.codici_sconto),
      }
      try {
        const preventivo = calcolaPreventivo(catalogo, {
          kwp: args.kwp,
          batteria_marca: args.batteria_marca,
          batteria_kwh: args.batteria_kwh,
          zona: args.zona,
          eps: args.eps === true,
          eps_gift: args.eps_gift === true,
          codice_sconto: args.codice_sconto ?? null,
        })
        return {
          dati: {
            listino: { id: riga.id, nome: riga.nome, valido_dal: riga.valido_dal, valido_al: riga.valido_al },
            preventivo,
          },
          righe: 1,
        }
      } catch (errore) {
        if (errore instanceof ErrorePreventivo) {
          // Fuori listino non e' un guasto: si restituisce cosa era ammesso,
          // com'e' gia' per il configuratore.
          throw new Error(
            `${errore.message}${errore.disponibili.length > 0 ? ` Valori disponibili: ${errore.disponibili.join(", ")}.` : ""}`,
          )
        }
        throw errore
      }
    },
  })

  // --- Listino --------------------------------------------------------------

  registraTool(server, {
    nome: "listino_get",
    titolo: "Leggi listino",
    descrizione:
      "Legge un listino: prezzi fotovoltaico per kWp, matrici accumuli, accessori, regole di sconto " +
      "per zona, codici sconto e pannelli. Senza id restituisce quello pubblicato.",
    schema: {
      id: z.string().uuid().optional().describe("Se assente: il listino pubblicato."),
      sezioni: z
        .array(z.enum(["fotovoltaico", "accumuli", "accessori", "sconti", "codici_sconto", "pannelli"]))
        .optional()
        .describe("Limita la risposta ad alcune sezioni. Senza filtro le restituisce tutte."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id, sezioni }) => {
      const riga = await caricaCatalogo(id)
      const tutte = {
        fotovoltaico: normalizeFotovoltaico(riga.fotovoltaico),
        accumuli: normalizeAccumuli(riga.accumuli),
        accessori: normalizeAccessori(riga.accessori),
        sconti: normalizeSconti(riga.sconti),
        codici_sconto: normalizeCodiciSconto(riga.codici_sconto),
        pannelli: normalizePannelli((riga.specifiche_prodotto as { pannelli?: unknown } | null)?.pannelli),
      }
      const scelte = sezioni?.length
        ? Object.fromEntries(Object.entries(tutte).filter(([chiave]) => sezioni.includes(chiave as keyof typeof tutte)))
        : tutte
      return {
        dati: {
          id: riga.id,
          nome: riga.nome,
          stato: riga.stato,
          valido_dal: riga.valido_dal,
          valido_al: riga.valido_al,
          note: riga.note,
          aggiornato_at: riga.aggiornato_at,
          ...scelte,
        },
        righe: 1,
      }
    },
  })

  registraTool(server, {
    nome: "listino_versioni_list",
    titolo: "Versioni del listino",
    descrizione:
      "Elenca le versioni del listino con il loro stato (bozza, pubblicato, archiviato) e le date di " +
      "validita'. Da consultare prima di ogni modifica: e' qui che si vede quale versione e' quella viva.",
    schema: { stato: z.enum(["bozza", "pubblicato", "archiviato"]).optional() },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ stato }) => {
      const supabase = clientMcpObbligatorio()
      let query = supabase
        .from("offerta_commerciale_cataloghi")
        .select("id,nome,stato,valido_dal,valido_al,fonte_path,pubblicato_at,aggiornato_at")
        .order("aggiornato_at", { ascending: false })
      if (stato) query = query.eq("stato", stato)
      const { data, error } = await query
      if (error) throw new Error(`Lettura versioni non riuscita: ${error.message}`)
      return { dati: { versioni: data ?? [] }, righe: data?.length ?? 0 }
    },
  })

  registraTool(server, {
    nome: "listino_meta_update",
    titolo: "Aggiorna intestazione listino",
    descrizione:
      "Aggiorna nome, periodo di validita' e note di un listino. Non tocca prezzi ne' sconti.",
    schema: {
      catalogo_id: z.string().uuid(),
      nome: z.string().trim().max(180).optional(),
      valido_dal: z.string().trim().nullable().optional().describe("Data ISO."),
      valido_al: z.string().trim().nullable().optional().describe("Data ISO."),
      note: z.string().trim().max(4000).nullable().optional(),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id, ...campi }) => {
      const catalogo = await caricaCatalogo(catalogo_id)
      const patch = Object.fromEntries(Object.entries(campi).filter(([, v]) => v !== undefined))
      if (Object.keys(patch).length === 0) throw new Error("Nessun campo da aggiornare")
      const aggiornatoAt = await salvaCatalogo(catalogo_id, patch)
      return {
        dati: { id: catalogo_id, aggiornati: Object.keys(patch), aggiornato_at: aggiornatoAt, avviso: avvisoSePubblicato(catalogo) },
        righe: 1,
      }
    },
  })

  registraTool(server, {
    nome: "listino_prezzi_set",
    titolo: "Prezzi fotovoltaico e accumuli",
    descrizione:
      "Sostituisce i prezzi base per taglia (kWp -> prezzo) e/o le matrici di prezzo degli accumuli. " +
      "Sostituisce l'intero blocco passato: per cambiare una sola taglia, leggi prima con listino_get " +
      "e rimanda l'elenco completo con la modifica.",
    schema: {
      catalogo_id: z.string().uuid(),
      fotovoltaico: z
        .array(z.object({ kwp: z.number().positive(), prezzo: z.number().nonnegative() }))
        .optional(),
      accumuli: z
        .array(
          z.object({
            marca: z.string().trim().min(1),
            garanzia_anni: z.number().nullable().optional(),
            ip: z.string().trim().nullable().optional(),
            tensione: z.string().trim().nullable().optional(),
            taglie: z.array(z.number()),
            prezzi: z.record(z.string(), z.array(z.number())).describe("Chiave: kWp dell'impianto; valore: prezzi per taglia, nello stesso ordine di 'taglie'."),
          }),
        )
        .optional(),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id, fotovoltaico, accumuli }) => {
      if (!fotovoltaico && !accumuli) throw new Error("Passa almeno uno fra fotovoltaico e accumuli")
      const catalogo = await caricaCatalogo(catalogo_id)
      const patch: Record<string, unknown> = {}
      if (fotovoltaico) patch.fotovoltaico = normalizeFotovoltaico(fotovoltaico)
      if (accumuli) patch.accumuli = normalizeAccumuli(accumuli)
      const aggiornatoAt = await salvaCatalogo(catalogo_id, patch)
      return {
        dati: {
          id: catalogo_id,
          fotovoltaico: (patch.fotovoltaico as unknown[] | undefined)?.length,
          accumuli: (patch.accumuli as unknown[] | undefined)?.length,
          aggiornato_at: aggiornatoAt,
          avviso: avvisoSePubblicato(catalogo),
        },
        righe: 1,
      }
    },
  })

  registraTool(server, {
    nome: "listino_sconti_zone_set",
    titolo: "Regole di sconto per zona",
    descrizione:
      "Sostituisce le regole di sconto: per ogni zona e fascia di kWp, la percentuale applicata, il " +
      "prezzo EPS e se l'EPS puo' essere omaggiato. Sostituisce l'intero elenco.",
    schema: {
      catalogo_id: z.string().uuid(),
      sconti: z.array(
        z.object({
          zona: z.string().trim().min(1),
          kwp_min: z.number().nonnegative(),
          kwp_max: z.number().positive(),
          percentuale: z.number().min(0).max(100),
          eps_prezzo: z.number().nonnegative(),
          eps_omaggiabile: z.boolean(),
        }),
      ),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id, sconti }) => {
      const catalogo = await caricaCatalogo(catalogo_id)
      const normalizzati = normalizeSconti(sconti)
      const aggiornatoAt = await salvaCatalogo(catalogo_id, { sconti: normalizzati })
      return {
        dati: { id: catalogo_id, regole: normalizzati.length, aggiornato_at: aggiornatoAt, avviso: avvisoSePubblicato(catalogo) },
        righe: normalizzati.length,
      }
    },
  })

  registraTool(server, {
    nome: "listino_codici_sconto_set",
    titolo: "Codici sconto",
    descrizione:
      "Sostituisce i codici sconto del listino. 'cumulabile_con_sconto_zona' decide se la percentuale " +
      "del codice si somma allo sconto di zona o lo sostituisce: senza il flag, lo sostituisce.",
    schema: {
      catalogo_id: z.string().uuid(),
      codici: z.array(
        z.object({
          codice: z.string().trim().min(1),
          nome: z.string().trim().min(1),
          descrizione: z.string().trim().nullable().optional(),
          tipo: z.enum(["percentuale", "importo", "omaggio", "nota"]),
          valore: z.number().nullable().optional(),
          attivo: z.boolean(),
          cumulabile_con_sconto_zona: z.boolean().optional().describe("Default false: il codice sostituisce lo sconto di zona."),
        }),
      ),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id, codici }) => {
      const catalogo = await caricaCatalogo(catalogo_id)
      const normalizzati = normalizeCodiciSconto(codici)
      const aggiornatoAt = await salvaCatalogo(catalogo_id, { codici_sconto: normalizzati })
      return {
        dati: { id: catalogo_id, codici: normalizzati.length, aggiornato_at: aggiornatoAt, avviso: avvisoSePubblicato(catalogo) },
        righe: normalizzati.length,
      }
    },
  })

  registraTool(server, {
    nome: "listino_pubblica",
    titolo: "Pubblica listino",
    descrizione:
      "Rende pubblicato il listino indicato e archivia quello attualmente pubblicato. Da quel momento " +
      "il configuratore del sito calcola i preventivi con i prezzi di questa versione.",
    schema: { catalogo_id: z.string().uuid() },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id }) => {
      const supabase = clientMcpObbligatorio()
      const catalogo = await caricaCatalogo(catalogo_id)
      if (catalogo.stato === "pubblicato") {
        return { dati: { id: catalogo_id, esito: "era gia' pubblicato" }, righe: 0 }
      }
      if (catalogo.stato !== "bozza" && catalogo.stato !== "archiviato") {
        throw new Error(`Stato "${catalogo.stato}" non pubblicabile`)
      }
      const adesso = new Date().toISOString()
      // Stesso ordine della route dell'app: prima si archivia il pubblicato,
      // cosi' non esistono due listini pubblicati nello stesso istante.
      const { error: erroreArchivio } = await supabase
        .from("offerta_commerciale_cataloghi")
        .update({ stato: "archiviato", aggiornato_at: adesso })
        .eq("stato", "pubblicato")
      if (erroreArchivio) throw new Error(`Archiviazione precedente non riuscita: ${erroreArchivio.message}`)

      const { error } = await supabase
        .from("offerta_commerciale_cataloghi")
        .update({ stato: "pubblicato", pubblicato_at: adesso, aggiornato_at: adesso })
        .eq("id", catalogo_id)
      if (error) throw new Error(`Pubblicazione non riuscita: ${error.message}`)
      return { dati: { id: catalogo_id, nome: catalogo.nome, pubblicato_at: adesso }, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "listino_delete",
    titolo: "Elimina listino archiviato",
    descrizione:
      "Elimina un listino, ammesso solo se archiviato. Il PDF sorgente su Nextcloud NON viene " +
      "toccato: resta dov'e' e il percorso viene restituito, cosi' lo si puo' rimuovere a parte.",
    schema: { catalogo_id: z.string().uuid() },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    esegui: async ({ catalogo_id }) => {
      const supabase = clientMcpObbligatorio()
      const catalogo = await caricaCatalogo(catalogo_id)
      if (catalogo.stato !== "archiviato") {
        throw new Error(`Si puo' eliminare solo un listino archiviato: questo e' "${catalogo.stato}"`)
      }
      const { error } = await supabase.from("offerta_commerciale_cataloghi").delete().eq("id", catalogo_id)
      if (error) throw new Error(`Eliminazione non riuscita: ${error.message}`)
      return {
        dati: { id: catalogo_id, nome: catalogo.nome, file_sorgente_rimasto: catalogo.fonte_path ?? null },
        righe: 1,
      }
    },
  })

  // --- Offerte del periodo --------------------------------------------------

  registraTool(server, {
    nome: "offerte_periodo_list",
    titolo: "Offerte del periodo",
    descrizione:
      "Elenca le offerte del periodo (volantini, locandine, brochure, pagine): titolo, tipo, validita', " +
      "se pubblicate, PDF e copertina associati.",
    schema: {
      solo_pubblicate: z.boolean().optional(),
      tipo: z.enum(["offerta", "locandina", "brochure", "finanziaria", "pagina"]).optional(),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ solo_pubblicate, tipo }) => {
      const supabase = clientMcpObbligatorio()
      let query = supabase
        .from("offerta_commerciale_offerte")
        .select("id,titolo,descrizione,tipo,url_pubblico,pdf_path,cover_path,valido_dal,valido_al,pubblicata,ordinamento,configurazioni,aggiornato_at")
        .order("ordinamento")
        .order("titolo")
      if (solo_pubblicate) query = query.eq("pubblicata", true)
      if (tipo) query = query.eq("tipo", tipo)
      const { data, error } = await query
      if (error) throw new Error(`Lettura offerte non riuscita: ${error.message}`)
      return { dati: { offerte: data ?? [] }, righe: data?.length ?? 0 }
    },
  })

  const campiOfferta = {
    titolo: z.string().trim().max(180).optional(),
    descrizione: z.string().trim().max(2000).nullable().optional(),
    tipo: z.enum(["offerta", "locandina", "brochure", "finanziaria", "pagina"]).optional(),
    url_pubblico: z.string().trim().url().nullable().optional().describe("Solo http/https."),
    valido_dal: z.string().trim().nullable().optional().describe("Data ISO."),
    valido_al: z.string().trim().nullable().optional().describe("Data ISO."),
    pubblicata: z.boolean().optional(),
    ordinamento: z.number().int().optional(),
    configurazioni: z
      .array(z.object({ kwp: z.number().optional(), kwh: z.number().optional(), prezzo: z.number().optional(), label: z.string().optional() }))
      .max(30)
      .optional()
      .describe("Configurazioni in evidenza mostrate sull'offerta."),
  }

  registraTool(server, {
    nome: "offerte_periodo_create",
    titolo: "Crea offerta del periodo",
    descrizione:
      "Crea un'offerta del periodo. PDF e copertina si associano caricando i file su Nextcloud e " +
      "lanciando la sincronizzazione, non da qui.",
    schema: { ...campiOfferta, titolo: z.string().trim().min(1).max(180) },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async (args) => {
      const supabase = clientMcpObbligatorio()
      const { data, error } = await supabase
        .from("offerta_commerciale_offerte")
        .insert({
          titolo: args.titolo,
          descrizione: args.descrizione ?? null,
          tipo: args.tipo ?? "offerta",
          url_pubblico: args.url_pubblico ?? null,
          valido_dal: args.valido_dal ?? null,
          valido_al: args.valido_al ?? null,
          pubblicata: args.pubblicata === true,
          ordinamento: args.ordinamento ?? 0,
          configurazioni: args.configurazioni ?? [],
          aggiornato_at: new Date().toISOString(),
        })
        .select("*")
        .single()
      if (error) throw new Error(`Creazione offerta non riuscita: ${error.message}`)
      return { dati: data, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "offerte_periodo_update",
    titolo: "Aggiorna offerta del periodo",
    descrizione: "Aggiorna i campi indicati di un'offerta del periodo. Quelli non passati restano invariati.",
    schema: { id: z.string().uuid(), ...campiOfferta },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id, ...campi }) => {
      const supabase = clientMcpObbligatorio()
      const patch = Object.fromEntries(Object.entries(campi).filter(([, v]) => v !== undefined))
      if (Object.keys(patch).length === 0) throw new Error("Nessun campo da aggiornare")
      const { data, error } = await supabase
        .from("offerta_commerciale_offerte")
        .update({ ...patch, aggiornato_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle()
      if (error) throw new Error(`Aggiornamento offerta non riuscito: ${error.message}`)
      if (!data) throw new Error(`Nessuna offerta con id ${id}`)
      return { dati: data, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "offerte_periodo_delete",
    titolo: "Elimina offerta del periodo",
    descrizione:
      "Elimina un'offerta del periodo. I file PDF e copertina su Nextcloud restano: si rimuovono con " +
      "offerta_documenti_delete o dalla cartella.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    esegui: async ({ id }) => {
      const supabase = clientMcpObbligatorio()
      const { error, count } = await supabase
        .from("offerta_commerciale_offerte")
        .delete({ count: "exact" })
        .eq("id", id)
      if (error) throw new Error(`Eliminazione offerta non riuscita: ${error.message}`)
      if ((count ?? 0) === 0) throw new Error(`Nessuna offerta con id ${id}`)
      return { dati: { eliminata: true, id }, righe: count ?? 0 }
    },
  })

  // --- Documenti del catalogo commerciale -----------------------------------

  registraTool(server, {
    nome: "offerta_documenti_list",
    titolo: "Documenti del catalogo commerciale",
    descrizione:
      "Elenca i file sincronizzati dalla cartella Nextcloud del catalogo commerciale (listini, " +
      "locandine, copertine) con percorso, dimensione e data di modifica.",
    schema: { tipo: z.enum(["listino", "locandina", "copertina", "altro"]).optional() },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ tipo }) => {
      const supabase = clientMcpObbligatorio()
      let query = supabase
        .from("offerta_commerciale_documenti")
        .select("id,path,nome,tipo,dimensione_kb,modificato_at,sincronizzato_at")
        .order("modificato_at", { ascending: false, nullsFirst: false })
      if (tipo) query = query.eq("tipo", tipo)
      const { data, error } = await query
      if (error) throw new Error(`Lettura documenti non riuscita: ${error.message}`)
      return { dati: { cartella: OFFERTA_COMMERCIALE_ROOT, documenti: data ?? [] }, righe: data?.length ?? 0 }
    },
  })

  registraTool(server, {
    nome: "offerta_documenti_delete",
    titolo: "Elimina documento commerciale",
    descrizione:
      "Elimina un documento del catalogo commerciale: prima il file su Nextcloud, poi la riga in " +
      "elenco. Il percorso deve stare dentro la cartella del catalogo commerciale.",
    schema: { path: z.string().trim().min(1).describe("Percorso Nextcloud del file, come restituito da offerta_documenti_list.") },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ path }) => {
      if (path.includes("..") || !path.startsWith(`${OFFERTA_COMMERCIALE_ROOT}/`)) {
        throw new Error(`Percorso fuori dal catalogo commerciale (${OFFERTA_COMMERCIALE_ROOT}/)`)
      }
      // Stesso ordine della route dell'app: se Nextcloud rifiuta, la riga
      // resta e l'elenco continua a descrivere quello che c'e' davvero.
      const esito = await deleteFile(path)
      if (!esito.ok) throw new Error(esito.error ?? `Eliminazione su Nextcloud fallita (HTTP ${esito.status})`)
      const supabase = clientMcpObbligatorio()
      const { error, count } = await supabase
        .from("offerta_commerciale_documenti")
        .delete({ count: "exact" })
        .eq("path", path)
      if (error) throw new Error(`Riga non rimossa dall'elenco: ${error.message}`)
      return { dati: { eliminato: true, path, righe_elenco: count ?? 0 }, righe: count ?? 0 }
    },
  })

  // --- Catalogo prodotti ----------------------------------------------------

  registraTool(server, {
    nome: "catalogo_pannelli_list",
    titolo: "Pannelli del catalogo",
    descrizione:
      "Elenca i pannelli con le loro specifiche (potenza, dimensioni, efficienza, garanzie, tier). " +
      "Sono la scheda prodotto che il configuratore del sito mostra.",
    schema: {
      catalogo_id: z.string().uuid().optional().describe("Se assente: il listino pubblicato."),
      solo_attivi: z.boolean().optional(),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id, solo_attivi }) => {
      const riga = await caricaCatalogo(catalogo_id)
      const pannelli = normalizePannelli((riga.specifiche_prodotto as { pannelli?: unknown } | null)?.pannelli)
      const scelti = solo_attivi ? pannelli.filter((p) => p.attivo !== false) : pannelli
      return { dati: { catalogo_id: riga.id, stato: riga.stato, pannelli: scelti }, righe: scelti.length }
    },
  })

  registraTool(server, {
    nome: "catalogo_pannelli_upsert",
    titolo: "Aggiungi o aggiorna un pannello",
    descrizione:
      "Aggiunge un pannello al catalogo o ne aggiorna uno esistente. L'identita' e' il modello (o il " +
      "codice, se presente): se c'e' gia', i campi passati sostituiscono i suoi e gli altri restano.",
    schema: { catalogo_id: z.string().uuid(), pannello: pannelloSchema },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id, pannello }) => {
      const catalogo = await caricaCatalogo(catalogo_id)
      const correnti = normalizePannelli((catalogo.specifiche_prodotto as { pannelli?: unknown } | null)?.pannelli)
      const stessoPannello = (p: PannelloSpec) =>
        pannello.codice ? p.codice === pannello.codice : p.modello === pannello.modello
      const indice = correnti.findIndex(stessoPannello)
      const aggiornato = indice >= 0 ? { ...correnti[indice], ...pannello } : pannello
      const prossimi = indice >= 0
        ? correnti.map((p, i) => (i === indice ? aggiornato : p))
        : [...correnti, aggiornato]

      const specifiche = normalizeSpecificheProdotto(
        { ...(catalogo.specifiche_prodotto as Record<string, unknown> | null), pannelli: prossimi },
        catalogo.specifiche_prodotto,
      )
      const aggiornatoAt = await salvaCatalogo(catalogo_id, { specifiche_prodotto: specifiche })
      return {
        dati: {
          catalogo_id,
          operazione: indice >= 0 ? "aggiornato" : "aggiunto",
          modello: pannello.modello,
          totale_pannelli: specifiche.pannelli?.length ?? 0,
          aggiornato_at: aggiornatoAt,
          avviso: avvisoSePubblicato(catalogo),
        },
        righe: 1,
      }
    },
  })

  registraTool(server, {
    nome: "catalogo_pannelli_delete",
    titolo: "Rimuovi un pannello",
    descrizione:
      "Toglie un pannello dal catalogo. Per nasconderlo senza perderne le specifiche conviene invece " +
      "metterlo a non attivo con catalogo_pannelli_upsert.",
    schema: {
      catalogo_id: z.string().uuid(),
      modello: z.string().trim().optional(),
      codice: z.string().trim().optional().describe("Se presente ha la precedenza sul modello."),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id, modello, codice }) => {
      if (!modello && !codice) throw new Error("Serve il modello oppure il codice del pannello")
      const catalogo = await caricaCatalogo(catalogo_id)
      const correnti = normalizePannelli((catalogo.specifiche_prodotto as { pannelli?: unknown } | null)?.pannelli)
      const prossimi = correnti.filter((p) => (codice ? p.codice !== codice : p.modello !== modello))
      if (prossimi.length === correnti.length) {
        throw new Error(`Nessun pannello con ${codice ? `codice ${codice}` : `modello ${modello}`}`)
      }
      const specifiche = normalizeSpecificheProdotto(
        { ...(catalogo.specifiche_prodotto as Record<string, unknown> | null), pannelli: prossimi },
        catalogo.specifiche_prodotto,
      )
      const aggiornatoAt = await salvaCatalogo(catalogo_id, { specifiche_prodotto: specifiche })
      return {
        dati: { catalogo_id, rimossi: correnti.length - prossimi.length, restanti: prossimi.length, aggiornato_at: aggiornatoAt, avviso: avvisoSePubblicato(catalogo) },
        righe: correnti.length - prossimi.length,
      }
    },
  })

  registraTool(server, {
    nome: "catalogo_accessori_set",
    titolo: "Accessori del catalogo",
    descrizione:
      "Sostituisce l'elenco degli accessori con prezzo, prezzo combo e unita' di misura. " +
      "'scontabile' decide se l'accessorio segue lo sconto di zona. Sostituisce l'intero elenco.",
    schema: {
      catalogo_id: z.string().uuid(),
      accessori: z.array(
        z.object({
          nome: z.string().trim().min(1),
          prezzo: z.number().nonnegative(),
          prezzo_combo: z.number().nonnegative().nullable().optional(),
          unita: z.string().trim().default("pz"),
          scontabile: z.boolean(),
        }),
      ),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ catalogo_id, accessori }) => {
      const catalogo = await caricaCatalogo(catalogo_id)
      const normalizzati = normalizeAccessori(accessori)
      const aggiornatoAt = await salvaCatalogo(catalogo_id, { accessori: normalizzati })
      return {
        dati: { catalogo_id, accessori: normalizzati.length, aggiornato_at: aggiornatoAt, avviso: avvisoSePubblicato(catalogo) },
        righe: normalizzati.length,
      }
    },
  })
}
