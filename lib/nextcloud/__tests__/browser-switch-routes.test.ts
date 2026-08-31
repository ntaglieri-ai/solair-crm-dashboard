import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { resolveBrowserAccess } from "../browser-access"
import { assertSwitchProviderReady, sealSwitchState, SWITCH_COOKIE } from "../session-switch"
import { GET as open } from "@/app/api/auth/nextcloud/open/route"
import { GET as resume, HEAD as probe } from "@/app/api/auth/nextcloud/resume/route"

vi.mock("../browser-access", () => ({ resolveBrowserAccess: vi.fn() }))
vi.mock("../session-switch", async (importOriginal) => ({
  ...await importOriginal<typeof import("../session-switch")>(), assertSwitchProviderReady: vi.fn(),
}))
const access = vi.mocked(resolveBrowserAccess)
const ready = vi.mocked(assertSwitchProviderReady)
const origin = "https://crm.example.test"
function request(path: string, state?: string) {
  return new NextRequest(origin + path, state ? { headers: { cookie: `${SWITCH_COOKIE}=${state}` } } : undefined)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("NEXTCLOUD_URL", "https://cloud.example.test")
  vi.stubEnv("NEXTCLOUD_OIDC_LOGIN_URL", "https://cloud.example.test/apps/user_oidc/login/3")
  vi.stubEnv("NEXTCLOUD_CRED_ENC_KEY", "test-only-signing-key")
  access.mockResolvedValue({ userId: "nando", redirectPath: "/f/123" })
  ready.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe("Nextcloud browser handoff", () => {
  it("goes through logout before opening the requested file, then consumes state", async () => {
    const start = await open(request("/api/auth/nextcloud/open?path=Solair%2Ffile.pdf&fileid=123"))
    expect(new URL(start.headers.get("location")!).searchParams.get("redirectUrl")).toBe("/apps/user_oidc/sls")
    expect(start.headers.get("cache-control")).toBe("no-store")
    const cookie = start.cookies.get(SWITCH_COOKIE)!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe("lax")
    const finish = await resume(request("/api/auth/nextcloud/resume?post_logout_redirect_uri=https://evil.test", cookie.value))
    expect(new URL(finish.headers.get("location")!).searchParams.get("redirectUrl")).toBe("/f/123")
    expect(finish.cookies.get(SWITCH_COOKIE)?.maxAge).toBe(0)
    expect(access).toHaveBeenLastCalledWith("Solair/file.pdf", "123")
    expect(finish.headers.get("set-cookie")).not.toContain("sb-")
  })
  it("does not reuse Roberta's pending request after a CRM account change", async () => {
    const state = sealSwitchState("roberta", "Solair", null)
    const response = await resume(request("/api/auth/nextcloud/resume", state))
    expect(response.headers.get("location")).toBe(origin + "/documenti?nc_error=session_switch_changed")
    expect(response.cookies.get(SWITCH_COOKIE)?.maxAge).toBe(0)
  })
  it("does not auto-login after an ordinary logout or callback replay", async () => {
    const response = await resume(request("/api/auth/nextcloud/resume?redirectUrl=https://evil.test"))
    expect(response.headers.get("location")).toBe(origin + "/documenti")
    expect(access).not.toHaveBeenCalled()
  })
  it("rejects an expired switch", async () => {
    const state = sealSwitchState("nando", "Solair", null, Date.now() - 300000)
    expect((await resume(request("/api/auth/nextcloud/resume", state))).headers.get("location"))
      .toBe(origin + "/documenti?nc_error=session_switch_expired")
  })
  it.each(["/login", "/documenti?nc_error=not_provisioned", "/documenti?nc_error=path_denied"] as const)("revalidates access on return: %s", async (error) => {
    access.mockResolvedValue({ error })
    const response = await resume(request("/api/auth/nextcloud/resume", sealSwitchState("nando", "Solair", null)))
    expect(response.headers.get("location")).toBe(origin + error)
  })
  it("does not leave the CRM when provider configuration is missing", async () => {
    ready.mockRejectedValue(new Error("unavailable"))
    const response = await open(request("/api/auth/nextcloud/open"))
    expect(response.headers.get("location")).toBe(origin + "/documenti?nc_error=session_switch_unavailable")
  })
  it("does not contact the provider if unauthenticated", async () => {
    access.mockResolvedValue({ error: "/login" })
    const location = new URL((await open(request("/api/auth/nextcloud/open?path=Solair"))).headers.get("location")!)
    expect(location.pathname).toBe("/nextcloud/login")
    expect(location.searchParams.get("redirect")).toBe("/api/auth/nextcloud/open?path=Solair")
    expect(ready).not.toHaveBeenCalled()
  })
  it("exposes a read-only readiness probe", async () => {
    const response = await probe()
    expect(response.status).toBe(204)
    expect(response.headers.get("X-Nextcloud-Session-Switch")).toBe("v1")
    expect(response.headers.has("set-cookie")).toBe(false)
    expect(access).not.toHaveBeenCalled()
  })
})
