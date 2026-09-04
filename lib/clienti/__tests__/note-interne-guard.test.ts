import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ permissions: vi.fn(), scope: vi.fn() }))
vi.mock("@/lib/permissions/server", () => ({ getCurrentPermissions: mocks.permissions }))
vi.mock("@/lib/permissions/data-scope", () => ({ canAccessOwnedRecord: mocks.scope }))
import { requireApiNoteInterne } from "../note-interne-guard"
beforeEach(() => { vi.clearAllMocks(); mocks.scope.mockResolvedValue(true) })
describe("internal note guard", () => {
  it.each(["SUPERADMIN", "ADMIN", "DIRECTOR"])("allows %s with action and record access", async (ruoloCode) => {
    mocks.permissions.mockResolvedValue({ snapshot: { subject: { ruoloCode } }, canAction: () => true })
    expect((await requireApiNoteInterne("cliente")).response).toBeNull()
  })
  it("never enables an AGENT through a custom action grant", async () => {
    mocks.permissions.mockResolvedValue({ snapshot: { subject: { ruoloCode: "AGENT" } }, canAction: () => true })
    expect((await requireApiNoteInterne("cliente")).response?.status).toBe(404)
  })
  it("hides records outside the scope", async () => {
    mocks.permissions.mockResolvedValue({ snapshot: { subject: { ruoloCode: "DIRECTOR" } }, canAction: () => true })
    mocks.scope.mockResolvedValue(false)
    expect((await requireApiNoteInterne("cliente")).response?.status).toBe(404)
  })
  it("honors action revocation", async () => {
    mocks.permissions.mockResolvedValue({ snapshot: { subject: { ruoloCode: "ADMIN" } }, canAction: () => false })
    expect((await requireApiNoteInterne("cliente")).response?.status).toBe(404)
  })
})
