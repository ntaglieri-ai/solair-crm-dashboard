import { afterEach, describe, expect, it, vi } from "vitest"
import { nextcloudProvisioningConfig } from "../config"
import { nextcloudGroupForRole } from "../provisioning"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("nextcloudGroupForRole", () => {
  it.each([
    ["SUPERADMIN", "solair-superadmin"],
    ["ADMIN", "solair-admin"],
    ["DIRECTOR", "solair-director"],
    ["STANDARD", "solair-standard"],
    ["AGENT", "solair-agent"],
  ])("mappa %s sul gruppo %s", (role, group) => {
    expect(nextcloudGroupForRole(role)).toBe(group)
  })

  it("rifiuta un ruolo che non ha un gruppo gestito", () => {
    expect(nextcloudGroupForRole("UNKNOWN")).toBeNull()
  })
})

describe("nextcloudProvisioningConfig", () => {
  it("preferisce la credenziale primaria dedicata", () => {
    vi.stubEnv("NEXTCLOUD_URL", "https://cloud.example.test/")
    vi.stubEnv("NEXTCLOUD_ADMIN_USER", "legacy")
    vi.stubEnv("NEXTCLOUD_ADMIN_PASSWORD", "legacy-password")
    vi.stubEnv("NEXTCLOUD_PROVISIONING_USER", "provisioner")
    vi.stubEnv("NEXTCLOUD_PROVISIONING_PASSWORD", "primary-password")

    expect(nextcloudProvisioningConfig()).toEqual({
      baseUrl: "https://cloud.example.test",
      adminUser: "provisioner",
      adminPassword: "primary-password",
    })
  })

  it("mantiene il fallback per gli ambienti esistenti", () => {
    vi.stubEnv("NEXTCLOUD_URL", "https://cloud.example.test")
    vi.stubEnv("NEXTCLOUD_ADMIN_USER", "legacy")
    vi.stubEnv("NEXTCLOUD_ADMIN_PASSWORD", "legacy-password")
    vi.stubEnv("NEXTCLOUD_PROVISIONING_USER", "")
    vi.stubEnv("NEXTCLOUD_PROVISIONING_PASSWORD", "")

    expect(nextcloudProvisioningConfig()).toEqual({
      baseUrl: "https://cloud.example.test",
      adminUser: "legacy",
      adminPassword: "legacy-password",
    })
  })
})
