import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ guard: vi.fn(), client: vi.fn(), resolve: vi.fn(), notify: vi.fn(), users: vi.fn() }))
vi.mock("@/lib/clienti/note-interne-guard", () => ({ requireApiNoteInterne: mocks.guard }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }))
vi.mock("@/lib/clienti/note-interne-mentions-server", () => ({ resolveInternalMentions: mocks.resolve, notifyInternalMentions: mocks.notify, internalMentionUsers: mocks.users }))
import { POST, GET } from "@/app/api/clienti/[id]/note-interne/route"
import { PATCH, DELETE } from "@/app/api/clienti/[id]/note-interne/[notaId]/route"
import { GET as mentionUsers } from "@/app/api/clienti/[id]/note-interne/mention-users/route"

const mention = { userId: "11111111-1111-4111-8111-111111111111", name: "Mario Rossi", start: 0, end: 12 }
const params = { params: Promise.resolve({ id: "cliente", notaId: "nota" }) }
const request = (body = { contenuto: "@Mario Rossi", menzioni: [mention] }) => new Request("https://crm.example/api/clienti/cliente/note-interne", { method: "POST", body: JSON.stringify(body) })
const saved = { id: "nota", contenuto: "@Mario Rossi", menzioni: [mention], creato_da: "author", creato_il: "2026-09-04", modificato_da: null, modificato_il: null }
let operations: Array<[string, unknown]>
function database(results: Array<{ data: unknown; error: unknown }>) {
  mocks.client.mockResolvedValue({ from: (table: string) => {
    operations.push(["from", table])
    const result = results.shift() ?? { data: [], error: null }
    const query = {
      select: (v: string) => { operations.push(["select", v]); return query },
      eq: (k: string, v: unknown) => { operations.push([k, v]); return query },
      is: (k: string, v: unknown) => { operations.push([k, v]); return query },
      in: () => query, order: () => query,
      insert: (v: unknown) => { operations.push(["insert", v]); return query },
      update: (v: unknown) => { operations.push(["update", v]); return query },
      single: () => Promise.resolve(result), maybeSingle: () => Promise.resolve(result),
      then: (cb: (value: unknown) => unknown) => Promise.resolve(result).then(cb),
    }
    return query
  } })
}
beforeEach(() => {
  vi.clearAllMocks(); operations = []
  mocks.guard.mockResolvedValue({ response: null, permissions: { snapshot: { subject: { userId: "author", nome: "Autore" } } } })
  mocks.resolve.mockResolvedValue([mention]); mocks.notify.mockResolvedValue(0); mocks.users.mockResolvedValue([])
})
describe("internal notes routes", () => {
  it("guards every endpoint before reads/writes/recipient lookup", async () => {
    mocks.guard.mockResolvedValue({ response: new Response("Not found", { status: 404 }) })
    for (const handler of [GET, POST, PATCH, DELETE, mentionUsers]) expect((await handler(request(), params)).status).toBe(404)
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.users).not.toHaveBeenCalled()
  })
  it("persists mentions only in the reserved table and returns them", async () => {
    database([{ data: saved, error: null }, { data: [{ id: "author", nome: "Autore" }], error: null }])
    const response = await POST(request(), params)
    expect(response.status).toBe(201)
    expect((await response.json()).menzioni).toEqual([mention])
    expect(operations).toContainEqual(["insert", { cliente_id: "cliente", contenuto: "@Mario Rossi", menzioni: [mention], creato_da: "author" }])
    expect(operations).not.toContainEqual(["from", "attivita"])
    expect(mocks.notify).toHaveBeenCalledTimes(1)
  })
  it("does not notify when writing fails", async () => {
    database([{ data: null, error: { message: "failed" } }])
    expect((await POST(request(), params)).status).toBe(500)
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it("rejects invalid recipients before inserting", async () => {
    mocks.resolve.mockRejectedValue(new Error("non autorizzato"))
    expect((await POST(request(), params)).status).toBe(400)
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it("keeps success if notification fails", async () => {
    database([{ data: saved, error: null }, { data: [], error: null }]); mocks.notify.mockResolvedValue(1)
    const response = await POST(request(), params)
    expect(response.status).toBe(201); expect((await response.json()).notificationFailures).toBe(1)
  })
  it("reads mentions back without notifying", async () => {
    database([{ data: [saved], error: null }, { data: [], error: null }])
    expect((await (await GET(request(), params)).json()).note[0].menzioni).toEqual([mention])
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it("patch passes previous recipients and uses a concurrency guard", async () => {
    database([{ data: saved, error: null }, { data: { id: "nota" }, error: null }])
    const response = await PATCH(request(), params)
    expect(response.status).toBe(200)
    expect(operations).toContainEqual(["modificato_il", null])
    expect(mocks.notify.mock.calls[0][0].previous).toEqual([mention])
  })
  it("does not send or claim success on a concurrent/deleted note", async () => {
    database([{ data: saved, error: null }, { data: null, error: null }])
    expect((await PATCH(request(), params)).status).toBe(409)
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it("does not lose mention metadata for old clients", async () => {
    database([{ data: saved, error: null }])
    const req = new Request("https://crm.example", { method: "PATCH", body: JSON.stringify({ contenuto: "testo cambiato" }) })
    expect((await PATCH(req, params)).status).toBe(409)
    expect(operations.some(([key]) => key === "update")).toBe(false)
  })
  it("returns 404 for a missing note before resolving recipients", async () => {
    database([{ data: null, error: null }])
    expect((await PATCH(request(), params)).status).toBe(404)
    expect(mocks.resolve).not.toHaveBeenCalled()
  })
  it("recipient endpoint exposes only id/name, not email or roles", async () => {
    mocks.users.mockResolvedValue([{ id: "u", nome: "Mario", email: "secret@example.test" }])
    const response = await mentionUsers(request(), params)
    expect(await response.json()).toEqual({ users: [{ id: "u", nome: "Mario" }] })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
