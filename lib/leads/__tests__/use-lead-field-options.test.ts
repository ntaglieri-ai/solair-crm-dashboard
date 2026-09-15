import { describe, expect, it, vi } from "vitest"
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { options: { meta_ad_name: [{ value: "Da webhook", label: "Da webhook" }] } } }) }))
vi.mock("@/lib/leads/field-options", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/leads/field-options")>()
  return { ...actual, LEAD_FIELD_OPTION_FALLBACKS: { ...actual.LEAD_FIELD_OPTION_FALLBACKS, meta_ad_name: undefined, meta_adset_name: undefined } }
})
import { useLeadFieldOptions } from "../use-lead-field-options"
describe("opzioni Lead con fallback assenti", () => {
  it("mantiene opzioni API e valore manuale senza bloccare la scheda", () => {
    const result = useLeadFieldOptions()
    expect(result.optionsFor("meta_ad_name", "Manuale").map(option => option.value)).toEqual(["Manuale", "Da webhook"])
    expect(result.optionsFor("meta_adset_name")).toEqual([])
  })
})
