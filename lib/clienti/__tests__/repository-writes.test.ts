import { beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>, writes: [] as Record<string, unknown>[],
  accessible: true, canEditCustom: true, metadata: [] as Record<string, unknown>[], failWrite: false,
}))
vi.mock("@/lib/permissions/server", () => ({ getCurrentPermissions: async () => ({ canField: () => state.canEditCustom }) }))
vi.mock("@/lib/permissions/data-scope", () => ({
  filterCurrentAccessibleRecordIds: async () => state.accessible ? ["client"] : [],
  resolveCurrentOwnerScope: async () => ({ kind: "all" }), applyOwnerScope: (q: unknown) => q,
}))
vi.mock("@/lib/clienti/tag-italia", () => ({ applicaTagItalia: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (table: string) => {
  let update: Record<string, unknown> | undefined
  const result = () => {
    if (table === "crm_custom_fields") return { data: state.metadata, error: null }
    if (table === "installatori") return { data: { id: "00000000-0000-4000-8000-000000000011", nome: "Canonical installer", attivo: true }, error: null }
    if (update && state.failWrite) return { data: null, error: { message: "Rejected by database" } }
    if (update) { state.writes.push(update); state.row = { ...state.row, ...update } }
    return { data: state.row, error: null }
  }
  const query = {
    select: () => query, eq: () => query, is: () => query, order: () => query,
    update: (patch: Record<string, unknown>) => { update = patch; return query },
    single: async () => result(), maybeSingle: async () => result(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  }
  return query
} }) }))
import { updateClienteRecord } from "../repository"

beforeEach(() => {
  state.row = { id: "client", nome_clienti: "Test", data_sopralluogo: "2026-09-04", updated_at: "2026-09-04" }
  state.writes = []; state.accessible = true; state.canEditCustom = true; state.failWrite = false
  state.metadata = [{ field_key: "extra", column_name: "extra", tipo: "number", label: "Extra", required: false, options: [] }]
})

describe("client persistence", () => {
  it("persists survey date, clearing and modification timestamp", async () => {
    await updateClienteRecord("client", { "Data sopralluogo": "2026-09-15" })
    expect(state.row.data_sopralluogo).toBe("2026-09-15")
    expect(state.row.ora_modifica).toBe(state.row.updated_at)
    await updateClienteRecord("client", { "Data sopralluogo": null })
    expect(state.row.data_sopralluogo).toBeNull()
  })
  it("rejects invalid dates before any database write", async () => {
    const error = vi.fn()
    expect(await updateClienteRecord("client", { "Data sopralluogo": "2026-02-31" }, error)).toBeNull()
    expect(error).toHaveBeenCalledWith("Data sopralluogo: data non valida")
    expect(state.writes).toHaveLength(0)
  })
  it("does not mutate records outside the user's scope", async () => {
    state.accessible = false
    expect(await updateClienteRecord("client", { Nome: "Denied" })).toBeNull()
    expect(state.writes).toHaveLength(0)
  })
  it("persists custom values and returns their reread values", async () => {
    const result = await updateClienteRecord("client", { "custom:extra": 42 } as never)
    expect(state.row.extra).toBe(42)
    expect(result?.customFields?.[0].value).toBe(42)
  })
  it("rejects unauthorized and invented custom fields atomically", async () => {
    state.canEditCustom = false
    expect(await updateClienteRecord("client", { Nome: "Not saved", "custom:extra": 42 } as never)).toBeNull()
    state.canEditCustom = true
    expect(await updateClienteRecord("client", { "custom:unknown": 42 } as never)).toBeNull()
    expect(state.writes).toHaveLength(0)
  })
  it("uses the canonical installer name, not a forged client-side label", async () => {
    await updateClienteRecord("client", { InstallatoreId: "00000000-0000-4000-8000-000000000011", Installatore: "Forged" })
    expect(state.row.installatore).toBe("Canonical installer")
    await updateClienteRecord("client", { InstallatoreId: null })
    expect(state.row.installatore).toBeNull()
    expect(state.row.installatore_id).toBeNull()
  })
  it("keeps an empty imported client status empty instead of inventing a default", async () => {
    state.row.stato = null
    const result = await updateClienteRecord("client", { Nome: "Test" })
    expect(result?.Stato).toBe("")
  })
  it("surfaces database errors without reporting success", async () => {
    state.failWrite = true
    const error = vi.fn()
    expect(await updateClienteRecord("client", { Nome: "Test" }, error)).toBeNull()
    expect(error).toHaveBeenCalledWith("Rejected by database")
    expect(state.writes).toHaveLength(0)
  })
})
