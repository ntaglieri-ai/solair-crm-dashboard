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
const avvolgi = (c: ClientFinto) => applicaPerimetro(c as any)

describe("perimetro MCP — tabelle vietate", () => {
  const vietate = [
    "crm_settings",
    "ruoli",
    "permessi_pagina",
    "permessi_azione",
    "permessi_campo",
    "permessi_record",
    "audit_log",
  ]

  it.each(vietate)("nega la lettura di %s", (tabella) => {
    const client = clientFinto()
    expect(() => avvolgi(client).from(tabella)).toThrow(ErrorePerimetroMcp)
    // Non deve nemmeno arrivare al client sottostante.
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each(vietate)("nega la scrittura di %s", (tabella) => {
    expect(() => assertTabellaScrivibile(tabella)).toThrow(ErrorePerimetroMcp)
  })
})

describe("perimetro MCP — tabelle del CRM", () => {
  it("lascia passare le tabelle business", () => {
    const client = clientFinto()
    const protetto = avvolgi(client)
    for (const tabella of ["leads", "clienti", "cliente_pagamenti", "compiti", "scadenze"]) {
      expect(() => protetto.from(tabella)).not.toThrow()
    }
    expect(client.from).toHaveBeenCalledTimes(5)
  })

  it("non intralcia le altre proprieta' del client", () => {
    const client = clientFinto()
    expect(() => avvolgi(client).auth.getUser()).not.toThrow()
    expect(client.auth.getUser).toHaveBeenCalled()
  })
})

describe("perimetro MCP — utenti in sola lettura", () => {
  it("permette la select", () => {
    const client = clientFinto()
    expect(() => avvolgi(client).from("utenti").select("id,nome,email")).not.toThrow()
  })

  it.each(["insert", "update", "upsert", "delete"] as const)("nega %s", (metodo) => {
    const client = clientFinto()
    const builder = avvolgi(client).from("utenti") as unknown as Record<string, () => unknown>
    expect(() => builder[metodo]()).toThrow(ErrorePerimetroMcp)
  })

  it("assertTabellaLeggibile passa dove assertTabellaScrivibile blocca", () => {
    expect(() => assertTabellaLeggibile("utenti")).not.toThrow()
    expect(() => assertTabellaScrivibile("utenti")).toThrow(ErrorePerimetroMcp)
  })
})

describe("perimetro MCP — RPC in allowlist", () => {
  it("permette le funzioni elencate", () => {
    const client = clientFinto()
    expect(() => avvolgi(client).rpc("get_lead_stats")).not.toThrow()
  })

  // Il senso dell'allowlist: fra le RPC esistenti ci sono DDL sul database,
  // revoca sessioni e lettura di credenziali in chiaro. Con una denylist, una
  // RPC nuova nascerebbe permessa.
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
    expect(() => avvolgi(client).rpc(funzione)).toThrow(ErrorePerimetroMcp)
    expect(() => assertRpcConsentita(funzione)).toThrow(ErrorePerimetroMcp)
    expect(client.rpc).not.toHaveBeenCalled()
  })
})

describe("perimetro MCP — vie laterali", () => {
  it("nega il cambio di schema, che scavalcherebbe il controllo su from()", () => {
    const client = clientFinto()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (avvolgi(client) as any).schema("public")).toThrow(ErrorePerimetroMcp)
  })
})
