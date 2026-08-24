import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { clientMcpObbligatorio } from "@/lib/mcp/context"
import { registraTool } from "@/lib/mcp/registra-tool"

/**
 * Tool trasversali ai moduli. `crm_utenti_lookup` e' l'unico punto del server
 * MCP che legge `utenti`, e legge tre colonne: senza una corrispondenza
 * nome -> id non si potrebbe assegnare un compito o cambiare un proprietario
 * se non incollando UUID a mano. La scrittura su `utenti` resta negata dal
 * perimetro (lib/mcp/denylist.ts), non da qui.
 */
export function registraToolComuni(server: McpServer): void {
  registraTool(server, {
    nome: "crm_utenti_lookup",
    titolo: "Elenco utenti CRM",
    descrizione:
      "Elenca gli utenti attivi del CRM con id, nome ed email, per risolvere un nome in un id " +
      "da usare come proprietario di lead, compiti, scadenze o installatori. Sola lettura: " +
      "non espone ruoli ne' permessi e non permette di creare o modificare account.",
    schema: {
      cerca: z
        .string()
        .trim()
        .min(2)
        .optional()
        .describe("Filtro sul nome o sull'email (ricerca parziale, senza distinzione fra maiuscole e minuscole)."),
    },
    annotazioni: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    esegui: async ({ cerca }) => {
      const supabase = clientMcpObbligatorio()
      let query = supabase.from("utenti").select("id,nome,email").eq("attivo", true).order("nome")
      if (cerca) {
        const p = `%${cerca.replace(/[,()\\]/g, " ").trim()}%`
        query = query.or(`nome.ilike.${p},email.ilike.${p}`)
      }
      const { data, error } = await query
      if (error) throw new Error(`Lettura utenti non riuscita: ${error.message}`)
      return { dati: { utenti: data ?? [] }, righe: data?.length ?? 0 }
    },
  })
}
