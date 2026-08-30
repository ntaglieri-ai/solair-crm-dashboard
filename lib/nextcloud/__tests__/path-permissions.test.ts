import { describe, expect, it } from "vitest"

import {
  canAccessNcPath,
  canBrowseNcTreePath,
  ncPhysicalSharePath,
  type NcPathRule,
} from "@/lib/nextcloud/path-permissions"

function rule(prefix: string, allowed: string[], priorita = 10): NcPathRule {
  return {
    prefix,
    priorita,
    allowed: new Set(allowed),
    accessByRole: new Map(allowed.map((role) => [role, "editable"])),
  }
}

describe("nextcloud path permissions", () => {
  const rules = [
    rule("Vendita-Digitale/Clienti 2.0/", ["SUPERADMIN", "ADMIN", "DIRECTOR"], 10),
    rule("Vendita-Digitale/LISTINI", ["SUPERADMIN", "ADMIN", "DIRECTOR", "STANDARD", "AGENT"], 20),
    rule("Solair-Agenti/Schede tecniche", ["SUPERADMIN", "ADMIN", "DIRECTOR", "STANDARD", "AGENT"], 30),
  ]

  it("richiede una regola esplicita per rendere visibile un path ad AGENT", () => {
    expect(canAccessNcPath("Vendita-Digitale/LISTINI/prezzi.pdf", "AGENT", rules)).toBe(true)
    expect(canAccessNcPath("Vendita-Digitale/Cartella non censita/file.pdf", "AGENT", rules)).toBe(false)
  })

  it("applica le regole con slash finale anche alla cartella stessa", () => {
    expect(canAccessNcPath("Vendita-Digitale/Clienti 2.0", "AGENT", rules)).toBe(false)
    expect(canAccessNcPath("Vendita-Digitale/Clienti 2.0/documento.pdf", "AGENT", rules)).toBe(false)
  })

  it("lascia navigabili ad AGENT solo i parent che portano a prefissi consentiti", () => {
    expect(canBrowseNcTreePath("Vendita-Digitale", "AGENT", rules)).toBe(true)
    expect(canBrowseNcTreePath("Vendita-Digitale/LISTINI", "AGENT", rules)).toBe(true)
    expect(canBrowseNcTreePath("Vendita-Digitale/Finanziaria", "AGENT", rules)).toBe(false)
  })

  it("valuta allo stesso modo i path relativi e quelli sotto Solair", () => {
    expect(canAccessNcPath("Solair/Vendita-Digitale/LISTINI/prezzi.pdf", "AGENT", rules)).toBe(true)
    expect(canAccessNcPath("Solair/Vendita-Digitale/Cartella non censita/file.pdf", "AGENT", rules)).toBe(false)
  })

  it("converte i prefissi logici nei path fisici condivisi da Nextcloud", () => {
    expect(ncPhysicalSharePath("Vendita-Digitale/LISTINI")).toBe("Solair/Vendita-Digitale/LISTINI")
    expect(ncPhysicalSharePath("Solair/Vendita-Digitale/LISTINI")).toBe("Solair/Vendita-Digitale/LISTINI")
  })
})
