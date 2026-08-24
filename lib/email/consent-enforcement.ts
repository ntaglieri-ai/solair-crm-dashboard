// Interruttore globale del blocco invii senza consenso.
//
// Esiste per una sola ragione legittima: poter riaprire l'invio in una
// situazione in cui il blocco sta fermando lavoro che ha una base giuridica
// diversa dal consenso, senza dover fare un deploy. NON e' un'impostazione
// operativa: spento, il CRM torna a scrivere a chiunque abbia un indirizzo,
// inclusi i 9112 lead che non hanno mai acconsentito.
//
// Per questo:
//   - la chiave e' PIATTA, senza prefisso system./company./maintenance./user.
//     Per le policy di 20260823_crm_settings_write_policies.sql questo
//     significa "nessuna policy di scrittura: solo service_role", cioe' la
//     stessa classe di session_timeout_minutes e ip_block_enabled. Nessun
//     utente autenticato puo' scriverla passando da PostgREST.
//   - la sola route che la scrive richiede SUPERADMIN (vedi
//     app/api/crm-settings/consenso-enforcement/route.ts).
//   - ogni cambio di stato e ogni invio fatto a interruttore spento lasciano
//     una riga di audit_log.

import { createAdminClient } from "@/lib/supabase/admin"

export const CHIAVE_CONSENSO_ENFORCEMENT = "consenso_enforcement_attivo"

/** Acceso salvo prova contraria: il default sicuro e' bloccare. */
export const CONSENSO_ENFORCEMENT_DEFAULT = true

// Cache in-process breve: la chiave viene letta a ogni invio, singolo o
// massivo. Stesso limite dichiarato in lib/session-access/security-settings.ts
// — su Vercel i processi sono piu' d'uno, quindi un cambio impiega fino al TTL
// a propagarsi. Per un interruttore che si tocca una volta ogni mai va bene;
// va tenuto basso proprio perche' RIACCENDERE il blocco deve avere effetto in
// fretta.
const CACHE_TTL_MS = 30 * 1000
let cache: { attivo: boolean; scadeA: number } | null = null

export function invalidaCacheEnforcement(): void {
  cache = null
}

function booleano(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw
  if (raw === "true") return true
  if (raw === "false") return false
  return fallback
}

/**
 * Stato dell'interruttore.
 *
 * Fallisce SICURO, non aperto: se la chiave non si legge (service_role
 * assente, query in errore, valore illeggibile) si torna `true`, cioe' blocco
 * attivo. Un errore di configurazione non deve poter spegnere una tutela.
 */
export async function leggiConsensoEnforcement(): Promise<{
  attivo: boolean
  errore: string | null
}> {
  const adesso = Date.now()
  if (cache && cache.scadeA > adesso) return { attivo: cache.attivo, errore: null }

  const admin = createAdminClient()
  if (!admin) {
    return {
      attivo: CONSENSO_ENFORCEMENT_DEFAULT,
      errore: "SUPABASE_SERVICE_ROLE_KEY non configurata",
    }
  }

  const { data, error } = await admin
    .from("crm_settings")
    .select("valore")
    .eq("chiave", CHIAVE_CONSENSO_ENFORCEMENT)
    .maybeSingle()

  if (error) {
    // Non si mette in cache un fallimento: il tentativo dopo deve riprovare.
    console.error("[consenso-email] lettura interruttore fallita:", error.message)
    return { attivo: CONSENSO_ENFORCEMENT_DEFAULT, errore: error.message }
  }

  const attivo = booleano(data?.valore, CONSENSO_ENFORCEMENT_DEFAULT)
  cache = { attivo, scadeA: adesso + CACHE_TTL_MS }
  return { attivo, errore: null }
}

export async function salvaConsensoEnforcement(
  attivo: boolean,
): Promise<{ errore: string | null }> {
  const admin = createAdminClient()
  if (!admin) return { errore: "SUPABASE_SERVICE_ROLE_KEY non configurata" }

  const { error } = await admin.from("crm_settings").upsert(
    {
      chiave: CHIAVE_CONSENSO_ENFORCEMENT,
      valore: attivo,
      descrizione:
        "Blocco invii email verso contatti senza consenso. Spento = invii senza filtro.",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chiave" },
  )

  if (error) return { errore: error.message }
  invalidaCacheEnforcement()
  return { errore: null }
}
