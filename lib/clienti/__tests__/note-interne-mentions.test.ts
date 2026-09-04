import { beforeEach, describe, expect, it, vi } from "vitest"
const { admin, notify } = vi.hoisted(() => ({ admin: vi.fn(), notify: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: admin }))
vi.mock("@/lib/notes/mentions-server", () => ({ notifyMentionedUsers: notify, absoluteCrmUrl: (_r: Request, path: string) => `https://crm.example${path}` }))
import { canMentionInternalUser, internalMentionUsers, resolveInternalMentions, notifyInternalMentions } from "../note-interne-mentions-server"
import { notaInternaInput } from "../note-interne-input"

const id = "11111111-1111-4111-8111-111111111111"
const user = { id, nome: "Mario Rossi", email: "mario@example.test", attivo: true, auth_user_id: "auth", ruolo: "ADMIN", ruolo_id: "role" }
const base = { user, ui: [], actions: [], pages: [], records: [], ownerId: "other", teamOwner: false }
const mention = { userId: id, start: 2, end: 14, name: "Mario Rossi" }
function database(overrides: Record<string, unknown> = {}) {
  const tables: Record<string, unknown> = { clienti: { clienti_proprietario_id: "other" }, utenti: [user], ruoli: [], permessi_ui: [], permessi_azione: [], permessi_pagina: [], permessi_record: [], team_direttori: [], team_agenti: [], ...overrides }
  admin.mockReturnValue({ from: (table: string) => {
    const result = { data: tables[table], error: null }
    const query = { select: () => query, eq: () => query, or: () => query, maybeSingle: () => Promise.resolve(result), then: (cb: (value: unknown) => unknown) => Promise.resolve(result).then(cb) }
    return query
  } })
}
beforeEach(() => { vi.clearAllMocks(); database(); notify.mockResolvedValue(0) })

describe("internal mentions recipient permissions", () => {
  it("allows admin and superadmin with access", () => {
    expect(canMentionInternalUser(base)).toBe(true)
    expect(canMentionInternalUser({ ...base, user: { ...user, ruolo: "SUPERADMIN" } })).toBe(true)
  })
  it.each(["AGENT", "STANDARD", "CUSTOM"])("never allows %s even with a forged action grant", (ruolo) => {
    expect(canMentionInternalUser({ ...base, user: { ...user, ruolo }, actions: [{ azione: "clienti.note_interne.view", abilitato: true }] })).toBe(false)
  })
  it("rejects disabled, unlinked and custom-role accounts", () => {
    expect(canMentionInternalUser({ ...base, user: { ...user, attivo: false } })).toBe(false)
    expect(canMentionInternalUser({ ...base, user: { ...user, auth_user_id: null } })).toBe(false)
    expect(canMentionInternalUser({ ...base, role: { id: "role", code: "CUSTOM", nome: "Direzione" } })).toBe(false)
  })
  it("restricts directors to owned records or their team", () => {
    const director = { ...base, user: { ...user, ruolo: "DIRECTOR" } }
    expect(canMentionInternalUser(director)).toBe(false)
    expect(canMentionInternalUser({ ...director, ownerId: id })).toBe(true)
    expect(canMentionInternalUser({ ...director, teamOwner: true })).toBe(true)
    expect(canMentionInternalUser({ ...director, ownerId: null, teamOwner: true })).toBe(false)
  })
  it("honors action, page and record revocations", () => {
    expect(canMentionInternalUser({ ...base, actions: [{ azione: "clienti.note_interne.view", abilitato: false }] })).toBe(false)
    expect(canMentionInternalUser({ ...base, pages: [{ pagina: "clienti", accesso: "no_access" }] })).toBe(false)
    expect(canMentionInternalUser({ ...base, records: [{ modulo: "clienti", azione: "view", abilitato: false }] })).toBe(false)
  })
  it("honors configured scopes and rejects conflicting scopes", () => {
    const ui = [{ chiave: "scope:clienti:own", abilitato: true }]
    expect(canMentionInternalUser({ ...base, ui })).toBe(false)
    expect(canMentionInternalUser({ ...base, ui, ownerId: id })).toBe(true)
    expect(canMentionInternalUser({ ...base, ui: [...ui, { chiave: "scope:clienti:all", abilitato: true }] })).toBe(false)
  })
  it("does not expand director DB scope via legacy visibility", () => {
    expect(canMentionInternalUser({ ...base, user: { ...user, ruolo: "DIRECTOR" }, ui: [{ chiave: "visibilita_sedi", abilitato: true }] })).toBe(false)
  })
  it("fails closed without permission data", async () => {
    admin.mockReturnValue(null)
    await expect(internalMentionUsers("cliente")).rejects.toThrow()
  })
})

describe("internal mention validation and notifications", () => {
  it("preserves whitespace and resolves canonical names", async () => {
    const parsed = notaInternaInput.parse({ contenuto: "  @Mario Rossi  ", menzioni: [mention] })
    expect(parsed.contenuto).toBe("  @Mario Rossi  ")
    expect(await resolveInternalMentions("cliente", parsed.contenuto, parsed.menzioni!)).toEqual([mention])
  })
  it.each([null, { contenuto: 8 }, { contenuto: " " }, { contenuto: "x", menzioni: [null] }, { contenuto: "x", menzioni: [{ userId: id, start: 0.2, end: 1 }] }])("rejects malformed input %j", (input) => {
    expect(notaInternaInput.safeParse(input).success).toBe(false)
  })
  it("rejects inaccessible recipients and forged offsets", async () => {
    await expect(resolveInternalMentions("cliente", "other text", [mention])).rejects.toThrow()
    database({ utenti: [{ ...user, ruolo: "AGENT" }] })
    await expect(resolveInternalMentions("cliente", "  @Mario Rossi", [mention])).rejects.toThrow()
  })
  it("does not require admin configuration for notes without mentions", async () => {
    admin.mockReturnValue(null)
    expect(await resolveInternalMentions("cliente", "nota", [])).toEqual([])
  })
  const notification = { request: new Request("https://crm.example"), clienteId: "cliente", mentions: [mention], authorId: "author", authorName: "Autore" }
  it("sends only a generic notice and deduplicates mentions", async () => {
    expect(await notifyInternalMentions({ ...notification, mentions: [mention, mention] })).toBe(0)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0].recipients).toHaveLength(1)
    expect(notify.mock.calls[0][0].text).not.toContain("Mario Rossi")
    expect(notify.mock.calls[0][0].recordUrl).toContain("#section-note-interne")
  })
  it("does not re-notify existing mentions or the author", async () => {
    expect(await notifyInternalMentions({ ...notification, previous: [mention] })).toBe(0)
    expect(await notifyInternalMentions({ ...notification, authorId: id })).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })
  it("rechecks access before email and warns if revoked", async () => {
    database({ utenti: [{ ...user, attivo: false }] })
    expect(await notifyInternalMentions(notification)).toBe(1)
    expect(notify.mock.calls[0][0].recipients).toEqual([])
  })
  it("reports email failures without failing a saved note", async () => {
    notify.mockRejectedValue(new Error("SMTP"))
    expect(await notifyInternalMentions(notification)).toBe(1)
  })
})
