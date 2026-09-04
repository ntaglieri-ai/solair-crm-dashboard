import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), lead: { id: "lead", "Stato Lead": "Nuovo", "Account convertito": null as string | null }, denied: false }))
vi.mock("@/lib/leads/repository", () => ({ getFullLeadById: async () => mocks.lead }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => { throw new Error("Ancillary read unavailable") } }))
vi.mock("@/lib/clienti/tag-italia", () => ({ applicaTagItalia: vi.fn() }))
vi.mock("@/lib/permissions/server", () => ({ requireApiRecord: async () => ({ response: mocks.denied ? new Response(null, { status: 403 }) : null, permissions: { snapshot: {} } }) }))
vi.mock("@/lib/permissions/data-scope", () => ({ resolveOwnerScope: async () => ({ kind: "owners", ownerIds: ["owner"] }) }))
import { POST } from "@/app/api/leads/[id]/converti/route"
const run = () => POST(new Request("https://crm.example.test/api/leads/lead/converti", { method: "POST" }), { params: Promise.resolve({ id: "lead" }) })
beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: "client", error: null })
  mocks.denied = false; mocks.lead["Account convertito"] = null
})
describe("atomic conversion route", () => {
  it("uses one atomic RPC with server-resolved scopes, without requiring documents", async () => {
    const response = await run()
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ clienteId: "client" })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("crm_convert_lead_atomic", { p_lead_id: "lead", p_lead_owner_ids: ["owner"], p_cliente_owner_ids: ["owner"] })
  })
  it("does not call the database without CRUD permission", async () => {
    mocks.denied = true
    expect((await run()).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("rejects an already-converted lead", async () => {
    mocks.lead["Account convertito"] = "client"
    expect((await run()).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([["23505", 409], ["42501", 403], ["P0002", 404], ["PGRST202", 503]])("handles RPC error %s without unsafe fallback", async (code, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code } })
    expect((await run()).status).toBe(status)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
})
