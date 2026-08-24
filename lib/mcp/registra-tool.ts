import "server-only"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"
import type { z } from "zod"

import { ErrorePerimetroMcp } from "@/lib/mcp/denylist"
import { registraChiamataMcp } from "@/lib/mcp/log"

/**
 * Registrazione di un tool con tutto il contorno gia' attaccato: cronometro,
 * registro, e traduzione degli errori in una risposta che il modello possa
 * leggere invece che in un 500 muto.
 *
 * Sta in un helper e non ripetuto tool per tool perche' i tool sono ~75: se il
 * logging dipendesse dalla diligenza di chi scrive il singolo tool, prima o poi
 * un delete finirebbe fuori dal registro.
 */

export type RisultatoTool = {
  /** Corpo della risposta, serializzato in JSON per il modello. */
  dati: unknown
  /** Quante righe sono state lette o toccate: finisce nel registro. */
  righe?: number | null
}

type Shape = z.ZodRawShape

export type DefinizioneTool<S extends Shape> = {
  nome: string
  titolo?: string
  descrizione: string
  schema: S
  annotazioni: ToolAnnotations
  esegui: (args: z.infer<z.ZodObject<S>>) => Promise<RisultatoTool>
}

export function registraTool<S extends Shape>(server: McpServer, def: DefinizioneTool<S>): void {
  server.registerTool(
    def.nome,
    {
      title: def.titolo ?? def.nome,
      description: def.descrizione,
      inputSchema: def.schema,
      annotations: def.annotazioni,
    },
    (async (args: unknown) => {
      const inizio = Date.now()
      try {
        const risultato = await def.esegui(args as z.infer<z.ZodObject<S>>)
        registraChiamataMcp({
          tool: def.nome,
          argomenti: args,
          esito: "ok",
          righe: risultato.righe ?? null,
          durataMs: Date.now() - inizio,
        })
        return {
          content: [{ type: "text" as const, text: JSON.stringify(risultato.dati, null, 2) }],
        }
      } catch (errore) {
        const fuoriPerimetro = errore instanceof ErrorePerimetroMcp
        const messaggio = errore instanceof Error ? errore.message : String(errore)
        registraChiamataMcp({
          tool: def.nome,
          argomenti: args,
          esito: fuoriPerimetro ? "negato" : "errore",
          errore: messaggio,
          durataMs: Date.now() - inizio,
        })
        // isError lascia decidere al modello: un errore di dominio ("lead non
        // trovato") non deve sembrare un guasto del server.
        return {
          content: [{ type: "text" as const, text: `Errore: ${messaggio}` }],
          isError: true,
        }
      }
      // La firma di registerTool dipende dallo shape dello schema: qui e'
      // generica per costruzione, quindi il cast e' l'unico modo di tenere
      // insieme un helper unico e i tipi dei singoli tool.
    }) as Parameters<McpServer["registerTool"]>[2],
  )
}
