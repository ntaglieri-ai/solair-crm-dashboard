import { describe, expect, it } from "vitest"
import { normalizeLeadIntakePayload } from "@/lib/leads/public-intake"

describe("normalizeLeadIntakePayload", () => {
  it("normalizza il payload Facebook Lead Ads passato da Make", () => {
    const payload = normalizeLeadIntakePayload({
      leadgen_id: "123456789",
      form_id: "form-1",
      field_data: [
        { name: "full_name", values: ["Mario Rossi"] },
        { name: "phone_number", values: ["+39 333 1234567"] },
        { name: "email", values: ["Mario@Example.test"] },
        { name: "city", values: ["Catania"] },
        { name: "state", values: ["CT"] },
      ],
    })

    expect(payload).toMatchObject({
      origine: "meta_ads",
      nome: "Mario Rossi",
      telefono: "+39 333 1234567",
      email: "Mario@Example.test",
      citta: "Catania",
      provincia: "CT",
    })
    expect(payload.note).toContain("Leadgen ID: 123456789")
    expect(payload.note).toContain("Form ID: form-1")
  })

  it("accetta i sinonimi di origine usati negli scenari", () => {
    expect(normalizeLeadIntakePayload({ origine: "facebook" }).origine).toBe("meta_ads")
    expect(normalizeLeadIntakePayload({ origine: "make" }).origine).toBe("meta_ads")
    expect(normalizeLeadIntakePayload({ origine: "sito" }).origine).toBe("configuratore")
  })
})
