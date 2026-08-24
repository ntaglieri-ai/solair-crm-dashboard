import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import {
  CANALE_PREFERITO_DEFAULT,
  type InstallatoriListParams,
} from "@/lib/installatori/api-types"
import {
  createInstallatoreRecord,
  deleteInstallatoreRecord,
  getInstallatoreById,
  queryInstallatori,
  updateInstallatoreRecord,
} from "@/lib/installatori/repository"
import { getInstallatoriSuggeriti } from "@/lib/installatori/zone"
import { clientMcpObbligatorio } from "@/lib/mcp/context"
import { registraTool } from "@/lib/mcp/registra-tool"

/**
 * Area Installatori, comprese le zone di competenza.
 *
 * Le zone stanno su `installatore_zone` (una riga per regione, con vincolo
 * unico su installatore_id+regione) e sono l'unica parte che non passa dal
 * repository, che non le tocca. La copertura a raggio
 * (`installatore_zone_raggio`) resta fuori: si legge da installatori_suggeriti
 * ma non si modifica da qui, perche' e' geolocalizzazione e non anagrafica.
 */

const DEFAULT_INSTALLATORI_PARAMS: InstallatoriListParams = {
  page: 1,
  pageSize: 25,
  sortBy: "nome",
  sortDir: "asc",
  search: "",
  proprietario: "all",
  tag: "all",
  stato: "all",
}

export function registraToolInstallatori(server: McpServer): void {
  registraTool(server, {
    nome: "installatori_search",
    titolo: "Cerca installatori",
    descrizione:
      "Cerca installatori per nome o email, con filtri su stato (attivo/non attivo), tag e " +
      "proprietario. Restituisce una pagina di risultati con il totale.",
    schema: {
      cerca: z.string().trim().optional(),
      stato: z.enum(["all", "attivo", "non_attivo"]).optional(),
      tag: z.string().trim().optional(),
      proprietario_id: z.string().uuid().optional(),
      ordina_per: z.enum(["nome", "email", "updated_at"]).optional(),
      direzione: z.enum(["asc", "desc"]).optional(),
      pagina: z.number().int().min(1).optional(),
      per_pagina: z.number().int().min(1).max(200).optional().describe("Default 25."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async (args) => {
      const params: InstallatoriListParams = {
        ...DEFAULT_INSTALLATORI_PARAMS,
        page: args.pagina ?? 1,
        pageSize: args.per_pagina ?? 25,
        sortBy: args.ordina_per ?? "nome",
        sortDir: args.direzione ?? "asc",
        search: args.cerca ?? "",
        proprietario: args.proprietario_id ?? "all",
        tag: args.tag ?? "all",
        stato: args.stato ?? "all",
      }
      const esito = await queryInstallatori(params)
      return { dati: esito, righe: esito.rows.length }
    },
  })

  registraTool(server, {
    nome: "installatori_get",
    titolo: "Dettaglio installatore",
    descrizione: "Scheda di un installatore: contatti, canale preferito, note, zone di competenza.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id }) => {
      const supabase = clientMcpObbligatorio()
      const [installatore, zone] = await Promise.all([
        getInstallatoreById(id),
        supabase.from("installatore_zone").select("regione").eq("installatore_id", id).order("regione"),
      ])
      if (!installatore) throw new Error(`Nessun installatore con id ${id}`)
      if (zone.error) throw new Error(`Lettura zone non riuscita: ${zone.error.message}`)
      return {
        dati: { ...installatore, zone: (zone.data ?? []).map((riga) => riga.regione) },
        righe: 1,
      }
    },
  })

  registraTool(server, {
    nome: "installatori_create",
    titolo: "Crea installatore",
    descrizione:
      "Crea un installatore. Il canale preferito decide come riceve la scheda sopralluogo: " +
      "'email' se non specificato.",
    schema: {
      nome: z.string().trim().min(1),
      email: z.string().trim().optional(),
      email_secondaria: z.string().trim().optional(),
      telefono: z.string().trim().optional(),
      tag: z.string().trim().optional(),
      attivo: z.boolean().optional().describe("Default true."),
      canale_preferito: z.enum(["email", "whatsapp"]).optional(),
      proprietario_id: z.string().uuid().optional(),
      note: z.string().trim().optional(),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    esegui: async (args) => {
      const creato = await createInstallatoreRecord({
        nome: args.nome,
        email: args.email ?? null,
        email_secondaria: args.email_secondaria ?? null,
        telefono: args.telefono ?? null,
        tag: args.tag ?? null,
        attivo: args.attivo ?? true,
        canale_preferito: args.canale_preferito ?? CANALE_PREFERITO_DEFAULT,
        proprietario_id: args.proprietario_id ?? null,
        note: args.note ?? null,
      })
      return { dati: creato, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "installatori_update",
    titolo: "Aggiorna installatore",
    descrizione: "Aggiorna i campi indicati di un installatore. Quelli non passati restano invariati.",
    schema: {
      id: z.string().uuid(),
      nome: z.string().trim().optional(),
      email: z.string().trim().nullable().optional(),
      email_secondaria: z.string().trim().nullable().optional(),
      telefono: z.string().trim().nullable().optional(),
      tag: z.string().trim().nullable().optional(),
      attivo: z.boolean().optional(),
      canale_preferito: z.enum(["email", "whatsapp"]).optional(),
      proprietario_id: z.string().uuid().nullable().optional(),
      note: z.string().trim().nullable().optional(),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ id, ...campi }) => {
      const patch = Object.fromEntries(
        Object.entries(campi).filter(([, valore]) => valore !== undefined),
      )
      if (Object.keys(patch).length === 0) throw new Error("Nessun campo da aggiornare")
      const aggiornato = await updateInstallatoreRecord(id, patch)
      if (!aggiornato) throw new Error(`Aggiornamento non riuscito: nessun installatore con id ${id}`)
      return { dati: aggiornato, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "installatori_delete",
    titolo: "Elimina installatore",
    descrizione:
      "Elimina definitivamente un installatore, con le sue zone di competenza. I clienti che lo " +
      "avevano assegnato restano, con il riferimento vuoto.",
    schema: { id: z.string().uuid() },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    esegui: async ({ id }) => {
      const eliminato = await deleteInstallatoreRecord(id)
      if (!eliminato) throw new Error(`Nessun installatore con id ${id}`)
      return { dati: { eliminato: true, id }, righe: 1 }
    },
  })

  registraTool(server, {
    nome: "installatori_zone_add",
    titolo: "Aggiungi zone a un installatore",
    descrizione:
      "Aggiunge una o piu' regioni alle zone di competenza. Le regioni gia' presenti non vengono " +
      "duplicate. I nomi vanno scritti per esteso, es. 'Sicilia', 'Lombardia'.",
    schema: {
      installatore_id: z.string().uuid(),
      regioni: z.array(z.string().trim().min(1)).min(1),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ installatore_id, regioni }) => {
      const supabase = clientMcpObbligatorio()
      const righe = regioni.map((regione) => ({ installatore_id, regione }))
      const { error } = await supabase
        .from("installatore_zone")
        .upsert(righe, { onConflict: "installatore_id,regione", ignoreDuplicates: true })
      if (error) throw new Error(`Aggiunta zone non riuscita: ${error.message}`)
      return { dati: { aggiunte: righe.length, regioni }, righe: righe.length }
    },
  })

  registraTool(server, {
    nome: "installatori_zone_remove",
    titolo: "Rimuovi zone da un installatore",
    descrizione:
      "Toglie una o piu' regioni dalle zone di competenza. L'installatore smette di comparire fra i " +
      "suggeriti per quelle regioni.",
    schema: {
      installatore_id: z.string().uuid(),
      regioni: z.array(z.string().trim().min(1)).min(1),
    },
    annotazioni: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    esegui: async ({ installatore_id, regioni }) => {
      const supabase = clientMcpObbligatorio()
      const { error, count } = await supabase
        .from("installatore_zone")
        .delete({ count: "exact" })
        .eq("installatore_id", installatore_id)
        .in("regione", regioni)
      if (error) throw new Error(`Rimozione zone non riuscita: ${error.message}`)
      return { dati: { rimosse: count ?? 0 }, righe: count ?? 0 }
    },
  })

  registraTool(server, {
    nome: "installatori_suggeriti",
    titolo: "Installatori suggeriti per una provincia",
    descrizione:
      "Suggerisce gli installatori competenti per una provincia (sigla o nome). Separa i compatibili " +
      "certi da quelli 'da verificare' — coperture a raggio non decidibili senza coordinate — e " +
      "restituisce comunque tutti gli altri attivi, perche' la scelta fuori lista resta possibile.",
    schema: {
      provincia: z.string().trim().describe("Sigla o nome della provincia, es. 'CT' o 'Catania'."),
      lat: z.number().optional().describe("Latitudine del cantiere, se nota: abilita il calcolo a raggio."),
      lng: z.number().optional().describe("Longitudine del cantiere, se nota."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ provincia, lat, lng }) => {
      const coordinate = lat !== undefined && lng !== undefined ? { lat, lng } : undefined
      const esito = await getInstallatoriSuggeriti(provincia, coordinate)
      return { dati: esito, righe: esito.suggeriti.length }
    },
  })
}
