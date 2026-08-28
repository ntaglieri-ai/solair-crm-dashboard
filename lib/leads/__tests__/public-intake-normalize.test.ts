import { describe, expect, it } from "vitest"
import {
  leadDataClickIso,
  leadSourceCreatedAtIso,
  leadPhoneMatchKeys,
  normalizeLeadIntakePayload,
  parseLeadSourceCreatedAt,
} from "@/lib/leads/public-intake"

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
      date_created: "3 agosto 2026 14:09",
    })

    expect(payload).toMatchObject({
      origine: "meta_ads",
      nome: "Raffaele D'aguanno",
      telefono: "+393313627769",
      email: "raffaele.daguanno@libero.it",
      provincia: "Frosinone",
      campaignName: "Lead FV Lazio",
      socialLeadId: "meta-lead-42",
      sourceCreatedAt: "3 agosto 2026 14:09",
      dataClick: "3 agosto 2026 14:09",
    })
  })

  it("legge Data Click dai payload esterni e lo normalizza", () => {
    const payload = normalizeLeadIntakePayload({
      origine: "make",
      nome: "Mario Rossi",
      telefono: "3331234567",
      data_click: "4 agosto 2026 23:35",
    })

    expect(payload.dataClick).toBe("4 agosto 2026 23:35")
    expect(leadDataClickIso(payload as Parameters<typeof leadDataClickIso>[0])).toBe(
      "2026-08-04T21:35:00.000Z",
    )
  })

  it("accetta i sinonimi di origine usati negli scenari", () => {
    expect(normalizeLeadIntakePayload({ origine: "facebook" }).origine).toBe("meta_ads")
    expect(normalizeLeadIntakePayload({ origine: "make" }).origine).toBe("meta_ads")
    expect(normalizeLeadIntakePayload({ origine: "sito" }).origine).toBe("configuratore")
  })

  it("genera chiavi telefono compatibili con vecchi formati Zoho", () => {
    expect(leadPhoneMatchKeys("+39 333 1234567")).toContain("3331234567")
    expect(leadPhoneMatchKeys("00393331234567")).toContain("3331234567")
    expect(leadPhoneMatchKeys("333-123-4567")).toContain("393331234567")
  })

  it("legge la data sorgente Meta in formato italiano di Make", () => {
    expect(parseLeadSourceCreatedAt("3 agosto 2026 14:09")?.toISOString()).toBe(
      "2026-08-03T12:09:00.000Z",
    )
  })

  it("usa la data sorgente Meta come data creazione del lead", () => {
    expect(
      leadSourceCreatedAtIso({
        origine: "meta_ads",
        nome: "Mario Rossi",
        telefono: "3331234567",
        sourceCreatedAt: "4 agosto 2026 23:35",
      }),
    ).toBe("2026-08-04T21:35:00.000Z")

    expect(
      leadSourceCreatedAtIso({
        origine: "meta_ads",
        nome: "Mario Rossi",
        telefono: "3331234567",
      }),
    ).toBeNull()
  })

  it("usa la data sorgente Meta come Data Click quando il campo dedicato manca", () => {
    expect(
      leadDataClickIso({
        origine: "meta_ads",
        nome: "Mario Rossi",
        telefono: "3331234567",
        sourceCreatedAt: "4 agosto 2026 23:35",
      }),
    ).toBe("2026-08-04T21:35:00.000Z")
  })
})
