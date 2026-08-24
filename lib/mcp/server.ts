import "server-only"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registraToolClienti } from "@/lib/mcp/tools/clienti"
import { registraToolCompiti, registraToolScadenze } from "@/lib/mcp/tools/compiti"
import { registraToolComuni } from "@/lib/mcp/tools/comuni"
import { registraToolInstallatori } from "@/lib/mcp/tools/installatori"
import { registraToolLeads } from "@/lib/mcp/tools/leads"
import { registraToolNextcloud } from "@/lib/mcp/tools/nextcloud"
import { registraToolOfferta } from "@/lib/mcp/tools/offerta"
import { registraToolTrasversali } from "@/lib/mcp/tools/trasversali"

/**
 * Istanza del server MCP. Si costruisce una per richiesta: il transport e'
 * senza sessione (stateless), quindi non c'e' stato da conservare fra una
 * chiamata e l'altra e ogni invocazione parte pulita.
 */

const ISTRUZIONI = `Server MCP del CRM Solair. Espone i dati operativi dell'azienda:
lead, clienti e relative sotto-schede, offerta commerciale e listino, catalogo prodotti,
installatori, compiti e scadenze, e i file su Nextcloud.

Le query passano dalla sessione Supabase dell'utente reale, quindi valgono le stesse
regole di visibilita' che l'utente ha nel CRM.

Fuori perimetro, per scelta: impostazioni CRM, ruoli e permessi, registro di audit,
gestione degli account e manutenzione. I tool relativi non esistono e le tabelle sono
negate a monte: se serve una di quelle informazioni, dillo all'utente invece di cercare
un altro modo per arrivarci.`

export function creaServerMcp(): McpServer {
  const server = new McpServer(
    { name: "solair-crm", version: "0.1.0" },
    { capabilities: { tools: {} }, instructions: ISTRUZIONI },
  )

  registraToolComuni(server)
  registraToolLeads(server)
  registraToolClienti(server)
  registraToolCompiti(server)
  registraToolScadenze(server)
  registraToolInstallatori(server)
  registraToolOfferta(server)
  registraToolNextcloud(server)
  registraToolTrasversali(server)

  return server
}
