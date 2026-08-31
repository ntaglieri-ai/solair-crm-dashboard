import { describe, expect, it } from "vitest"

import { buildUpdatePayload, diffLeadRecord } from "../diff"
import { normalizeLeadCsvRow } from "../mapping"
import { valuesEqual } from "../normalizers"
import type { LeadCrmRecord, NormalizedLead } from "../types"

describe("Zoho sync diff", () => {
  it("normalizza gli ID Zoho con prefisso e li collega al proprietario CRM", () => {
    const normalized = normalizeLeadCsvRow(
      {
        "ID record": "zcrm_667429000000000123",
        "Lead Proprietario.id": "zcrm_667429000000000456",
        "Lead Name": "Mario Rossi",
        "E-mail": "mario@example.test",
      },
      new Map([["667429000000000456", "crm-user-1"]]),
    )

    expect(normalized).toMatchObject({
      zoho_id: "667429000000000123",
      zoho_owner_id: "667429000000000456",
      lead_proprietario_id: "crm-user-1",
      nome_lead: "Mario Rossi",
      email: "mario@example.test",
    })
  })

  it("non segnala differenze sugli ID Zoho quando il CRM li conserva con prefisso", () => {
    const lead = {
      zoho_id: "667429000000000123",
      zoho_owner_id: "667429000000000456",
      lead_proprietario_id: "crm-user-1",
      nome_lead: "Mario Rossi",
    } satisfies NormalizedLead

    const existing = {
      id: "lead-1",
      zoho_id: "zcrm_667429000000000123",
      zoho_synced_at: null,
      zoho_owner_id: "zcrm_667429000000000456",
      lead_proprietario_id: "crm-user-1",
      nome_lead: "Mario Rossi",
    } satisfies LeadCrmRecord

    const result = diffLeadRecord(lead, existing)

    expect(result.action).toBe("skip")
    expect(result.diffs.map((diff) => diff.field)).not.toContain("zoho_owner_id")
  })

  it("non inserisce nel payload i campi vuoti Zoho se il CRM ha gia' un valore", () => {
    const lead = {
      zoho_id: "667429000000000123",
      nome_lead: "Mario Rossi",
      email: null,
      telefono: "+393331234567",
    } satisfies NormalizedLead

    const existing = {
      id: "lead-1",
      zoho_id: "667429000000000123",
      zoho_synced_at: null,
      nome_lead: "Mario Rossi",
      email: "storica@example.test",
      telefono: "+39095123456",
    } satisfies LeadCrmRecord

    const result = diffLeadRecord(lead, existing)
    const payload = buildUpdatePayload(lead, result.diffs)

    expect(result.action).toBe("update")
    expect(result.diffs).toContainEqual(
      expect.objectContaining({
        field: "email",
        writeBlockedReason: "empty_zoho_preserves_crm",
      }),
    )
    expect(payload).toMatchObject({ telefono: "+393331234567" })
    expect(payload).not.toHaveProperty("email")
  })

  it("confronta i timestamp come ora locale italiana quando Zoho esporta senza offset", () => {
    expect(
      valuesEqual("2026-08-31T17:00:00.000Z", "2026-08-31T19:00:00.000Z"),
    ).toBe(true)
  })
})
