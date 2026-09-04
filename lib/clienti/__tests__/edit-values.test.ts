import { describe, expect, it, vi } from "vitest"
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { initialEditValue, outgoingEditValue, buildClienteEditFields } from "@/components/shared/edit-record-dialog"
import type { ClienteRecord } from "@/lib/mock-data"
import type { PermissionEngine } from "@/lib/permissions/types"

describe("client edit values", () => {
  const date = { key: "Data sopralluogo", label: "Data sopralluogo", type: "date" as const, value: "2026-09-04T00:00:00+00:00" }
  it("keeps survey calendar day and sends null when cleared", () => {
    expect(initialEditValue(date)).toBe("2026-09-04")
    expect(outgoingEditValue(date, "2026-09-05")).toBe("2026-09-05")
    expect(outgoingEditValue(date, "")).toBeNull()
  })
  it("does not silently turn invalid numbers into deletion", () => {
    expect(() => outgoingEditValue({ ...date, type: "number" }, "bad")).toThrow()
    expect(outgoingEditValue({ ...date, type: "number" }, "0")).toBe(0)
  })
  it("exposes only authorized custom fields and uses real installer ids", () => {
    const cliente = { Installatore: "Storico", customFields: [
      { key: "extra", column: "extra", label: "Extra", tipo: "number", value: 12 },
      { key: "secret", column: "secret", label: "Secret", tipo: "text", value: "hidden" },
    ] } as ClienteRecord
    const permissions = { canField: (_module: string, column: string) => column !== "secret" } as PermissionEngine
    const fields = buildClienteEditFields(cliente, permissions, [{ id: "real-id", nome: "Reale" }])
    expect(fields.find((f) => f.key === "custom:extra")?.value).toBe(12)
    expect(fields.some((f) => f.key === "custom:secret")).toBe(false)
    expect(fields.find((f) => f.key === "InstallatoreId")?.options).toEqual(["real-id", "__legacy_installer__"])
    expect(fields.some((f) => f.key === "Ora modifica")).toBe(false)
  })
})
