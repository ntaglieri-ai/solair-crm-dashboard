import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/permissions/server", () => ({ requireApiRecord: async () => ({ response: null }) }))
vi.mock("@/lib/clienti/repository", () => ({
  queryClienti: async () => ({ rows: [], total: 0, page: 1, pageSize: 50 }),
  createClienteRecord: vi.fn(),
}))
vi.mock("@/lib/allegati/provisioning", () => ({ provisionaCartellaRecord: vi.fn() }))
import { GET } from "../route"

describe("GET /api/clienti", () => {
  it("non permette di riusare una lista vecchia dopo una modifica", async () => {
    const response = await GET(new Request("http://localhost/api/clienti"))
    const cacheControl = response.headers.get("Cache-Control") ?? ""
    expect(cacheControl).toContain("no-store")
    expect(cacheControl).not.toContain("stale-while-revalidate")
    expect(cacheControl).not.toContain("s-maxage")
  })
})
