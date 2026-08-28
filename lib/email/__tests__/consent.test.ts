// Test della risoluzione destinatari con consensi non bloccanti.
//
// I consensi restano dati salvabili e leggibili, ma non devono escludere
// destinatari, generare warning o cambiare il risultato di preview/invio.

import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Doppi dei moduli di I/O -----------------------------------------------
// vi.hoisted e non due `let` a modulo: vitest solleva le vi.mock sopra gli
// import, quindi una factory che leggesse una variabile normale la troverebbe
// ancora in temporal dead zone. Questo oggetto e' invece garantito inizializzato
// prima dei mock, ed e' la manopola che ogni test gira.
const stato = vi.hoisted(() => ({
  /** Righe che la "query" restituisce, riscritte da ogni test. */
  righe: [] as Record<string, unknown>[],
  /** Stato dell'interruttore globale, riscritto da ogni test. */
  enforcementAttivo: true,
}))

/**
 * Client Supabase finto che riproduce la sola catena usata dal codice sotto
 * test: .from(tabella).select(colonne).in("id", ids). Non fa filtri sugli id:
 * i test passano gia' le righe che vogliono vedere tornare.
 */
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ in: async () => ({ data: stato.righe, error: null }) }),
    }),
  }),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ in: async () => ({ data: stato.righe, error: null }) }),
    }),
  }),
}))

// L'audit non e' oggetto di questo test e scriverebbe su un client inesistente.
vi.mock("@/lib/audit/log", () => ({
  logAudit: async () => undefined,
  attoreDaPermessi: () => ({ id: null, nome: null }),
}))

vi.mock("../consent-enforcement", () => ({
  leggiConsensoEnforcement: async () => ({
    attivo: stato.enforcementAttivo,
    errore: null,
  }),
  CHIAVE_CONSENSO_ENFORCEMENT: "consenso_enforcement_attivo",
  CONSENSO_ENFORCEMENT_DEFAULT: true,
  invalidaCacheEnforcement: () => undefined,
  salvaConsensoEnforcement: async () => ({ errore: null }),
}))

import { filtraDestinatariConsenzienti, hasEmailConsent, quantiBloccati } from "../consent"
import { resolveBulkRecipients } from "../bulk-targets"

// --- Dati di prova ---------------------------------------------------------
// Quattro contatti raggiungibili (2 con consenso, 2 senza) e uno senza
// indirizzo, che non deve mai finire tra i destinatari ne' tra i bloccati.
const LEAD_FINTI = [
  { id: "L1", nome: "Anna", cognome: "Rossi", email: "anna@example.test", consenso_contatto_email: true },
  { id: "L2", nome: "Bruno", cognome: "Bianchi", email: "bruno@example.test", consenso_contatto_email: false },
  { id: "L3", nome: "Carla", cognome: "Verdi", email: "carla@example.test", consenso_contatto_email: true },
  { id: "L4", nome: "Dario", cognome: "Neri", email: "dario@example.test", consenso_contatto_email: false },
  { id: "L5", nome: "Elsa", cognome: "Gialli", email: "", consenso_contatto_email: true },
]
const ID_LEAD = LEAD_FINTI.map((r) => r.id)

function snapshotFinto(ruoloCode: "SUPERADMIN" | "AGENT" = "SUPERADMIN") {
  return {
    subject: {
      authUserId: "auth-1",
      userId: "u1",
      email: "test@example.test",
      nome: "Test",
      iniziali: "T",
      ruoloId: null,
      ruoloCode,
      ruoloNome: ruoloCode,
      sede: null,
    },
    pages: {},
    records: {},
    fields: {},
    actions: {},
    scopes: {},
  } as unknown as Parameters<typeof resolveBulkRecipients>[0]["snapshot"]
}

beforeEach(() => {
  stato.righe = LEAD_FINTI
  stato.enforcementAttivo = true
})

// --- Il predicato ----------------------------------------------------------
describe("hasEmailConsent", () => {
  it("accetta solo il booleano true", () => {
    expect(hasEmailConsent({ consenso_contatto_email: true })).toBe(true)
  })

  it("rifiuta tutto il resto, valori mancanti inclusi", () => {
    // Il default sicuro e' bloccare: una colonna assente da una proiezione
    // parziale non deve valere "si".
    for (const valore of [false, null, undefined, "true", 1, {}]) {
      expect(hasEmailConsent({ consenso_contatto_email: valore })).toBe(false)
    }
    expect(hasEmailConsent({})).toBe(false)
  })
})

// --- Invio singolo / ai filtrati -------------------------------------------
describe("filtraDestinatariConsenzienti", () => {
  it("include tutti i contatti con email valida anche senza consenso", async () => {
    stato.enforcementAttivo = true
    const { data, error } = await filtraDestinatariConsenzienti({ entita: "lead", ids: ID_LEAD })

    expect(error).toBeNull()
    expect(data!.enforcementAttivo).toBe(false)
    expect(data!.destinatari.map((d) => d.id)).toEqual(["L1", "L2", "L3", "L4"])
    expect(data!.senzaConsenso).toEqual([])
    expect(data!.esclusiSenzaEmail).toBe(1)
    expect(quantiBloccati(data!)).toBe(0)
  })

  it("non fa passare chi non ha un indirizzo", async () => {
    stato.enforcementAttivo = false
    const { data } = await filtraDestinatariConsenzienti({ entita: "lead", ids: ID_LEAD })
    expect(data!.destinatari.map((d) => d.id)).not.toContain("L5")
    expect(data!.esclusiSenzaEmail).toBe(1)
  })
})

// --- Invio di massa --------------------------------------------------------
describe("resolveBulkRecipients", () => {
  it("include i non consenzienti e non li conta a parte", async () => {
    stato.enforcementAttivo = true
    const { data, error } = await resolveBulkRecipients({
      tipo: "lead",
      recordIds: ID_LEAD,
      snapshot: snapshotFinto(),
    })

    expect(error).toBeNull()
    expect(data!.consensoEnforcementAttivo).toBe(false)
    expect(data!.recipients.map((r) => r.id)).toEqual(["L1", "L2", "L3", "L4"])
    expect(data!.esclusiSenzaConsenso).toBe(0)
    expect(data!.senzaConsenso).toEqual([])
    expect(data!.esclusiSenzaEmail).toBe(1)
  })

  it("l'interruttore storico non cambia il risultato", async () => {
    stato.enforcementAttivo = false
    const { data, error } = await resolveBulkRecipients({
      tipo: "lead",
      recordIds: ID_LEAD,
      snapshot: snapshotFinto(),
    })

    expect(error).toBeNull()
    expect(data!.consensoEnforcementAttivo).toBe(false)
    expect(data!.recipients.map((r) => r.id)).toEqual(["L1", "L2", "L3", "L4"])
    expect(data!.esclusiSenzaConsenso).toBe(0)
    expect(data!.senzaConsenso).toEqual([])
  })

  it("sugli installatori il consenso non si applica, in nessuno dei due stati", async () => {
    stato.righe = [
      { id: "I1", nome: "Alfa Impianti", email: "alfa@example.test", proprietario_id: "u1" },
      { id: "I2", nome: "Beta Impianti", email: "", email_secondaria: "beta@example.test", proprietario_id: "u1" },
    ]

    for (const valore of [true, false]) {
      stato.enforcementAttivo = valore
      const { data } = await resolveBulkRecipients({
        tipo: "installatore",
        recordIds: ["I1", "I2"],
        snapshot: snapshotFinto(),
      })
      expect(data!.recipients.map((r) => r.id)).toEqual(["I1", "I2"])
      expect(data!.esclusiSenzaConsenso).toBe(0)
      expect(data!.senzaConsenso).toEqual([])
    }
  })

  it("il filtro di proprieta' per gli AGENT resta indipendente dal consenso", async () => {
    // L1 consente ma non e' suo, L2 e' suo ma non consente: il consenso non
    // blocca L2, mentre la proprieta' continua a escludere L1.
    stato.righe = [
      { id: "L1", nome: "Anna", email: "anna@example.test", consenso_contatto_email: true, lead_proprietario_id: "altro" },
      { id: "L2", nome: "Bruno", email: "bruno@example.test", consenso_contatto_email: false, lead_proprietario_id: "u1" },
    ]
    stato.enforcementAttivo = true

    const { data } = await resolveBulkRecipients({
      tipo: "lead",
      recordIds: ["L1", "L2"],
      snapshot: snapshotFinto("AGENT"),
    })

    expect(data!.recipients.map((r) => r.id)).toEqual(["L2"])
    expect(data!.esclusiNonProprietari).toBe(1)
    expect(data!.esclusiSenzaConsenso).toBe(0)
  })
})
