// Copertura della traduzione permessi_ui -> snapshot.
//
// Perche' proprio qui: un errore in questa funzione non produce nessun
// sintomo. Non lancia, non logga, non rompe una pagina — allarga o stringe
// l'ambito dati di un ruolo in silenzio. E' esattamente il caso che
// `visibilita_sedi` ha prodotto: spento mappava su "own_sede" mentre il
// default dell'AGENT e' "own", quindi salvare il ruolo dal pannello gli
// allargava l'accesso da "i propri record" a "tutti quelli della sua sede".

import { describe, expect, it } from "vitest"
import { applyUiPermission } from "../load-permissions"
import { buildDefaultPermissionSnapshot } from "../constants"
import type { PermissionSnapshot } from "../types"

function snapshotDi(ruoloCode: "AGENT" | "DIRECTOR" | "ADMIN"): PermissionSnapshot {
  return buildDefaultPermissionSnapshot({ ruoloCode })
}

describe("applyUiPermission — visibilita_sedi", () => {
  it("spento restringe a 'own', non a 'own_sede'", () => {
    const snapshot = snapshotDi("AGENT")
    applyUiPermission(snapshot, { chiave: "visibilita_sedi", abilitato: false })
    for (const scope of Object.values(snapshot.scopes)) expect(scope).toBe("own")
  })

  it("spento non allarga l'ambito di un AGENT", () => {
    // Il default dell'AGENT non e' "own" ma "assigned" (constants.ts, ramo
    // AGENT). I due pero' si comportano allo stesso modo nell'unico posto che
    // legge gli scope, lib/dashboard/scope.ts: entrambi filtrano sulla colonna
    // proprietario. Quindi spegnere l'interruttore lascia l'AGENT dov'era.
    //
    // Prima della correzione usciva "own_sede", che filtra per SEDE e non per
    // proprietario: quello si' allargava, da "i miei record" a "tutti quelli
    // della mia sede".
    const dopo = snapshotDi("AGENT")
    applyUiPermission(dopo, { chiave: "visibilita_sedi", abilitato: false })
    for (const scope of Object.values(dopo.scopes)) {
      expect(scope).not.toBe("own_sede")
      expect(["own", "assigned"]).toContain(scope)
    }
  })

  it("acceso apre a 'all' su tutti i moduli", () => {
    const snapshot = snapshotDi("AGENT")
    applyUiPermission(snapshot, { chiave: "visibilita_sedi", abilitato: true })
    for (const scope of Object.values(snapshot.scopes)) expect(scope).toBe("all")
  })
})

describe("applyUiPermission — altre chiavi", () => {
  it("una chiave 'scope:<risorsa>:<scope>' vale solo per quella risorsa", () => {
    const snapshot = snapshotDi("AGENT")
    applyUiPermission(snapshot, { chiave: "scope:lead:team", abilitato: true })
    expect(snapshot.scopes.lead).toBe("team")
    expect(snapshot.scopes.clienti).not.toBe("team")
  })

  it("una chiave 'field:<modulo>:<campo>' spenta nasconde il campo", () => {
    const snapshot = snapshotDi("AGENT")
    applyUiPermission(snapshot, { chiave: "field:clienti:iban", abilitato: false })
    expect(snapshot.fields.clienti.iban).toBe("hidden")
  })

  it("qualunque altra chiave diventa un'azione", () => {
    const snapshot = snapshotDi("AGENT")
    applyUiPermission(snapshot, { chiave: "widget.bacheca.gestisci", abilitato: true })
    expect(snapshot.actions["widget.bacheca.gestisci"]).toBe(true)
  })
})
