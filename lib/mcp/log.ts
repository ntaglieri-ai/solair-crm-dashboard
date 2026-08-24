import "server-only"

import { after } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Tracciamento delle chiamate MCP.
 *
 * `audit_log` e' fuori dal perimetro e ci resta: questo e' un registro
 * separato, dedicato al solo modulo MCP. La conseguenza da tenere presente e'
 * che una cancellazione fatta da Claude compare qui e NON nell'audit del CRM,
 * quindi i due registri vanno letti insieme quando si ricostruisce una storia.
 *
 * Due livelli, entrambi attivi:
 *  1. riga strutturata su stdout -> log Vercel, immediata, sempre;
 *  2. riga su `mcp_tool_log`, interrogabile, scritta in service_role (la
 *     tabella non ha policy: invisibile da PostgREST, come le
 *     offerta_commerciale_* prima della migration).
 *
 * Gli argomenti si registrano ridotti: identificativi e parametri di query
 * si', dati di contatto e credenziali no. Il registro serve a sapere "quale
 * tool ha toccato quale record", non a duplicare l'anagrafica altrove.
 */

export type EsitoMcp = "ok" | "errore" | "negato"

const CHIAVI_OSCURATE =
  /^(iban|password|passwd|token|secret|segreto|codice_fiscale|email|telefono|mobile_fisso|email_secondaria)$/i

const LUNGHEZZA_MAX_STRINGA = 200
const PROFONDITA_MAX = 4

function riduci(valore: unknown, profondita = 0): unknown {
  if (valore === null || valore === undefined) return valore
  if (profondita >= PROFONDITA_MAX) return "…"
  if (typeof valore === "string") {
    return valore.length > LUNGHEZZA_MAX_STRINGA
      ? `${valore.slice(0, LUNGHEZZA_MAX_STRINGA)}… (${valore.length} car.)`
      : valore
  }
  if (typeof valore === "number" || typeof valore === "boolean") return valore
  if (Array.isArray(valore)) {
    // Le liste di id possono essere lunghe: si tiene la testa e il conteggio.
    const testa = valore.slice(0, 20).map((v) => riduci(v, profondita + 1))
    return valore.length > 20 ? [...testa, `…altri ${valore.length - 20}`] : testa
  }
  if (typeof valore === "object") {
    const out: Record<string, unknown> = {}
    for (const [chiave, v] of Object.entries(valore as Record<string, unknown>)) {
      out[chiave] = CHIAVI_OSCURATE.test(chiave) ? "[oscurato]" : riduci(v, profondita + 1)
    }
    return out
  }
  return String(valore)
}

export type RigaLogMcp = {
  tool: string
  argomenti: unknown
  esito: EsitoMcp
  errore?: string | null
  righe?: number | null
  durataMs: number
}

function scriviSuStdout(riga: RigaLogMcp, argomentiRidotti: unknown): void {
  const parti = [
    `tool=${riga.tool}`,
    `esito=${riga.esito}`,
    riga.righe != null ? `righe=${riga.righe}` : null,
    `durata_ms=${riga.durataMs}`,
    riga.errore ? `errore=${JSON.stringify(riga.errore)}` : null,
    `args=${JSON.stringify(argomentiRidotti)}`,
  ].filter(Boolean)
  console.log(`[mcp] ${parti.join(" ")}`)
}

async function scriviSuTabella(riga: RigaLogMcp, argomentiRidotti: unknown): Promise<void> {
  const supabase = createAdminClient()
  if (!supabase) {
    console.error("[mcp] log su tabella saltato: Supabase admin non configurato")
    return
  }
  const { error } = await supabase.from("mcp_tool_log").insert({
    tool: riga.tool,
    argomenti: argomentiRidotti as Record<string, unknown>,
    esito: riga.esito,
    errore: riga.errore ?? null,
    righe: riga.righe ?? null,
    durata_ms: riga.durataMs,
  })
  // Un registro che non riesce a scrivere non deve far fallire l'operazione
  // gia' eseguita: si segnala e basta.
  if (error) console.error("[mcp] log su tabella fallito:", error.message)
}

export function registraChiamataMcp(riga: RigaLogMcp): void {
  const argomentiRidotti = riduci(riga.argomenti) ?? {}
  scriviSuStdout(riga, argomentiRidotti)

  const scrittura = () => scriviSuTabella(riga, argomentiRidotti)
  try {
    // Fuori dal percorso critico: la risposta al tool non aspetta il registro.
    after(scrittura)
  } catch {
    // `after` esiste solo dentro una richiesta: nei test si scrive e basta.
    void scrittura()
  }
}
