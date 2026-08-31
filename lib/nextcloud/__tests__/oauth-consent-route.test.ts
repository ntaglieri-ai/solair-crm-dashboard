import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/auth/nextcloud/authorize/route"
import { sealSwitchState, SWITCH_COOKIE } from "../session-switch"

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  oauth: { getAuthorizationDetails: vi.fn(), approveAuthorization: vi.fn() },
}))
const adapter = vi.hoisted(() => ({ setAll: vi.fn() }))
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => {
    adapter.setAll = options.cookies.setAll
    return { auth }
  }),
}))
const origin = "https://crm.example.test"
const callback = "https://cloud.example.test/apps/user_oidc/code?code=test-code"
const missing = { name: "AuthSessionMissingError", message: "Auth session missing!" }
function request(extraCookie = "", query = "?authorization_id=test-authorization") {
  return new NextRequest(origin + "/api/auth/nextcloud/authorize" + query, {
    headers: { cookie: `sb-project-auth-token.0=old; sb-project-auth-token.1=old-chunk; scrm_session=1; ${extraCookie}` },
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key")
  vi.stubEnv("SUPABASE_OAUTH_NEXTCLOUD_CLIENT_ID", "nextcloud")
  vi.stubEnv("NEXTCLOUD_URL", "https://cloud.example.test")
  vi.stubEnv("NEXTCLOUD_CRED_ENC_KEY", "test-signing-key")
  vi.spyOn(console, "warn").mockImplementation(() => {})
  auth.getUser.mockResolvedValue({ data: { user: { id: "nando" } }, error: null })
  auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: { client: { id: "nextcloud" } }, error: null })
  auth.oauth.approveAuthorization.mockResolvedValue({ data: { redirect_url: callback }, error: null })
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe("Nextcloud OAuth consent recovery", () => {
  it("approves a healthy session without a second login and persists rotated cookies", async () => {
    auth.getUser.mockImplementation(async () => {
      adapter.setAll([
        { name: "sb-project-auth-token.0", value: "renewed", options: { path: "/", sameSite: "lax" } },
        { name: "sb-project-auth-token.1", value: "", options: { path: "/", maxAge: 0 } },
      ])
      return { data: { user: { id: "nando" } }, error: null }
    })
    const response = await GET(request())
    expect(response.headers.get("location")).toBe(callback)
    expect(response.cookies.get("sb-project-auth-token.0")?.value).toBe("renewed")
    expect(response.cookies.get("sb-project-auth-token.1")?.maxAge).toBe(0)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
  })
  it.each(["user", "details", "approve"])("recovers a missing session at %s without global logout", async (stage) => {
    if (stage === "user") auth.getUser.mockResolvedValue({ data: { user: null }, error: missing })
    if (stage === "details") auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: null, error: missing })
    if (stage === "approve") auth.oauth.approveAuthorization.mockResolvedValue({ data: null, error: missing })
    const state = sealSwitchState("nando", "Solair/file.pdf", "123")
    const response = await GET(request(`${SWITCH_COOKIE}=${state}`))
    const login = new URL(response.headers.get("location")!)
    expect(login.pathname).toBe("/nextcloud/login")
    expect(login.searchParams.get("sessione_scaduta")).toBe("1")
    expect(login.searchParams.get("redirect")).toBe("/api/auth/nextcloud/open?path=Solair%2Ffile.pdf&fileid=123")
    expect(response.cookies.get("sb-project-auth-token.0")?.maxAge).toBe(0)
    expect(response.cookies.get("sb-project-auth-token.1")?.maxAge).toBe(0)
    expect(response.cookies.get("scrm_session")?.maxAge).toBe(0)
    expect(response.cookies.get(SWITCH_COOKIE)?.maxAge).toBe(0)
  })
  it("recovers a rejected refresh token, including when approval rejects a valid-looking JWT", async () => {
    auth.oauth.approveAuthorization.mockResolvedValue({ data: null, error: { name: "AuthApiError", code: "refresh_token_not_found", status: 400 } })
    const response = await GET(request())
    expect(new URL(response.headers.get("location")!).pathname).toBe("/nextcloud/login")
  })
  it("does not approve Roberta's pending switch with Nando's current session", async () => {
    const response = await GET(request(`${SWITCH_COOKIE}=${sealSwitchState("roberta", "Solair", null)}`))
    expect(response.headers.get("location")).toBe(origin + "/documenti?nc_error=session_switch_changed")
    expect(auth.oauth.getAuthorizationDetails).not.toHaveBeenCalled()
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled()
    expect(response.cookies.get("sb-project-auth-token.0")).toBeUndefined()
  })
  it("rejects an expired pending switch", async () => {
    const response = await GET(request(`${SWITCH_COOKIE}=${sealSwitchState("nando", "Solair", null, Date.now() - 300000)}`))
    expect(response.headers.get("location")).toBe(origin + "/documenti?nc_error=session_switch_expired")
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled()
  })
  it("does not erase a session on a transient authentication outage", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 503 } })
    const response = await GET(request())
    expect(response.headers.get("location")).toBe(origin + "/oauth/consent?error=unavailable")
    expect(response.headers.has("set-cookie")).toBe(false)
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled()
  })
  it("rejects an unapproved client", async () => {
    auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: { client: { id: "other" } }, error: null })
    expect((await GET(request())).headers.get("location")).toBe(origin + "/oauth/consent?error=client")
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled()
  })
  it("does not turn an invalid authorization into an endless login loop", async () => {
    auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: null, error: { code: "validation_failed" } })
    const response = await GET(request())
    expect(response.headers.get("location")).toBe(origin + "/oauth/consent?error=request")
    expect(response.headers.has("set-cookie")).toBe(false)
  })
  it("handles prior consent, but blocks a redirect outside Nextcloud", async () => {
    auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: callback }, error: null })
    expect((await GET(request())).headers.get("location")).toBe(callback)
    expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled()
    auth.oauth.getAuthorizationDetails.mockResolvedValue({ data: { redirect_url: "https://evil.test" }, error: null })
    expect((await GET(request())).headers.get("location")).toBe(origin + "/oauth/consent?error=client")
  })
  it("requires an authorization ID and configured client", async () => {
    expect((await GET(request("", ""))).headers.get("location")).toBe(origin + "/oauth/consent?error=request")
    vi.stubEnv("SUPABASE_OAUTH_NEXTCLOUD_CLIENT_ID", "")
    expect((await GET(request())).headers.get("location")).toBe(origin + "/oauth/consent?error=client")
    expect(auth.getUser).not.toHaveBeenCalled()
  })
})
