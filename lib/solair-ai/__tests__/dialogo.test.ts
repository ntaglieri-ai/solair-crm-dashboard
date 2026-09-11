import { describe, expect, it } from "vitest"

import { entitaDaSelezioneSemplice } from "@/lib/solair-ai/dialogo"

describe("entitaDaSelezioneSemplice", () => {
  it("riconosce quando l'utente sta solo scegliendo il tipo record", () => {
    expect(entitaDaSelezioneSemplice("cliente")).toBe("cliente")
    expect(entitaDaSelezioneSemplice("Clienti")).toBe("cliente")
    expect(entitaDaSelezioneSemplice("un cliente")).toBe("cliente")
    expect(entitaDaSelezioneSemplice("lead")).toBe("lead")
    expect(entitaDaSelezioneSemplice("installatori")).toBe("installatore")
    expect(entitaDaSelezioneSemplice("l'installatore")).toBe("installatore")
  })

  it("non blocca domande reali o messaggi che contengono anche un nome", () => {
    expect(entitaDaSelezioneSemplice("quali clienti hanno il CER?")).toBeNull()
    expect(entitaDaSelezioneSemplice("cliente Mario Rossi")).toBeNull()
    expect(entitaDaSelezioneSemplice("dimmi i lead nuovi")).toBeNull()
  })
})
