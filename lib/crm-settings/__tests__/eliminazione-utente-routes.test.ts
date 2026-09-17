import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Le due regole che non devono poter saltare, verificate sui route handler e
 * non solo sulla UI: la riassegnazione e' obbligatoria, e la cancellazione
 * fisica non esiste senza il passaggio 1.
 */

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  admin: vi.fn(),
  rpc: vi.fn(),
  utente: vi.fn(),
  revocaToken: vi.fn(),
}))

// after(): il lavoro in background (sessioni, ban Auth, Nextcloud) non fa parte
// del contratto sincrono che stiamo verificando, e fuori da una request Next
// non ha uno scope in cui girare.
vi.mock("next/server", async (importOriginal) => {
  const reale = await importOriginal<typeof import("next/server")>()
  return { ...reale, after: () => undefined }
})
vi.mock("@/lib/permissions/server", () => ({ requireApiAction: mocks.guard }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), attoreDaPermessi: () => ({ id: null, nome: null }) }))
vi.mock("@/lib/permissions/load-permissions", () => ({ invalidatePermissionSnapshotCache: vi.fn() }))
vi.mock("@/lib/nextcloud/credentials", () => ({
  getNextcloudUsername: vi.fn().mockResolvedValue(null),
  storeNextcloudCredential: vi.fn(),
  getNextcloudCredentialStatuses: vi.fn(),
}))
vi.mock("@/lib/nextcloud/config", () => ({ nextcloudUsernameFromEmail: (email: string) => email }))
vi.mock("@/lib/nextcloud/provisioning", () => ({
  deleteNextcloudUser: vi.fn(),
  setNextcloudUserEnabled: vi.fn(),
  syncNextcloudUserGroup: vi.fn(),
}))
vi.mock("@/lib/mcp/oauth/archivio", () => ({ revocaRefreshPerUtente: mocks.revocaToken }))

import { POST } from "@/app/api/crm-settings/utenti/[id]/eliminazione/route"
import { DELETE } from "@/app/api/crm-settings/utenti/[id]/route"

const UTENTE = "11111111-1111-4111-8111-111111111111"
const DESTINATARIO = "22222222-2222-4222-8222-222222222222"
const params = { params: Promise.resolve({ id: UTENTE }) }

function richiesta(body: unknown) {
  return new Request("https://crm.example/api/crm-settings/utenti/x/eliminazione", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.guard.mockResolvedValue({ response: null, permissions: { snapshot: {} } })
  mocks.revocaToken.mockResolvedValue(0)
  mocks.utente.mockReturnValue({ data: { id: UTENTE, nome: "Agente", email: "a@x.it", auth_user_id: null, eliminato_il: null }, error: null })
  mocks.rpc.mockResolvedValue({ data: {}, error: null })
  mocks.admin.mockReturnValue({
    rpc: mocks.rpc,
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: () => Promise.resolve(mocks.utente()),
      }
      return query
    },
    auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: null }) } },
  })
})

describe("passaggio 1 — riassegnazione obbligatoria", () => {
  it("rifiuta la richiesta senza destinatario, senza toccare il database", async () => {
    const res = await POST(richiesta({}), params)
    expect(res.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("rifiuta un destinatario uguale all'utente da eliminare", async () => {
    const res = await POST(richiesta({ destinatarioId: UTENTE }), params)
    expect(res.status).toBe(400)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("riassegna e disattiva in una sola chiamata atomica", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        utente: { id: UTENTE, nome: "Agente", email: "a@x.it" },
        destinatario: { id: DESTINATARIO, nome: "Collega", email: "c@x.it" },
        spostati: { leads: 3, clienti: 1, compiti: 0, scadenze: 0, installatori: 0, regole_assegnazione: 0 },
      },
      error: null,
    })
    const res = await POST(richiesta({ destinatarioId: DESTINATARIO }), params)
    expect(res.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("crm_riassegna_e_disattiva_utente", {
      p_da: UTENTE,
      p_a: DESTINATARIO,
    })
    await expect(res.json()).resolves.toMatchObject({ esito: { spostati: { leads: 3, clienti: 1 } } })
  })

  it("non procede se il permesso manca", async () => {
    mocks.guard.mockResolvedValue({ response: new Response("no", { status: 403 }) })
    const res = await POST(richiesta({ destinatarioId: DESTINATARIO }), params)
    expect(res.status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe("passaggio 2 — cancellazione definitiva", () => {
  it("rifiuta un utente che non e' passato dalla riassegnazione", async () => {
    const res = await DELETE(new Request("https://crm.example/x", { method: "DELETE" }), params)
    expect(res.status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("Prima riassegna i record"),
    })
  })

  it("cancella l'utente gia' eliminato al passaggio 1", async () => {
    mocks.utente.mockReturnValue({
      data: { nome: "Agente", email: "a@x.it", auth_user_id: null, eliminato_il: "2026-09-16T10:00:00Z" },
      error: null,
    })
    mocks.rpc.mockResolvedValue({
      data: {
        utente: { id: UTENTE, nome: "Agente", email: "a@x.it", auth_user_id: null },
        sganciati: { note: 12, documenti: 0, caselle_condivise: 0, log_mcp: 0 },
        eliminati: { caselle_personali: 1, token_mcp: 2, codici_oauth_mcp: 0, eventi_calendario: 0 },
      },
      error: null,
    })
    const res = await DELETE(new Request("https://crm.example/x", { method: "DELETE" }), params)
    expect(res.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("crm_purga_utente", { p_utente: UTENTE })
    await expect(res.json()).resolves.toMatchObject({ ok: true, esito: { sganciati: { note: 12 } } })
  })
})
