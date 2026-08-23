// Lettura e scrittura delle tre impostazioni di sicurezza su public.crm_settings.
//
// Le chiavi esistono dal 26/06/2026 e finora non erano lette da nessuno: il
// timeout veniva dalla env var SESSION_IDLE_TIMEOUT_SECONDS e le altre due non
// erano applicate affatto. Da qui in avanti la riga di database e' la sorgente.
//
// Client: service_role. Non per aggirare RLS — la policy `crm_authenticated_access`
// concede ALL a `authenticated` — ma perche' il chiamante principale e'
// /api/auth/login, che per definizione gira PRIMA che una sessione esista.

import { createAdminClient } from "@/lib/supabase/admin"
import {
  CHIAVE_BLOCCO_IP,
  CHIAVE_MAX_TENTATIVI,
  CHIAVE_TIMEOUT,
  clampTentativi,
  clampTimeoutMinuti,
  type ImpostazioniSicurezza,
} from "./constants"

export const IMPOSTAZIONI_DEFAULT: ImpostazioniSicurezza = {
  timeoutMinuti: 30,
  maxTentativi: 5,
  bloccoIpAttivo: true,
}

// Cache in-process. Il valore serve su /api/auth/login e su ogni keepalive di
// sessione: senza cache sarebbe una SELECT per ogni tentativo di accesso e per
// ogni tab aperta ogni minuto.
//
// Limite dichiarato: su Vercel il processo non e' uno solo, quindi un
// salvataggio fatto su un'istanza impiega fino a TTL a farsi vedere dalle
// altre. Per un timeout di sessione e una soglia di tentativi e' irrilevante;
// per un dato che dovesse cambiare in modo atomico non lo sarebbe.
const CACHE_TTL_MS = 60 * 1000
let cache: { valore: ImpostazioniSicurezza; scadeA: number } | null = null

/** Da invocare dopo un salvataggio, cosi' l'istanza che scrive rilegge subito. */
export function invalidaCacheImpostazioni(): void {
  cache = null
}

/**
 * `valore` e' jsonb: un numero salvato da PostgREST torna come number, ma una
 * riga scritta a mano dal SQL Editor puo' essere una stringa. Si normalizza qui
 * invece di fidarsi del tipo.
 */
function numero(raw: unknown, fallback: number): number {
  if (typeof raw === "number") return raw
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function booleano(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw
  if (raw === "true") return true
  if (raw === "false") return false
  return fallback
}

export async function leggiImpostazioniSicurezza(): Promise<{
  impostazioni: ImpostazioniSicurezza
  errore: string | null
}> {
  const adesso = Date.now()
  if (cache && cache.scadeA > adesso) {
    return { impostazioni: cache.valore, errore: null }
  }

  const admin = createAdminClient()
  if (!admin) {
    return {
      impostazioni: IMPOSTAZIONI_DEFAULT,
      errore: "SUPABASE_SERVICE_ROLE_KEY non configurata",
    }
  }

  const { data, error } = await admin
    .from("crm_settings")
    .select("chiave, valore")
    .in("chiave", [CHIAVE_TIMEOUT, CHIAVE_MAX_TENTATIVI, CHIAVE_BLOCCO_IP])

  if (error) {
    // Non si mette in cache un fallimento: il tentativo successivo deve
    // riprovare davvero. Si restituiscono i default, che sono i piu' restrittivi
    // fra quelli plausibili, insieme all'errore.
    return { impostazioni: IMPOSTAZIONI_DEFAULT, errore: error.message }
  }

  const per = new Map((data ?? []).map((r) => [r.chiave as string, r.valore]))

  const impostazioni: ImpostazioniSicurezza = {
    timeoutMinuti: clampTimeoutMinuti(
      numero(per.get(CHIAVE_TIMEOUT), IMPOSTAZIONI_DEFAULT.timeoutMinuti),
    ),
    maxTentativi: clampTentativi(
      numero(per.get(CHIAVE_MAX_TENTATIVI), IMPOSTAZIONI_DEFAULT.maxTentativi),
    ),
    bloccoIpAttivo: booleano(per.get(CHIAVE_BLOCCO_IP), IMPOSTAZIONI_DEFAULT.bloccoIpAttivo),
  }

  cache = { valore: impostazioni, scadeA: adesso + CACHE_TTL_MS }
  return { impostazioni, errore: null }
}

export async function salvaImpostazioniSicurezza(
  impostazioni: ImpostazioniSicurezza,
): Promise<{ errore: string | null }> {
  const admin = createAdminClient()
  if (!admin) return { errore: "SUPABASE_SERVICE_ROLE_KEY non configurata" }

  // `chiave` e' UNIQUE: l'upsert aggiorna le tre righe gia' presenti invece di
  // duplicarle. `descrizione` viene riscritta identica a quella del seed per
  // non svuotarla.
  const { error } = await admin.from("crm_settings").upsert(
    [
      {
        chiave: CHIAVE_TIMEOUT,
        valore: impostazioni.timeoutMinuti,
        descrizione: "Timeout sessione in minuti",
        updated_at: new Date().toISOString(),
      },
      {
        chiave: CHIAVE_MAX_TENTATIVI,
        valore: impostazioni.maxTentativi,
        descrizione: "Tentativi login massimi prima del blocco",
        updated_at: new Date().toISOString(),
      },
      {
        chiave: CHIAVE_BLOCCO_IP,
        valore: impostazioni.bloccoIpAttivo,
        descrizione: "Blocco automatico IP dopo login falliti",
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "chiave" },
  )

  if (error) return { errore: error.message }

  invalidaCacheImpostazioni()
  return { errore: null }
}
