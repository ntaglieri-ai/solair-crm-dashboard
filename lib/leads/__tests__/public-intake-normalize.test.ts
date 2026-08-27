import { describe, expect, it } from "vitest"
import { normalizeLeadIntakePayload } from "@/lib/leads/public-intake"

describe("normalizeLeadIntakePayload", () => {
  it("normalizza il payload Facebook Lead Ads passato da Make", () => {
    const payload = normalizeLeadIntakePayload({
      leadgen_id: "123456789",
      form_id: "form-1",
      field_data: [
        { name: "full_name", values: ["Mario Rossi"] },
        { name: "first_name", values: ["Mario"] },
        { name: "last_name", values: ["Rossi"] },
        { name: "phone_number", values: ["+39 333 1234567"] },
        { name: "email", values: ["Mario@Example.test"] },
        { name: "city", values: ["Catania"] },
        { name: "state", values: ["CT"] },
      ],
    })

    expect(payload).toMatchObject({
      origine: "meta_ads",
      nome: "Mario Rossi",
      firstName: "Mario",
      lastName: "Rossi",
      cognome: "Rossi",
      telefono: "+39 333 1234567",
      email: "Mario@Example.test",
      citta: "Catania",
      provincia: "CT",
      socialLeadId: "123456789",
    })
    expect(payload.note).toContain("Leadgen ID: 123456789")
    expect(payload.note).toContain("Form ID: form-1")
  })

  it("riconosce campagna e nome completo anche da campi root snake_case", () => {
    const payload = normalizeLeadIntakePayload({
      origine: "facebook",
      nome: "Raffaele D'aguanno",
      telefono: "+393313627769",
      email: "raffaele.daguanno@libero.it",
      provincia: "Frosinone",
      campaign_name: "Lead FV Lazio",
      lead_id: "meta-lead-42",
    })

    expect(payload).toMatchObject({
      origine: "meta_ads",
      nome: "Raffaele D'aguanno",
      telefono: "+393313627769",
      email: "raffaele.daguanno@libero.it",
      provincia: "Frosinone",
      campaignName: "Lead FV Lazio",
      socialLeadId: "meta-lead-42",
    })
  })

  it("accetta i sinonimi di origine usati negli scenari", () => {
    expect(normalizeLeadIntakePayload({ origine: "facebook" }).origine).toBe("meta_ads")
    expect(normalizeLeadIntakePayload({ origine: "make" }).origine).toBe("meta_ads")
    expect(normalizeLeadIntakePayload({ origine: "sito" }).origine).toBe("configuratore")
  })
})
