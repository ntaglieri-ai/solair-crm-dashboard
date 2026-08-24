import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Perimetro del server MCP, applicato prima di ogni chiamata alla rete.
 *
 * Perche' esiste, dato che c'e' gia' la RLS: perche' sulle tabelle vietate la
 * RLS NON protegge in lettura. Verificato il 24/08/2026 su pg_policies:
 * `audit_log` ha `audit_log_select using (auth.uid() is not null)` e
 * `permessi_pagina` ha `permessi_pagina_read using (true)` — cioe' il JWT di
 * un qualsiasi utente autenticato le legge senza ostacoli, Vito compreso.
 * Senza questo elenco, il perimetro sarebbe garantito solo dal fatto che non
 * abbiamo scritto il tool: una convenzione, non una barriera. Un `.from()`
 * sbagliato in un refactor futuro basterebbe a superarla in silenzio.
 *
 * Regola: si nega per nome tabella, non per intenzione del chiamante.
 */

export class ErrorePerimetroMcp extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErrorePerimetroMcp"
  }
}

/** Nessun accesso, in lettura ne' in scrittura. */
const TABELLE_VIETATE = new Set([
  // Impostazioni e configurazione CRM
  "crm_settings",
  "integrazioni",
  // Ruoli e motore dei permessi (tutta la famiglia, non solo le 5 citate)
  "ruoli",
  "permessi_pagina",
  "permessi_azione",
  "permessi_campo",
  "permessi_record",
  "permessi_speciali",
  "permessi_ui",
  "permessi_cartelle_nextcloud",
  // Audit
  "audit_log",
  // Account, sessioni, credenziali
  "ip_bloccati",
  "nextcloud_credentials",
  "email_credentials_personali",
  "zoho_user_staging",
  // Schema dinamico: e' manutenzione, non dato business
  "crm_custom_fields",
  "crm_column_values",
  "custom_fields",
  "custom_field_values",
  "attributi_record",
  "workflow_rules",
  "regole_assegnazione",
])

/**
 * Leggibili ma mai scrivibili. `utenti` sta qui e non fra le vietate perche'
 * senza un elenco nomi -> id non si puo' assegnare un compito a nessuno, e
 * perche' i reference-data gia' scritti (loadLeadReferenceData e sorelle) lo
 * leggono per popolare la tendina dei proprietari. La scrittura — creare,
 * disattivare o modificare un account — resta fuori dal perimetro.
 */
const TABELLE_SOLA_LETTURA = new Set(["utenti"])

/**
 * Le funzioni RPC vanno in allowlist, non in denylist: fra quelle esistenti
 * ci sono `crm_admin_add_column`/`crm_admin_drop_column` (DDL sul database),
 * `crm_revoca_*` (sessioni) e `nextcloud_cred_get_password`/`email_cred_*`
 * (credenziali in chiaro). Con una denylist, una RPC nuova nascerebbe
 * permessa; cosi' nasce negata.
 */
const RPC_CONSENTITE = new Set(["get_lead_stats"])

export function assertTabellaLeggibile(tabella: string): void {
  if (TABELLE_VIETATE.has(tabella)) {
    throw new ErrorePerimetroMcp(
      `Tabella "${tabella}" fuori dal perimetro del server MCP: nessun accesso, nemmeno in lettura.`,
    )
  }
}

export function assertTabellaScrivibile(tabella: string): void {
  assertTabellaLeggibile(tabella)
  if (TABELLE_SOLA_LETTURA.has(tabella)) {
    throw new ErrorePerimetroMcp(
      `Tabella "${tabella}" e' accessibile in sola lettura dal server MCP: scrittura negata.`,
    )
  }
}

export function assertRpcConsentita(funzione: string): void {
  if (!RPC_CONSENTITE.has(funzione)) {
    throw new ErrorePerimetroMcp(
      `RPC "${funzione}" non e' nell'allowlist del server MCP: chiamata negata.`,
    )
  }
}

export function isTabellaSolaLettura(tabella: string): boolean {
  return TABELLE_SOLA_LETTURA.has(tabella)
}

/** Solo per i test: l'elenco non va esportato mutabile. */
export const _perimetro = {
  vietate: () => [...TABELLE_VIETATE],
  solaLettura: () => [...TABELLE_SOLA_LETTURA],
  rpc: () => [...RPC_CONSENTITE],
}

// ---------------------------------------------------------------------------
// Applicazione del perimetro
//
// Sta qui e non nel modulo che crea il client perche' e' la stessa policy di
// sopra, vista dal lato di chi la subisce: tenerle insieme evita che una delle
// due cambi da sola. E senza I/O, questo file resta interamente testabile.

const METODI_SCRITTURA = new Set(["insert", "update", "upsert", "delete"])

function builderSolaLettura(builder: unknown, tabella: string): unknown {
  return new Proxy(builder as object, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && METODI_SCRITTURA.has(prop)) {
        throw new ErrorePerimetroMcp(
          `Tabella "${tabella}" e' accessibile in sola lettura dal server MCP: "${prop}" negata.`,
        )
      }
      const valore = Reflect.get(target, prop, receiver)
      return typeof valore === "function" ? valore.bind(target) : valore
    },
  })
}

/**
 * Avvolge un client Supabase in modo che `.from()`, `.rpc()` e `.schema()`
 * rispettino il perimetro.
 *
 * Il controllo sta sul client e non nei singoli tool di proposito: vale anche
 * per il codice che i tool riusano senza saperlo — i repository, i
 * reference-data, tutto quello che riceve questo client dall'AsyncLocalStorage.
 * Se un domani qualcuno scrive `.from("audit_log")` dentro una funzione
 * condivisa, la chiamata muore qui invece di arrivare al database.
 */
export function applicaPerimetro(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (tabella: string) => {
          assertTabellaLeggibile(tabella)
          const builder = target.from(tabella)
          return isTabellaSolaLettura(tabella) ? builderSolaLettura(builder, tabella) : builder
        }
      }
      if (prop === "rpc") {
        return (funzione: string, ...resto: unknown[]) => {
          assertRpcConsentita(funzione)
          return (target.rpc as (...args: unknown[]) => unknown)(funzione, ...resto)
        }
      }
      if (prop === "schema") {
        // `schema()` scavalcherebbe il controllo su `from()`: si nega in blocco,
        // il perimetro vive tutto in `public`.
        throw new ErrorePerimetroMcp("Cambio di schema non consentito dal server MCP")
      }
      const valore = Reflect.get(target, prop, receiver)
      return typeof valore === "function" ? valore.bind(target) : valore
    },
  }) as SupabaseClient
}
