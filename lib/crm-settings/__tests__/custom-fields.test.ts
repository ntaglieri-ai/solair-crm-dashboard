import { describe, expect, it } from "vitest"
import { buildCustomPatch, validateCustomValue, validDate } from "../custom-fields"

const field = { field_key: "potenza_extra", column_name: "potenza_extra", label: "Potenza extra", tipo: "number", required: false, options: [] }

describe("custom client fields", () => {
  it("only maps metadata-backed custom keys", () => {
    expect(buildCustomPatch({ "custom:potenza_extra": 12.5, nome: "Ignored" }, [field], () => true)).toEqual({ potenza_extra: 12.5 })
  })
  it("rejects unknown, deleted/hidden (not returned), unauthorized and injected columns", () => {
    expect(() => buildCustomPatch({ "custom:missing": 1 }, [field], () => true)).toThrow()
    expect(() => buildCustomPatch({ "custom:potenza_extra": 1 }, [], () => true)).toThrow()
    expect(() => buildCustomPatch({ "custom:potenza_extra": 1 }, [field], () => false)).toThrow()
    expect(() => buildCustomPatch({ "custom:potenza_extra": 1 }, [{ ...field, column_name: "id,nome" }], () => true)).toThrow()
  })
  it("accepts clearing optional fields but rejects clearing required fields", () => {
    expect(validateCustomValue(field, null)).toBeNull()
    expect(() => validateCustomValue({ ...field, required: true }, null)).toThrow("obbligatorio")
    expect(validateCustomValue({ ...field, required: true }, 0)).toBe(0)
    expect(validateCustomValue({ ...field, tipo: "boolean", required: true }, false)).toBe(false)
  })
  it("rejects coercion, NaN and infinity", () => {
    for (const value of ["12", NaN, Infinity, {}, []]) expect(() => validateCustomValue(field, value)).toThrow()
  })
  it("validates real calendar dates without shifting date-only values", () => {
    expect(validDate("2024-02-29")).toBe(true)
    expect(validDate("2026-02-29")).toBe(false)
    expect(validDate("2026-02-31")).toBe(false)
    expect(validateCustomValue({ ...field, tipo: "date" }, "2026-09-04")).toBe("2026-09-04")
    expect(() => validateCustomValue({ ...field, tipo: "date" }, "04/09/2026")).toThrow()
  })
  it("validates selections and preserves lists", () => {
    const select = { ...field, tipo: "select", options: ["A", "B"] }
    expect(validateCustomValue(select, "A")).toBe("A")
    expect(() => validateCustomValue(select, "C")).toThrow()
    expect(validateCustomValue({ ...select, tipo: "multiselect" }, ["A", "A", "B"])).toEqual(["A", "B"])
  })
  it("validates email, lookup and datetime types", () => {
    expect(() => validateCustomValue({ ...field, tipo: "email" }, "invalid")).toThrow()
    expect(() => validateCustomValue({ ...field, tipo: "lookup" }, "Mario")).toThrow()
    expect(validateCustomValue({ ...field, tipo: "datetime" }, "2026-09-04T12:00:00+02:00")).toBe("2026-09-04T10:00:00.000Z")
    expect(() => validateCustomValue({ ...field, tipo: "unknown" }, "x")).toThrow()
  })
})
