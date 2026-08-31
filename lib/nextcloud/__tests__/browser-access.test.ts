import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveBrowserAccess } from "../browser-access"
import { createClient } from "@/lib/supabase/server"
import { getNextcloudAppPassword } from "../credentials"
import { canAccessNcPath, roleRequiresExplicitNcPathRule } from "../path-permissions"
import { providerPayload } from "../../../scripts/configure-nextcloud-session-switch.mjs"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("../credentials", () => ({ getNextcloudAppPassword: vi.fn() }))
vi.mock("../path-permissions", () => ({
  normalizeNcPath: (path: string) => path.replace(/^\/+/, ""),
  canAccessNcPath: vi.fn(), loadNcPathRules: vi.fn().mockResolvedValue([]),
  roleRequiresExplicitNcPathRule: vi.fn(),
}))
vi.mock("@/lib/permissions/load-permissions", () => ({
  loadCurrentPermissionSnapshot: vi.fn().mockResolvedValue({ subject: { ruoloCode: "ADMIN" } }),
}))
const getUser = vi.fn()
const maybeSingle = vi.fn()
beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "nando" } } })
  maybeSingle.mockResolvedValue({ data: { id: "crm-nando" } })
  const client = { auth: { getUser }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  vi.mocked(getNextcloudAppPassword).mockResolvedValue("test-app-password")
  vi.mocked(canAccessNcPath).mockReturnValue(true)
  vi.mocked(roleRequiresExplicitNcPathRule).mockReturnValue(false)
})

describe("browser access revalidation", () => {
  it("preserves the agent root restriction introduced on Mac", async () => {
    vi.mocked(roleRequiresExplicitNcPathRule).mockReturnValue(true)
    expect(await resolveBrowserAccess("", null)).toEqual({ userId: "nando", redirectPath: "/apps/files/" })
  })
  it("requires a live CRM identity", async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await resolveBrowserAccess("", null)).toEqual({ error: "/login" })
  })
  it("requires an existing CRM account and provisioned Nextcloud credentials", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null })
    expect(await resolveBrowserAccess("", null)).toEqual({ error: "/documenti?nc_error=no_account" })
    vi.mocked(getNextcloudAppPassword).mockResolvedValueOnce(null)
    expect(await resolveBrowserAccess("", null)).toEqual({ error: "/documenti?nc_error=not_provisioned" })
  })
  it("does not let a file ID bypass folder permissions", async () => {
    vi.mocked(canAccessNcPath).mockReturnValue(false)
    expect(await resolveBrowserAccess("Restricted/file", "123")).toEqual({ error: "/documenti?nc_error=path_denied" })
  })
  it("encodes folder query characters and preserves valid file deep links", async () => {
    const folder = await resolveBrowserAccess("Solair/A & B#è", "invalid")
    expect(new URL(folder.redirectPath!, "https://cloud.test").searchParams.get("dir")).toBe("/Solair/A & B#è")
    expect(await resolveBrowserAccess("Solair/file", "123")).toEqual({ userId: "nando", redirectPath: "/f/123" })
  })
  it("ignores bare file IDs without an authorized path", async () => {
    expect(await resolveBrowserAccess("", "123")).toEqual({ userId: "nando", redirectPath: "/apps/files/?dir=/Solair" })
  })
})

describe("provider update payload", () => {
  it("changes only callback fields and never sends back a masked client secret", () => {
    const provider = {
      id: 3, identifier: "solair-crm", clientId: "client-id", clientSecret: "***",
      discoveryEndpoint: "https://idp.test/discovery", scope: "openid email profile",
      settings: { mappingUid: "email", uniqueUid: "0" }, endSessionEndpoint: null,
      postLogoutUri: "https://crm.test/old",
    }
    const body = providerPayload(provider, "https://crm.test/api/auth/nextcloud/resume")
    expect(body.settings).toEqual(provider.settings)
    expect(body.scope).toBe(provider.scope)
    expect(body).not.toHaveProperty("clientSecret")
    expect(body.endSessionEndpoint).toBe("https://crm.test/api/auth/nextcloud/resume")
    expect(providerPayload(provider, undefined).endSessionEndpoint).toBeNull()
    expect(providerPayload(provider, undefined).postLogoutUri).toBe("https://crm.test/old")
  })
})
