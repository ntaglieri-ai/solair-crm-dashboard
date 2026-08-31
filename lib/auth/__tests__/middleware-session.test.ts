import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"

const state = vi.hoisted(() => ({
  claims: true,
  updates: [] as { name: string; value: string; options: { path: string; maxAge?: number } }[],
}))
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => ({ auth: {
    getClaims: async () => {
      options.cookies.setAll(state.updates)
      return { data: { claims: state.claims ? { sub: "nando" } : null } }
    },
  } })),
}))
const origin = "https://crm.example.test"
function request(path: string, crmSession = true, flag = "0") {
  return new NextRequest(origin + path, { headers: { cookie:
    `sb-project-auth-token=old; scrm_mcp=${flag}; ${crmSession ? "scrm_session=1; scrm_last_activity=now" : ""}`,
  } })
}
beforeEach(() => {
  state.claims = true
  state.updates = [{ name: "sb-project-auth-token", value: "renewed", options: { path: "/" } }]
})
afterEach(() => vi.restoreAllMocks())

describe("authentication cookies survive middleware redirects", () => {
  it.each(["/login", "/nextcloud/login", "/nextcloud/login?redirect=%2Foauth%2Fconsent%3Fauthorization_id%3Dtest"])("preserves a renewal on %s", async (path) => {
    const response = await middleware(request(path))
    expect(response.status).toBe(307)
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe("renewed")
  })
  it("propagates deletions when a revoked refresh token redirects to login", async () => {
    state.claims = false
    state.updates = [{ name: "sb-project-auth-token", value: "", options: { path: "/", maxAge: 0 } }]
    const response = await middleware(request("/api/auth/nextcloud/open"))
    expect(new URL(response.headers.get("location")!).pathname).toBe("/nextcloud/login")
    expect(response.cookies.get("sb-project-auth-token")?.maxAge).toBe(0)
  })
  it("renders the dedicated login instead of looping when CRM cookies are missing", async () => {
    const response = await middleware(request("/nextcloud/login", false))
    expect(response.headers.get("location")).toBeNull()
    expect(response.cookies.get("sb-project-auth-token")?.maxAge).toBe(0)
  })
  it("CRM expiration wins over refreshed Supabase cookies", async () => {
    const response = await middleware(request("/oauth/consent?authorization_id=test", false))
    expect(response.status).toBe(307)
    expect(response.cookies.get("sb-project-auth-token")?.maxAge).toBe(0)
    expect(response.cookies.get("scrm_session")?.maxAge).toBe(0)
  })
  it("the writable OAuth handler cannot bypass an expired CRM session", async () => {
    const response = await middleware(request("/api/auth/nextcloud/authorize?authorization_id=test", false))
    expect(new URL(response.headers.get("location")!).pathname).toBe("/nextcloud/login")
    expect(response.cookies.get("sb-project-auth-token")?.maxAge).toBe(0)
  })
  it("allows missing Supabase sessions to reach OAuth recovery", async () => {
    state.claims = false
    expect((await middleware(request("/api/auth/nextcloud/authorize?authorization_id=test"))).headers.get("location")).toBeNull()
  })
  it("preserves renewal on the mandatory password-change redirect", async () => {
    const response = await middleware(request("/documenti", true, "1"))
    expect(new URL(response.headers.get("location")!).pathname).toBe("/cambia-password")
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe("renewed")
  })
})
