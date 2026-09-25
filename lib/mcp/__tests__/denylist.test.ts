// Test del perimetro del server MCP.
//
// Perche' esiste: sulle tabelle vietate la RLS non protegge in lettura
// (`audit_log` ha una policy `using (auth.uid() is not null)`, `permessi_pagina`
// una `using (true)`), quindi questo elenco e' l'unica barriera vera. Se
// smettesse di funzionare — un refactor del Proxy, una `from()` che scavalca il
// wrapper — non ci sarebbe nessun sintomo: le query passerebbero e basta.
//
// Qui non si tocca Supabase: il "client" e' un doppio che registra le chiamate.

import { describe, expect, it, vi } from "vitest"

import {
  applicaPerimetro,
  assertRpcConsentita,
  assertTabellaLeggibile,
  assertTabellaScrivibile,
  ErrorePerimetroMcp,
} from "@/lib/mcp/denylist"

type ClientFinto = {
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
  auth: { getUser: ReturnType<typeof vi.fn> }
}

function clientFinto(): ClientFinto {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
  }
  return {
    from: vi.fn(() => builder),
    rpc: vi.fn(() => ({ data: null, error: null })),
    auth: { getUser: vi.fn() },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const avvolgi = (c: ClientFinto, ruolo?: string) => applicaPerimetro(c as any, ruolo)

const RUOLI = ["SUPERADMIN", "ADMIN", "DIRECTOR"] as const

describe("perimetro MCP — fascia 1: credenziali, mai per nessuno", () => {
  const vietate = ["nextcloud_credentials", "email_credentials_personali"]

  it.each(RUOLI.flatMap((r) => vietate.map((t) => [r, t] as const)))(
    "%s non legge %s",
    (ruolo, tabella) => {
      const client = clientFinto()
      expect(() => avvolgi(client, ruolo).from(tabella)).toThrow(ErrorePerimetroMcp)
      expect(client.from).not.toHaveBeenCalled()
    },
  )
})

describe("perimetro MCP — fascia 2: configurazione CRM, nemmeno al superadmin", () => {
  // La richiesta era esplicita: da MCP si verifica tutto quello che l'account
  // vede nel tool, MENO le configurazioni di CRM Settings. Il superadmin qui
  // non fa eccezione, ed e' il test che lo tiene fermo.
  const configurazione = [
    "crm_settings",
    "integrazioni",
    "ruoli",
    "permessi_pagina",
    "permessi_azione",
    "permessi_campo",
    "permessi_record",
    "permessi_speciali",
    "permessi_ui",
    "permessi_cartelle_nextcloud",
    "custom_fields",
    "custom_field_values",
    "attributi_record",
    "workflow_rules",
    "regole_assegnazione",
  ]

  it.each(configurazione)("nega la lettura di %s anche al SUPERADMIN", (tabella) => {
    const client = clientFinto()
    expect(() => avvolgi(client, "SUPERADMIN").from(tabella)).toThrow(ErrorePerimetroMcp)
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each(configurazione)("nega la scrittura di %s a ogni ruolo", (tabella) => {
    for (const ruolo of RUOLI) {
      expect(() => assertTabellaScrivibile(tabella, ruolo)).toThrow(ErrorePerimetroMcp)
    }
  })
})

describe("perimetro MCP — fascia 3: riservate ai ruoli elevati", () => {
  const riservate = ["audit_log", "ip_bloccati", "zoho_user_staging"]

  it.each(riservate)("SUPERADMIN e ADMIN leggono %s", (tabella) => {
    for (const ruolo of ["SUPERADMIN", "ADMIN", "superadmin", " Admin "]) {
      const client = clientFinto()
      expect(() => avvolgi(client, ruolo).from(tabella)).not.toThrow()
      expect(client.from).toHaveBeenCalledWith(tabella)
    }
  })

  it.each(riservate)("DIRECTOR non legge %s", (tabella) => {
    const client = clientFinto()
    expect(() => avvolgi(client, "DIRECTOR").from(tabella)).toThrow(ErrorePerimetroMcp)
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each(riservate)("senza ruolo %s resta negata", (tabella) => {
    // Un chiamante che dimentica il ruolo deve perdere accesso, non guadagnarlo.
    const client = clientFinto()
    expect(() => avvolgi(client).from(tabella)).toThrow(ErrorePerimetroMcp)
  })

  it.each(riservate)("nessuno scrive %s, nemmeno il SUPERADMIN", (tabella) => {
    expect(() => assertTabellaScrivibile(tabella, "SUPERADMIN")).toThrow(ErrorePerimetroMcp)
    const client = clientFinto()
    const builder = avvolgi(client, "SUPERADMIN").from(tabella) as unknown as Record<
      string,
      () => unknown
    >
    expect(() => builder.insert()).toThrow(ErrorePerimetroMcp)
  })
})

describe("perimetro MCP — fascia 4: sola lettura per tutti i ruoli", () => {
  const solaLettura = ["utenti", "crm_custom_fields", "crm_column_values"]

  it.each(RUOLI.flatMap((r) => solaLettura.map((t) => [r, t] as const)))(
    "%s legge %s",
    (ruolo, tabella) => {
      const client = clientFinto()
      expect(() => avvolgi(client, ruolo).from(tabella).select("*")).not.toThrow()
    },
  )

  it.each(solaLettura.flatMap((t) => (["insert", "update", "upsert", "delete"] as const).map((m) => [t, m] as const)))(
    "nega %s.%s",
    (tabella, metodo) => {
      const client = clientFinto()
      const builder = avvolgi(client, "SUPERADMIN").from(tabella) as unknown as Record<
        string,
        () => unknown
      >
      expect(() => builder[metodo]()).toThrow(ErrorePerimetroMcp)
    },
  )

  it("assertTabellaLeggibile passa dove assertTabellaScrivibile blocca", () => {
    expect(() => assertTabellaLeggibile("utenti", "DIRECTOR")).not.toThrow()
    expect(() => assertTabellaScrivibile("utenti", "DIRECTOR")).toThrow(ErrorePerimetroMcp)
  })
})

describe("perimetro MCP — la scheda cliente resta raggiungibile", () => {
  // La regressione concreta da cui nasce il perimetro a fasce: con
  // `crm_custom_fields` fra le vietate, `loadRecordCustomFieldValues`
  // lanciava sulla prima query e `clienti_get` falliva per intero, per ogni
  // ruolo. Questo test e' il guardrail di quel percorso.
  it.each(RUOLI)("%s legge i metadati dei campi personalizzati", (ruolo) => {
    const client = clientFinto()
    expect(() =>
      avvolgi(client, ruolo)
        .from("crm_custom_fields")
        .select("field_key, label, tipo, column_name, required, options")
        .eq("table_name", "clienti"),
    ).not.toThrow()
  })
})

describe("perimetro MCP — tabelle del CRM", () => {
  it("lascia passare le tabelle business", () => {
    const client = clientFinto()
    const protetto = avvolgi(client, "DIRECTOR")
    for (const tabella of ["leads", "clienti", "cliente_pagamenti", "compiti", "scadenze"]) {
      expect(() => protetto.from(tabella)).not.toThrow()
    }
    expect(client.from).toHaveBeenCalledTimes(5)
  })

  it("non intralcia le altre proprieta' del client", () => {
    const client = clientFinto()
    expect(() => avvolgi(client, "SUPERADMIN").auth.getUser()).not.toThrow()
    expect(client.auth.getUser).toHaveBeenCalled()
  })
})

describe("perimetro MCP — RPC in allowlist", () => {
  it("permette le funzioni elencate", () => {
    const client = clientFinto()
    expect(() => avvolgi(client, "DIRECTOR").rpc("get_lead_stats")).not.toThrow()
  })

  // Il senso dell'allowlist: fra le RPC esistenti ci sono DDL sul database,
  // revoca sessioni e lettura di credenziali in chiaro. Con una denylist, una
  // RPC nuova nascerebbe permessa. Il ruolo non c'entra: nemmeno il superadmin
  // apre una RPC che non e' in elenco.
  it.each([
    "crm_admin_add_column",
    "crm_admin_drop_column",
    "crm_revoca_sessione",
    "nextcloud_cred_get_password",
    "email_cred_get_password",
    "get_permission_snapshot",
    "funzione_inventata_domani",
  ])("nega %s", (funzione) => {
    const client = clientFinto()
    expect(() => avvolgi(client, "SUPERADMIN").rpc(funzione)).toThrow(ErrorePerimetroMcp)
    expect(() => assertRpcConsentita(funzione)).toThrow(ErrorePerimetroMcp)
    expect(client.rpc).not.toHaveBeenCalled()
  })
})

describe("perimetro MCP — vie laterali", () => {
  it("nega il cambio di schema, che scavalcherebbe il controllo su from()", () => {
    const client = clientFinto()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (avvolgi(client, "SUPERADMIN") as any).schema("public")).toThrow(
      ErrorePerimetroMcp,
    )
  })
})
