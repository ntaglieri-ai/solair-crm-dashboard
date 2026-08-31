import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { clearCrmSessionCookies, NEXTCLOUD_SWITCH_COOKIE, NEXTCLOUD_SWITCH_COOKIE_PATH } from "@/lib/auth/session-policy"
import {
  assertSwitchProviderReady, oidcLoginUrl, readSwitchState, sealSwitchState, SWITCH_TTL,
} from "../session-switch"

beforeEach(() => {
  vi.stubEnv("NEXTCLOUD_URL", "https://cloud.example.test")
  vi.stubEnv("NEXTCLOUD_OIDC_LOGIN_URL", "https://cloud.example.test/apps/user_oidc/login/3")
  vi.stubEnv("NEXTCLOUD_CRED_ENC_KEY", "test-only-signing-key")
  vi.stubEnv("NEXTCLOUD_ADMIN_USER", "admin")
  vi.stubEnv("NEXTCLOUD_ADMIN_PASSWORD", "test-only-password")
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("switch state", () => {
  it("cancels a pending handoff on CRM logout or expiration", () => {
    const response = NextResponse.json({ ok: true })
    clearCrmSessionCookies(response)
    expect(response.cookies.get(NEXTCLOUD_SWITCH_COOKIE)).toMatchObject({ maxAge: 0, path: NEXTCLOUD_SWITCH_COOKIE_PATH })
  })
  it("preserves identity, folder and file without exposing credentials", () => {
    const token = sealSwitchState("nando", "Solair/A & B/è.pdf", "123", 1000)
    expect(readSwitchState(token, 1001)).toEqual({
      userId: "nando", path: "Solair/A & B/è.pdf", fileId: "123", expires: 1000 + SWITCH_TTL * 1000,
    })
    expect(token).not.toContain("test-only")
  })
  it("rejects modified, malformed, missing and expired cookies", () => {
    const token = sealSwitchState("nando", "Solair", null, 1000)
    for (const invalid of [undefined, "", "broken", `${token}x`, `${token}.x`]) {
      expect(readSwitchState(invalid, 1001)).toBeNull()
    }
    const [payload, signature] = token.split(".")
    const forged = Buffer.from(Buffer.from(payload, "base64url").toString().replace("nando", "roberta")).toString("base64url")
    expect(readSwitchState(`${forged}.${signature}`, 1001)).toBeNull()
    expect(readSwitchState(token, 1000 + SWITCH_TTL * 1000)).toBeNull()
  })
  it("rejects oversized paths before setting a browser cookie", () => {
    expect(() => sealSwitchState("nando", "x".repeat(4000), null)).toThrow()
  })
})

describe("OIDC destination", () => {
  it("uses camelCase redirectUrl and preserves encoded folder characters", () => {
    const target = "/apps/files/?dir=%2FSolair%2FA+%26+B"
    expect(oidcLoginUrl(target).searchParams.get("redirectUrl")).toBe(target)
  })
  it.each(["https://evil.test/apps/user_oidc/login/3", "http://cloud.example.test/apps/user_oidc/login/3", "https://cloud.example.test/login", "https://user:pass@cloud.example.test/apps/user_oidc/login/3"])("rejects unsafe configured login %s", (url) => {
    vi.stubEnv("NEXTCLOUD_OIDC_LOGIN_URL", url)
    expect(() => oidcLoginUrl("/")).toThrow()
  })
})

describe("provider readiness", () => {
  const callback = "https://crm.example.test/api/auth/nextcloud/resume"
  it("accepts only the matching provider and both exact callback URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ocs: { data: [{ id: 3, endSessionEndpoint: callback, postLogoutUri: callback }] } }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(assertSwitchProviderReady("https://crm.example.test")).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" })
  })
  it.each([
    { id: 3, endSessionEndpoint: null, postLogoutUri: callback },
    { id: 4, endSessionEndpoint: callback, postLogoutUri: callback },
    { id: 3, endSessionEndpoint: callback, postLogoutUri: "https://evil.test" },
  ])("fails closed for incomplete or mismatched settings", async (provider) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ocs: { data: [provider] } })))
    await expect(assertSwitchProviderReady("https://crm.example.test")).rejects.toThrow()
  })
  it("fails closed on API denial", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })))
    await expect(assertSwitchProviderReady("https://crm.example.test")).rejects.toThrow()
  })
})
