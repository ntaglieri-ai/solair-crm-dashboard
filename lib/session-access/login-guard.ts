// Applicazione reale della soglia tentativi e del blocco IP.
//
// Prima di questo modulo le due impostazioni erano inerti: /login chiamava
// signInWithPassword direttamente dal browser, quindi il server non era sul
// percorso e nessun valore salvato poteva fermare alcunche'. Adesso il gate sta
// in /api/auth/login, che e' l'unico punto in cui il CRM autentica.
//
// Limite noto, da non nascondere: chi conoscesse la chiave anon (che e'
// pubblica, sta nel bundle) puo' sempre parlare con Supabase Auth in proprio e
// ottenere un token senza passare di qui. Quello che NON puo' fare e' entrare
// nel CRM: senza i cookie di sessione CRM il middleware lo rimanda a /login.
// Questo gate protegge il CRM dal brute force, non l'endpoint GoTrue.

import { createAdminClient } from "@/lib/supabase/admin"
import {
  DURATA_BLOCCO_MINUTI,
  FINESTRA_TENTATIVI_MINUTI,
  type ImpostazioniSicurezza,
} from "./constants"

export interface EsitoControlloIp {
  bloccato: boolean
  /** Motivo registrato sul blocco, per il registro (non per l'utente). */
  motivo: string | null
  scadenza: string | null
}

/**
 * Un IP e' bloccato se ha una riga con `scadenza` nulla (blocco manuale, senza
 * termine) oppure futura. Le righe scadute restano in tabella come storico e
 * non fermano nessuno: e' questo che rende lo sblocco automatico alla scadenza.
 */
export async function controllaIpBloccato(ip: string | null): Promise<EsitoControlloIp> {
  const libero: EsitoControlloIp = { bloccato: false, motivo: null, scadenza: null }
  if (!ip) return libero

  const admin = createAdminClient()
  if (!admin) return libero

  const { data, error } = await admin
    .from("ip_bloccati")
    .select("motivo, scadenza")
    .eq("ip_address", ip)
    .maybeSingle()

  // In caso di errore di lettura si lascia passare: un guasto della tabella dei
  // blocchi non deve trasformarsi in un lucchetto sull'intero CRM.
  if (error || !data) return libero

  const attivo = data.scadenza === null || new Date(data.scadenza).getTime() > Date.now()
  if (!attivo) return libero

  return { bloccato: true, motivo: data.motivo, scadenza: data.scadenza }
}

/**
 * Tentativi falliti da contare per questo IP.
 *
 * Due accorgimenti contro i falsi positivi:
 *   1. finestra mobile di FINESTRA_TENTATIVI_MINUTI, come dichiarato in pagina;
 *   2. si contano solo i fallimenti successivi all'ULTIMO accesso riuscito
 *      dallo stesso IP. Senza questo, chi sbaglia quattro volte, entra, e poi
 *      sbaglia una volta sola riaprendo una seconda scheda verrebbe bloccato
 *      pur conoscendo evidentemente la password.
 */
export async function contaTentativiFalliti(ip: string | null): Promise<number> {
  if (!ip) return 0

  const admin = createAdminClient()
  if (!admin) return 0

  const inizioFinestra = new Date(
    Date.now() - FINESTRA_TENTATIVI_MINUTI * 60 * 1000,
  ).toISOString()

  const { data: ultimoAccesso } = await admin
    .from("audit_log")
    .select("created_at")
    .eq("tipo_evento", "accesso")
    .eq("ip_address", ip)
    .gte("created_at", inizioFinestra)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const da =
    ultimoAccesso?.created_at && ultimoAccesso.created_at > inizioFinestra
      ? ultimoAccesso.created_at
      : inizioFinestra

  const { count, error } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("tipo_evento", "login_fallito")
    .eq("ip_address", ip)
    .gt("created_at", da)

  if (error) return 0
  return count ?? 0
}

/**
 * Applica il blocco automatico se il tentativo appena fallito porta l'IP alla
 * soglia. Ritorna true se il blocco e' stato scritto adesso.
 *
 * `ip_address` e' UNIQUE: l'upsert rinnova la scadenza di un IP gia' noto
 * invece di fallire. Un blocco manuale senza scadenza NON viene sovrascritto —
 * si controlla prima — altrimenti un blocco permanente deciso da un
 * amministratore diventerebbe da solo un blocco di quindici minuti.
 */
export async function applicaBloccoSeNecessario(
  ip: string | null,
  impostazioni: ImpostazioniSicurezza,
): Promise<{ bloccato: boolean; tentativi: number }> {
  if (!ip || !impostazioni.bloccoIpAttivo) return { bloccato: false, tentativi: 0 }

  const tentativi = await contaTentativiFalliti(ip)
  if (tentativi < impostazioni.maxTentativi) return { bloccato: false, tentativi }

  const admin = createAdminClient()
  if (!admin) return { bloccato: false, tentativi }

  const { data: esistente } = await admin
    .from("ip_bloccati")
    .select("scadenza")
    .eq("ip_address", ip)
    .maybeSingle()

  if (esistente && esistente.scadenza === null) {
    return { bloccato: true, tentativi }
  }

  const scadenza = new Date(Date.now() + DURATA_BLOCCO_MINUTI * 60 * 1000).toISOString()

  const { error } = await admin.from("ip_bloccati").upsert(
    {
      ip_address: ip,
      motivo: `${tentativi} tentativi di accesso falliti in ${FINESTRA_TENTATIVI_MINUTI} minuti`,
      // Blocco automatico: nessun amministratore lo ha deciso, la colonna resta
      // vuota. E' cosi' che la tabella distingue un blocco di sistema da uno
      // manuale, senza aggiungere colonne.
      bloccato_da: null,
      scadenza,
      created_at: new Date().toISOString(),
    },
    { onConflict: "ip_address" },
  )

  if (error) {
    console.error("[login-guard] blocco IP non scritto:", error.message)
    return { bloccato: false, tentativi }
  }

  return { bloccato: true, tentativi }
}
