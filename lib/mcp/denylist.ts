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
 * Il perimetro e' a fasce, non piatto. Un elenco unico costringeva a scegliere
 * fra due errori: negare a tutti una tabella che serve a leggere un record
 * (era il caso di `crm_custom_fields`, che bloccava l'intera scheda cliente
 * anche al superadmin), oppure aprirla a tutti per sbloccare un tool. Le fasce
 * sono quattro, dalla piu' chiusa alla piu' aperta:
 *
 *   1. VIETATE_SEMPRE      credenziali: nessun ruolo, mai, nemmeno in lettura
 *   2. CONFIGURAZIONE      CRM Settings e motore dei permessi: fuori perimetro
 *                          per tutti, superadmin incluso — si configurano dal
 *                          CRM, non da una chat
 *   3. RISERVATE_ELEVATI   leggibili dai soli SUPERADMIN e ADMIN, mai scrivibili
 *   4. SOLA_LETTURA        leggibili da tutti i ruoli ammessi, mai scrivibili
 *
 * Regola invariata: si nega per nome tabella, non per intenzione del chiamante.
 */

export class ErrorePerimetroMcp extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErrorePerimetroMcp"
  }
}

/** Codice ruolo come arriva da `utenti.ruolo`, gia' normalizzato a monte. */
export type RuoloMcp = string

/**
 * I ruoli che possono leggere la fascia 3. Non coincide con "chi puo'
 * collegare il connettore" (SUPERADMIN, ADMIN, DIRECTOR): il direttore accede
 * ai suoi dati, non al registro di audit ne' agli IP bloccati.
 */
const RUOLI_ELEVATI = new Set(["SUPERADMIN", "ADMIN"])

function isRuoloElevato(ruolo: RuoloMcp | undefined | null): boolean {
  return ruolo ? RUOLI_ELEVATI.has(ruolo.trim().toUpperCase()) : false
}

/** Fascia 1 — credenziali in chiaro: nessun accesso, per nessun ruolo. */
const TABELLE_VIETATE_SEMPRE = new Set([
  "nextcloud_credentials",
  "email_credentials_personali",
])

/**
 * Fascia 2 — configurazione del CRM. Fuori perimetro per tutti, superadmin
 * compreso: e' una scelta esplicita, non una lacuna. Impostazioni, ruoli,
 * permessi, automazioni e l'editor dei campi si toccano da CRM Settings, dove
 * c'e' la conferma dell'utente e il log di chi ha cambiato cosa.
 */
const TABELLE_CONFIGURAZIONE = new Set([
  // Impostazioni e integrazioni
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
  // Editor dei campi personalizzati e automazioni
  "custom_fields",
  "custom_field_values",
  "attributi_record",
  "workflow_rules",
  "regole_assegnazione",
])

/**
 * Fascia 3 — leggibili dai soli ruoli elevati, mai scrivibili da MCP.
 *
 * `audit_log` non e' una configurazione: e' il registro di cosa e' successo, e
 * un superadmin che chiede "chi ha toccato questa scheda" sta verificando, non
 * configurando. Scrivere resta escluso per chiunque: il registro lo compila il
 * CRM, non chi lo consulta.
 */
const TABELLE_RISERVATE_ELEVATI = new Set([
  "audit_log",
  "ip_bloccati",
  "zoho_user_staging",
])

/**
 * Fascia 4 — leggibili da tutti i ruoli ammessi, mai scrivibili.
 *
 * `utenti` sta qui perche' senza un elenco nomi -> id non si puo' assegnare un
 * compito a nessuno, e perche' i reference-data gia' scritti
 * (loadLeadReferenceData e sorelle) lo leggono per popolare la tendina dei
 * proprietari.
 *
 * `crm_custom_fields` e `crm_column_values` stanno qui per una ragione
 * concreta: sono i metadati con cui si legge un record, non l'editor che li
 * crea. Finche' erano vietate, `loadRecordCustomFieldValues` moriva sulla
 * prima query e con lei l'intera `clienti_get` — la scheda cliente era
 * irraggiungibile da MCP per chiunque. L'editor vero e proprio (fascia 2)
 * resta fuori perimetro: qui si leggono le definizioni, non si cambiano.
 *
 * La scrittura — creare un account, aggiungere una colonna, cambiare un
 * valore di configurazione — resta fuori dal perimetro per ogni fascia.
 */
const TABELLE_SOLA_LETTURA = new Set([
  "utenti",
  "crm_custom_fields",
  "crm_column_values",
])

/**
 * Le funzioni RPC vanno in allowlist, non in denylist: fra quelle esistenti
 * ci sono `crm_admin_add_column`/`crm_admin_drop_column` (DDL sul database),
 * `crm_revoca_*` (sessioni) e `nextcloud_cred_get_password`/`email_cred_*`
 * (credenziali in chiaro). Con una denylist, una RPC nuova nascerebbe
 * permessa; cosi' nasce negata.
 */
const RPC_CONSENTITE = new Set(["get_lead_stats"])

export function assertTabellaLeggibile(tabella: string, ruolo?: RuoloMcp | null): void {
  if (TABELLE_VIETATE_SEMPRE.has(tabella)) {
    throw new ErrorePerimetroMcp(
      `Tabella "${tabella}" fuori dal perimetro del server MCP: nessun accesso, nemmeno in lettura.`,
    )
  }
  if (TABELLE_CONFIGURAZIONE.has(tabella)) {
    throw new ErrorePerimetroMcp(
      `Tabella "${tabella}" e' configurazione del CRM: si gestisce da CRM Settings, non dal server MCP.`,
    )
  }
  if (TABELLE_RISERVATE_ELEVATI.has(tabella) && !isRuoloElevato(ruolo)) {
    throw new ErrorePerimetroMcp(
      `Tabella "${tabella}" e' riservata ai ruoli SUPERADMIN e ADMIN: lettura negata per il ruolo corrente.`,
    )
  }
}

export function isTabellaSolaLettura(tabella: string, ruolo?: RuoloMcp | null): boolean {
  void ruolo
  return TABELLE_SOLA_LETTURA.has(tabella) || TABELLE_RISERVATE_ELEVATI.has(tabella)
}

export function assertTabellaScrivibile(tabella: string, ruolo?: RuoloMcp | null): void {
  assertTabellaLeggibile(tabella, ruolo)
  if (isTabellaSolaLettura(tabella, ruolo)) {
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

/** Solo per i test: gli elenchi non vanno esportati mutabili. */
export const _perimetro = {
  vietateSempre: () => [...TABELLE_VIETATE_SEMPRE],
  configurazione: () => [...TABELLE_CONFIGURAZIONE],
  riservateElevati: () => [...TABELLE_RISERVATE_ELEVATI],
  solaLettura: () => [...TABELLE_SOLA_LETTURA],
  rpc: () => [...RPC_CONSENTITE],
  ruoliElevati: () => [...RUOLI_ELEVATI],
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
 * rispettino il perimetro del ruolo che ha presentato il token.
 *
 * Il controllo sta sul client e non nei singoli tool di proposito: vale anche
 * per il codice che i tool riusano senza saperlo — i repository, i
 * reference-data, tutto quello che riceve questo client dall'AsyncLocalStorage.
 * Se un domani qualcuno scrive `.from("audit_log")` dentro una funzione
 * condivisa, la chiamata muore qui invece di arrivare al database.
 *
 * Il ruolo e' opzionale e, se manca, si comporta come il ruolo meno elevato:
 * un chiamante che dimentica di passarlo perde accesso, non lo guadagna.
 */
export function applicaPerimetro(client: SupabaseClient, ruolo?: RuoloMcp | null): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (tabella: string) => {
          assertTabellaLeggibile(tabella, ruolo)
          const builder = target.from(tabella)
          return isTabellaSolaLettura(tabella, ruolo)
            ? builderSolaLettura(builder, tabella)
            : builder
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
